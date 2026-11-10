import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface PlayerPanelProps {
  id: string
  /** The panel's accessible name, e.g. "Lyrics"; the close button is "Close the lyrics". */
  label: string
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * The frame of the panels opened from the player bar (lyrics, queue), above it: a card on the right on wide screens,
 * the whole screen between the header and the bar on narrow ones. Escape closes it, unless it is leaving a field
 * (the search box) or something else handled it (a menu).
 */
export function PlayerPanel({ id, label, title, subtitle, onClose, children }: PlayerPanelProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && !event.defaultPrevented && !target?.closest('input:not([type="range"]), textarea, select')) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside
      id={id}
      aria-label={label}
      className="fixed inset-x-2 top-16 bottom-22 z-20 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:top-auto sm:right-4 sm:max-h-[min(40rem,calc(100svh-8rem))] sm:w-96"
    >
      <div className="flex items-start gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-sm text-neutral-400">{subtitle}</p>}
        </div>
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
