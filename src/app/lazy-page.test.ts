import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lazyPage } from './lazy-page'

describe('lazyPage', () => {
  let reload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()
    reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)
  })

  afterEach(() => vi.restoreAllMocks())

  it('gives the page', async () => {
    expect(await lazyPage(async () => 'the page')()).toEqual({ element: 'the page' })
    expect(reload).not.toHaveBeenCalled()
  })

  it("reloads once when the page's file can't be loaded (a deploy since the tab opened)", async () => {
    const failing = lazyPage(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))

    void failing()
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())

    // After the reload, the same failure is shown instead of reloading again.
    await expect(failing()).rejects.toThrow('Failed to fetch dynamically imported module')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads again for a later deploy, once a page loaded meanwhile', async () => {
    const failing = lazyPage(() => Promise.reject(new TypeError('Failed to fetch')))
    void failing()
    await lazyPage(async () => 'the page')()

    void failing()
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2))
  })
})
