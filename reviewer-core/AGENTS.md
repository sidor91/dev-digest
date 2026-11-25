# Reviewer core

TypeScript review engine that turns a diff and repository context into grounded findings.

## Checks

- Verify changes with `npm test` and `npm run typecheck`. The build is a type check.

## Read when

- Before changing prompt assembly, structured output, or grounding, read the [pipeline overview](README.md#pipeline).
- Before changing an export or a contract used by the server, read the [public API](README.md#public-api).
- Before editing reviewer prompt content, read the [reviewer prompt guide](../docs/agent-prompts/README.md).
- Before changing an internal mechanism, look for its description in [docs/](docs/).
- Before changing behavior, look for its specification in [specs/](specs/).
- When diagnosing a regression or revisiting an area, read [INSIGHTS.md](INSIGHTS.md).

## Local conventions

- Keep model calls behind the injected `LLMProvider` and use a stubbed provider in tests.
- Pass findings through the diff grounding gate before computing the score.
