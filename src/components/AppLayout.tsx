import { Link, Outlet } from 'react-router'
import { signOut } from '../auth/session'
import { useCurrentUser } from '../auth/useCurrentUser'

/** The frame of every signed-in page. */
export function AppLayout() {
  const { data: user } = useCurrentUser()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Echora
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user && <span className="text-neutral-400">{user.username}</span>}
          <button type="button" onClick={() => void signOut()} className="text-neutral-300 hover:text-white">
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
