# Client insights

Record verified lessons from client work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-26 — The screen width can overstate the space available for PR-list tables because AppFrame keeps the 264 px sidebar beside the content. At a 390 px viewport, the original list gutters left 60 px for the scroller. Responsive gutters gave it 124 px, enough to reveal the full 116 px Cost column. Evidence: browser smoke test at 390 px and `client/src/app/repos/[repoId]/pulls/styles.ts` (`pageGutter`, `tableScroll`).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
