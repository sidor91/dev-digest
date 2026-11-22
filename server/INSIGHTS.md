# Engineering Insights

## What Works

- 2026-11-22 — For a Cost preview on an installation seeded before pricing, migrate the local database and use a separate freshly migrated and seeded database for the preview. `server/src/db/seed.ts` (`seedDemoReviewRuns`) creates the priced runs when the demo PR is first inserted. Running the seed again on a migrated installation with the old demo PR leaves its historical amounts unknown. Verified that the migrated local database had the new columns and no recorded amounts, while the fresh preview returned `$0.0613` for PR #482 and `$0.0013` for the Security Reviewer trace.

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — When aggregating runs for one review command, persist membership at launch. `server/src/modules/reviews/service.ts` (`runReview`) creates independent agent run rows before starting the executor, and `server/src/db/schema/runs.ts` (`agentRuns`, `multiAgentRuns`) has no link between those rows and the existing group table. A PR ID or nearby run timestamps cannot reliably identify one command when multiple commands overlap.
- 2026-11-22 — Review Cost now writes the shared group ID at launch. When deciding whether a group is ready to price, use `settledAt` on its members. A cancellation request sets `status = cancelled` before the outstanding model call can return its price, and `RunBus.complete` clears the cancellation flag. Keep stream completion in the executor and include cancelled-but-unsettled rows in startup recovery. Evidence: `server/src/modules/reviews/repository/run.repo.ts` (`createReviewRuns`, `reapStaleRunningRuns`), `server/src/platform/sse.ts` (`complete`), and the in-flight cancellation case in `server/test/reviews.it.test.ts`.

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-11-22 — When a newly added repository shows zero PRs despite open PRs on GitHub, compare `GET /repos/:id/pulls` with GitHub and check `GET /settings/secrets-status`. Cloning and PR import are independent, and an import failure can return HTTP 200 with an empty local list. Use `Container.githubForPullReads` to allow public PR reads without a token and preserve authenticated access when configured. Evidence: `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`) and the tokenless import regression in `server/test/integration.it.test.ts`.

## Session Notes

## Open Questions
