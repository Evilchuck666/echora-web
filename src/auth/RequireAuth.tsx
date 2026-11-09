import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './tokens'

/** Renders the child routes when signed in; otherwise sends to /login, which comes back here afterwards. */
export function RequireAuth() {
  const signedIn = useSession((session) => session.signedIn)
  const location = useLocation()

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
