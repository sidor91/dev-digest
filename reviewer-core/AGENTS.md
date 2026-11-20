# reviewer-core

Owns prompt assembly, review strategies, structured output, and citation grounding. Stack is TypeScript 5, Zod 3, an injected `LLMProvider`, and Vitest 2. [Package manifest](package.json)

## Where to work

- [`src/index.ts`](src/index.ts) is the public entry point. The [server](../server/AGENTS.md) imports this source through a tsconfig alias.
- [`src/review/run.ts`](src/review/run.ts) orchestrates reviews. [`src/prompt.ts`](src/prompt.ts) assembles prompts and [`src/grounding.ts`](src/grounding.ts) checks finding locations against the diff.
- Keep data loading, persistence, and run tracking in the server. Pass resolved data and an `LLMProvider` into the engine.
- Preserve the shared grounding step for every review strategy. Test the engine with a stub provider in [`test/`](test/).

## Verify

- `npm run typecheck` and `npm test`. `npm run build` also typechecks the package and emits no JavaScript.
- For a public export or input/output contract change, check its server call site and run the affected server checks. [Server executor](../server/src/modules/reviews/run-executor.ts)

## Read by task

- **Review behavior or acceptance criteria.** Look in [`specs/`](specs/).
- **Prompt, model output, or grounding.** Start with the [pipeline overview](README.md#pipeline). Additional package documentation belongs in [`docs/`](docs/).
- **Durable discoveries.** Record them in [INSIGHTS.md](INSIGHTS.md).
