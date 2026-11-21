# client

Owns the web studio on port 3000. Stack is TypeScript, Next.js 15 App Router, React 19, TanStack Query 5, next-intl, and Tailwind CSS 4. [Package manifest](package.json)

## Where to work

- Routes and page-specific components live in [`src/app/`](src/app/), with feature components colocated in `_components/`.
- Shared studio components live in [`src/components/`](src/components/). Reuse primitives from [`src/vendor/ui/`](src/vendor/ui/) when they fit.
- Follow [`src/lib/hooks/`](src/lib/hooks/) into [`src/lib/api.ts`](src/lib/api.ts) for REST. Review run events use `EventSource` in the [review hooks](src/lib/hooks/reviews.ts).
- Put UI text in the applicable namespace under [`messages/en/`](messages/en/) and follow the existing next-intl pattern.

## Verify

- `pnpm dev` for the web app, `pnpm build` for the production build.
- `pnpm typecheck` and `pnpm test`. Component tests use Vitest, jsdom, and mocked HTTP. [Test setup](vitest.config.ts)

## Read by task

- **UI behavior or acceptance criteria.** Look in [`specs/`](specs/).
- **Routes and UI architecture.** Start with the [UI route map](README.md#ui-route-map). Additional package documentation belongs in [`docs/`](docs/).
- **Prior insights.** Read [INSIGHTS.md](INSIGHTS.md) before working on or answering questions about this package.
