import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

const SEARCH_PATH = '/search'

/** How long typing has to pause before the results follow. */
const DELAY_MS = 300

/**
 * The search field of the header. Typing opens the results page (/search?q=...) after a short pause; further typing
 * there replaces the URL instead of adding history, so Back leaves the search in one step. "/" focuses it from
 * anywhere, Escape leaves it.
 */
export function SearchBox() {
  const navigate = useNavigate()
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
    // Clearing the field on another page has nothing to show.
    if (!query && !onSearchPageRef.current) {
      return
    }
    navigate(query ? `${SEARCH_PATH}?${new URLSearchParams({ q: query })}` : SEARCH_PATH, { replace: onSearchPageRef.current })
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

  return (
    <form role="search" onSubmit={submit} className="w-full">
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && input.current?.blur()}
        placeholder="Search artists, albums, tracks"
        aria-label="Search the library"
        className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm outline-none placeholder:text-neutral-500 focus:border-violet-500"
      />
    </form>
  )
}
