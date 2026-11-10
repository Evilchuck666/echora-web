import { create } from 'zustand'

interface ToastState {
  message: string | null
  /** Changes on every toast, so the same message twice in a row shows for its full time again. */
  id: number
}

/** The toast on screen, if any; shown by Toaster. */
export const useToast = create<ToastState>()(() => ({ message: null, id: 0 }))

/** A short confirmation at the bottom of the screen, also read by screen readers ("Added to the queue"). */
export function showToast(message: string): void {
  useToast.setState((state) => ({ message, id: state.id + 1 }))
}
