import type { BrowserContext, Request, Route } from '@playwright/test'

/** The origin the app calls (VITE_API_URL in .env). Every request to it is answered here, never by a server. */
export const API = 'https://localhost'

/** The account tests sign in with: an administrator. */
export const USERNAME = 'listener'
export const PASSWORD = 'secret'
export const EMAIL = 'listener@example.com'
export const NAME = 'Lee Listener'

/** Another account, not an administrator. */
export const OTHER = { username: 'robin', password: 'robin-secret', email: 'robin@example.com', name: 'Robin Reader' }

/** Length of the audio every track serves, in seconds. */
export const TRACK_SECONDS = 12

/** The API's REFRESH_TOKEN_GRACE_SECONDS. */
const GRACE_SECONDS = 300

interface MockArtist {
  id: string
  name: string
  image: boolean
}

interface MockAlbum {
  id: string
  artistId: string
  title: string
  year: number | null
  cover: boolean
}

interface MockPlaylist {
  id: string
  name: string
  /** Increases with every change to its name or items (the API's updatedAt). */
  changed: number
  items: { id: string; trackId: string }[]
}

interface MockUser {
  id: string
  username: string
  email: string | null
  name: string
  password: string
  admin: boolean
  /** Changes with every new picture (the API puts the file name in the URL); null without one. */
  avatar: number | null
}

interface MockTrack {
  id: string
  albumId: string
  artistId: string
  title: string
  trackNumber: number
  hasLyrics: boolean
}

export interface MockApiOptions {
  /** Artists added after the real ones ("Band 001"...), to have several pages. */
  extraArtists?: number
  /** Every request for this page of /api/artists fails with a 500 this many times, then works. */
  failArtistsPage?: { page: number; times: number }
  /** A new server, without accounts: the first visitor creates the administrator (POST /api/setup). */
  noAccounts?: boolean
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/**
 * A small, stateful Echora API: accounts, single-use refresh tokens, the library, the search, media URLs.
 * Tests read what it received (refreshes, logouts, streams...) and can make it fail on purpose.
 */
export class MockApi {
  readonly artists: MockArtist[] = []
  readonly albums: MockAlbum[] = []
  readonly tracks: MockTrack[] = []

  /** Requests received, as "METHOD /path?query". */
  readonly requests: string[] = []
  /** Refresh tokens presented to POST /api/token/refresh, valid or not. */
  readonly refreshes: string[] = []
  /** Refresh tokens presented to POST /api/logout. */
  readonly logouts: string[] = []

  /** The next stream requests answer 401, as an expired signed URL does. */
  expiredStreams = 0
  /** The next refresh is carried out, but its response never reaches the page (as when the network drops). */
  loseNextRefreshResponse = false

  /** The user's favourites of each kind, by id, newest first (as the API lists them). */
  readonly favourites: Record<'track' | 'album' | 'artist', string[]> = { track: [], album: [], artist: [] }
  /** The user's playlists, in the user's order (a new one first), as the API keeps them. */
  readonly playlists: MockPlaylist[] = []
  private changes = 0
  private playlistCount = 0

  /** Bodies of POST /api/transcodes (the tracks to convert to Opus ahead of time), in order. */
  readonly transcodes: { device: string; tracks: string[] }[] = []
  /** The next favourite changes answer 500, as when the API is down. */
  failFavourites = 0

  /** The accounts, by username (as the API lists them). */
  readonly users: MockUser[] = []
  /** Pictures received (multipart uploads), as "me" or the id of the account. */
  readonly avatarUploads: string[] = []
  private userCount = 0

  /** Access token → id of its account. */
  private accessTokens = new Map<string, string>()
  /** Refresh token → id of its account. */
  private refreshTokens = new Map<string, string>()
  /** Like the API's grace period: presented refresh token → the one issued for it, and when. */
  private successors = new Map<string, { token: string; at: number }>()
  private issued = 0
  private failures = new Map<number, number>()
  private readonly options: MockApiOptions

  constructor(options: MockApiOptions = {}) {
    this.options = options
    this.addLibrary()
    if (!options.noAccounts) {
      this.addUser({ username: USERNAME, password: PASSWORD, email: EMAIL, name: NAME, admin: true })
      this.addUser({ ...OTHER, admin: false })
    }
    if (options.failArtistsPage) {
      this.failures.set(options.failArtistsPage.page, options.failArtistsPage.times)
    }
  }

  async install(context: BrowserContext): Promise<void> {
    await context.route((url) => url.origin === API, (route, request) => this.handle(route, request))
  }

  /** The access tokens issued so far stop working, as after a change of signing keys. Refresh tokens still work. */
  rejectAccessTokens(): void {
    this.accessTokens.clear()
  }

  /** A playlist made beforehand, with these tracks (by title; the first track of that title). It comes first. */
  addPlaylist(name: string, trackTitles: string[] = []): MockPlaylist {
    const playlist: MockPlaylist = {
      id: `00000000-0000-4000-9000-${String(++this.playlistCount).padStart(12, '0')}`,
      name,
      changed: ++this.changes,
      items: trackTitles.map((title) => ({ id: `item-${++this.changes}`, trackId: this.tracks.find((t) => t.title === title)!.id })),
    }
    // As the API: a new playlist comes first.
    this.playlists.unshift(playlist)
    return playlist
  }

  /** An account made beforehand (as by an administrator, or the console). */
  addUser(user: Omit<MockUser, 'id' | 'avatar'> & { avatar?: number | null }): MockUser {
    const created: MockUser = { avatar: null, ...user, id: `00000000-0000-4000-a000-${String(++this.userCount).padStart(12, '0')}` }
    this.users.push(created)
    this.users.sort((a, b) => a.username.localeCompare(b.username))
    return created
  }

  userNamed(username: string): MockUser {
    return this.users.find((user) => user.username === username) ?? (() => { throw new Error(`No user ${username}`) })()
  }

  /** How many sessions (refresh tokens) of an account are open. */
  sessionsOf(username: string): number {
    const userId = this.userNamed(username).id
    return [...this.refreshTokens.values()].filter((owner) => owner === userId).length
  }

  artistNamed(name: string): MockArtist {
    return this.artists.find((artist) => artist.name === name) ?? (() => { throw new Error(`No artist ${name}`) })()
  }

  albumTitled(title: string): MockAlbum {
    return this.albums.find((album) => album.title === title) ?? (() => { throw new Error(`No album ${title}`) })()
  }

  // --- Data ----------------------------------------------------------------------------------------------------------

  private addLibrary(): void {
    const library: [string, boolean, [string, number | null, boolean, string[]][]][] = [
      ['Accept', true, [
        ['Breaker', 1981, true, ['Starlight', 'Breaker', 'Run If You Can']],
        ['Balls to the Wall', 1983, true, ['Balls to the Wall', 'London Leatherboys', 'Fight It Back', 'Head Over Heels', 'Losing More Than You\'ve Ever Had', 'Love Child']],
      ]],
      ['Alice Cooper', true, [['Killer', 1971, true, ['Under My Wheels', 'Be My Lover', 'Halo of Flies']]]],
      ['Motörhead', false, [['Ace of Spades', 1980, false, ['Ace of Spades', 'Love Me Like a Reptile']]]],
    ]
    let n = 1
    for (const [name, image, albums] of library) {
      const artist = { id: id(n++), name, image }
      this.artists.push(artist)
      for (const [title, year, cover, titles] of albums) {
        const album = { id: id(n++), artistId: artist.id, title, year, cover }
        this.albums.push(album)
        titles.forEach((trackTitle, index) => {
          this.tracks.push({ id: id(n++), albumId: album.id, artistId: artist.id, title: trackTitle, trackNumber: index + 1, hasLyrics: index % 2 === 0 })
        })
      }
    }
    for (let i = 1; i <= (this.options.extraArtists ?? 0); i++) {
      this.artists.push({ id: id(n++), name: `Band ${String(i).padStart(3, '0')}`, image: false })
    }
    this.artists.sort((a, b) => a.name.localeCompare(b.name))
  }

  // --- Serialization, like the API's JSON-LD -------------------------------------------------------------------------

  private artistJson(artist: MockArtist) {
    return {
      '@id': `/api/artists/${artist.id}`,
      '@type': 'Artist',
      id: artist.id,
      name: artist.name,
      ...(artist.image ? { coverUrl: this.signed(`/api/artists/${artist.id}/cover`) } : {}),
      favourite: this.favourites.artist.includes(artist.id),
    }
  }

  private albumJson(album: MockAlbum, withArtist = true) {
    const artist = this.artists.find((a) => a.id === album.artistId)!
    return {
      '@id': `/api/albums/${album.id}`,
      '@type': 'Album',
      id: album.id,
      title: album.title,
      year: album.year,
      ...(album.cover ? { coverUrl: this.signed(`/api/albums/${album.id}/cover`) } : {}),
      favourite: this.favourites.album.includes(album.id),
      ...(withArtist ? { artist: { '@id': `/api/artists/${artist.id}`, '@type': 'Artist', id: artist.id, name: artist.name } } : {}),
    }
  }

  private trackJson(track: MockTrack) {
    const artist = this.artists.find((a) => a.id === track.artistId)!
    const album = this.albums.find((a) => a.id === track.albumId)!
    // As if Ace of Spades were MP3 files and the rest FLAC: only FLAC tracks have an Opus version.
    const flac = album.title !== 'Ace of Spades'
    return {
      '@id': `/api/tracks/${track.id}`,
      '@type': 'Track',
      id: track.id,
      title: track.title,
      album: this.albumJson(this.albums.find((a) => a.id === track.albumId)!, false),
      artist: { '@id': `/api/artists/${artist.id}`, '@type': 'Artist', id: artist.id, name: artist.name },
      trackNumber: track.trackNumber,
      discNumber: 1,
      durationMs: TRACK_SECONDS * 1000,
      format: 'wav',
      mimeType: 'audio/wav',
      fileSize: WAV.length,
      streamUrl: this.signed(`/api/tracks/${track.id}/stream`),
      opusStreamUrl: flac ? this.signed(`/api/tracks/${track.id}/stream/opus`) : null,
      hasLyrics: track.hasLyrics,
      favourite: this.favourites.track.includes(track.id),
    }
  }

  private collection<T>(path: string, items: T[], page: number) {
    const pageSize = 30
    const last = Math.max(1, Math.ceil(items.length / pageSize))
    const link = (p: number) => `${path}${path.includes('?') ? '&' : '?'}page=${p}`
    return {
      '@id': path,
      '@type': 'Collection',
      totalItems: items.length,
      member: items.slice((page - 1) * pageSize, page * pageSize),
      ...(last > 1 ? { view: { '@id': link(page), '@type': 'PartialCollectionView', first: link(1), last: link(last), ...(page < last ? { next: link(page + 1) } : {}) } } : {}),
    }
  }

  private playlistJson(playlist: MockPlaylist) {
    const tracks = playlist.items.map((item) => this.tracks.find((t) => t.id === item.trackId)!)
    const albums = [...new Set(tracks.map((t) => t.albumId))].map((albumId) => this.albums.find((a) => a.id === albumId)!)
    return {
      '@id': `/api/playlists/${playlist.id}`,
      '@type': 'Playlist',
      id: playlist.id,
      name: playlist.name,
      position: this.playlists.indexOf(playlist),
      trackCount: tracks.length,
      durationMs: tracks.length * TRACK_SECONDS * 1000,
      covers: albums.filter((a) => a.cover).slice(0, 4).map((a) => this.signed(`/api/albums/${a.id}/cover`)),
    }
  }

  private itemJson(item: { id: string; trackId: string }, position: number) {
    return {
      '@id': `/api/playlist_items/${item.id}`,
      '@type': 'PlaylistItem',
      id: item.id,
      position,
      track: this.trackJson(this.tracks.find((t) => t.id === item.trackId)!),
    }
  }

  private userJson(user: MockUser) {
    return {
      '@id': `/api/users/${user.id}`,
      '@type': 'User',
      id: user.id,
      roles: user.admin ? ['ROLE_ADMIN', 'ROLE_USER'] : ['ROLE_USER'],
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar === null ? null : `${this.signed(`/api/users/${user.id}/avatar`)}&file=avatar-${user.avatar}.jpg`,
      username: user.username,
      admin: user.admin,
    }
  }

  private signed(path: string): string {
    return `${API}${path}?_expiration=${Math.floor(Date.now() / 1000) + 6 * 3600}&_hash=mock-signature`
  }

  // --- Requests ------------------------------------------------------------------------------------------------------

  private async handle(route: Route, request: Request): Promise<void> {
    const url = new URL(request.url())
    const origin = (await request.headerValue('origin')) ?? '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type, range',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'content-range, content-length, accept-ranges',
    }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors })
    }
    this.requests.push(`${request.method()} ${url.pathname}${url.search}`)

    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: status < 400 ? 'application/ld+json' : 'application/json', body: JSON.stringify(body) })
    const notFound = () => reply(404, { '@type': 'Error', title: 'An error occurred', detail: 'Not Found', status: 404 })
    const path = url.pathname

    // Public endpoints.
    if (request.method() === 'POST' && path === '/api/auth') {
      // The username or the email.
      const { username, password } = request.postDataJSON() as { username: string; password: string }
      const user = this.users.find((u) => u.username === username || (u.email !== null && u.email === username.trim().toLowerCase()))
      return user && user.password === password ? reply(200, this.issue(user.id)) : reply(401, { code: 401, message: 'Invalid credentials.' })
    }
    if (path === '/api/setup' && request.method() === 'GET') {
      return reply(200, { '@id': '/api/setup', '@type': 'Setup', required: this.users.length === 0 })
    }
    if (path === '/api/setup' && request.method() === 'POST') {
      if (this.users.length > 0) {
        return reply(409, { '@type': 'Error', title: 'An error occurred', detail: 'This server is already set up: sign in instead.', status: 409 })
      }
      const body = request.postDataJSON() as Record<string, unknown>
      const refused = this.checkAccount(body, null, ['email', 'name', 'password'])
      if (refused) {
        return reply(422, refused)
      }
      const admin = this.addUser({ username: this.usernameFor(String(body.email)), email: String(body.email).trim().toLowerCase(), name: String(body.name), password: String(body.password), admin: true })
      return reply(201, this.issue(admin.id))
    }
    if (request.method() === 'POST' && path === '/api/token/refresh') {
      const { refresh_token } = request.postDataJSON() as { refresh_token: string }
      this.refreshes.push(refresh_token)
      // The API's grace period: a spent token whose successor is unused, presented within 5 minutes, is refreshed
      // as that successor.
      const successor = this.successors.get(refresh_token)
      const spent = this.refreshTokens.has(refresh_token)
        ? refresh_token
        : successor && Date.now() - successor.at < GRACE_SECONDS * 1000 && this.refreshTokens.has(successor.token)
          ? successor.token
          : null
      if (!spent) {
        return reply(401, { code: 401, message: 'JWT Refresh Token Not Found' })
      }
      const owner = this.refreshTokens.get(spent)!
      this.refreshTokens.delete(spent)
      const issued = this.issue(owner)
      this.successors.set(refresh_token, { token: issued.refresh_token, at: Date.now() })
      if (this.loseNextRefreshResponse) {
        this.loseNextRefreshResponse = false
        return route.abort('connectionreset')
      }
      return reply(200, issued)
    }
    if (request.method() === 'POST' && path === '/api/logout') {
      const { refresh_token } = request.postDataJSON() as { refresh_token: string }
      this.logouts.push(refresh_token)
      const known = this.refreshTokens.delete(refresh_token)
      return reply(200, { code: 200, message: known ? 'The supplied refresh_token has been invalidated.' : 'The supplied refresh_token is already invalid.' })
    }

    // Media: signed URLs, no Authorization header.
    // The Opus version is the same tone: browsers look at the audio itself, not at the URL.
    let match = /^\/api\/tracks\/([^/]+)\/stream(\/opus)?$/.exec(path)
    if (match) {
      if (this.expiredStreams > 0) {
        this.expiredStreams--
        return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"code":401,"message":"Expired"}' })
      }
      return route.fulfill({ status: 200, headers: { ...cors, 'Accept-Ranges': 'bytes' }, contentType: 'audio/wav', body: WAV })
    }
    match = /^\/api\/users\/([^/]+)\/avatar$/.exec(path)
    if (match && request.method() === 'GET') {
      const user = this.users.find((u) => u.id === match![1])
      if (!user || user.avatar === null) {
        return notFound()
      }
      const hue = (user.avatar * 97) % 360
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hue} 70% 55%)"/></svg>`
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/svg+xml', body: svg })
    }
    match = /^\/api\/(albums|artists)\/([^/]+)\/cover$/.exec(path)
    if (match) {
      const hue = (parseInt(match[2].slice(-4), 16) * 47) % 360
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hue} 60% 45%)"/></svg>`
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/svg+xml', body: svg })
    }

    // Everything else needs a valid JWT.
    const token = (await request.headerValue('authorization'))?.replace(/^Bearer /, '')
    // A deleted account's tokens stop working at once: the API can't load its account.
    const me = token ? this.users.find((user) => user.id === this.accessTokens.get(token)) : undefined
    if (!token || !me) {
      return reply(401, { code: 401, message: token ? 'Invalid JWT Token' : 'JWT Token not found' })
    }
    const page = Number(url.searchParams.get('page') ?? 1)

    // As API Platform: a PATCH must be a JSON merge patch.
    if (request.method() === 'PATCH' && (await request.headerValue('content-type')) !== 'application/merge-patch+json') {
      return reply(415, { '@type': 'Error', title: 'An error occurred', detail: 'The content-type is not supported.', status: 415 })
    }
    // Playlists: the user's only; positions are indexes from 0; a track may appear several times.
    const invalid = (detail: string) => reply(422, { '@type': 'ConstraintViolation', title: 'An error occurred', detail, status: 422 })
    const validName = (name: unknown): name is string => typeof name === 'string' && name.length >= 1 && name.length <= 100 && name.trim() === name
    if (path === '/api/playlists' && request.method() === 'POST') {
      const { name } = request.postDataJSON() as { name?: unknown }
      if (!validName(name)) {
        return invalid('name: This value should not be blank.')
      }
      const playlist = { id: `00000000-0000-4000-9000-${String(++this.playlistCount).padStart(12, '0')}`, name, changed: ++this.changes, items: [] }
      this.playlists.unshift(playlist)
      return reply(201, this.playlistJson(playlist))
    }
    if (path === '/api/playlists') {
      return reply(200, this.collection('/api/playlists', this.playlists.map((p) => this.playlistJson(p)), page))
    }
    if ((match = /^\/api\/playlists\/([^/]+)(\/items)?$/.exec(path))) {
      const playlist = this.playlists.find((p) => p.id === match![1])
      if (!playlist) {
        return notFound()
      }
      const items = match[2] !== undefined
      if (!items && request.method() === 'PATCH') {
        const { name, position } = request.postDataJSON() as { name?: unknown; position?: unknown }
        if (name !== undefined && !validName(name)) {
          return invalid('name: This value is not valid.')
        }
        if (position !== undefined && (typeof position !== 'number' || !Number.isInteger(position) || position < 0)) {
          return invalid('position: This value should be either positive or zero.')
        }
        if (typeof name === 'string' && name !== playlist.name) {
          playlist.name = name
          playlist.changed = ++this.changes
        }
        if (typeof position === 'number') {
          // Moving isn't a change to the playlist (no updatedAt): only its place among the others.
          this.playlists.splice(this.playlists.indexOf(playlist), 1)
          this.playlists.splice(Math.min(position, this.playlists.length), 0, playlist)
        }
        return reply(200, this.playlistJson(playlist))
      }
      if (!items && request.method() === 'DELETE') {
        this.playlists.splice(this.playlists.indexOf(playlist), 1)
        return route.fulfill({ status: 204, headers: cors })
      }
      if (items && request.method() === 'POST') {
        const { tracks } = request.postDataJSON() as { tracks?: unknown }
        const ids = Array.isArray(tracks) ? tracks.map((t) => String(t).split('/').pop()!) : []
        if (ids.length === 0 || ids.some((trackId) => !this.tracks.some((t) => t.id === trackId))) {
          return invalid('tracks: Unknown track.')
        }
        playlist.items.push(...ids.map((trackId) => ({ id: `item-${++this.changes}`, trackId })))
        playlist.changed = ++this.changes
        return reply(200, this.playlistJson(playlist))
      }
      if (items) {
        return reply(200, this.collection(`/api/playlists/${playlist.id}/items`, playlist.items.map((item, i) => this.itemJson(item, i)), page))
      }
      return reply(200, this.playlistJson(playlist))
    }
    if ((match = /^\/api\/playlist_items\/([^/]+)$/.exec(path))) {
      const playlist = this.playlists.find((p) => p.items.some((item) => item.id === match![1]))
      if (!playlist) {
        return notFound()
      }
      const from = playlist.items.findIndex((item) => item.id === match![1])
      const [item] = playlist.items.splice(from, 1)
      playlist.changed = ++this.changes
      if (request.method() === 'DELETE') {
        return route.fulfill({ status: 204, headers: cors })
      }
      const { position } = request.postDataJSON() as { position?: unknown }
      if (typeof position !== 'number' || position < 0) {
        playlist.items.splice(from, 0, item)
        return invalid('position: This value should be either positive or zero.')
      }
      const to = Math.min(position, playlist.items.length)
      playlist.items.splice(to, 0, item)
      return reply(200, this.itemJson(item, to))
    }

    // Opus ahead of time: the same checks as the API; nothing is converted (the mock's Opus is the same tone).
    if (request.method() === 'POST' && path === '/api/transcodes') {
      const body = request.postDataJSON() as { device?: unknown; tracks?: unknown }
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (typeof body.device !== 'string' || !uuid.test(body.device) || !Array.isArray(body.tracks) || body.tracks.length > 20) {
        return reply(422, { '@type': 'ConstraintViolation', title: 'An error occurred', detail: 'Invalid request', status: 422 })
      }
      const tracks = body.tracks.map(String)
      this.transcodes.push({ device: body.device, tracks })
      return reply(202, { queued: tracks, ready: [], converting: [] })
    }

    // Favourites: PUT and DELETE are idempotent (204), the lists are newest first.
    if ((match = /^\/api\/(track|album|artist)s\/([^/]+)\/favourite$/.exec(path))) {
      const kind = match[1] as 'track' | 'album' | 'artist'
      const itemId = match[2]
      const items: { id: string }[] = kind === 'track' ? this.tracks : kind === 'album' ? this.albums : this.artists
      if (!items.some((item) => item.id === itemId)) {
        return notFound()
      }
      if (this.failFavourites > 0) {
        this.failFavourites--
        return reply(500, { '@type': 'Error', title: 'An error occurred', detail: 'Internal Server Error', status: 500 })
      }
      const without = this.favourites[kind].filter((favourite) => favourite !== itemId)
      this.favourites[kind] = request.method() === 'PUT' ? [itemId, ...without] : without
      return route.fulfill({ status: 204, headers: cors })
    }
    if ((match = /^\/api\/favourites\/(track|album|artist)s$/.exec(path))) {
      const kind = match[1] as 'track' | 'album' | 'artist'
      const ids = this.favourites[kind]
      const members: unknown[] =
        kind === 'track'
          ? ids.map((favourite) => this.trackJson(this.tracks.find((t) => t.id === favourite)!))
          : kind === 'album'
            ? ids.map((favourite) => this.albumJson(this.albums.find((a) => a.id === favourite)!))
            : ids.map((favourite) => this.artistJson(this.artists.find((a) => a.id === favourite)!))
      return reply(200, this.collection(`/api/favourites/${kind}s`, members, page))
    }

    if (await this.handleAccounts(request, path, me, page, reply, () => route.fulfill({ status: 204, headers: cors }))) {
      return
    }
    if (path === '/api/artists') {
      const remaining = this.failures.get(page) ?? 0
      if (remaining > 0) {
        this.failures.set(page, remaining - 1)
        return reply(500, { '@type': 'Error', title: 'An error occurred', detail: 'Simulated failure', status: 500 })
      }
      return reply(200, this.collection('/api/artists', this.artists.map((a) => this.artistJson(a)), page))
    }
    if ((match = /^\/api\/artists\/([^/]+)$/.exec(path))) {
      const artist = this.artists.find((a) => a.id === match![1])
      return artist ? reply(200, this.artistJson(artist)) : notFound()
    }
    if (path === '/api/albums') {
      const artistId = url.searchParams.get('artist')?.split('/').pop()
      const artistName = (album: MockAlbum) => this.artists.find((a) => a.id === album.artistId)!.name
      // As the API sorts them: album artist by name, then year and title (by year for one artist).
      const albums = this.albums
        .filter((a) => !artistId || a.artistId === artistId)
        .sort((a, b) => artistName(a).localeCompare(artistName(b)) || (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title))
      return reply(200, this.collection(`/api/albums${artistId ? `?artist=${encodeURIComponent(`/api/artists/${artistId}`)}` : ''}`, albums.map((a) => this.albumJson(a)), page))
    }
    if ((match = /^\/api\/albums\/([^/]+)$/.exec(path))) {
      const album = this.albums.find((a) => a.id === match![1])
      return album ? reply(200, this.albumJson(album)) : notFound()
    }
    if (path === '/api/tracks') {
      const albumId = url.searchParams.get('album')?.split('/').pop()
      const albumArtistId = url.searchParams.get('albumArtist')?.split('/').pop()
      const albumOf = (t: MockTrack) => this.albums.find((a) => a.id === t.albumId)!
      const artistOf = (t: MockTrack) => this.artists.find((a) => a.id === albumOf(t).artistId)!.name
      // As the API sorts them: album artist by name, album by year and title, then track number.
      const tracks = this.tracks
        .filter((t) => (!albumId || t.albumId === albumId) && (!albumArtistId || albumOf(t).artistId === albumArtistId))
        .sort(
          (a, b) =>
            artistOf(a).localeCompare(artistOf(b)) ||
            (albumOf(a).year ?? 0) - (albumOf(b).year ?? 0) ||
            albumOf(a).title.localeCompare(albumOf(b).title) ||
            a.trackNumber - b.trackNumber,
        )
      const filter = [...url.searchParams].filter(([name]) => name !== 'page').map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&')
      return reply(200, this.collection(`/api/tracks${filter ? `?${filter}` : ''}`, tracks.map((t) => this.trackJson(t)), page))
    }
    if ((match = /^\/api\/tracks\/([^/]+)$/.exec(path))) {
      const track = this.tracks.find((t) => t.id === match![1])
      return track ? reply(200, { ...this.trackJson(track), lyrics: track.hasLyrics ? `${track.title}, the first line\nThe second line\n\nThe chorus` : null }) : notFound()
    }
    if (path === '/api/search') {
      return reply(200, this.search(url.searchParams.get('q') ?? '', Number(url.searchParams.get('limit') ?? 10)))
    }
    return notFound()
  }

  /** Every word, in any order, ignoring case and accents (the API also ranks them; not needed here). */
  private search(query: string, limit: number) {
    const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    const words = fold(query).split(/\s+/).filter(Boolean)
    const matches = (...fields: string[]) => words.every((word) => fields.some((field) => fold(field).includes(word)))
    const artistName = (artistId: string) => this.artists.find((a) => a.id === artistId)!.name
    const albumTitle = (albumId: string) => this.albums.find((a) => a.id === albumId)!.title
    const artists = this.artists.filter((a) => matches(a.name))
    const albums = this.albums.filter((a) => matches(a.title, artistName(a.artistId)))
    const tracks = this.tracks.filter((t) => matches(t.title, artistName(t.artistId), albumTitle(t.albumId)))
    return {
      '@id': '/api/search',
      '@type': 'Search',
      query: words.join(' '),
      artists: artists.slice(0, limit).map((a) => this.artistJson(a)),
      totalArtists: artists.length,
      albums: albums.slice(0, limit).map((a) => this.albumJson(a)),
      totalAlbums: albums.length,
      tracks: tracks.slice(0, limit).map((t) => this.trackJson(t)),
      totalTracks: tracks.length,
    }
  }

  // --- Accounts ------------------------------------------------------------------------------------------------------

  /**
   * /api/me, /api/users and the pictures, with the API's rules: administrators only for /api/users, usernames made
   * from emails, unique usernames and emails, a server never without an administrator, an administrator never
   * deleting their own account, a new password signing the account out. False (nothing answered) for any other path.
   */
  private async handleAccounts(
    request: Request,
    path: string,
    me: MockUser,
    page: number,
    reply: (status: number, body: unknown) => Promise<void>,
    replyEmpty: () => Promise<void>,
  ): Promise<boolean> {
    const method = request.method()
    const route = async (status: number, body: unknown) => {
      await reply(status, body)
      return true
    }
    const noContent = async () => {
      await replyEmpty()
      return true
    }
    const conflict = (detail: string) => route(409, { '@type': 'Error', title: 'An error occurred', detail, status: 409 })

    if (path === '/api/me' && method === 'GET') {
      return route(200, { ...this.userJson(me), '@id': '/api/me' })
    }
    if (path === '/api/me' && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>
      return this.applyPatch(me, body, ['name', 'username', 'email'], route)
    }
    if (path === '/api/me/password' && method === 'POST') {
      const { currentPassword, newPassword } = request.postDataJSON() as { currentPassword?: string; newPassword?: string }
      if (currentPassword !== me.password) {
        return route(422, violations([['currentPassword', 'The current password is wrong.']]))
      }
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return route(422, violations([['newPassword', 'The password has at least 8 characters.']]))
      }
      me.password = newPassword
      this.signOutEverywhere(me.id)
      return route(200, this.issue(me.id))
    }
    let match = /^\/api\/(?:me|users\/([^/]+))\/avatar$/.exec(path)
    if (match && (method === 'POST' || method === 'DELETE')) {
      const target = match[1] === undefined ? me : this.users.find((u) => u.id === match![1])
      if (match[1] !== undefined && !me.admin) {
        return route(403, { '@type': 'Error', title: 'An error occurred', detail: 'Access Denied.', status: 403 })
      }
      if (!target) {
        return route(404, { '@type': 'Error', title: 'An error occurred', detail: 'No account with this id.', status: 404 })
      }
      if (method === 'DELETE') {
        target.avatar = null
        return noContent()
      }
      const contentType = (await request.headerValue('content-type')) ?? ''
      const body = request.postDataBuffer()?.toString('latin1') ?? ''
      if (!contentType.startsWith('multipart/form-data') || !/name="file"/.test(body)) {
        return route(422, { '@type': 'Error', title: 'An error occurred', detail: 'Send the picture as multipart/form-data, in a field named "file".', status: 422 })
      }
      this.avatarUploads.push(match[1] ?? 'me')
      target.avatar = ++this.changes
      // As the API: plain JSON, not JSON-LD.
      const json = this.userJson(target)
      return route(200, Object.fromEntries(Object.entries(json).filter(([key]) => !key.startsWith('@'))))
    }

    if (!path.startsWith('/api/users')) {
      return false
    }
    if (!me.admin) {
      return route(403, { '@type': 'Error', title: 'An error occurred', detail: 'Access Denied.', status: 403 })
    }
    if (path === '/api/users' && method === 'GET') {
      return route(200, this.collection('/api/users', this.users.map((u) => this.userJson(u)), page))
    }
    if (path === '/api/users' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      const refused = this.checkAccount(body, null, ['email', 'name', 'password'])
      if (refused) {
        return route(422, refused)
      }
      const user = this.addUser({
        username: this.usernameFor(String(body.email)),
        email: String(body.email).trim().toLowerCase(),
        name: String(body.name),
        password: String(body.password),
        admin: body.admin === true,
      })
      return route(201, this.userJson(user))
    }
    match = /^\/api\/users\/([^/]+)$/.exec(path)
    const user = match ? this.users.find((u) => u.id === match![1]) : undefined
    if (!user) {
      return route(404, { '@type': 'Error', title: 'An error occurred', detail: 'Not Found', status: 404 })
    }
    if (method === 'GET') {
      return route(200, this.userJson(user))
    }
    if (method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>
      if (body.admin === false && user.admin && this.users.filter((u) => u.admin).length === 1) {
        return conflict('This is the last administrator: make another account an administrator first.')
      }
      return this.applyPatch(user, body, ['name', 'username', 'email', 'admin', 'password'], route)
    }
    if (method === 'DELETE') {
      if (user.id === me.id) {
        return conflict('An administrator cannot delete their own account: ask another administrator.')
      }
      this.users.splice(this.users.indexOf(user), 1)
      this.signOutEverywhere(user.id)
      return noContent()
    }
    return false
  }

  private applyPatch(user: MockUser, body: Record<string, unknown>, allowed: string[], reply: (status: number, body: unknown) => Promise<boolean>) {
    const fields = allowed.filter((field) => body[field] !== undefined)
    const refused = this.checkAccount(body, user, fields)
    if (refused) {
      return reply(422, refused)
    }
    if (typeof body.name === 'string') user.name = body.name
    if (typeof body.username === 'string') user.username = body.username
    if (typeof body.email === 'string') user.email = body.email.trim().toLowerCase()
    if (typeof body.admin === 'boolean' && allowed.includes('admin')) user.admin = body.admin
    if (typeof body.password === 'string' && allowed.includes('password')) {
      user.password = body.password
      this.signOutEverywhere(user.id)
    }
    this.users.sort((a, b) => a.username.localeCompare(b.username))
    return reply(200, this.userJson(user))
  }

  /** The API's checks of an account's fields (only `fields`), or null when they pass. */
  private checkAccount(body: Record<string, unknown>, user: MockUser | null, fields: string[]) {
    const problems: [string, string][] = []
    const others = this.users.filter((u) => u !== user)
    for (const field of fields) {
      const value = body[field]
      if (field === 'email') {
        const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push(['email', 'This is not a valid email.'])
        else if (others.some((u) => u.email === email)) problems.push(['email', 'Another account already uses this email.'])
      } else if (field === 'name') {
        if (typeof value !== 'string' || value.trim() === '') problems.push(['name', 'The name cannot be empty.'])
        else if (value.trim() !== value) problems.push(['name', 'The name cannot start or end with a space.'])
      } else if (field === 'username') {
        if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{3,32}$/.test(value)) problems.push(['username', 'Use 3 to 32 letters, digits, dots, dashes or underscores.'])
        else if (others.some((u) => u.username === value)) problems.push(['username', 'This username is already taken.'])
      } else if (field === 'password') {
        if (typeof value !== 'string' || value.length < 8) problems.push(['password', 'The password has at least 8 characters.'])
      }
    }
    return problems.length > 0 ? violations(problems) : null
  }

  /** As the API: the part of the email before the @, `-1` when too short, then `-2`, `-3`... when taken. */
  private usernameFor(email: string): string {
    let base = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 29)
    if (base.length < 3) {
      base = `${base}-1`.padStart(3, 'x')
    }
    let candidate = base
    for (let n = 2; this.users.some((u) => u.username === candidate); n++) {
      candidate = `${base}-${n}`
    }
    return candidate
  }

  /** Every session of an account ends (new password, deleted account): its refresh tokens stop working. */
  private signOutEverywhere(userId: string): void {
    for (const [token, owner] of this.refreshTokens) {
      if (owner === userId) {
        this.refreshTokens.delete(token)
      }
    }
  }

  private issue(userId: string) {
    this.issued++
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = Buffer.from(JSON.stringify({ exp, sub: userId, n: this.issued })).toString('base64url')
    const token = `mock.${payload}.signature`
    const refreshToken = `refresh-${this.issued}`
    this.accessTokens.set(token, userId)
    this.refreshTokens.set(refreshToken, userId)
    return { token, refresh_token: refreshToken, refresh_token_expiration: exp + 30 * 86400 }
  }
}

/** A ConstraintViolation (422), as API Platform answers it. */
function violations(problems: [string, string][]) {
  return {
    '@type': 'ConstraintViolation',
    title: 'An error occurred',
    status: 422,
    violations: problems.map(([propertyPath, message]) => ({ propertyPath, message })),
    detail: problems.map(([field, message]) => `${field}: ${message}`).join('\n'),
  }
}

/** TRACK_SECONDS of a quiet 440 Hz tone: 8 kHz, 8-bit mono WAV. */
const WAV = (() => {
  const rate = 8000
  const samples = rate * TRACK_SECONDS
  const buffer = Buffer.alloc(44 + samples)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate, 28)
  buffer.writeUInt16LE(1, 32)
  buffer.writeUInt16LE(8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples, 40)
  for (let i = 0; i < samples; i++) {
    buffer[44 + i] = 128 + Math.round(20 * Math.sin((2 * Math.PI * 440 * i) / rate))
  }
  return buffer
})()
