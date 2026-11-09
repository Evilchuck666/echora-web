# 🎧 Echora Web

![Platform](https://img.shields.io/badge/platform-Web-blue)
![React](https://img.shields.io/badge/React-TypeScript-blue)
![Vite](https://img.shields.io/badge/build-Vite-blue)
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

Echora Web is in early development. These are the features it is being built with:

- **Sign in once**: the client signs in with your Echora account and keeps the session alive by refreshing its token on its own, even with the app open in several tabs.
- **Browse your library**: artists, their albums and each album's tracks, in the order of the tags (disc and track number), with album covers.
- **Play in the browser**: FLAC and MP3 straight from the server with a plain `<audio>` element, with seeking, so no plugin or transcoding is needed.
- **A queue that follows you around**: the player keeps playing while you browse, with a queue, the current track and the volume.
- **Lyrics**: the lyrics of the track that is playing, when its tags have them.

---

## 🧱 Stack

| Part | Technologies |
|---|---|
| Web client (this repository) | React, TypeScript, Vite, Tailwind CSS 4 |
| Data and state | TanStack Query (server data), Zustand (player), React Router |
| API access | `openapi-fetch`, with types generated from the API's OpenAPI specification by `openapi-typescript` |
| Package manager | [Bun](https://bun.sh/) |
| Backend | [Echora](https://github.com/Evilchuck666/Echora): Symfony + API Platform, in a separate repository |

---

## 🚀 Running in development

> [!NOTE]
> The app hasn't been scaffolded yet. These steps describe how it will run once it is.

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

### The API's certificate

`https://localhost` uses a certificate signed by Caddy's local authority, and the browser must trust it: otherwise every call to the API fails before reaching it. Open https://localhost/api once and accept the certificate, or import the authority into your browser or system:

```sh
# Run in the Echora repository
docker compose cp php:/data/caddy/pki/authorities/local/root.crt ~/echora-local-ca.crt
```

---

## 🔌 API types

The client doesn't hand-write the shapes of the API's responses: it generates them from the OpenAPI specification that the API publishes at `https://localhost/api/docs.jsonopenapi`, with `openapi-typescript`. When the API changes, regenerate the types and let TypeScript point out what needs updating.

The API documents every endpoint at **https://localhost/api**, and its [README](https://github.com/Evilchuck666/Echora#-api) explains authentication, filters and media URLs.

---

## 🛠️ Development

The repository includes a VS Code setup in `.vscode/` (it also works in Code - OSS with extensions from Open VSX):

- Recommended extensions: ESLint, Tailwind CSS IntelliSense and EditorConfig.
- Tasks to install dependencies, start the dev server, build and lint, all through Bun.
- A **Debug in Chrome** configuration that starts the dev server and opens the app with the debugger attached. The debug browser uses its own profile, so accept the API's certificate there too.

Use Bun for everything (`bun install`, `bun run <script>`, `bunx`), not npm, pnpm or yarn.

---

## 🚧 Status

Echora Web is in early development. The [Echora API](https://github.com/Evilchuck666/Echora) is ready, and the next steps here are scaffolding the app, signing in, browsing the library and the player.

---

## ⚖️ License

This project is licensed under the GPLv3 License (GPL-3.0-only) — see the [LICENSE](LICENSE) file for details.
