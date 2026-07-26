import { ConnectivityIndicator, type ConnectivityStatus } from '@hospitality-os/ui'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'

import { useCartStore } from '../features/cart/cart-store.js'
import { useOrderStore } from '../features/order/order-store.js'
import { useSessionStore } from '../features/session/session-store.js'

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
  const table = useSessionStore((s) => s.table)
  const clearSession = useSessionStore((s) => s.clearSession)
  const order = useOrderStore((s) => s.order)
  const clearOrder = useOrderStore((s) => s.clearOrder)
  const clearCart = useCartStore((s) => s.clear)
  const connectivity = useConnectivityStatus()
  const location = useLocation()
  const navigate = useNavigate()

  const handleExit = () => {
    clearSession()
    clearOrder()
    clearCart()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{table?.label}</h2>
          {table?.section ? <p className="text-xs text-ink-faint">{table.section}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {order ? (
            <Link
              to={location.pathname === '/order' ? '/' : '/order'}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
            >
              {location.pathname === '/order' ? 'Menu' : 'My order'}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleExit}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
          >
            Exit
          </button>
        </div>
      </header>

      {connectivity !== 'online' ? (
        <div className="px-4 pt-3">
          <ConnectivityIndicator status={connectivity} />
        </div>
      ) : null}

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
