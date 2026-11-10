import { useEffect } from 'react'
import { useToast } from './toast'

/** How long a toast stays on screen. */
const TOAST_MS = 3000

/** Where toasts (showToast) appear; mounted once in AppLayout. The live region is always there, so every message is announced. */
export function Toaster() {
  const { message, id } = useToast()

  useEffect(() => {
    if (message === null) {
      return
    }
    const timer = setTimeout(() => useToast.setState({ message: null }), TOAST_MS)
    return () => clearTimeout(timer)
  }, [message, id])

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
      {message && (
        <p key={id} className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 shadow-lg">
          {message}
        </p>
      )}
    </div>
  )
}
