# Engineering Insights

## What Works

- 2026-11-22 — For a Cost preview on an installation seeded before pricing, migrate the local database and use a separate freshly migrated and seeded database for the preview. `server/src/db/seed.ts` (`seedDemoReviewRuns`) creates the priced runs when the demo PR is first inserted. Running the seed again on a migrated installation with the old demo PR leaves its historical amounts unknown. Verified that the migrated local database had the new columns and no recorded amounts, while the fresh preview returned `$0.0613` for PR #482 and `$0.0013` for the Security Reviewer trace.

- 2026-11-22 — After adding `GITHUB_TOKEN` to `server/.env`, restart the API and check `GET /settings/secrets-status` before retrying PR import. The running `tsx watch` process did not pick up the `.env` edit. Touching `server/src/server.ts` triggered a restart through the existing watcher, after which the connection test passed and the detail request returned 229 files and 13 commits. Evidence: `server/src/platform/config.ts` (`dotenv/config`), `server/src/adapters/secrets/local.ts` (`LocalSecretsProvider.get`), and the before-and-after local API responses.

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — When aggregating runs for one review command, persist membership at launch. `server/src/modules/reviews/service.ts` (`runReview`) creates independent agent run rows before starting the executor, and `server/src/db/schema/runs.ts` (`agentRuns`, `multiAgentRuns`) has no link between those rows and the existing group table. A PR ID or nearby run timestamps cannot reliably identify one command when multiple commands overlap.
- 2026-11-22 — Review Cost now writes the shared group ID at launch. When deciding whether a group is ready to price, use `settledAt` on its members. A cancellation request sets `status = cancelled` before the outstanding model call can return its price, and `RunBus.complete` clears the cancellation flag. Keep stream completion in the executor and include cancelled-but-unsettled rows in startup recovery. Evidence: `server/src/modules/reviews/repository/run.repo.ts` (`createReviewRuns`, `reapStaleRunningRuns`), `server/src/platform/sse.ts` (`complete`), and the in-flight cancellation case in `server/test/reviews.it.test.ts`.

- 2026-11-22 — For a multi-agent command, read each agent's verdict before interpreting the PR list score. `GET /repos/:id/pulls` takes the score from the newest persisted review by `reviews.createdAt`, while `latestReviewCosts` prices the command group. In a local three-agent run the list showed 100 even though another agent from the same command returned `request_changes` with 53. Evidence: `server/src/modules/pulls/routes.ts` (`latestReviewByPr`), `server/src/modules/pulls/review-cost.ts` (`latestReviewCosts`), and live responses from `GET /repos/:id/pulls` and `GET /pulls/:id/reviews`.

## Tool & Library Notes

- 2026-11-22 — When a reviewer flags an optional `and()` condition as invalid SQL, compile the query with `.toSQL()` on the installed Drizzle version. Drizzle 0.45.4 omits `undefined` and retains the other predicates. Verified that `completeAgentRun` can omit the running-status predicate for failed and cancelled runs while preserving the run ID and `settled_at IS NULL` checks. Evidence: `server/src/modules/reviews/repository/run.repo.ts` (`completeAgentRun`) and the compiled PostgreSQL update.
- 2026-11-22 — When stopping a local DevDigest stack, check container names as well as Compose membership. `docker ps --filter name=devdigest` found a standalone Cost preview database still listening on port 5433 after its web and API processes had exited. The main database uses the named `devdigest_pgdata` volume, while the preview container was configured for automatic removal. Evidence: local Docker inspection and `docker-compose.yml` (the `postgres` service).

## Recurring Errors & Fixes

- 2026-11-22 — When a newly added repository shows zero PRs despite open PRs on GitHub, compare `GET /repos/:id/pulls` with GitHub and check `GET /settings/secrets-status`. Cloning and PR import are independent, and an import failure can return HTTP 200 with an empty local list. Use `Container.githubForPullReads` to allow public PR reads without a token and preserve authenticated access when configured. Evidence: `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`) and the tokenless import regression in `server/test/integration.it.test.ts`.

- 2026-11-22 — If an interrupted review has a terminal status but its trace returns 404 after a write error, retry the transaction that saves both before falling back to status-only completion. Saving the status alone sets `settledAt`, which prevents the guarded completion path from writing that run again. A single failed trace write now recovers the original error log and known cost. Evidence: `server/src/modules/reviews/run-executor.ts` (`finishInterruptedRun`), `server/src/modules/reviews/repository/run.repo.ts` (`completeAgentRun`), and the transient trace write failure case in `server/test/reviews.it.test.ts`.

- 2026-11-22 — If a rerun repeats findings after a push, compare the new PR head with the local clone refs and cached patch content. The PR list advances `headSha` independently of the PR detail cache, and `loadDiff` silently falls back to cached `pr_files` when the git refs are unavailable. A completed run reviewed 55 cached patches while GitHub reported 67 changed files and the cached patches lacked the newly pushed trace-retry change. Evidence: `server/src/modules/pulls/routes.ts` (PR list upsert and detail refresh), `server/src/modules/reviews/diff-loader.ts` (`loadDiff`), and the local run trace and database rows.

- 2026-11-22 — The stale review fallback above is fixed in `server/src/modules/reviews/diff-loader.ts` (`loadDiff`). Verify the requested head and base when falling back from Git to live GitHub, and compare the paginated file list length with GitHub's changed-file count before parsing patches. A file entry may lack a textual patch, so the parsed diff count alone does not prove it is stale. The live PR returned 59 patch-bearing files with the trace-retry change at the expected SHA. Evidence: `server/src/adapters/github/octokit.ts` (`getPullRequest`) and the regression cases in `server/test/adapters.test.ts` and `server/test/reviews.it.test.ts`.

- 2026-11-22 — When a known PR loads slowly and then shows zero files, check GitHub's `x-ratelimit-remaining` and `x-ratelimit-reset` alongside the local API log. With no GitHub token and the anonymous quota exhausted, the list waited 60 seconds for sequential sync and stats backfill timeouts. The detail request has its own 30-second timeout and serves persisted files and commits as HTTP 200 when refresh fails, so a PR with only metadata cached can appear empty. Evidence: local API response showed zero files for a PR with 229 changed files on GitHub, the log reported `Request quota exhausted`, and `server/src/modules/pulls/routes.ts` (list backfill and detail fallback) uses `server/src/adapters/github/octokit.ts` (`TIMEOUT`).

## Session Notes

## Open Questions
