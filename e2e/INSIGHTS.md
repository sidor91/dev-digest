# Engineering Insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — A flow that asserts on the Agent runs timeline or opens a Run Trace needs actual run and trace fixtures. The existing seeded findings flow passes against a sample review with no linked run, so its verdict and finding assertions do not prove either surface has data. Evidence: `server/src/db/seed.ts` (`seed`, sample review) and `e2e/specs/04-pr-findings.flow.json`.
- 2026-11-22 — Fresh seeds now include a grouped command with two distinct prices and their traces. Keep the group total different from either individual price, and scope assertions inside the dialog because the timeline stays in the DOM behind the drawer. Evidence: `server/src/db/seed.ts` (`seedDemoReviewRuns`) and `e2e/specs/08-review-cost.flow.json`.
- 2026-11-22 — Use the seeded General Reviewer when checking the same run across Timeline and Review runs. `seedDemoReviewRuns` links the sample review to that run because it has findings. The Security Reviewer also has a priced run and trace, but its seed creates no linked review. Evidence: `server/src/db/seed.ts` (`seedDemoReviewRuns`) and `e2e/specs/08-review-cost.flow.json`.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
