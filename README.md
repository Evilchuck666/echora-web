# 🎧 Echora Web

![Platform](https://img.shields.io/badge/platform-Web-blue)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![Vite](https://img.shields.io/badge/Vite-8-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-blue)
![Requires](https://img.shields.io/badge/requires-Bun-blue)
![Status](https://img.shields.io/badge/status-early%20development-orange)
[![License](https://img.shields.io/badge/license-GPLv3-green)](LICENSE)
[![Build and tests](https://github.com/Evilchuck666/echora-web/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/Evilchuck666/echora-web/actions/workflows/ci.yaml)

**Your own music streaming service, in your browser.**

Echora is a self-hosted music streaming service. This repository is its web client: a single-page app to browse your library and play your music from any browser, served by your own [Echora](https://github.com/Evilchuck666/Echora) server.

> 🚧 **Status:** Echora Web is in early development. The [Echora API](https://github.com/Evilchuck666/Echora) is ready, and signing in, browsing and searching the library, playing it with a queue you control, reading the lyrics, playlists and favourites work.

🌐 **Website:** https://evilchuck666.github.io/echora-web/

## 🧩 Why Echora Web?

Echora keeps the server and the clients apart: the [Echora API](https://github.com/Evilchuck666/Echora) stores the library and streams the tracks, and every client talks to it only through its endpoints. Echora Web is the first of those clients, and native apps for other platforms can be built later on the same API.

The rules of the service (what a library contains, who can listen to it, how tracks are served) live in the API. The web client only shows them, so every client behaves the same way.

## ✨ Features

- **Sign in once**: the client signs in with your Echora account and keeps the session alive by refreshing its token on its own, even with the app open in several tabs.
- **Browse your library**: artists with their photos, every album and every track (in the order of the library), their albums and each album's tracks, in the order of the tags (disc and track number), with album covers.
- **A player that follows you**: play an album, a single track, every album of an artist, or the whole library (Play with nothing queued: in order, or shuffled), and keep listening while you browse. Choose the original files or the data saver, which plays FLAC as Opus at about a quarter of the size, for mobile networks (the default on phones); the server converts the next tracks of your queue ahead of time, so they start at once. Reload, or come back another day: the queue and the position are where you left them (in this browser), ready to go on. The next track loads before the current one ends, so albums play on without a pause, and with the app open in several tabs only one plays at a time. Seek anywhere, skip, change the volume, shuffle and repeat (the whole queue or one track; all remembered), use the space bar and arrow keys, or your keyboard's media keys and the system's media controls.
- **Your queue, your way**: on a large screen the queue (and the lyrics, if you like) stays in a column next to the page; elsewhere it opens over it. See what plays next, jump to a track, remove it or drag it elsewhere (also by touch or keyboard). Any track or album can play next or join the end of the queue, without replacing it. When you like what is queued, save it as a playlist.
- **Read along**: open the lyrics of the track that is playing (from its tags), and they follow the player from one track to the next.
- **Playlists**: make as many as you like from the sidebar or while adding to one, and drag them into your own order (the same on every device); add a track or a whole album from its "⋯" menu (repeats welcome), drag the tracks into order, play, rename, delete. Each account has its own.
- **Favourites**: a heart on every track, album and artist keeps them in your favourites, with a page of their own (tracks you can play at once, albums, artists). Each account has its own.
- **Search everything at once**: one field in the header finds artists, albums and tracks, every word in any order, ignoring accents (`motorhead` finds Motörhead). Press `/` to jump to it.

## 🚀 Getting started

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

## 🌍 Production

In production, Echora Web isn't deployed on its own: the [Echora](https://github.com/Evilchuck666/Echora) server builds it into its image and serves it at the root of its domain, next to the API (`https://your-domain/` and `https://your-domain/api`). Same origin, so the browser needs no CORS. Clone this repository next to Echora's and follow [its production guide](https://github.com/Evilchuck666/Echora/blob/main/TECHNICAL_GUIDE.md#production).

The production build (`bun run build`) calls the API by path (`/api/...`, see `.env.production`). `bun run preview` serves that build and passes `/api` to the local API, to try it before deploying. After deploying, `ECHORA_E2E_BASE_URL=https://your-domain bun run test:e2e:live` runs the live tests against it (see [Tests](TECHNICAL_GUIDE.md#tests)).

## 📚 Learn more

### 🧱 Stack

| Part | Technologies |
|---|---|
| Web client (this repository) | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, oxlint |
| Data and state | TanStack Query 5 (server data), Zustand 5 (player), React Router 8 |
| API access | `openapi-fetch`, with types generated from the API's OpenAPI specification by `openapi-typescript` |
| Package manager | [Bun](https://bun.sh/) |
| Backend | [Echora](https://github.com/Evilchuck666/Echora): Symfony + API Platform, in a separate repository |

- [Technical guide](TECHNICAL_GUIDE.md): API types, development commands and
  editor setup, unit and end-to-end tests.
- [Echora](https://github.com/Evilchuck666/Echora): the server and its API.

## ⚖️ License

Echora Web is free software released under the **GNU General Public License v3.0** (GPL-3.0). See [LICENSE](LICENSE).
