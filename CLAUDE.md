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
bun run preview      # serve the production build
bun run api:types    # regenerate src/api/schema.d.ts from the running API
```

There are no tests yet.

## Layout

- `src/main.tsx`: mounts the providers (TanStack Query, React Router).
- `src/app/`: app-wide setup: `router.tsx` (routes), `query-client.ts` (also clears the cache on sign-out).
- `src/api/`: `client.ts` (the typed `openapi-fetch` client, its authentication middleware, and `unwrap()` to turn a call into data or an `ApiError` for `queryFn`) and `schema.d.ts` (generated, committed so builds don't need the API; never edit it by hand).
- `src/auth/`: the session. `tokens.ts` keeps the tokens in `localStorage` (shared by every tab) and exposes `useSession` (Zustand); `session.ts` signs in and out and refreshes the JWT, single-flight within a tab and under a Web Lock across tabs, re-reading the tokens once the lock is held. `RequireAuth` guards the signed-in routes.
- `src/components/`: shared components, such as `AppLayout` (the frame of signed-in pages).
- `src/pages/`: one component per route.

The API's OpenAPI document lists the refresh endpoint as `api_refresh_token` instead of `/api/token/refresh` (the firewall's `check_path` is a route name), so `session.ts` calls it with plain `fetch`. Once the API documents the path, it can use the typed client.
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
- **Refresh tokens are single use with reuse detection**: presenting a refresh token that was already spent revokes the whole session. So refreshes must be single-flight (concurrent 401s wait for one refresh) **and coordinated across browser tabs** (e.g. Web Locks API or BroadcastChannel, with the tokens in shared storage). Two tabs refreshing with the same token sign the user out.
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
