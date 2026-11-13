import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreIcon } from '../player/icons'

export interface MenuAction {
  label: string
  /** A second, quieter line under the label. */
  description?: string
  /** A choice among others (a radio item, ticked when chosen) rather than an action. */
  checked?: boolean
  /** Shown, but can't be chosen; `description` should say why. */
  disabled?: boolean
  /** A heading shared by the consecutive actions that have it (a group of the menu, e.g. "Volume leveling"). */
  section?: string
  onSelect: () => unknown
}

interface ActionsMenuProps {
  /** The button's accessible name, e.g. "More options for Killer". */
  label: string
  actions: MenuAction[]
  className?: string
  /** What the button shows: "⋯" unless given. */
  icon?: ReactNode
  /** Classes of the button, instead of the round "⋯" one. */
  buttonClassName?: string
  /** A wider menu, for items with a description. */
  wide?: boolean
}

const ITEM = '[role^="menuitem"]'

/** Room kept clear at the bottom of the screen for the player bar. */
const PLAYER_BAR_PX = 80
/** Roughly the menu's height: below that much room, it opens upwards. */
const MENU_PX = 120
/** The menu's width (w-48, or w-64 when wide), to keep it on screen. */
const MENU_WIDTH_PX = { normal: 192, wide: 256 }
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
export function ActionsMenu({ label, actions, className = '', icon, buttonClassName, wide = false }: ActionsMenuProps) {
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
    const width = MENU_WIDTH_PX[wide ? 'wide' : 'normal']
    const left = Math.max(MARGIN_PX, Math.min(rect.right - width, window.innerWidth - width - MARGIN_PX))
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
    // The chosen item of a choice, else the first one.
    const items = [...(menu.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
    ;(items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus({ preventScroll: true })
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
    const items = [...(menu.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
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

  function renderItem(action: MenuAction) {
    return (
      <button
        key={action.label}
        type="button"
        role={action.checked === undefined ? 'menuitem' : 'menuitemradio'}
        aria-checked={action.checked}
        aria-disabled={action.disabled || undefined}
        tabIndex={-1}
        onClick={() => {
          if (action.disabled) {
            return
          }
          close(true)
          void action.onSelect()
        }}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none aria-disabled:cursor-default aria-disabled:opacity-50"
      >
        {action.checked !== undefined && (
          <span aria-hidden="true" className="w-4 shrink-0 text-violet-400">
            {action.checked ? '✓' : ''}
          </span>
        )}
        <span className="min-w-0">
          <span className="block">{action.label}</span>
          {action.description && <span className="block text-xs text-neutral-400">{action.description}</span>}
        </span>
      </button>
    )
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
        className={
          buttonClassName ??
          'flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 hover:text-white aria-expanded:bg-neutral-800'
        }
      >
        {icon ?? <MoreIcon className="h-5 w-5" />}
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
            className={`fixed z-50 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-2xl ${wide ? 'w-64' : 'w-48'}`}
          >
            {sections(actions).map(({ section, items }, index) =>
              section ? (
                <div key={section} role="group" aria-label={section} className={index > 0 ? 'mt-1 border-t border-neutral-800 pt-1' : ''}>
                  <div aria-hidden="true" className="px-3 pt-1.5 pb-1 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                    {section}
                  </div>
                  {items.map(renderItem)}
                </div>
              ) : (
                items.map(renderItem)
              ),
            )}
          </div>,
          document.body,
        )}
    </span>
  )
}

/** The actions, by section: consecutive actions with the same `section` (or none) together, in order. */
function sections(actions: MenuAction[]): { section?: string; items: MenuAction[] }[] {
  const result: { section?: string; items: MenuAction[] }[] = []
  for (const action of actions) {
    const last = result.at(-1)
    if (last && last.section === action.section) {
      last.items.push(action)
    } else {
      result.push({ section: action.section, items: [action] })
    }
  }
  return result
}
