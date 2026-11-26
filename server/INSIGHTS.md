# Server insights

Record verified lessons from server work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-26 — The local PR executor discards the cost returned by the reviewer engine, and migration `0009_complex_runaways.sql` dropped the historical `agent_runs.cost_usd` column. Reuse the engine result when storing cost for new runs and keep legacy run costs unknown unless an independent historical source is available. Evidence: `server/src/modules/reviews/run-executor.ts` (review outcome and run write), `server/src/db/migrations/0009_complex_runaways.sql`, and `reviewer-core/src/review/run.ts` (`ReviewRunResult.costUsd`).
- 2026-11-26 — Migration `0010_pr_review_cost.sql` restores nullable cost storage for new runs. A timeline delete moves the run's cost contribution into `deleted_run_costs` under a row lock and deletes the run in the same transaction. Read both tables in one grouped query so a concurrent delete preserves the subtotal and its coverage flags. Evidence: `server/src/modules/reviews/repository/run.repo.ts` (`deleteAgentRun`), `server/src/modules/pulls/review-costs.ts`, and `server/test/reviews.it.test.ts` (tracked spend after concurrent deletion).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
