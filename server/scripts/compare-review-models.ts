import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { gateTriggered, OpenRouterProvider, reviewPullRequest } from '@devdigest/reviewer-core';
import { parseUnifiedDiff } from '../src/adapters/git/diff-parser.js';
import { OpenAIProvider } from '../src/adapters/llm/openai.js';
import { LocalSecretsProvider } from '../src/adapters/secrets/local.js';
import { GENERAL_REVIEWER_PROMPT } from '../src/db/seed-prompts.js';

const fixtures = [
  {
    id: 'receipt-label-clean',
    expectedDefects: [],
    path: 'src/receipt.ts',
    changes: [
      ' export function receiptLabel(id: string): string {',
      '-  return "Receipt #" + id;',
      '+  return `Receipt #${id}`;',
      ' }',
    ],
  },
  {
    id: 'refund-balance-regression',
    expectedDefects: [{
      line: 2,
      severity: 'CRITICAL',
      description: 'A positive refund subtracts from the customer balance instead of crediting it.',
    }],
    path: 'src/refund.ts',
    changes: [
      ' export function balanceAfterRefund(balance: number, refundAmount: number): number {',
      '-  return balance + refundAmount;',
      '+  return balance - refundAmount;',
      ' }',
    ],
  },
  {
    id: 'reservation-cleanup-regression',
    expectedDefects: [{
      line: 2,
      severity: 'CRITICAL',
      description: 'Cleanup keeps expired reservations and drops active reservations.',
    }],
    path: 'src/reservations.ts',
    changes: [
      ' export function keepActive(reservations: Array<{ expiresAt: number }>, now: number) {',
      '-  return reservations.filter((reservation) => reservation.expiresAt > now);',
      '+  return reservations.filter((reservation) => reservation.expiresAt <= now);',
      ' }',
    ],
  },
].map(({ path, changes, ...fixture }) => {
  const oldLines = changes.filter((line) => !line.startsWith('+')).length;
  const newLines = changes.filter((line) => !line.startsWith('-')).length;
  return {
    ...fixture,
    path,
    diff: parseUnifiedDiff([
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      `@@ -1,${oldLines} +1,${newLines} @@`,
      ...changes,
    ].join('\n')),
  };
});

if (process.argv.includes('--fixtures-only')) {
  process.stdout.write(`${JSON.stringify(fixtures, null, 2)}\n`);
} else {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const secrets = new LocalSecretsProvider(join(homedir(), '.devdigest', 'secrets.json'));
  const [openaiKey, openRouterKey] = await Promise.all([
    secrets.get('OPENAI_API_KEY'),
    secrets.get('OPENROUTER_API_KEY'),
  ]);
  if (!openaiKey || !openRouterKey) {
    console.error('Comparison requires both OPENAI_API_KEY and OPENROUTER_API_KEY.');
    process.exit(1);
  }

  const openai = new OpenAIProvider(openaiKey);
  const openrouter = new OpenRouterProvider(openRouterKey);
  const models = [
    { model: 'gpt-6.2-sol', llm: openai },
    { model: 'deepseek/deepseek-v4-flash', llm: openrouter },
    { model: 'anthropic/claude-sonnet-4.6', llm: openrouter },
  ];

  for (const fixture of fixtures) {
    for (const { model, llm } of models) {
      const trial = { fixture: fixture.id, model, provider: llm.id, expectedDefects: fixture.expectedDefects };
      const start = performance.now();
      try {
        const outcome = await reviewPullRequest({
          model,
          llm,
          systemPrompt: GENERAL_REVIEWER_PROMPT,
          diff: fixture.diff,
          strategy: 'single-pass',
          maxRetries: 0,
        });
        const blocksMerge = gateTriggered(outcome.review.findings, 'critical');
        console.log(JSON.stringify({
          ...trial,
          validStructuredOutput: true,
          durationMs: Math.round(performance.now() - start),
          tokensIn: outcome.tokensIn,
          tokensOut: outcome.tokensOut,
          costUsd: outcome.costUsd,
          blocksMerge,
          falseBlockOnCleanDiff: fixture.expectedDefects.length === 0 && blocksMerge,
          findings: outcome.review.findings,
          dropped: outcome.dropped,
        }));
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error))
          .replaceAll(openaiKey, '[redacted]')
          .replaceAll(openRouterKey, '[redacted]');
        console.log(JSON.stringify({
          ...trial,
          validStructuredOutput: false,
          durationMs: Math.round(performance.now() - start),
          error: message,
        }));
        process.exitCode = 1;
      }
    }
  }
}
