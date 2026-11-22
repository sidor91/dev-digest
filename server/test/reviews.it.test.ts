import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { ReviewRepository } from '../src/modules/reviews/repository.js';
import { MockLLMProvider, MockEmbedder, MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { PrMeta, Review, RunSummary } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/**
 * A unified diff touching src/config.ts (line 11 added) so grounding can keep a
 * finding on line 11 and drop one on line 999 / a non-existent file.
 */
const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

/** A Review fixture: one valid finding (line 11), one hallucinated (line 999). */
const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 42,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      suggestion: 'Move the key to an environment variable.',
      confidence: 0.95,
      kind: 'finding',
    },
    {
      id: 'f-halluc',
      severity: 'WARNING',
      category: 'bug',
      title: 'Phantom finding on a line not in the diff',
      file: 'src/config.ts',
      start_line: 999,
      end_line: 999,
      rationale: 'This line does not exist in the diff.',
      confidence: 0.5,
      kind: 'finding',
    },
  ],
};

let repoSeq = 0;
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `payments-api-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 482,
      title: 'Add rate limiting',
      author: 'marisa.koch',
      branch: 'feat/rl',
      base: 'main',
      headSha: 'a1b2c3d4',
      additions: 1,
      deletions: 0,
      filesCount: 1,
      status: 'needs_review',
      body: 'Add rate limiting. Closes #471.',
    })
    .returning();
  // persist the patch so the reviewer can reconstruct a diff (MockGit also returns one)
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  return { repo: repo!, pr: pr! };
}

d('A2 reviews + agents (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(
    structured: unknown,
    provider: 'openai' | 'openrouter' = 'openai',
    llm = new MockLLMProvider(provider, { structured }),
  ) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        github: new MockGitHubClient({ pulls: [] }),
        llm: {
          openai: provider === 'openai' ? llm : new MockLLMProvider('openai', { structured }),
          openrouter: provider === 'openrouter' ? llm : new MockLLMProvider('openrouter', { structured }),
        },
      },
    });
  }

  it('agents CRUD', async () => {
    const app = await appWith(REVIEW_FIXTURE);

    const created = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: 'Test Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'You are a reviewer.',
      },
    });
    expect(created.statusCode).toBe(201);
    const agent = created.json();
    expect(agent.version).toBe(1);

    const list = (await app.inject({ method: 'GET', url: '/agents' })).json();
    expect(list.some((a: { id: string }) => a.id === agent.id)).toBe(true);

    // a config change bumps version
    const updated = (
      await app.inject({
        method: 'PUT',
        url: `/agents/${agent.id}`,
        payload: { system_prompt: 'Updated prompt.' },
      })
    ).json();
    expect(updated.version).toBe(2);

    await app.close();
  });

  it('runs a review: map-reduce + grounding drops the hallucinated finding, keeps the valid one', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Sec', provider: 'openai', model: 'gpt-4.1', system_prompt: 'sec' },
      })
    ).json();

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runs).toHaveLength(1);

    // runReview is fire-and-forget: wait for the background run, then read the
    // persisted reviews (the POST returns runIds, not the reviews themselves).
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews).toHaveLength(1);

    const review = reviews[0];
    expect(review.verdict).toBe('request_changes');
    // Score is derived from the GROUNDED findings, not the model's self-reported
    // 42: grounding keeps one CRITICAL (line 11) ⇒ 100 − 35 = 65.
    expect(review.score).toBe(65);
    // grounding kept only the valid finding (line 11), dropped the line-999 one
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].file).toBe('src/config.ts');
    expect(review.findings[0].start_line).toBe(11);

    // a run_traces document was written (single doc)
    const runId = body.runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.config.model).toBe('gpt-4.1');
    expect(trace.stats.grounding).toBe('1/2 passed');
    expect(trace.stats.cost_usd).toBe(0.001);
    expect(trace.log.length).toBeGreaterThan(0);

    // agent_runs row populated for A5 to aggregate
    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    expect(run!.status).toBe('done');
    expect(run!.findingsCount).toBe(1);
    expect(run!.grounding).toBe('1/2 passed');
    expect(run!.costUsd).toBe(0.001);
    expect(run!.multiAgentRunId).not.toBeNull();

    await app.inject({ method: 'DELETE', url: `/reviews/${review.id}` });
    const traceAfterReviewDeletion = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    expect(traceAfterReviewDeletion.json().stats.cost_usd).toBe(0.001);

    await app.close();
  });

  it('tracks one Run all command and prices the latest settled group within its PR', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const db = pg.handle.db;
    try {
      const { repo, pr } = await setupRepoAndPr(db, workspaceId);
      const { repo: otherRepo, pr: otherPr } = await setupRepoAndPr(db, workspaceId);
      const response = await app.inject({
        method: 'POST', url: `/pulls/${pr.id}/review`, payload: { all: true },
      });
      expect(response.statusCode).toBe(200);
      const { runs } = response.json<{ runs: { run_id: string }[] }>();
      expect(runs.length).toBeGreaterThan(1);
      const members = await waitForPrRuns(db, pr.id, { expected: runs.length });
      expect(members.map((run) => run.id).sort()).toEqual(runs.map((run) => run.run_id).sort());
      expect(new Set(members.map((run) => run.multiAgentRunId)).size).toBe(1);
      expect(members[0]!.multiAgentRunId).not.toBeNull();
      expect(members.every((run) => run.settledAt != null)).toBe(true);

      async function createGroup(prId: string, day: number) {
        const [group] = await db.insert(t.multiAgentRuns).values({
          workspaceId, prId, ranAt: new Date(Date.UTC(2099, 0, day)),
        }).returning();
        return group!.id;
      }
      const older = await createGroup(pr.id, 1);
      const latest = await createGroup(pr.id, 2);
      const active = await createGroup(pr.id, 3);
      const separate = await createGroup(otherPr.id, 4);
      const settledAt = new Date();
      const [general, security, unknown, running] = await db.insert(t.agentRuns).values([
        { workspaceId, prId: pr.id, multiAgentRunId: latest, status: 'done', settledAt, costUsd: 0.06 },
        { workspaceId, prId: pr.id, multiAgentRunId: latest, status: 'done', settledAt, costUsd: 0.0013 },
        { workspaceId, prId: pr.id, multiAgentRunId: older, status: 'done', settledAt, costUsd: 12 },
        { workspaceId, prId: pr.id, multiAgentRunId: active, status: 'cancelled' },
        { workspaceId, prId: otherPr.id, multiAgentRunId: separate, status: 'done', settledAt, costUsd: 99 },
      ]).returning();

      async function cost(repoId = repo.id, prId = pr.id) {
        const result = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
        expect(result.statusCode).toBe(200);
        return result.json<PrMeta[]>().find((row) => row.id === prId)!;
      }

      expect((await cost()).review_cost_usd).toBeCloseTo(0.0613);
      expect((await cost()).review_cost_is_partial).toBe(false);
      expect((await cost(otherRepo.id, otherPr.id)).review_cost_usd).toBe(99);
      expect((await app.inject({ method: 'DELETE', url: `/runs/${running!.id}` })).json()).toEqual({ ok: false });

      // Finishing a previously started command later cannot replace a newer one.
      await db.update(t.agentRuns).set({ settledAt: new Date() }).where(eq(t.agentRuns.id, unknown!.id));
      await db.update(t.agentRuns).set({ costUsd: null }).where(eq(t.agentRuns.id, general!.id));
      expect(await cost()).toMatchObject({ review_cost_usd: 0.0013, review_cost_is_partial: true });

      await app.inject({ method: 'DELETE', url: `/runs/${general!.id}` });
      expect(await cost()).toMatchObject({ review_cost_usd: 0.0013, review_cost_is_partial: false });

      // A newer settled command with no known price wins over the previous price.
      await new ReviewRepository(db).reapStaleRunningRuns();
      const [recovered] = await db.select().from(t.agentRuns).where(eq(t.agentRuns.id, running!.id));
      expect(recovered).toMatchObject({ status: 'cancelled', settledAt: expect.any(Date) });
      expect(await cost()).toMatchObject({ review_cost_usd: null, review_cost_is_partial: false });
      await db.update(t.agentRuns).set({ costUsd: 0 }).where(eq(t.agentRuns.id, running!.id));
      expect(await cost()).toMatchObject({ review_cost_usd: 0, review_cost_is_partial: false });

      await app.inject({ method: 'DELETE', url: `/runs/${running!.id}` });
      expect((await cost()).review_cost_usd).toBe(security!.costUsd);
    } finally {
      await app.close();
    }
  });

  it.each([
    { scenario: 'recording the interruption', traceWriteFailures: 0, expectedTraceStatus: 200 },
    { scenario: 'recovering from a transient trace write failure', traceWriteFailures: 1, expectedTraceStatus: 200 },
    { scenario: 'settling after repeated trace write failures', traceWriteFailures: 2, expectedTraceStatus: 404 },
  ])('keeps the review cost when $scenario', async ({ traceWriteFailures, expectedTraceStatus }) => {
    const app = await appWith(REVIEW_FIXTURE);
    const write = vi.spyOn(ReviewRepository.prototype, 'insertReview').mockRejectedValueOnce(new Error('write failed'));
    const writeTrace = vi.spyOn(ReviewRepository.prototype, 'saveRunTrace');
    for (let attempt = 0; attempt < traceWriteFailures; attempt++) {
      writeTrace.mockRejectedValueOnce(new Error('trace write failed'));
    }
    try {
      const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
      const agent = (await app.inject({
        method: 'POST', url: '/agents',
        payload: { name: `Paid Reviewer ${traceWriteFailures}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review' },
      })).json<{ id: string }>();
      const response = await app.inject({
        method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id },
      });
      expect(response.statusCode).toBe(200);
      const [run] = await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
      expect(run).toMatchObject({ status: 'failed', costUsd: 0.001, error: 'write failed' });
      const trace = await app.inject({ method: 'GET', url: `/runs/${run!.id}/trace` });
      expect(trace.statusCode).toBe(expectedTraceStatus);
      if (expectedTraceStatus === 200) {
        expect(trace.json()).toMatchObject({
          stats: { cost_usd: 0.001 },
          log: expect.arrayContaining([expect.objectContaining({ kind: 'error', msg: 'Run failed: write failed' })]),
        });
      }
    } finally {
      write.mockRestore();
      writeTrace.mockRestore();
      await app.close();
    }
  });

  it('settles a cancelled model call with its returned price and a workspace-scoped trace', async () => {
    const llm = new MockLLMProvider('openai', { structured: REVIEW_FIXTURE });
    const complete = llm.completeStructured.bind(llm);
    let signalStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    llm.completeStructured = async (req) => {
      signalStarted();
      await held;
      return complete(req);
    };
    const app = await appWith(REVIEW_FIXTURE, 'openai', llm);
    const db = pg.handle.db;
    try {
      const { repo, pr } = await setupRepoAndPr(db, workspaceId);
      const agent = (await app.inject({
        method: 'POST', url: '/agents',
        payload: { name: 'Cancellable Reviewer', provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review' },
      })).json<{ id: string }>();
      const result = (await app.inject({
        method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id },
      })).json<{ runs: { run_id: string }[] }>();
      const runId = result.runs[0]!.run_id;
      await started;
      await app.inject({ method: 'POST', url: `/runs/${runId}/cancel` });
      async function summary() {
        const runs = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json<RunSummary[]>();
        return runs.find((run) => run.run_id === runId);
      }

      expect(await summary()).toMatchObject({ status: 'cancelled', cost_pending: true, cost_usd: null });
      release();
      await vi.waitFor(async () => {
        expect(await summary()).toMatchObject({ status: 'cancelled', cost_pending: false, cost_usd: 0.001 });
      });
      const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
      expect(trace.stats.cost_usd).toBe(0.001);
      const prCosts = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json<PrMeta[]>();
      expect(prCosts.find((row) => row.id === pr.id)?.review_cost_usd).toBe(0.001);
      expect((await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })).json()).toEqual([]);

      const [foreignWorkspace] = await db.insert(t.workspaces).values({ name: 'foreign-trace' }).returning();
      const [foreignRun] = await db.insert(t.agentRuns).values({
        workspaceId: foreignWorkspace!.id, status: 'done', costUsd: 7,
      }).returning();
      await db.insert(t.runTraces).values({ runId: foreignRun!.id, trace });
      expect((await app.inject({ method: 'GET', url: `/runs/${foreignRun!.id}/trace` })).statusCode).toBe(404);
    } finally {
      release();
      await app.close();
    }
  });

  it('dual-provider structured output: Claude via OpenRouter returns the same Review shape', async () => {
    const app = await appWith(REVIEW_FIXTURE, 'openrouter');
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Claude Rev', provider: 'openrouter', model: 'anthropic/claude-sonnet-4.6', system_prompt: 'rev' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews[0].findings).toHaveLength(1);
    expect(reviews[0].model).toBe('anthropic/claude-sonnet-4.6');
    await app.close();
  });

  it('finding actions: accept, dismiss', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'ActAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    const findingId = reviews[0].findings[0].id;

    const accepted = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/accept` })
    ).json();
    expect(accepted.finding.accepted_at).not.toBeNull();

    const dismissed = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/dismiss` })
    ).json();
    expect(dismissed.finding.dismissed_at).not.toBeNull();
    expect(dismissed.finding.accepted_at).toBeNull();

    await app.close();
  });

  it('SSE: /runs/:id/events streams events and completes', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'SseAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    // The run is synchronous; events are buffered on the bus. Subscribing after
    // the run still replays the buffer (replay-first semantics), then completes.
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId = body.runs[0].run_id;

    const sse = await app.inject({ method: 'GET', url: `/runs/${runId}/events` });
    expect(sse.statusCode).toBe(200);
    expect(sse.headers['content-type']).toContain('text/event-stream');
    // The replay buffer should contain our log lines as SSE `data:` frames.
    expect(sse.payload).toContain('Starting review');
    expect(sse.payload).toContain('Citation grounding');
    await app.close();
  });

  it('run all enabled agents reviews with each enabled agent', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { all: true } })
    ).json();
    // seed has 2 enabled agents; we may have created more above in this PR's ws.
    expect(body.runs.length).toBeGreaterThanOrEqual(2);
    await app.close();
  });
});
