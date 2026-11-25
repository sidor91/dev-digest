# DevDigest

DevDigest is a local-first pull request review tool. Its four packages have separate lockfiles and run their own checks.

## Package map

Read the instructions for each package affected by your change before editing it.

- [client/AGENTS.md](client/AGENTS.md) covers the Next.js studio.
- [server/AGENTS.md](server/AGENTS.md) covers the Fastify API, Postgres, and repository indexing.
- [reviewer-core/AGENTS.md](reviewer-core/AGENTS.md) covers the review pipeline and findings.
- [e2e/AGENTS.md](e2e/AGENTS.md) covers the browser test suite.

## Local workflow

- Use Node.js 22 or newer, pnpm 10 or newer, and Docker for Postgres.
- Start the local stack with `./scripts/dev.sh` from the repository root.
- Run package checks from the package directory unless the command is marked as a repository-root command.

## Read when

- Before setting up the project or troubleshooting local startup, read the [project README](README.md).
- Before changing the review pipeline or how packages interact, read the [architecture overview](README.md#architecture).
- Before choosing a test suite or changing CI, read the [testing strategy](TESTING.md).
