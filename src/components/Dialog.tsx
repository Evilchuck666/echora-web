import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../player/icons'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A modal dialog over the page: the focus goes to its first field (or button), stays inside while it is open, and
 * goes back where it was afterwards. Escape, the × and a click outside close it. Drawn in a portal; its keys, clicks
 * and double clicks don't reach what is behind it (a menu, a panel, the navigation drawer, a track row).
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const focusBack = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('input, textarea, select') ?? panel.current?.querySelector<HTMLElement>('button')
    first?.focus()
    return () => focusBack?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled), input, textarea, select') ?? [])]
      const first = items[0]
      const last = items.at(-1)
      // From the panel itself (after a click on its text), Shift+Tab goes round to the last item too.
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return createPortal(
    // React passes a portal's events on to the components it was rendered from: a click or double click here must
    // not reach them (a track row plays on a double click, e.g. selecting a word of its lyrics).
    <div
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        // Focusable, so a click on its text keeps the focus inside and Escape still closes it.
        tabIndex={-1}
        className="relative flex outline-none max-h-[min(36rem,calc(100svh-2rem))] w-full max-w-md flex-col rounded-lg border border-neutral-800 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <h2 id={titleId} className="truncate font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 p-1 text-neutral-400 hover:text-white">
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
