import { ConnectivityIndicator, type ConnectivityStatus } from '@hospitality-os/ui'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'

import { useAuthStore } from '../features/auth/auth-store.js'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/approvals', label: 'Approvals', end: false },
]

function useConnectivityStatus(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>(navigator.onLine ? 'online' : 'offline')

  useEffect(() => {
    const goOnline = () => setStatus('online')
    const goOffline = () => setStatus('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return status
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const connectivity = useConnectivityStatus()

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-56 flex-col border-r border-border bg-surface px-3 py-4">
        <p className="px-2 text-sm font-semibold text-ink">Manager Portal</p>
        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-2 py-2 text-sm font-medium ${
                  isActive ? 'bg-status-active-bg text-status-active' : 'text-ink-soft hover:bg-surface-2'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2">
          <p className="truncate text-xs text-ink-faint">{user?.email}</p>
          <button type="button" onClick={logout} className="text-xs font-medium text-ink-soft hover:text-ink">
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1">
        {connectivity !== 'online' ? (
          <div className="px-6 pt-4">
            <ConnectivityIndicator status={connectivity} />
          </div>
        ) : null}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
