import { useState } from 'react'

interface ArtistImageProps {
  /** The artist's signed `coverUrl` (a thumbnail), used as is; missing when the artist has no image. */
  url: string | null | undefined
  /** Shown as its initial when there is no image. */
  name: string
  /** Size and text size, e.g. "w-full text-4xl". */
  className?: string
}

/**
 * An artist's thumbnail, round, or the initial of the name when there is none or it fails to load (e.g. its
 * signature expired). Decorative: the name is always written next to it.
 */
export function ArtistImage({ url, name, className = '' }: ArtistImageProps) {
  // Keyed by URL, so a new URL gets a fresh attempt after a failed one.
  return <ArtistImageInner key={url ?? 'none'} url={url} name={name} className={className} />
}

function ArtistImageInner({ url, name, className }: ArtistImageProps) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex aspect-square items-center justify-center rounded-full bg-violet-900/60 font-semibold text-violet-200 ${className}`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`aspect-square rounded-full bg-neutral-800 object-cover ${className}`}
    />
  )
}
