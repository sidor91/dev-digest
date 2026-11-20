# e2e

Owns deterministic browser checks of the web app and API on seeded PostgreSQL. Stack is TypeScript 5, tsx 4, and the agent-browser CLI. [Package manifest](package.json) · [Runner setup](README.md)

## Where to work

- [`run.ts`](run.ts) loads `*.flow.json` files from [`specs/`](specs/) in lexical order. Each flow lists browser commands executed in a shared session.
- Assert observable state with URL/text waits or role, text, and label locators. Keep flows deterministic and runnable against seeded data without model calls or API keys.
- Keep failure artifacts under `test-results/`, the ignored output directory used by the runner and CI.

## Verify

- `npm run typecheck` for runner types.
- `npm run e2e:hermetic` for local browser runs against an isolated, freshly seeded stack. Run `npm test` when an appropriate seeded stack is already running. See the [environment prerequisites](README.md#run-locally).

## Read by task

- **Flow coverage or steps.** Use the [coverage table](README.md#coverage-typological-not-exhaustive) and the matching JSON flow.
- **Runner, CI, or test environment.** Use the [package README](README.md) and the [CI workflow](../.github/workflows/e2e-web.yml). Additional package documentation belongs in [`docs/`](docs/).
- **Durable discoveries.** Record them in [INSIGHTS.md](INSIGHTS.md).
