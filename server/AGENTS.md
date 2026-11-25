# server

Owns the local API on port 3001. Stack is Node.js 22+, TypeScript, Fastify 5, Zod 3, Drizzle ORM, and PostgreSQL 16 with pgvector. [Package manifest](package.json) · [Local database](../docker-compose.yml)

## Where to work

- Feature routes are Fastify plugins registered in [`src/modules/index.ts`](src/modules/index.ts). Keep request schemas and workspace scoping with the owning route.
- [`src/platform/container.ts`](src/platform/container.ts) wires adapters and their test overrides. Use the adapter interfaces for GitHub, Git, and LLM calls.
- Drizzle schemas and migrations live under [`src/db/`](src/db/). Apply migrations explicitly before using a fresh database.
- The [`reviews`](src/modules/reviews/) module owns I/O, persistence, and SSE. It delegates review logic to [`reviewer-core`](../reviewer-core/AGENTS.md).

## Verify

- `pnpm dev` for the API, `pnpm build` for the TypeScript build, `pnpm typecheck` for types.
- DB-free tests use `pnpm exec vitest run --exclude '**/*.it.test.ts'`. DB-backed files use the `*.it.test.ts` suffix and run with `pnpm exec vitest run .it.test` against Testcontainers PostgreSQL.

## Read by task

- **API behavior, data rules, or acceptance criteria.** Look in [`specs/`](specs/).
- **API and indexing.** Start with the [API map](README.md#api-map-starter) or the [Repo Intel guide](src/modules/repo-intel/README.md). Additional package documentation belongs in [`docs/`](docs/).
- **Prior insights.** Read [INSIGHTS.md](INSIGHTS.md) before working on or answering questions about this package.
