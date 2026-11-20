import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { seed } from '../src/db/seed.js';
import { loadConfig } from '../src/platform/config.js';
import { dockerAvailable, startPg } from './helpers/pg.js';

describe.skipIf(!(await dockerAvailable()))('direct Anthropic migration', () => {
  it('moves legacy configurations once and keeps old snapshots readable', async () => {
    const pg = await startPg();
    try {
      const { workspaceId, userId } = await seed(pg.handle.db);
      const { sql } = pg.handle;
      const legacy = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        system_prompt: 'Review the diff.',
        strategy: 'single-pass',
        ci_fail_on: 'critical',
        repo_intel: true,
        skills: [],
      };
      const replacement = { provider: 'openai', model: 'gpt-6.2-sol' };
      const [agent] = await sql<{ id: string }[]>`
        INSERT INTO agents (workspace_id, name, provider, model, system_prompt, enabled)
        VALUES (${workspaceId}, 'Legacy Reviewer', ${legacy.provider}, ${legacy.model}, ${legacy.system_prompt}, false)
        RETURNING id
      `;
      const [skill] = await sql<{ id: string }[]>`
        INSERT INTO skills (workspace_id, name, description, type, source, body)
        VALUES (${workspaceId}, 'Review rules', '', 'rubric', 'manual', 'Check regressions.')
        RETURNING id
      `;
      const agentId = agent!.id;
      const skillId = skill!.id;
      await sql`INSERT INTO agent_versions (agent_id, version, config_json)
        VALUES (${agentId}, 1, ${JSON.stringify(legacy)}::jsonb)`;
      await sql`INSERT INTO agent_skills (agent_id, skill_id, "order") VALUES (${agentId}, ${skillId}, 0)`;
      const openRouterClaude = { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.6' };
      await sql`INSERT INTO settings (workspace_id, user_id, key, value)
        VALUES (${workspaceId}, ${userId}, 'feature_models', ${JSON.stringify({
          risk_brief: { provider: legacy.provider, model: legacy.model },
          review_intent: openRouterClaude,
        })}::jsonb)`;
      const [oldReview] = await sql<{ id: string; pr_id: string }[]>`
        UPDATE reviews SET model = ${legacy.model}
        WHERE workspace_id = ${workspaceId}
        RETURNING id, pr_id
      `;

      const migration = readFileSync(
        new URL('../src/db/migrations/0010_remove-direct-anthropic.sql', import.meta.url),
        'utf8',
      );
      for (let run = 0; run < 2; run++) {
        await sql.begin(async (tx) => {
          for (const statement of migration.split('--> statement-breakpoint')) {
            await tx.unsafe(statement);
          }
        });
      }

      const app = await buildApp({ config: loadConfig({ NODE_ENV: 'test' }), db: pg.handle.db });
      try {
        const response = await app.inject({ url: `/agents/${agentId}` });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ ...replacement, enabled: false, version: 2 });

        const versions = await app.inject({ url: `/agents/${agentId}/versions` });
        expect(versions.statusCode).toBe(200);
        expect(versions.json()).toMatchObject([
          { version: 2, config: { ...legacy, ...replacement, skills: [skillId] } },
          { version: 1, config: legacy },
        ]);

        const settings = await app.inject({ url: '/settings' });
        expect(settings.json().feature_models).toMatchObject({
          risk_brief: replacement,
          review_intent: openRouterClaude,
        });
        const all = await app.inject({ url: '/agents' });
        expect(all.json()).toContainEqual(expect.objectContaining({
          name: 'General Reviewer', provider: 'openrouter', model: 'deepseek/deepseek-v4-flash', version: 1,
        }));
        const reviews = await app.inject({ url: `/pulls/${oldReview!.pr_id}/reviews` });
        expect(reviews.json()).toContainEqual(
          expect.objectContaining({ id: oldReview!.id, model: legacy.model }),
        );
        const retired = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: { name: 'Retired provider', provider: legacy.provider, model: legacy.model, system_prompt: legacy.system_prompt },
        });
        expect(retired.statusCode).toBe(422);
      } finally {
        await app.close();
      }
    } finally {
      await pg.stop();
    }
  }, 60_000);
});
