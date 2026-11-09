import type { components } from '../api/schema'

type Schemas = components['schemas']

export type Artist = Schemas['Artist.jsonld-artist.read']
export type Album = Schemas['Album.jsonld-album.read']
export type Track = Schemas['Track.jsonld-track.read']
