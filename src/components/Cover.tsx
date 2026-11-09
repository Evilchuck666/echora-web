import { useState } from 'react'

interface CoverProps {
  /** The album's signed `coverUrl`, used as is; `null` when the album has no cover. */
  url: string | null | undefined
  alt: string
  className?: string
}

/** An album cover, or a placeholder when there is none or it fails to load (e.g. its signature expired). */
export function Cover({ url, alt, className = '' }: CoverProps) {
  // Keyed by URL, so a new URL gets a fresh attempt after a failed one.
  return <CoverImage key={url ?? 'none'} url={url} alt={alt} className={className} />
}

function CoverImage({ url, alt, className }: CoverProps) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex aspect-square items-center justify-center bg-neutral-800 text-neutral-600 ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-1/3 w-1/3" aria-hidden="true">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`aspect-square bg-neutral-800 object-cover ${className}`}
    />
  )
}
