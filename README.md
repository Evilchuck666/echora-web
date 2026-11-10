# 🎧 Echora Web

![Platform](https://img.shields.io/badge/platform-Web-blue)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![Vite](https://img.shields.io/badge/Vite-8-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-blue)
![Bun](https://img.shields.io/badge/requires-Bun-blue)
![Status](https://img.shields.io/badge/status-early%20development-orange)
[![License](https://img.shields.io/badge/license-GPLv3-green)](LICENSE)

**Your own music streaming service, in your browser.**

Echora is a self-hosted music streaming service. This repository is its web client: a single-page app to browse your library and play your music from any browser, served by your own [Echora](https://github.com/Evilchuck666/Echora) server.

---

## 🧩 Why Echora Web?

Echora keeps the server and the clients apart: the [Echora API](https://github.com/Evilchuck666/Echora) stores the library and streams the tracks, and every client talks to it only through its endpoints. Echora Web is the first of those clients, and native apps for other platforms can be built later on the same API.

The rules of the service (what a library contains, who can listen to it, how tracks are served) live in the API. The web client only shows them, so every client behaves the same way.

---

## ✨ Features

Echora Web is in early development. What it does so far:

- **Sign in once**: the client signs in with your Echora account and keeps the session alive by refreshing its token on its own, even with the app open in several tabs.
- **Browse your library**: artists with their photos, their albums and each album's tracks, in the order of the tags (disc and track number), with album covers.
- **A player that follows you**: play an album, a single track or every album of an artist, and keep listening while you browse. The next track loads before the current one ends, so albums play on without a pause, and with the app open in several tabs only one plays at a time. Seek anywhere, skip, change the volume, shuffle and repeat (the whole queue or one track; all remembered), use the space bar and arrow keys, or your keyboard's media keys and the system's media controls.
- **Your queue, your way**: on a large screen the queue (and the lyrics, if you like) stays in a column next to the page; elsewhere it opens over it. See what plays next, jump to a track, remove it or drag it elsewhere (also by touch or keyboard). Any track or album can play next or join the end of the queue, without replacing it.
- **Read along**: open the lyrics of the track that is playing (from its tags), and they follow the player from one track to the next.
- **Search everything at once**: one field in the header finds artists, albums and tracks, every word in any order, ignoring accents (`motorhead` finds Motörhead). Press `/` to jump to it.

Coming next: playlists and favourites, once the API has them.

---

## 🧱 Stack

| Part | Technologies |
|---|---|
| Web client (this repository) | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, oxlint |
| Data and state | TanStack Query 5 (server data), Zustand 5 (player), React Router 8 |
| API access | `openapi-fetch`, with types generated from the API's OpenAPI specification by `openapi-typescript` |
| Package manager | [Bun](https://bun.sh/) |
| Backend | [Echora](https://github.com/Evilchuck666/Echora): Symfony + API Platform, in a separate repository |

---

## 🚀 Running in development

You need [Bun](https://bun.sh/) and a running Echora API. Start the API first, from its repository:

```sh
git clone https://github.com/Evilchuck666/Echora.git
cd Echora
docker compose up --wait
```

The API is served at **https://localhost/api**. Create an account there, since Echora has no sign-up page:

```sh
docker compose exec php bin/console app:user:create <username>
```

Then clone and start the web client:

```sh
git clone https://github.com/Evilchuck666/echora-web.git
cd echora-web
bun install
bun run dev
```

Vite serves the app at **http://localhost:5173**. The API allows calls from `localhost` on any port in development.

The client finds the API through `VITE_API_URL` in `.env` (`https://localhost` by default). To point it somewhere else, set it in `.env.local`, which git ignores.

### The API's certificate

`https://localhost` uses a certificate signed by Caddy's local authority, and the browser must trust it: otherwise every call to the API fails before reaching it. Open https://localhost/api once and accept the certificate, or import the authority into your browser or system:

```sh
# Run in the Echora repository
docker compose cp php:/data/caddy/pki/authorities/local/root.crt ~/echora-local-ca.crt
```

---

## 🌍 Production

In production, Echora Web isn't deployed on its own: the [Echora](https://github.com/Evilchuck666/Echora) server builds it into its image and serves it at the root of its domain, next to the API (`https://your-domain/` and `https://your-domain/api`). Same origin, so the browser needs no CORS. Clone this repository next to Echora's and follow [its production guide](https://github.com/Evilchuck666/Echora#-production).

The production build (`bun run build`) calls the API by path (`/api/...`, see `.env.production`). `bun run preview` serves that build and passes `/api` to the local API, to try it before deploying. After deploying, `ECHORA_E2E_BASE_URL=https://your-domain bun run test:e2e:live` runs the live tests against it (see [Tests](#-tests)).

---

## 🔌 API types

The client doesn't hand-write the shapes of the API's responses: it generates them from the OpenAPI specification that the API publishes at `https://localhost/api/docs.jsonopenapi`, with `openapi-typescript`. When the API changes, regenerate the types and let TypeScript point out what needs updating:

```sh
NODE_EXTRA_CA_CERTS=~/echora-local-ca.crt bun run api:types
```

The generator runs on Node, which doesn't use the browser's certificates: `NODE_EXTRA_CA_CERTS` points it to Caddy's authority, exported as shown above. The result, `src/api/schema.d.ts`, is committed, so building the client doesn't need a running API.

The API documents every endpoint at **https://localhost/api**, and its [README](https://github.com/Evilchuck666/Echora#-api) explains authentication, filters and media URLs.

---

## 🛠️ Development

| Command | What it does |
|---|---|
| `bun run dev` | Starts the Vite dev server, with hot reload |
| `bun run build` | Checks the types and builds the app into `dist/` |
| `bun run typecheck` | Checks the types only |
| `bun run lint` | Lints the code with [oxlint](https://oxc.rs/docs/guide/usage/linter) |
| `bun run test` | Runs the unit tests ([Vitest](https://vitest.dev/)) |
| `bun run test:e2e` | Runs the end-to-end tests ([Playwright](https://playwright.dev/)) in Chromium, against a mock API |
| `bun run test:e2e:live` | Runs a few end-to-end tests against your running Echora API (see below) |
| `bun run preview` | Serves the production build locally, passing `/api` to the local API |
| `bun run api:types` | Regenerates the API types (see [API types](#-api-types)) |

The repository includes a VS Code setup in `.vscode/` (it also works in Code - OSS with extensions from Open VSX):

- Recommended extensions: Oxc (oxlint), Tailwind CSS IntelliSense, EditorConfig, Vitest and Playwright Test.
- Tasks for every script above, all through Bun.
- A **Debug in Chrome** configuration that starts the dev server and opens the app with the debugger attached. The debug browser uses its own profile, so accept the API's certificate there too.

Use Bun for everything (`bun install`, `bun run <script>`, `bunx`), not npm, pnpm or yarn.

---

## 🧪 Tests

The **unit tests** cover the logic that runs without a page: the session (one token refresh at a time, also across tabs), the API client and the player engine. Run them with `bun run test`: `bun test` would start Bun's own test runner instead of Vitest.

The **end-to-end tests** open the app in Chromium and use it like a person would: signing in, browsing, searching and playing. They run against a mock of the Echora API, so they need neither Docker nor a library. Install Playwright's Chromium once, then run them:

```sh
bunx playwright install chromium
bun run test:e2e
```

A few more run against your own Echora API and library, to check that both still work together. Start the API, create an account for them (`docker compose exec php bin/console app:user:create e2e` in the Echora repository), copy `e2e/.env.example` to `e2e/.env` (git-ignored) with its credentials, and run `bun run test:e2e:live`. Set `ECHORA_E2E_BASE_URL` there to run them against a deployed Echora instead.

After a failure, `bunx playwright show-report` opens a report with a trace of each failed test.

GitHub Actions (`.github/workflows/ci.yaml`) runs the lint, the build, the unit tests and the end-to-end tests against the mock API on every push to `main` and on pull requests.

---

## 🚧 Status

Echora Web is in early development. The [Echora API](https://github.com/Evilchuck666/Echora) is ready and signing in, browsing and searching the library, playing it with a queue you control, and reading the lyrics work. Next: playlists and favourites.

---

## ⚖️ License

This project is licensed under the GPLv3 License (GPL-3.0-only) — see the [LICENSE](LICENSE) file for details.
