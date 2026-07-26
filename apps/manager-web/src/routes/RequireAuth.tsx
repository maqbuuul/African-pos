import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthStore } from '../features/auth/auth-store.js'

export function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
