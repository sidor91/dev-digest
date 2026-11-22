# Engineering Insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-11-22 — When treating a structured OpenRouter call's `costUsd` as complete, verify attribution across every retry. `reviewer-core/src/llm/openrouter.ts` (`OpenRouterProvider.completeStructured`) accumulates only attempts with `usage.cost`, then falls back to token-based pricing only if no attempt reported a cost. A mix of priced and unpriced attempts can therefore return a subtotal despite having token counts for both.
- 2026-11-22 — The OpenRouter retry behavior above is corrected in `OpenRouterProvider.completeStructured`. Each attempt now uses its reported charge, including zero, or estimates from that attempt's token counts. A single unpriced attempt makes the whole result unknown. Preserve this distinction when changing attribution or adding a price fallback. Evidence: `reviewer-core/test/openrouter.test.ts` (`OpenRouter structured pricing`).
- 2026-11-22 — For unexpected review language, check the persisted Trace raw output and system prompt before investigating UI locale. A local Performance Reviewer run via OpenRouter/DeepSeek had Chinese in both its raw response and saved summary. The saved system prompt had no output-language rule. `reviewer-core/src/prompt.ts` (`assemblePrompt`) adds a security rule but no language rule, and `server/src/vendor/shared/contracts/findings.ts` (`Review`, `Finding`) validates review prose as strings. An English UI can therefore display prose in another language.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
