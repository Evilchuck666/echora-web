import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePlayer } from './store'

export type PanelName = 'lyrics' | 'queue'

/** Room for a column of its own at the right of the page, next to the content (Tailwind's `xl`). */
const DOCK = '(min-width: 80rem)'
/** Room for two floating panels side by side (Tailwind's `lg`). */
const WIDE = '(min-width: 64rem)'

interface PanelsState {
  /** Sections open in the column, on screens wide enough for it. Remembered: the queue shows from the start. */
  docked: PanelName[]
  /** Panels floating over the page on smaller screens, in the order they were opened. Not remembered. */
  floating: PanelName[]
}

const usePanelsStore = create<PanelsState>()(
  persist((): PanelsState => ({ docked: ['queue'], floating: [] }), {
    name: 'echora.panels',
    partialize: ({ docked }) => ({ docked }),
  }),
)

const matches = (query: string) => window.matchMedia(query).matches

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }
}
const subscribeToDock = subscribeTo(DOCK)
const subscribeToWide = subscribeTo(WIDE)

const useDockMode = () => useSyncExternalStore(subscribeToDock, () => matches(DOCK))

/**
 * The player's panels (lyrics, queue). On screens wide enough, a column at the right of the page holds them, the
 * queue above the lyrics; the queue is open there from the start, and what is open is remembered. On smaller ones
 * they float over the page, side by side when there is room, one at a time otherwise (the last one opened stays
 * after a resize). Escape closes the last floating panel opened, unless it is leaving a field (the search box) or
 * something else handled it (a menu, a drag in the queue); the column stays, as part of the page.
 */
export function usePanels() {
  const docked = useDockMode()
  const wide = useSyncExternalStore(subscribeToWide, () => matches(WIDE))
  const { docked: dockedOpen, floating } = usePanelsStore()
  const shown = docked ? dockedOpen : wide ? floating : floating.slice(-1)

  const toggle = useCallback((name: PanelName) => {
    if (matches(DOCK)) {
      usePanelsStore.setState(({ docked }) => ({ docked: docked.includes(name) ? docked.filter((open) => open !== name) : [...docked, name] }))
      return
    }
    usePanelsStore.setState(({ floating }) => {
      const visible = matches(WIDE) ? floating : floating.slice(-1)
      if (visible.includes(name)) {
        return { floating: floating.filter((open) => open !== name) }
      }
      return { floating: [...(matches(WIDE) ? floating.filter((open) => open !== name) : []), name] }
    })
  }, [])

  const close = useCallback((name: PanelName) => {
    usePanelsStore.setState((state) =>
      matches(DOCK) ? { docked: state.docked.filter((open) => open !== name) } : { floating: state.floating.filter((open) => open !== name) },
    )
  }, [])

  const lastFloating = docked ? undefined : shown.at(-1)
  useEffect(() => {
    if (!lastFloating) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && !event.defaultPrevented && !target?.closest('input:not([type="range"]), textarea, select')) {
        close(lastFloating!)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lastFloating, close])

  return { docked, isOpen: (name: PanelName) => shown.includes(name), toggle, close }
}

/** Whether the panels' column is on screen, so the page leaves it room: wide screen, something open, a track loaded. */
export function useDockedColumn(): boolean {
  const docked = useDockMode()
  const anyOpen = usePanelsStore((state) => state.docked.length > 0)
  const loaded = usePlayer((state) => state.index >= 0)
  return docked && anyOpen && loaded
}
