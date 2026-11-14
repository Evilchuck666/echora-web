# Echora Web technical guide

[Back to the project overview](README.md)

Echora Web is the React + TypeScript web client of Echora, built with Vite and
Bun. For a quick start, see the [README](README.md).

## API types

The client doesn't hand-write the shapes of the API's responses: it generates them from the OpenAPI specification that the API publishes at `https://localhost/api/docs.jsonopenapi`, with `openapi-typescript`. When the API changes, regenerate the types and let TypeScript point out what needs updating:

```sh
NODE_EXTRA_CA_CERTS=~/echora-local-ca.crt bun run api:types
```

The generator runs on Node, which doesn't use the browser's certificates: `NODE_EXTRA_CA_CERTS` points it to Caddy's authority, exported as shown in the [README](README.md#the-apis-certificate). The result, `src/api/schema.d.ts`, is committed, so building the client doesn't need a running API.

The API documents every endpoint at **https://localhost/api**, and its [technical guide](https://github.com/Evilchuck666/Echora/blob/main/TECHNICAL_GUIDE.md#api) explains authentication, filters and media URLs.

## Development

| Command | What it does |
|---|---|
| `bun run dev` | Starts the Vite dev server, with hot reload |
| `bun run build` | Checks the types and builds the app into `dist/` |
| `bun run typecheck` | Checks the types only |
| `bun run lint` | Lints the code with [oxlint](https://oxc.rs/docs/guide/usage/linter) |
| `bun run test` | Runs the unit tests ([Vitest](https://vitest.dev/)) |
| `bun run test:e2e` | Runs the end-to-end tests ([Playwright](https://playwright.dev/)) in Chromium and Firefox, against a mock API |
| `bun run test:e2e:live` | Runs a few end-to-end tests against your running Echora API (see below) |
| `bun run preview` | Serves the production build locally, passing `/api` to the local API |
| `bun run api:types` | Regenerates the API types (see [API types](#api-types)) |

The repository includes a VS Code setup in `.vscode/` (it also works in Code - OSS with extensions from Open VSX):

- Recommended extensions: Oxc (oxlint), Tailwind CSS IntelliSense, EditorConfig, Vitest and Playwright Test.
- Tasks for every script above, all through Bun.
- A **Debug in Chrome** configuration that starts the dev server and opens the app with the debugger attached. The debug browser uses its own profile, so accept the API's certificate there too.

Use Bun for everything (`bun install`, `bun run <script>`, `bunx`), not npm, pnpm or yarn.

## Tests

The **unit tests** cover the logic that runs without a page: the session (one token refresh at a time, also across tabs), the API client and the player engine. Run them with `bun run test`: `bun test` would start Bun's own test runner instead of Vitest.

The **end-to-end tests** open the app in Chromium and use it like a person would: signing in, browsing, searching and playing. They run against a mock of the Echora API, so they need neither Docker nor a library. Install Playwright's Chromium once, then run them:

```sh
bunx playwright install chromium firefox
bun run test:e2e
```

A few more run against your own Echora API and library, to check that both still work together. Start the API, create an account for them (`docker compose exec php bin/console app:user:create e2e` in the Echora repository), copy `e2e/.env.example` to `e2e/.env` (git-ignored) with its credentials, and run `bun run test:e2e:live`. Set `ECHORA_E2E_BASE_URL` there to run them against a deployed Echora instead.

After a failure, `bunx playwright show-report` opens a report with a trace of each failed test.

GitHub Actions (`.github/workflows/ci.yaml`) runs the lint, the build, the unit tests and the end-to-end tests against the mock API (in Chromium, and in Firefox with its own autoplay rules) on every push to `main` and on pull requests.
