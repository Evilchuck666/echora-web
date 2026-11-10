import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { CloseIcon } from '../player/icons'
import { Navigation } from './Navigation'

export const NAV_DRAWER_ID = 'nav-drawer'

/** From this width the sidebar shows the navigation, and the drawer isn't needed (Tailwind's `lg`). */
const SIDEBAR = '(min-width: 64rem)'

interface NavDrawerProps {
  onClose: () => void
  /** Gets the focus back when the drawer closes: the button that opened it. */
  opener: RefObject<HTMLButtonElement | null>
}

/**
 * The navigation on small screens: a panel that slides in from the left, over the page. It closes when a place is
 * chosen, on Escape, on a click outside, and when the screen gets wide enough for the sidebar. The focus stays
 * inside while it is open, and goes back to the menu button afterwards.
 */
export function NavDrawer({ onClose, opener }: NavDrawerProps) {
  const panel = useRef<HTMLDivElement>(null)
  const { pathname, search } = useLocation()
  const openedAt = useRef(pathname + search)

  // A place was chosen.
  useEffect(() => {
    if (pathname + search !== openedAt.current) {
      onClose()
    }
  }, [pathname, search, onClose])

  useEffect(() => {
    const focusBack = opener.current
    panel.current?.querySelector<HTMLElement>('a, button')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const sidebar = window.matchMedia(SIDEBAR)
    sidebar.addEventListener('change', onClose)
    return () => {
      document.body.style.overflow = previousOverflow
      sidebar.removeEventListener('change', onClose)
      focusBack?.focus()
    }
  }, [onClose, opener])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      // Keep the focus inside the drawer.
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a, button') ?? [])]
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        ref={panel}
        id={NAV_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onKeyDown={onKeyDown}
        className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 border-r border-neutral-800 bg-neutral-950 px-3 py-3"
      >
        <div className="flex items-center justify-between pl-3">
          <span className="text-lg font-semibold tracking-tight">Echora</span>
          <button type="button" onClick={onClose} aria-label="Close the navigation" className="p-2 text-neutral-400 hover:text-white">
            <CloseIcon />
          </button>
        </div>
        <Navigation />
      </div>
    </div>
  )
}
