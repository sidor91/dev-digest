# DevDigest

DevDigest is a local-first studio for AI review of GitHub pull requests. See the [project README](README.md) for architecture, setup, and the roadmap.

## Choose the package

Open the matching `AGENTS.md` before editing a package. For a cross-package change, open the file in each affected package.

| Task | Package |
| --- | --- |
| Web routes, components, UI state, and API hooks | [client](client/AGENTS.md) |
| Fastify routes, GitHub import, repo indexing, database, and review execution | [server](server/AGENTS.md) |
| Prompt assembly, review strategy, structured output, and grounding | [reviewer-core](reviewer-core/AGENTS.md) |
| Browser flows, seeded data assumptions, and runner behavior | [e2e](e2e/AGENTS.md) |

## Cross-package work

- Run commands from the owning package. `client` and `server` use pnpm. `reviewer-core` and `e2e` use npm. [Test lanes and CI](TESTING.md)
- For a shared contract change, inspect both vendored copies. `client` resolves its own `@devdigest/shared`, while `server` and `reviewer-core` resolve the server copy. [Client alias](client/tsconfig.json) · [Server alias](server/tsconfig.json) · [Core alias](reviewer-core/tsconfig.json)
- For behavior that spans packages, keep the requirements with the package that owns the change and link them from the other affected packages when needed.
