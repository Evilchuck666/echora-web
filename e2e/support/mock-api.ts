import type { BrowserContext, Request, Route } from '@playwright/test'

/** The origin the app calls (VITE_API_URL in .env). Every request to it is answered here, never by a server. */
export const API = 'https://localhost'

export const USERNAME = 'listener'
export const PASSWORD = 'secret'

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

  private accessTokens = new Set<string>()
  private refreshTokens = new Set<string>()
  /** Like the API's grace period: presented refresh token → the one issued for it, and when. */
  private successors = new Map<string, { token: string; at: number }>()
  private issued = 0
  private failures = new Map<number, number>()
  private readonly options: MockApiOptions

  constructor(options: MockApiOptions = {}) {
    this.options = options
    this.addLibrary()
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
      ...(withArtist ? { artist: { '@id': `/api/artists/${artist.id}`, '@type': 'Artist', id: artist.id, name: artist.name } } : {}),
    }
  }

  private trackJson(track: MockTrack) {
    const artist = this.artists.find((a) => a.id === track.artistId)!
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
      hasLyrics: track.hasLyrics,
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      const { username, password } = request.postDataJSON() as { username: string; password: string }
      return username === USERNAME && password === PASSWORD ? reply(200, this.issue()) : reply(401, { code: 401, message: 'Invalid credentials.' })
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
      this.refreshTokens.delete(spent)
      const issued = this.issue()
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
    let match = /^\/api\/tracks\/([^/]+)\/stream$/.exec(path)
    if (match) {
      if (this.expiredStreams > 0) {
        this.expiredStreams--
        return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"code":401,"message":"Expired"}' })
      }
      return route.fulfill({ status: 200, headers: { ...cors, 'Accept-Ranges': 'bytes' }, contentType: 'audio/wav', body: WAV })
    }
    match = /^\/api\/(albums|artists)\/([^/]+)\/cover$/.exec(path)
    if (match) {
      const hue = (parseInt(match[2].slice(-4), 16) * 47) % 360
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hue} 60% 45%)"/></svg>`
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/svg+xml', body: svg })
    }

    // Everything else needs a valid JWT.
    const token = (await request.headerValue('authorization'))?.replace(/^Bearer /, '')
    if (!token || !this.accessTokens.has(token)) {
      return reply(401, { code: 401, message: token ? 'Invalid JWT Token' : 'JWT Token not found' })
    }
    const page = Number(url.searchParams.get('page') ?? 1)

    if (path === '/api/me') {
      return reply(200, { '@id': '/api/me', '@type': 'User', id: id(0), username: USERNAME, roles: ['ROLE_USER'] })
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
      const albums = this.albums.filter((a) => !artistId || a.artistId === artistId).sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
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

  private issue() {
    this.issued++
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = Buffer.from(JSON.stringify({ exp, username: USERNAME, n: this.issued })).toString('base64url')
    const token = `mock.${payload}.signature`
    const refreshToken = `refresh-${this.issued}`
    this.accessTokens.add(token)
    this.refreshTokens.add(refreshToken)
    return { token, refresh_token: refreshToken, refresh_token_expiration: exp + 30 * 86400 }
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
