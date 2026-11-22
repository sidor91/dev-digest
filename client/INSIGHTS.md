# Engineering Insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — When the PR list depends on run results, explicitly refresh `['pulls', repoId]` after finalization and deletion. The detail page's `onRunDone` refreshes active runs, history and reviews, and `useDeleteRun` refreshes history and reviews. `usePulls` has its own cache and 60-second refresh interval, so the list can lag the detail view. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` (`onRunDone`), `client/src/lib/hooks/reviews.ts` (`useDeleteRun`), and `client/src/lib/hooks/core.ts` (`usePulls`).
- 2026-11-22 — For late run data, keep polling an already-cancelled row while `cost_pending` is true. A cancellation can become visible before the trace exists and the live widget is limited to active runs. In `client/src/lib/hooks/reviews.ts` (`usePrRuns`), the first settled history response now invalidates the list and the affected trace even when a run starts and settles between polls.

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-11-22 — A running Next.js dev process can still hold port 3000 while returning HTTP 500 after its local dependencies disappear. If the log reports a missing `next/dist/compiled/jest-worker/processChild.js`, check `client/node_modules/next` and restore dependencies with pnpm 10 and `install --frozen-lockfile`. The local page recovered after that install in the existing process. pnpm 12 rejected this lockfile because it ignores the `pnpm.overrides` in `client/package.json`. Evidence: `client/pnpm-lock.yaml` (`overrides`), `.github/workflows/client.yml` (pnpm setup), and the local PR page before and after installation.

## Session Notes

## Open Questions
