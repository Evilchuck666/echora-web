/**
 * A stand-in for the Web Locks API shared by every "tab" of a test: requests for the same name run one after the
 * other, like in a browser. happy-dom doesn't implement it.
 */
export function installLocks(): () => void {
  const tails = new Map<string, Promise<unknown>>()
  const locks = {
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => callback())
      tails.set(name, run.catch(() => undefined))
      return run
    },
  }
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
  return () => {
    delete (navigator as { locks?: unknown }).locks
  }
}
