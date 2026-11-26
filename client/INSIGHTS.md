# Client insights

Record verified lessons from client work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

- 2026-11-26 — Check runtime severity values against `FINDING_SEVERITIES` before using them as counter keys. The regression test in `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/helpers.test.ts` reproduced extra `NaN` keys for unknown or missing values and an inflated `CRITICAL` count when an array was coerced to a property key. Exact membership keeps the counters limited to the three supported levels.

## What Doesn't Work

- 2026-11-26 — A runtime `Severity` import from `@devdigest/shared` passed Vitest and `tsc`, but Next.js Webpack could not resolve the `.js` re-exports in `client/src/vendor/shared/index.ts` when opening a PR page. For client code that only needs the contract type, use a type-only import and type-check the local values against it. The Agent runs page rendered after `FindingsPanel` switched to this pattern.

## Codebase Patterns

- 2026-11-26 — The screen width can overstate the space available for PR-list tables because AppFrame keeps the 264 px sidebar beside the content. At a 390 px viewport, the original list gutters left 60 px for the scroller. Responsive gutters gave it 124 px, enough to reveal the full 116 px Cost column. Evidence: browser smoke test at 390 px and `client/src/app/repos/[repoId]/pulls/styles.ts` (`pageGutter`, `tableScroll`).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
