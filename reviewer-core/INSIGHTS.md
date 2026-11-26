# Reviewer core insights

Record verified lessons from review engine work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

## What Doesn't Work

- 2026-11-26 — A passing grounding count cannot establish that a citation covers the query described in a finding. `groundFindings` in `reviewer-core/src/grounding.ts` checks range intersection. In the General Reviewer prompt comparison, v2 passed 1/1 with a citation ending at line 349, while the per-review findings query it described was on lines 350–355. Verify that the cited range includes the operation supporting the finding when comparing prompt versions. [Demo PR #12](https://github.com/ai-agentic-engineering-neo/dev-digest/pull/12/files)

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
