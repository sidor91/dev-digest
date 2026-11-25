# Client

Next.js 15 App Router studio with React 19 and TanStack Query.

## Checks

- Build with `pnpm build`.
- Verify UI changes with `pnpm test` and `pnpm typecheck`.

## Read when

- Before changing a page, navigation, or an API hook, read the [UI route map](README.md#ui-route-map).
- When deciding between component and browser coverage, read the [client testing notes](README.md#testing) and the [suite map](../TESTING.md#suite-map).
- Before changing an internal mechanism, look for its description in [docs/](docs/).
- Before changing behavior, look for its specification in [specs/](specs/).
- When diagnosing a regression or revisiting an area, read [INSIGHTS.md](INSIGHTS.md).

## Local conventions

- Keep route pages thin and colocate feature logic and interaction tests in the route's `_components/` directory.
- Use the TanStack Query hooks in `src/lib/hooks/` for API-backed data.
