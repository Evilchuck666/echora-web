import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { SEARCH_PATH, searchUrl, useLeaveSearch } from '../library/search'

/** How long typing has to pause before the results follow. */
const DELAY_MS = 300

/**
 * The search field of the header. Typing opens the results page (/search?q=...) after a short pause; further typing
 * there replaces the URL instead of adding history, so Back leaves the search in one step. Emptying the field, with
 * its × button or by deleting the text, leaves the results for the page the search started from. "/" focuses it
 * from anywhere, Escape leaves it.
 */
export function SearchBox() {
  const navigate = useNavigate()
  const leaveSearch = useLeaveSearch()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const onSearchPage = location.pathname === SEARCH_PATH
  const urlQuery = onSearchPage ? (searchParams.get('q') ?? '') : ''

  const [text, setText] = useState(urlQuery)
  const [followedQuery, setFollowedQuery] = useState(urlQuery)
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef<number | undefined>(undefined)
  const onSearchPageRef = useRef(onSearchPage)

  // Follow the URL when it changes from elsewhere: Back and Forward, or a result was opened (the field empties).
  // The text typed so far is kept while it already matches, trailing space included. (Adjusted while rendering,
  // as React recommends for state derived from a changing value.)
  if (urlQuery !== followedQuery) {
    setFollowedQuery(urlQuery)
    setText((current) => (current.trim() === urlQuery ? current : urlQuery))
  }

  useEffect(() => {
    onSearchPageRef.current = onSearchPage
  }, [onSearchPage])

  useEffect(() => () => window.clearTimeout(pending.current), [])

  // "/" focuses the field, unless the user is typing somewhere else.
  useEffect(() => {
    function focusOnSlash(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [])

  function search(value: string) {
    window.clearTimeout(pending.current)
    const query = value.trim()
    if (query) {
      navigate(searchUrl(query), { replace: onSearchPageRef.current })
    } else if (onSearchPageRef.current) {
      leaveSearch()
    }
    // Emptied on another page: there is nothing to show, and nothing to leave.
  }

  function change(value: string) {
    setText(value)
    window.clearTimeout(pending.current)
    pending.current = window.setTimeout(() => search(value), DELAY_MS)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    search(text)
  }

  function clear() {
    setText('')
    input.current?.focus()
    search('')
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && input.current?.blur()}
        placeholder="Search artists, albums, tracks"
        aria-label="Search the library"
        // The browser's own clear button (Chrome, Safari) gives way to ours, which every browser gets.
        className="w-full rounded-full border border-neutral-700 bg-neutral-900 py-1.5 pr-9 pl-4 text-sm outline-none placeholder:text-neutral-500 focus:border-violet-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {text !== '' && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear the search"
          title="Clear the search"
          className="absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      )}
    </form>
  )
}
