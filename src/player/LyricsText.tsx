import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { useLyrics } from '../library/queries'
import type { PlayerTrack } from './store'

/**
 * The lyrics of a track as they load: a spinner, an error with a retry, "no lyrics", or the text. Lists already say
 * whether a track has lyrics: a track without them isn't asked for.
 */
export function LyricsText({ track }: { track: Pick<PlayerTrack, 'id' | 'hasLyrics'> }) {
  const lyrics = useLyrics(track.hasLyrics === false ? undefined : track.id)

  if (track.hasLyrics === false || lyrics.data === null) {
    return <p className="py-8 text-center text-neutral-400">This track has no lyrics.</p>
  }
  if (lyrics.isLoadingError) {
    return <QueryError error={lyrics.error} retry={lyrics.refetch} />
  }
  if (lyrics.data === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }
  return <p className="leading-relaxed whitespace-pre-line text-neutral-200">{lyrics.data}</p>
}
