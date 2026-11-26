# Reviewer core insights

Record verified lessons from review engine work. Describe the symptom, cause, and reusable takeaway, with a link to supporting evidence.

## What Works

## What Doesn't Work

- 2026-11-26 — An OpenRouter structured call can retry after a schema parse failure. If some attempts report `usage.cost` and others omit it, the current sum covers only the priced attempts and still bypasses the estimator. Resolve price per attempt when using the sum as a complete run cost. Evidence: `reviewer-core/src/llm/openrouter.ts` (`OpenRouterProvider.completeStructured`, `costFromApi` accumulation and fallback).

## Codebase Patterns

- 2026-11-26 — The OpenRouter retry accounting gap recorded above is resolved by pricing each structured-output attempt before aggregating it. A retry with no reported cost and no usable estimate makes the run cost unknown. A run with a mix of reported and estimated amounts is estimated. Evidence: `reviewer-core/test/openrouter.test.ts` and `reviewer-core/test/run.test.ts` (map-reduce cost cases).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
