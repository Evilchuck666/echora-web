import { create } from 'zustand'
import { useSession } from '../auth/tokens'

/** Whether the Now playing view is open (opened from the cover in the player bar). */
export const useNowPlaying = create<{ open: boolean }>(() => ({ open: false }))

export const NOW_PLAYING_ID = 'now-playing'

export function toggleNowPlaying(): void {
  useNowPlaying.setState((state) => ({ open: !state.open }))
}

export function closeNowPlaying(): void {
  useNowPlaying.setState({ open: false })
}

// The next account starts with it closed.
useSession.subscribe((session, previous) => {
  if (previous.signedIn && !session.signedIn) {
    closeNowPlaying()
  }
})
