# Server insights

Record verified lessons from server work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-26 — The local PR executor discards the cost returned by the reviewer engine, and migration `0009_complex_runaways.sql` dropped the historical `agent_runs.cost_usd` column. Reuse the engine result when storing cost for new runs and keep legacy run costs unknown unless an independent historical source is available. Evidence: `server/src/modules/reviews/run-executor.ts` (review outcome and run write), `server/src/db/migrations/0009_complex_runaways.sql`, and `reviewer-core/src/review/run.ts` (`ReviewRunResult.costUsd`).
- 2026-11-26 — Migration `0010_pr_review_cost.sql` restores nullable cost storage for new runs. A timeline delete moves the run's cost contribution into `deleted_run_costs` under a row lock and deletes the run in the same transaction. Read both tables in one grouped query so a concurrent delete preserves the subtotal and its coverage flags. Evidence: `server/src/modules/reviews/repository/run.repo.ts` (`deleteAgentRun`), `server/src/modules/pulls/review-costs.ts`, and `server/test/reviews.it.test.ts` (tracked spend after concurrent deletion).

## Tool & Library Notes

- 2026-11-26 — The Codex local test environment can supply multiple `GIT_CONFIG_KEY_n` and `GIT_CONFIG_VALUE_n` pairs. `gitAt` allows the count and slot 0 through simple-git, so a subprocess with a larger inherited count fails before reading `origin` with `missing config key GIT_CONFIG_KEY_1`. `scrubRemote` catches the read error and leaves the fixture URL in place. A temporary Git repo confirmed that the same local read and rewrite work with an explicit subprocess environment. Evidence: `server/src/adapters/git/simple-git.ts` (`gitAt`, `scrubRemote`) and `npm test -- test/git-adapter-safety.test.ts -t 'scrubs a PAT'` from `server/`.
- 2026-11-26 — Follow-up to the Codex environment finding above. Apply the explicit environment in `gitAt` so local commands and tokenless fetches share it. The regression test supplies two benign Git config entries and fetches from a local fixture after rewriting `origin`. The test failed with `missing config key GIT_CONFIG_KEY_1` before the fix and passed afterward. Evidence: `server/src/adapters/git/simple-git.ts` (`gitAt`) and `server/test/git-adapter-safety.test.ts` (`scrubs a PAT`).

## Recurring Errors & Fixes

## Session Notes

## Open Questions
