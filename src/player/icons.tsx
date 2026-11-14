// Small inline icons for the player. Decorative: the buttons that hold them carry the label.

interface IconProps {
  className?: string
}

const base = (className = 'h-5 w-5') => ({ viewBox: '0 0 24 24', fill: 'currentColor', className, 'aria-hidden': true })

export const PlayIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
)

export const PauseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
  </svg>
)

export const NextIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 5.5v13a1 1 0 0 0 1.53.85L16 13.5V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.5L6.53 4.65A1 1 0 0 0 5 5.5Z" />
  </svg>
)

export const PreviousIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M19 5.5v13a1 1 0 0 1-1.53.85L8 13.5V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.5l9.47-5.85A1 1 0 0 1 19 5.5Z" />
  </svg>
)

export const VolumeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 2.5a6 6 0 0 1 0 9l-1.06-1.06a4.5 4.5 0 0 0 0-6.88L15.5 7.5Zm2.47-2.47a9.5 9.5 0 0 1 0 13.94l-1.06-1.06a8 8 0 0 0 0-11.82l1.06-1.06Z" />
  </svg>
)

export const MutedIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 5 6 9H3v6h3l5 4V5Zm5.03 4.47 1.97 1.97 1.97-1.97 1.06 1.06-1.97 1.97 1.97 1.97-1.06 1.06-1.97-1.97-1.97 1.97-1.06-1.06 1.97-1.97-1.97-1.97 1.06-1.06Z" />
  </svg>
)

/** Three bars: marks the track that is playing. */
export const NowPlayingIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 10h3v9H5zM10.5 5h3v14h-3zM16 13h3v6h-3z" />
  </svg>
)

/** Lines of text with a microphone: the lyrics. */
export const LyricsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 5h11v2H3zM3 10h8v2H3zM3 15h6v2H3zM17 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Zm-5 7h1.5a3.5 3.5 0 0 0 7 0H22a5 5 0 0 1-4.25 4.94V19h-1.5v-3.06A5 5 0 0 1 12 11Z" />
  </svg>
)

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z" />
  </svg>
)

export const ShuffleIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M16 3h5v5l-1.8-1.8-3.6 3.6-1.4-1.4 3.6-3.6L16 3ZM3 5.6 4.4 4.2 19.2 19l1.8-1.8V21h-5l1.8-1.8L3 5.6Zm7.4 8.6 1.4 1.4-6.4 6.4L4 20.6l6.4-6.4Z" />
  </svg>
)

export const RepeatIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z" />
  </svg>
)

/** Repeat with a 1 in it: repeat the current track. */
export const RepeatOneIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Zm-4-2V9h-1l-2 1v1h1.5v4H13Z" />
  </svg>
)

/** A list with a play mark: the queue. */
export const QueueIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 5h14v2H3zM3 10h14v2H3zM3 15h8v2H3zM15 14.5v6l5-3-5-3Z" />
  </svg>
)

/** Three dots: more options. */
export const MoreIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 10.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm7 0a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm7 0a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z" />
  </svg>
)

/** Six dots: a handle to drag. */
export const DragHandleIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M9 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-6 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
  </svg>
)

/** A gauge: the audio quality. */
export const QualityIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 4a10 10 0 0 0-10 10 9.9 9.9 0 0 0 1.4 5.1l.3.4h16.6l.3-.4A9.9 9.9 0 0 0 22 14 10 10 0 0 0 12 4Zm7.1 13.5H4.9A8 8 0 0 1 4 14a8 8 0 0 1 16 0 8 8 0 0 1-.9 3.5ZM16.6 8.7l-3.7 3.5a2 2 0 1 0 1.4 1.4l3.6-3.6-1.3-1.3Z" />
  </svg>
)

/** A heart, outlined: not a favourite. */
export const HeartIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 20.7 10.6 19.4C5.4 14.7 2 11.6 2 7.8 2 4.7 4.4 2.3 7.5 2.3c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.6 11.6L12 20.7Zm0-2.7c4.8-4.3 8-7.2 8-10.2 0-2-1.5-3.5-3.5-3.5-1.5 0-3 1-3.6 2.4h-1.8C10.5 5.3 9 4.3 7.5 4.3 5.5 4.3 4 5.8 4 7.8c0 3 3.2 5.9 8 10.2Z" />
  </svg>
)

/** A heart, filled: a favourite. */
export const HeartFilledIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 20.7 10.6 19.4C5.4 14.7 2 11.6 2 7.8 2 4.7 4.4 2.3 7.5 2.3c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.6 11.6L12 20.7Z" />
  </svg>
)

/** Three lines: the navigation menu. */
export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
  </svg>
)

/** A person: the artists. */
export const ArtistsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 10c4.4 0 8 2 8 4.5V22H4v-3.5C4 16 7.6 14 12 14Zm0 2c-3.5 0-6 1.5-6 2.5V20h12v-1.5c0-1-2.5-2.5-6-2.5Z" />
  </svg>
)

/** A plus: create something new. */
export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
  </svg>
)

/** A list with a note: a playlist. */
export const PlaylistIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 5h12v2H3zM3 10h12v2H3zM3 15h7v2H3zM17 8h4v2h-2v7.5a2.5 2.5 0 1 1-2-2.45V8Z" />
  </svg>
)

/** A record: the albums. */
export const AlbumsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  </svg>
)

/** A note: the tracks. */
export const TracksIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
  </svg>
)

/** A clock with an arrow going back: the listening history. */
export const HistoryIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M13 3a9 9 0 0 0-9 9H1l3.9 3.9.1.1L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3Zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12Z" />
  </svg>
)

/** A chevron pointing up: opens the Now playing view (turned over to close it). */
export const ExpandIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41Z" />
  </svg>
)

/** A sparkle: what is new, the albums recently added. */
export const RecentIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M10 2.5 11.9 8.1 17.5 10 11.9 11.9 10 17.5 8.1 11.9 2.5 10 8.1 8.1 10 2.5Zm8 11 .95 2.55L21.5 17l-2.55.95L18 20.5l-.95-2.55L14.5 17l2.55-.95L18 13.5Z" />
  </svg>
)
