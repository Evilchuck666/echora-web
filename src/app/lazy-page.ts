import type { ReactNode } from 'react'

/** Set once a reload was tried for a page that wouldn't load, so a page that really fails doesn't reload forever. */
const RELOADED_KEY = 'echora.reloadedForChunk'

/**
 * A route's page loaded when it is first opened (React Router's `lazy`): pages few people open (setup, profile,
 * administration, history) stay out of the code every visit downloads.
 *
 * After a deploy, a tab opened before it asks for the old version's file, which the server no longer has: the page
 * reloads once, getting the new version. A page that still won't load shows the router's error.
 */
export function lazyPage(load: () => Promise<ReactNode>): () => Promise<{ element: ReactNode }> {
  return async () => {
    try {
      const element = await load()
      sessionStorage.removeItem(RELOADED_KEY)
      return { element }
    } catch (error) {
      if (!sessionStorage.getItem(RELOADED_KEY)) {
        sessionStorage.setItem(RELOADED_KEY, '1')
        window.location.reload()
        // Nothing to show meanwhile: the page is going away.
        return new Promise<never>(() => {})
      }
      throw error
    }
  }
}
