# Engineering Insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — When the PR list depends on run results, explicitly refresh `['pulls', repoId]` after finalization and deletion. The detail page's `onRunDone` refreshes active runs, history and reviews, and `useDeleteRun` refreshes history and reviews. `usePulls` has its own cache and 60-second refresh interval, so the list can lag the detail view. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` (`onRunDone`), `client/src/lib/hooks/reviews.ts` (`useDeleteRun`), and `client/src/lib/hooks/core.ts` (`usePulls`).
- 2026-11-22 — For late run data, keep polling an already-cancelled row while `cost_pending` is true. A cancellation can become visible before the trace exists and the live widget is limited to active runs. In `client/src/lib/hooks/reviews.ts` (`usePrRuns`), the first settled history response now invalidates the list and the affected trace even when a run starts and settles between polls.
- 2026-11-22 — When displaying a run's severity distribution, count the raw `review.findings` before applying either display filter. Accepting or dismissing a finding updates its persisted status, so it remains in the total while a dismissed critical finding stops contributing to the separate blocker count. Evidence: `client/src/lib/hooks/reviews.ts` (`useFindingAction`), `client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx` (`blockers`), and `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.test.tsx` (confidence and action refresh cases).

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-11-22 — A running Next.js dev process can still hold port 3000 while returning HTTP 500 after its local dependencies disappear. If the log reports a missing `next/dist/compiled/jest-worker/processChild.js`, check `client/node_modules/next` and restore dependencies with pnpm 10 and `install --frozen-lockfile`. The local page recovered after that install in the existing process. pnpm 12 rejected this lockfile because it ignores the `pnpm.overrides` in `client/package.json`. Evidence: `client/pnpm-lock.yaml` (`overrides`), `.github/workflows/client.yml` (pnpm setup), and the local PR page before and after installation.
- 2026-11-22 — Verify Next.js route compilation when changing a type-only `@devdigest/shared` import to a runtime import. Vitest and TypeScript passed with a runtime `Severity` import, but Next.js Webpack could not resolve the barrel's `./contracts/findings.js` re-export from TypeScript sources. For a client UI ordering, keep the contract import type-only and check the local tuple against it. Evidence: `client/src/vendor/shared/index.ts`, `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/constants.ts` (`SEVERITY_FILTER_LEVELS`), and the PR detail route's development compile error.

## Session Notes

## Open Questions
