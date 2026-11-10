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
