# Browser end-to-end tests

Deterministic browser journeys run with `agent-browser` against a seeded stack.

## Checks

- Run `./scripts/e2e.sh` from the repository root to test against an isolated, freshly seeded stack.
- Check runner types with `npm run typecheck` from `e2e/`.

## Read when

- Before editing a browser journey, read the [flow format](README.md#how-a-flow-works) and open its `*.flow.json` in [specs/](specs/).
- Before setting up the browser runner or troubleshooting a local run, read the [local run instructions](README.md#run-locally).
- Before changing CI coverage or adding another test at this level, read the [test suite map](../TESTING.md#suite-map).
- Before changing the runner or its environment, look for the relevant notes in [docs/](docs/).
- When diagnosing a regression or revisiting a flow, read [INSIGHTS.md](INSIGHTS.md).

## Local conventions

- Use seeded, read-only data and deterministic URL, text, role, or label locators.
- Use the isolated runner when a flow depends on the seeded repo being the only repo. Preserve the local development database volume.
