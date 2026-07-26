import { Navigate, Outlet, useLocation } from 'react-router'

import { useSessionStore } from '../features/session/session-store.js'

export function RequireSession() {
  const token = useSessionStore((s) => s.token)
  const location = useLocation()

  // Physical QR stickers point at `/?table=<slug>` — preserve the query
  // string through the redirect so a scan always lands on a pre-filled
  // entry form, not a blank one.
  if (!token) return <Navigate to={{ pathname: '/welcome', search: location.search }} replace />

  return <Outlet />
}
