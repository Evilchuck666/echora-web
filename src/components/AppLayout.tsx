import { useCallback, useRef, useState } from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { NowPlaying } from '../player/NowPlaying'
import { PlayerBar } from '../player/PlayerBar'
import { MenuIcon } from '../player/icons'
import { useDockedColumn } from '../player/usePanels'
import { AccountMenu } from './AccountMenu'
import { NAV_DRAWER_ID, NavDrawer } from './NavDrawer'
import { Navigation } from './Navigation'
import { SearchBox } from './SearchBox'
import { Toaster } from './Toaster'

/**
 * The frame of every signed-in page: the header, the navigation (a sidebar on large screens, a drawer opened from
 * the header on small ones), the page, and the player with its column of panels.
 */
export function AppLayout() {
  // On large screens the player's panels have a column at the right: the page takes the rest.
  const dockedColumn = useDockedColumn()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const menuButton = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex min-h-svh flex-col">
      {/* A fixed height (h-14): the player's column starts below it. */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 backdrop-blur">
        <div className="flex shrink-0 items-center gap-1">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open the navigation"
            aria-expanded={drawerOpen}
            aria-controls={drawerOpen ? NAV_DRAWER_ID : undefined}
            className="-ml-2 p-2 text-neutral-300 hover:text-white lg:hidden"
          >
            <MenuIcon />
          </button>
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Echora
          </Link>
        </div>
        <div className="mx-4 max-w-md flex-1">
          <SearchBox />
        </div>
        <div className="-mr-1 shrink-0">
          <AccountMenu />
        </div>
      </header>
      {/* Between the header (h-14) and the player bar (h-20), as the player's column on the other side. */}
      <aside className="fixed top-14 bottom-20 left-0 z-10 hidden w-56 overflow-y-auto border-r border-neutral-800 bg-neutral-950 px-3 py-4 lg:block">
        <Navigation />
      </aside>
      {drawerOpen && <NavDrawer onClose={closeDrawer} opener={menuButton} />}
      <div className={`flex flex-1 flex-col lg:pl-56 ${dockedColumn ? 'pr-96' : ''}`}>
        <Outlet />
      </div>
      {/* Back and forward return to where the page was scrolled; the lists come from the query cache meanwhile. */}
      <ScrollRestoration />
      <NowPlaying />
      <PlayerBar />
      <Toaster />
    </div>
  )
}
