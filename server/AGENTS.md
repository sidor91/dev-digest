# Server

Fastify 5 API backed by Postgres and pgvector through Drizzle.

## Checks

- Build with `pnpm build` and check types with `pnpm typecheck`.
- Run both test suites with `pnpm test`. For a targeted run, use the commands in the [server testing notes](README.md#testing).

## Read when

- Before changing an endpoint or its contract, read the [API map](README.md#api-map-starter).
- Before changing route registration, validation, or adapter wiring, read the [request and DI flow](README.md#request--di-flow).
- Before changing indexing, repository maps, or caller lookup, read the [repo-intel README](src/modules/repo-intel/README.md).
- Before changing test infrastructure or CI selection, read the [testing conventions](../TESTING.md#conventions).
- Before changing an internal mechanism, look for its description in [docs/](docs/).
- Before changing behavior, look for its specification in [specs/](specs/).
- When diagnosing a regression or revisiting an area, read [INSIGHTS.md](INSIGHTS.md).

## Local conventions

- Declare request schemas on Fastify routes using the shared Zod contracts where applicable.
- Use the `*.it.test.ts` suffix for tests that use a real database.
