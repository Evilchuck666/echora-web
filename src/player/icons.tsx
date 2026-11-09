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
