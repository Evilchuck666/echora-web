import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { MoreIcon } from '../player/icons'

export interface MenuAction {
  label: string
  onSelect: () => unknown
}

interface ActionsMenuProps {
  /** The button's accessible name, e.g. "More options for Killer". */
  label: string
  actions: MenuAction[]
  className?: string
}

/** Room kept clear at the bottom of the screen for the player bar. */
const PLAYER_BAR_PX = 80
/** Roughly the menu's height: below that much room, it opens upwards. */
const MENU_PX = 120
/** The menu's width (w-48), to keep it on screen. */
const MENU_WIDTH_PX = 192
/** Distance kept from the edges of the screen. */
const MARGIN_PX = 8

interface Position {
  left: number
  top?: number
  bottom?: number
}

/**
 * A "⋯" button that opens a menu of actions. Keyboard: the arrows, Home and End move between them, Escape closes the
 * menu and returns to the button. It closes on a click elsewhere, on scroll and on resize. Drawn over the page (a
 * portal), so lists and panels that clip their content don't cut it.
 */
export function ActionsMenu({ label, actions, className = '' }: ActionsMenuProps) {
  const [position, setPosition] = useState<Position | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const open = position !== null

  function show() {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    // Lined up with the button's right edge, but never off screen.
    const left = Math.max(MARGIN_PX, Math.min(rect.right - MENU_WIDTH_PX, window.innerWidth - MENU_WIDTH_PX - MARGIN_PX))
    const upwards = rect.bottom + MENU_PX > window.innerHeight - PLAYER_BAR_PX
    setPosition(upwards ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 })
  }

  function close(returnFocus: boolean) {
    setPosition(null)
    if (returnFocus) {
      button.current?.focus()
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) {
        setPosition(null)
      }
    }
    const dismiss = () => setPosition(null)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  function onMenuKeyDown(event: KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const focus = (index: number) => items[(index + items.length) % items.length]?.focus()
    if (event.key === 'ArrowDown') {
      focus(at + 1)
    } else if (event.key === 'ArrowUp') {
      focus(at - 1)
    } else if (event.key === 'Home') {
      focus(0)
    } else if (event.key === 'End') {
      focus(items.length - 1)
    } else if (event.key === 'Escape') {
      // Handled: an open panel doesn't close as well.
      close(true)
    } else if (event.key === 'Tab') {
      close(false)
      return
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    // A double click here doesn't reach the row around it (a double click on a track row plays it).
    <span onDoubleClick={(event) => event.stopPropagation()} className={className}>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close(false) : show())}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 hover:text-white aria-expanded:bg-neutral-800"
      >
        <MoreIcon className="h-5 w-5" />
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={position}
            className="fixed z-50 w-48 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-2xl"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(true)
                  void action.onSelect()
                }}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none"
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  )
}
