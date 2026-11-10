import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

interface PlayerPanelProps {
  id: string
  /** The panel's accessible name, e.g. "Lyrics"; the close button is "Close the lyrics". */
  label: string
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  /** Buttons of the panel, in its header before the ×. */
  actions?: ReactNode
  /** A section of the column at the right of the page, instead of a card floating over it. */
  docked?: boolean
  /** Floating on wide screens: sits to the left of another panel instead of at the right edge. */
  beside?: boolean
  children: ReactNode
}

const FLOATING =
  'fixed inset-x-2 top-16 bottom-22 z-20 rounded-lg border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:top-auto sm:right-4 sm:max-h-[min(40rem,calc(100svh-8rem))] sm:w-96'
/** In the column: sections share its height, with a line between them. */
const DOCKED = 'min-h-0 flex-1 border-b border-neutral-800 last:border-b-0'

/**
 * The frame of the panels opened from the player bar (lyrics, queue): a section of the column at the right of the
 * page on large screens; elsewhere, above the bar, a card on the right (two side by side when there is room), or the
 * whole screen between the header and the bar on narrow ones. See usePanels.
 */
export function PlayerPanel({ id, label, title, subtitle, onClose, actions, docked = false, beside = false, children }: PlayerPanelProps) {
  return (
    <aside
      id={id}
      aria-label={label}
      className={`flex flex-col ${docked ? DOCKED : FLOATING} ${beside && !docked ? 'lg:right-[25.75rem]' : ''}`}
    >
      <div className="flex items-start gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-sm text-neutral-400">{subtitle}</p>}
        </div>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close the ${label.toLowerCase()}`}
          className="-mr-1 p-1 text-neutral-400 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>
      {children}
    </aside>
  )
}
