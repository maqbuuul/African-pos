import { Button, Input } from '@hospitality-os/ui'
import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router'

import { useSessionStore } from '../features/session/session-store.js'

function parseQrSlug(): string | null {
  const params = new URLSearchParams(window.location.search)
  const slug = params.get('table') ?? params.get('slug') ?? params.get('qr')
  if (slug) localStorage.setItem('qr_slug', slug)
  return slug ?? localStorage.getItem('qr_slug')
}

export function EntryPage() {
  const token = useSessionStore((s) => s.token)
  const startSession = useSessionStore((s) => s.startSession)
  const [qrSlug, setQrSlug] = useState(parseQrSlug)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (token) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!qrSlug) return
    setLoading(true)
    setError(null)
    try {
      await startSession(qrSlug)
    } catch {
      setError('That QR code isn\'t recognized — ask a staff member for help.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">Welcome</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Scan a QR code on your table to view the menu and order.</p>

        <div className="mt-6">
          <Input
            label="Table QR code"
            placeholder="Enter QR slug or scan code"
            value={qrSlug ?? ''}
            onChange={(e) => setQrSlug(e.target.value)}
            error={error ?? undefined}
          />
        </div>

        <Button type="submit" className="mt-6 w-full" loading={loading} disabled={!qrSlug}>
          Start ordering
        </Button>
      </form>
    </main>
  )
}
