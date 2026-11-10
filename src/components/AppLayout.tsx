import { Link, Outlet, ScrollRestoration } from 'react-router'
import { signOut } from '../auth/session'
import { useCurrentUser } from '../auth/useCurrentUser'
import { PlayerBar } from '../player/PlayerBar'
import { useDockedColumn } from '../player/usePanels'
import { SearchBox } from './SearchBox'
import { Toaster } from './Toaster'

/** The frame of every signed-in page. */
export function AppLayout() {
  const { data: user } = useCurrentUser()
  // On large screens the player's panels have a column at the right: the page takes the rest.
  const dockedColumn = useDockedColumn()

  return (
    <div className="flex min-h-svh flex-col">
      {/* A fixed height (h-14): the player's column starts below it. */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 backdrop-blur">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Echora
        </Link>
        <div className="mx-4 max-w-md flex-1">
          <SearchBox />
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm">
          {user && <span className="hidden text-neutral-400 sm:inline">{user.username}</span>}
          <button type="button" onClick={() => void signOut()} className="text-neutral-300 hover:text-white">
            Sign out
          </button>
        </div>
      </header>
      <div className={`flex flex-1 flex-col ${dockedColumn ? 'pr-96' : ''}`}>
        <Outlet />
      </div>
      {/* Back and forward return to where the page was scrolled; the lists come from the query cache meanwhile. */}
      <ScrollRestoration />
      <PlayerBar />
      <Toaster />
    </div>
  )
}
