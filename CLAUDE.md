# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Echora Web is the browser client of Echora, a self-hosted music streaming service. It talks to the Echora API (Symfony + API Platform), which lives in a separate repository at `../Echora` (https://github.com/Evilchuck666/Echora). Native apps for other platforms are planned on the same API, so business rules belong in the API, not here.

## Commands

```sh
bun install          # install dependencies
bun run dev          # Vite dev server at http://localhost:5173
bun run build        # type check (tsc -b) and production build into dist/
bun run typecheck    # type check only
bun run lint         # oxlint
bun run test         # unit tests (Vitest); `bun test` would run Bun's own runner instead: always `bun run test`
bun run test:e2e     # end-to-end tests (Playwright) against the mock API
bun run test:e2e:live  # a few end-to-end tests against the real API (needs e2e/.env)
bun run preview      # serve the production build
bun run api:types    # regenerate src/api/schema.d.ts from the running API
```

## Tests

- **Unit** (Vitest + happy-dom, `src/**/*.test.ts`, setup in `src/test/`): logic without UI, above all the session (single-flight and cross-tab refresh, sign-out), the API client's middleware, and the player engine. `fetch` is a mock set before any import, because openapi-fetch keeps the fetch it finds when a client is created: configure it per test with the helpers in `src/test/http.ts` (`routes()`, `json()`, `calls()`, `jwt()`). happy-dom has no Web Locks (`navigator.locks` is `null`): `src/test/locks.ts` installs a shared stand-in.
- **End-to-end** (Playwright, `e2e/`): the app in Chromium. `e2e/mocked/` runs against `e2e/support/mock-api.ts`, a stateful mock of the Echora API (login, single-use refresh tokens, library, search, a real WAV stream, SVG covers, injectable failures) installed with `context.route()` through the fixtures in `e2e/support/fixtures.ts`; it needs no server and runs in CI (`.github/workflows/ci.yaml`). `e2e/live/` runs against the real API and library, skipped unless `e2e/.env` sets `ECHORA_E2E_USERNAME` and `ECHORA_E2E_PASSWORD` (see `e2e/.env.example`); it must not depend on particular artists. Playwright starts its own Vite on port 5179.
- Locate elements by role and accessible name (`getByRole('region', { name: 'Player' })`), as users and screen readers find them: keep `aria-label`s meaningful. When a feature changes the API's behaviour the client relies on, update the mock API too.
- After a change, run `bun run lint`, `bun run build`, `bun run test` and `bun run test:e2e`.

## Layout

- `src/main.tsx`: mounts the providers (TanStack Query, React Router).
- `src/app/`: app-wide setup: `router.tsx` (routes), `query-client.ts` (also clears the cache on sign-out).
- `src/api/`: `client.ts` (the typed `openapi-fetch` client, its authentication middleware, and `unwrap()` to turn a call into data or an `ApiError` for `queryFn`) and `schema.d.ts` (generated, committed so builds don't need the API; never edit it by hand).
- `src/auth/`: the session. `tokens.ts` keeps the tokens in `localStorage` (shared by every tab) and exposes `useSession` (Zustand); `session.ts` signs in and out and refreshes the JWT, single-flight within a tab and under a Web Lock across tabs, re-reading the tokens once the lock is held. Signing out takes the same lock, so it invalidates the current refresh token. `RequireAuth` guards the signed-in routes.
- `src/library/`: the music library: `queries.ts` (TanStack Query hooks for artists, albums, tracks and the search), `types.ts` (aliases of the generated JSON-LD schemas), `format.ts` (durations, plurals).
- `src/components/`: shared components: `AppLayout` (the frame of signed-in pages, with `ScrollRestoration`), `Cover` (album cover or placeholder), `ArtistImage` (round artist thumbnail or the initial), `LibraryCards` (`ArtistCard`, `AlbumCard`, typed by the fields they show so list and search results both fit), `SearchBox` (the header search, with a × button: navigates from its change handler after a pause, not from an effect, and follows the URL while rendering), `InfiniteScrollTrigger`, `QueryError`, `Spinner`, `Breadcrumbs`.
- `src/library/search.ts`: `searchUrl()` and `useLeaveSearch()`. An empty search URL (`/search`, `/search?q=`, a blank `q`) is never written nor shown: emptying the query goes back to the page the search started from (`navigate(-1)`), or replaces it with `/` when the app was opened on it (React Router's `history.state.idx` is 0).
- `src/player/`: the player. `store.ts` (Zustand: queue, index, playing, time, volume; only volume and mute are persisted, in `localStorage`), `engine.ts` (the single `Audio` element, created outside React so music survives navigation; its events write the store, and its exported controls are the only way to drive it; renews an expiring or failed (401) `streamUrl` by fetching the track again, once; Media Session; stops on sign-out), `PlayerBar.tsx` (fixed bar, mounted in `AppLayout`, with the space and arrow shortcuts), `icons.tsx`. Components read the store and call the engine; never touch the audio element elsewhere.
- `src/pages/`: one component per route: `/` artists, `/artists/:id` its albums, `/albums/:id` its tracks, `/search?q=` the global search (`GET /api/search`, `limit=50`, sections folded until "Show all"), `/login`.

Conventions:

- The `api` client is typed for `application/ld+json` (`createClient<paths, 'application/ld+json'>`), so responses have the JSON-LD shapes (`member`, `totalItems`, `view`). Wrap calls in `unwrap()` inside `queryFn`.
- Collections are infinite queries: `initialPageParam: 1` and `getNextPageParam: (page) => nextPage(page.view)`, with an `InfiniteScrollTrigger` after the list. Relation filters take IRIs (`/api/artists/{id}`).
- Show the page-level `QueryError` on `isLoadingError`, not `isError`: once data is on screen, a failed next page or refetch must not replace it (the trigger offers a retry instead). Server and network errors are retried twice automatically; 4xx aren't.
- `.env` sets `VITE_API_URL` (the API origin, without `/api`, since the generated paths include it). Local overrides go in `.env.local` (git-ignored).

## Decided stack

- Vite + React + TypeScript, styled with Tailwind CSS 4 (through `@tailwindcss/vite`; no `tailwind.config`, configuration lives in CSS).
- **TypeScript 6, not 7**: TypeScript 7 (the native compiler) has no JavaScript API, which `openapi-typescript` needs, and the editor only supports it experimentally. Move to 7 when both do.
- Linting with **oxlint** (`.oxlintrc.json`), the current Vite template's default. No formatter has been chosen yet.
- **Bun** is the package manager and script runner (`bun install`, `bun run <script>`, `bunx`). Don't use npm, pnpm or yarn, and don't commit their lockfiles.
- TanStack Query for server state, React Router for routing, Zustand for client state (the player: queue, current track, volume).
- API types generated from the API's OpenAPI specification with `openapi-typescript`, and requests made with `openapi-fetch`. Don't hand-write API types: regenerate them when the API changes.
- The interface is in **English only**: no i18n library.
- Same stack as the author's other React project (ArchivAries), on purpose.

## The Echora API

The local API runs from `../Echora` with `docker compose up --wait` at **https://localhost/api** (Swagger UI there; OpenAPI at `/api/docs.jsonopenapi`). Its README and its `bruno/` collection document every endpoint. Rules the client must follow:

- **Collections need JSON-LD** (`Accept: application/ld+json`, the default): items are in `member`, the total in `totalItems`, and pagination links in `view` (`first`, `next`, `last`; 30 items per page, `page` query parameter). With `Accept: application/json` a collection is a bare array with no total or links.
- **Filters** take IRIs for relations: `/api/albums?artist=/api/artists/{id}`, `/api/tracks?album=/api/albums/{id}`. Text filters (`name`, `title`) are partial and case-insensitive. Default order: artists by name, albums by year, tracks by disc and track number.
- **Authentication**: `POST /api/auth` with `{"username", "password"}` returns `{token, refresh_token, refresh_token_expiration}`. Send `Authorization: Bearer <token>` on every request. The JWT lasts one hour. `POST /api/token/refresh` with `{"refresh_token"}` returns a new pair.
- **Signing out**: `POST /api/logout` with `{"refresh_token"}` invalidates it (no JWT needed). The JWT stays valid until it expires, so drop it locally too.
- **Refresh tokens are single use with reuse detection**: presenting a refresh token that was already spent revokes the whole session, also when two requests present it at the same time (the API serializes them). So refreshes must be single-flight (concurrent 401s wait for one refresh) **and coordinated across browser tabs** (e.g. Web Locks API or BroadcastChannel, with the tokens in shared storage). Two tabs refreshing with the same token sign the user out.
- **Media URLs**: every track has a `streamUrl` (valid 6 hours) and every album a `coverUrl` (or `null`; stable for a day, so the browser caches it). Both are signed and work without the Authorization header: use them directly as `<audio src>` / `<img src>`. Never build these URLs by hand and never put the JWT in a URL. When a `streamUrl` has expired (401), fetch the track again for a fresh one.
- Audio is served as is (FLAC or MP3) with HTTP Range support, so seeking works with a plain `<audio>` element. FLAC files are large (~30 MB per track).
- Lists include `hasLyrics`; the `lyrics` themselves only come with `GET /api/tracks/{id}`.
- Errors: a 401 from the authenticator is `{code, message}`; other API errors are JSON-LD `Error` objects with `status`, `title`, `detail`.
- There is no sign-up endpoint: accounts are created on the server with `docker compose exec php bin/console app:user:create <username>` (in `../Echora`).

## Local development

- CORS on the API allows `localhost` on any port in development, so the Vite dev server can call https://localhost directly.
- The API's HTTPS certificate is signed by Caddy's local authority. The browser must trust it, or `fetch` calls to the API fail before reaching it: open https://localhost/api once and accept the certificate, or import the authority from `docker compose cp php:/data/caddy/pki/authorities/local/root.crt <file>` (run in `../Echora`).
- API Platform publishes OpenAPI 3.2, and `openapi-typescript` 7 handles it (the 3.0.0 variant, `?spec_version=3.0.0`, yields the same types). `bun run api:types` runs on Node, which doesn't trust Caddy's certificate: run it as `NODE_EXTRA_CA_CERTS=<exported root.crt> bun run api:types`.
- The editor is Code - OSS with extensions from Open VSX: only recommend extensions published there.
