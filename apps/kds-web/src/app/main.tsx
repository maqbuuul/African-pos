import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'

type ViewMode = 'station' | 'expo' | 'analytics' | 'plain-text'
type TicketItemStatus = 'open' | 'accepted' | 'in_progress' | 'ready' | 'void_requested' | 'voided' | string

type Session = {
  token: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
    organizationId: string
  }
}

type Station = {
  id: string
  organizationId: string
  locationId: string
  code: string
  name: string
  description: string | null
  assignedStaffId: string | null
  isExpo: boolean
  stationType: string
  expectedPrepTimeSeconds: number
  recallGraceSeconds: number
  sortOrder: number
  status: string
  createdAt: string
  updatedAt: string
}

type TicketItem = {
  id: string
  organizationId: string
  locationId: string
  ticketId: string
  stationId: string
  orderId: string
  orderItemId: string
  nameSnapshot: string
  localNameSnapshot: string | null
  quantity: number
  seatNumber: number | null
  course: string | null
  kitchenNote: string | null
  pourCost: number
  status: TicketItemStatus
  voidReason: string | null
  createdAt: string
  startedAt: string | null
  readyAt: string | null
  recalledAt: string | null
  voidRequestedAt: string | null
  voidAcknowledgedAt: string | null
  ageSeconds: number
  attentionFlags: string[]
}

type StationTicket = {
  id: string
  organizationId: string
  locationId: string
  stationId: string
  orderId: string
  tableId: string | null
  firedByActorId: string
  isRush: boolean
  isVip: boolean
  status: string
  createdAt: string
  readyAt: string | null
  ageSeconds: number
  readyItems: number
  totalItems: number
  items: TicketItem[]
}

type StationBatch = {
  batchKey: string
  stationId: string
  nameSnapshot: string
  quantityTotal: number
  ticketItemIds: string[]
  ticketIds: string[]
  oldestAgeSeconds: number
}

type StationQueueResponse = {
  station: Station
  tickets: StationTicket[]
  batches: StationBatch[]
}

type ExpoStationSummary = {
  stationId: string
  stationCode: string
  stationName: string
  ticketId: string
  status: string
  readyItems: number
  totalItems: number
}

type ExpoEntry = {
  orderId: string
  tableId: string | null
  tableLabel: string | null
  oldestFiredAt: string
  ageSeconds: number
  fullyReady: boolean
  stations: ExpoStationSummary[]
}

type AnalyticsStation = {
  stationId: string
  stationCode: string
  stationName: string
  expectedPrepTimeSeconds: number
  averageCompletedSeconds: number
  averageActiveAgeSeconds: number
  activeTicketItems: number
  completedTicketItems: number
}

type AnalyticsAlert = {
  type: string
  delayedStationId: string
  delayedStationName: string
  delayedAverageAgeSeconds: number
  baselineSeconds: number
  suggestedReliefStationId: string | null
  suggestedReliefStationName: string | null
}

type AnalyticsResponse = {
  stations: AnalyticsStation[]
  alerts: AnalyticsAlert[]
}

type LoginResponse = Session

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  token?: string | null
}

const API_BASE_URL_KEY = 'kds-web.api-base-url'
const SESSION_KEY = 'kds-web.session'
const POLL_INTERVAL_MS = 15_000

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')
const shortId = (value: string | null | undefined) => (value ? value.slice(0, 8) : '—')
const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

const formatTimestamp = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const readStoredSession = (): Session | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object') {
    const maybeMessage = 'message' in payload ? payload.message : undefined
    const maybeCode = 'code' in payload ? payload.code : undefined
    if (Array.isArray(maybeMessage)) {
      return maybeMessage.map((entry) => String(entry)).join(', ')
    }
    if (typeof maybeMessage === 'string' && typeof maybeCode === 'string') {
      return `${maybeMessage} (${maybeCode})`
    }
    if (typeof maybeMessage === 'string') return maybeMessage
  }
  return fallback
}

const buildPlainTextView = (
  station: Station | null,
  queue: StationQueueResponse | null,
  expo: ExpoEntry[],
  analytics: AnalyticsResponse | null,
) => {
  const lines: string[] = []
  lines.push('KITCHEN DISPLAY SYSTEM')
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')

  lines.push('STATION VIEW')
  if (!station) {
    lines.push('No station selected.')
  } else {
    lines.push(`${station.name} [${station.code}]`)
    lines.push(`Status: ${station.status}`)
    lines.push(`Prep target: ${formatDuration(station.expectedPrepTimeSeconds)}`)
    lines.push(`Recall grace: ${formatDuration(station.recallGraceSeconds)}`)
    lines.push('')
    if (queue?.batches.length) {
      lines.push('Batched items:')
      for (const batch of queue.batches) {
        lines.push(`- ${batch.quantityTotal}x ${batch.nameSnapshot} | oldest ${formatDuration(batch.oldestAgeSeconds)} | tickets ${batch.ticketIds.length}`)
      }
      lines.push('')
    }
    if (queue?.tickets.length) {
      for (const ticket of queue.tickets) {
        lines.push(`Ticket ${shortId(ticket.id)} | Order ${shortId(ticket.orderId)} | ${ticket.readyItems}/${ticket.totalItems} ready | age ${formatDuration(ticket.ageSeconds)}`)
        for (const item of ticket.items) {
          const parts = [`  - ${item.quantity}x ${item.nameSnapshot}`, `[${item.status}]`, `age ${formatDuration(item.ageSeconds)}`]
          if (item.localNameSnapshot) parts.push(`local: ${item.localNameSnapshot}`)
          if (item.seatNumber !== null) parts.push(`seat ${item.seatNumber}`)
          if (item.course) parts.push(`course ${item.course}`)
          if (item.attentionFlags.includes('allergy')) parts.push('ALLERGY')
          lines.push(parts.join(' | '))
          if (item.kitchenNote) lines.push(`    note: ${item.kitchenNote}`)
          if (item.voidReason) lines.push(`    void reason: ${item.voidReason}`)
        }
        lines.push('')
      }
    } else {
      lines.push('No station tickets.')
      lines.push('')
    }
  }

  lines.push('EXPO VIEW')
  if (expo.length === 0) {
    lines.push('No expo groups.')
  } else {
    for (const group of expo) {
      lines.push(`Order ${shortId(group.orderId)} | ${group.tableLabel ?? group.tableId ?? 'Walk-in'} | ${group.fullyReady ? 'READY' : 'WAITING'} | age ${formatDuration(group.ageSeconds)}`)
      for (const stationSummary of group.stations) {
        lines.push(`  - ${stationSummary.stationName}: ${stationSummary.readyItems}/${stationSummary.totalItems} ready [${stationSummary.status}]`)
      }
    }
  }
  lines.push('')

  lines.push('ANALYTICS')
  if (!analytics || analytics.stations.length === 0) {
    lines.push('No analytics available.')
  } else {
    for (const entry of analytics.stations) {
      lines.push(
        `${entry.stationName}: active ${entry.activeTicketItems}, completed ${entry.completedTicketItems}, avg complete ${formatDuration(entry.averageCompletedSeconds)}, avg active age ${formatDuration(entry.averageActiveAgeSeconds)}`,
      )
    }
    if (analytics.alerts.length) {
      lines.push('')
      lines.push('Alerts:')
      for (const alert of analytics.alerts) {
        lines.push(
          `- ${alert.delayedStationName} delayed: active age ${formatDuration(alert.delayedAverageAgeSeconds)} vs baseline ${formatDuration(alert.baselineSeconds)}${alert.suggestedReliefStationName ? ` | relief: ${alert.suggestedReliefStationName}` : ''}`,
        )
      }
    }
  }

  return lines.join('\n')
}

function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => normalizeBaseUrl(window.localStorage.getItem(API_BASE_URL_KEY) ?? 'http://localhost:3000'))
  const [session, setSession] = useState<Session | null>(() => readStoredSession())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [view, setView] = useState<ViewMode>('station')
  const [stations, setStations] = useState<Station[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedStationId, setSelectedStationId] = useState('')
  const [stationQueue, setStationQueue] = useState<StationQueueResponse | null>(null)
  const [expoEntries, setExpoEntries] = useState<ExpoEntry[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loginError, setLoginError] = useState('')
  const [appError, setAppError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isLoadingStations, setIsLoadingStations] = useState(false)
  const [isLoadingStationQueue, setIsLoadingStationQueue] = useState(false)
  const [isLoadingExpo, setIsLoadingExpo] = useState(false)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [pendingActionId, setPendingActionId] = useState('')

  useEffect(() => {
    window.localStorage.setItem(API_BASE_URL_KEY, apiBaseUrl)
  }, [apiBaseUrl])

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(SESSION_KEY)
    }
  }, [session])

  const requestJson = useCallback(
    async <T,>({ path, method = 'GET', body, token }: RequestOptions & { path: string }): Promise<T> => {
      const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })

      const text = await response.text()
      const payload = text ? (JSON.parse(text) as unknown) : null

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, `Request failed with status ${response.status}`))
      }

      return payload as T
    },
    [apiBaseUrl],
  )

  const resetData = useCallback(() => {
    setStations([])
    setSelectedLocationId('')
    setSelectedStationId('')
    setStationQueue(null)
    setExpoEntries([])
    setAnalytics(null)
    setAppError('')
    setStatusMessage('')
  }, [])

  const clearSession = useCallback(() => {
    setSession(null)
    resetData()
  }, [resetData])

  const refreshSession = useCallback(async () => {
    if (!session?.refreshToken) return null

    try {
      const refreshed = await requestJson<{ token: string; refreshToken: string }>({
        path: '/api/v1/auth/refresh',
        method: 'POST',
        body: { refreshToken: session.refreshToken },
      })
      const nextSession = { ...session, token: refreshed.token, refreshToken: refreshed.refreshToken }
      setSession(nextSession)
      return nextSession
    } catch {
      clearSession()
      return null
    }
  }, [clearSession, requestJson, session])

  const apiRequest = useCallback(
    async <T,>({ path, method = 'GET', body }: Omit<RequestOptions, 'token'> & { path: string }): Promise<T> => {
      if (!session?.token) {
        throw new Error('You are not logged in.')
      }

      try {
        return await requestJson<T>({ path, method, body, token: session.token })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed'
        if (!message.toLowerCase().includes('unauthorized') && !message.toLowerCase().includes('invalid token')) {
          throw error
        }

        const nextSession = await refreshSession()
        if (!nextSession) {
          throw new Error('Session expired. Please log in again.')
        }

        return requestJson<T>({ path, method, body, token: nextSession.token })
      }
    },
    [refreshSession, requestJson, session],
  )

  const loadStations = useCallback(async () => {
    if (!session) return
    setIsLoadingStations(true)
    try {
      const rows = await apiRequest<Station[]>({ path: '/api/v1/kds/stations' })
      const ordered = [...rows].sort((left, right) => {
        if (left.locationId !== right.locationId) return left.locationId.localeCompare(right.locationId)
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
        return left.name.localeCompare(right.name)
      })
      setStations(ordered)
      setAppError('')
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Failed to load stations.')
    } finally {
      setIsLoadingStations(false)
    }
  }, [apiRequest, session])

  const loadStationQueue = useCallback(async () => {
    if (!selectedStationId || !session) {
      setStationQueue(null)
      return
    }
    setIsLoadingStationQueue(true)
    try {
      const data = await apiRequest<StationQueueResponse>({ path: `/api/v1/kds/stations/${selectedStationId}/tickets` })
      setStationQueue(data)
      setAppError('')
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Failed to load station queue.')
    } finally {
      setIsLoadingStationQueue(false)
    }
  }, [apiRequest, selectedStationId, session])

  const loadExpo = useCallback(async () => {
    if (!selectedLocationId || !session) {
      setExpoEntries([])
      return
    }
    setIsLoadingExpo(true)
    try {
      const data = await apiRequest<ExpoEntry[]>({ path: `/api/v1/kds/expo?locationId=${encodeURIComponent(selectedLocationId)}` })
      setExpoEntries(data)
      setAppError('')
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Failed to load expo view.')
    } finally {
      setIsLoadingExpo(false)
    }
  }, [apiRequest, selectedLocationId, session])

  const loadAnalytics = useCallback(async () => {
    if (!selectedLocationId || !session) {
      setAnalytics(null)
      return
    }
    setIsLoadingAnalytics(true)
    try {
      const data = await apiRequest<AnalyticsResponse>({ path: `/api/v1/kds/cook-time-analytics?locationId=${encodeURIComponent(selectedLocationId)}` })
      setAnalytics(data)
      setAppError('')
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Failed to load analytics.')
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [apiRequest, selectedLocationId, session])

  useEffect(() => {
    if (!session) return
    void loadStations()
  }, [loadStations, session])

  const locationOptions = useMemo(() => {
    const unique = new Map<string, string>()
    for (const station of stations) {
      unique.set(station.locationId, station.locationId)
    }
    return [...unique.values()]
  }, [stations])

  const filteredStations = useMemo(() => {
    if (!selectedLocationId) return stations
    return stations.filter((station) => station.locationId === selectedLocationId)
  }, [selectedLocationId, stations])

  const selectedStation = useMemo(() => stations.find((station) => station.id === selectedStationId) ?? null, [selectedStationId, stations])

  useEffect(() => {
    if (!stations.length) {
      setSelectedLocationId('')
      setSelectedStationId('')
      return
    }

    if (!selectedLocationId || !stations.some((station) => station.locationId === selectedLocationId)) {
      const preferredLocationId = selectedStation?.locationId ?? stations[0]!.locationId
      setSelectedLocationId(preferredLocationId)
      return
    }

    if (!selectedStationId || !stations.some((station) => station.id === selectedStationId && station.locationId === selectedLocationId)) {
      const nextStation =
        stations.find((station) => station.locationId === selectedLocationId && !station.isExpo) ??
        stations.find((station) => station.locationId === selectedLocationId) ??
        stations[0]
      setSelectedStationId(nextStation?.id ?? '')
    }
  }, [selectedLocationId, selectedStation, selectedStationId, stations])

  useEffect(() => {
    if (!session) return
    void loadStationQueue()
  }, [loadStationQueue, session])

  useEffect(() => {
    if (!session) return
    void Promise.all([loadExpo(), loadAnalytics()])
  }, [loadAnalytics, loadExpo, session])

  useEffect(() => {
    if (!session) return
    const intervalId = window.setInterval(() => {
      void Promise.all([loadStations(), loadStationQueue(), loadExpo(), loadAnalytics()])
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [loadAnalytics, loadExpo, loadStationQueue, loadStations, session])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    setStatusMessage('')
    setIsLoggingIn(true)

    try {
      const result = await requestJson<LoginResponse>({
        path: '/api/v1/auth/owner/login',
        method: 'POST',
        body: { email, password },
      })
      setSession(result)
      setPassword('')
      setStatusMessage(`Logged in as ${result.user.name}`)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    const refreshToken = session?.refreshToken
    clearSession()
    if (!refreshToken) return
    try {
      await requestJson({
        path: '/api/v1/auth/logout',
        method: 'POST',
        body: { refreshToken },
        token: session?.token ?? null,
      })
    } catch {
      // local logout is enough for this lightweight app
    }
  }

  const refreshVisibleData = useCallback(async () => {
    if (!session) return
    await Promise.all([loadStations(), loadStationQueue(), loadExpo(), loadAnalytics()])
  }, [loadAnalytics, loadExpo, loadStationQueue, loadStations, session])

  const runItemAction = useCallback(
    async (ticketItemId: string, action: 'accept' | 'start' | 'bump' | 'recall' | 'acknowledge-void') => {
      setPendingActionId(ticketItemId)
      setStatusMessage('')
      setAppError('')
      try {
        await apiRequest({ path: `/api/v1/kds/tickets/${ticketItemId}/${action}`, method: 'POST' })
        setStatusMessage(`Item ${action.replace('-', ' ')} complete.`)
        await Promise.all([loadStationQueue(), loadExpo(), loadAnalytics()])
      } catch (error) {
        setAppError(error instanceof Error ? error.message : `Failed to ${action} item.`)
      } finally {
        setPendingActionId('')
      }
    },
    [apiRequest, loadAnalytics, loadExpo, loadStationQueue],
  )

  const plainTextView = useMemo(
    () => buildPlainTextView(selectedStation, stationQueue, expoEntries, analytics),
    [analytics, expoEntries, selectedStation, stationQueue],
  )

  const activeTicketCount = stationQueue?.tickets.length ?? 0
  const activeItemCount = stationQueue?.tickets.reduce((sum, ticket) => sum + ticket.items.filter((item) => item.status !== 'voided').length, 0) ?? 0
  const readyTicketCount = stationQueue?.tickets.filter((ticket) => ticket.status === 'ready').length ?? 0
  const allergyItemCount =
    stationQueue?.tickets.reduce((sum, ticket) => sum + ticket.items.filter((item) => item.attentionFlags.includes('allergy')).length, 0) ?? 0

  const isBusy = isLoggingIn || isLoadingStations || isLoadingStationQueue || isLoadingExpo || isLoadingAnalytics || pendingActionId !== ''

  if (!session) {
    return (
      <main className="app-shell login-shell">
        <section className="panel login-panel">
          <div>
            <p className="eyebrow">African POS</p>
            <h1>Kitchen Display System</h1>
            <p className="muted">Owner login is enough for the current KDS endpoints. Set the API base URL, sign in, and the screen will poll live station, expo, and analytics data.</p>
          </div>

          <form className="stack" onSubmit={handleLogin}>
            <label className="field">
              <span>API base URL</span>
              <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(normalizeBaseUrl(event.target.value))} placeholder="http://localhost:3000" required />
            </label>
            <label className="field">
              <span>Owner email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
            </label>
            {loginError ? <p className="notice notice--error">{loginError}</p> : null}
            <button className="primary-button" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="panel topbar screen-only">
        <div>
          <p className="eyebrow">African POS / KDS</p>
          <h1>Kitchen Display System</h1>
          <p className="muted">Live station queue, expo coordination, cook-time analytics, and a printable plain-text fallback.</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={() => void refreshVisibleData()} disabled={isBusy}>
            Refresh now
          </button>
          <button className="secondary-button" onClick={() => window.print()}>
            Print
          </button>
          <button className="secondary-button" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      </header>

      <section className="panel screen-only">
        <div className="settings-grid">
          <label className="field">
            <span>API base URL</span>
            <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(normalizeBaseUrl(event.target.value))} placeholder="http://localhost:3000" />
          </label>
          <label className="field">
            <span>Location</span>
            <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} disabled={locationOptions.length === 0}>
              {locationOptions.map((locationId) => (
                <option key={locationId} value={locationId}>
                  {locationId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Station</span>
            <select value={selectedStationId} onChange={(event) => setSelectedStationId(event.target.value)} disabled={filteredStations.length === 0}>
              {filteredStations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.code}){station.isExpo ? ' • expo' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="session-card">
            <span className="session-card__label">Signed in</span>
            <strong>{session.user.name}</strong>
            <span>{session.user.email}</span>
          </div>
        </div>

        <div className="summary-strip">
          <article className="summary-card">
            <span className="summary-card__label">Tickets</span>
            <strong>{activeTicketCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">Active items</span>
            <strong>{activeItemCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">Ready tickets</span>
            <strong>{readyTicketCount}</strong>
          </article>
          <article className="summary-card summary-card--attention">
            <span className="summary-card__label">Allergy attention</span>
            <strong>{allergyItemCount}</strong>
          </article>
        </div>

        {statusMessage ? <p className="notice notice--success">{statusMessage}</p> : null}
        {appError ? <p className="notice notice--error">{appError}</p> : null}
      </section>

      <nav className="tab-row screen-only" aria-label="KDS views">
        {(['station', 'expo', 'analytics', 'plain-text'] as const).map((entry) => (
          <button key={entry} className={view === entry ? 'tab-button tab-button--active' : 'tab-button'} onClick={() => setView(entry)}>
            {entry === 'plain-text' ? 'Plain text' : entry.charAt(0).toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </nav>

      {view === 'station' ? (
        <section className="stack screen-only">
          <section className="panel">
            <div className="section-header">
              <div>
                <h2>{selectedStation ? `${selectedStation.name} queue` : 'Station queue'}</h2>
                <p className="muted">Action buttons reflect the current ticket-item status. Allergy notes are called out visibly.</p>
              </div>
              <div className="pill-row">
                <span className="pill">Polling every {POLL_INTERVAL_MS / 1000}s</span>
                {selectedStation?.isExpo ? <span className="pill pill--warning">Expo station</span> : null}
                {selectedStation?.stationType === 'bar' ? <span className="pill pill--info">Bar</span> : null}
                {selectedStation ? <span className="pill">Prep target {formatDuration(selectedStation.expectedPrepTimeSeconds)}</span> : null}
                {selectedStation ? <span className="pill">Recall {formatDuration(selectedStation.recallGraceSeconds)}</span> : null}
              </div>
            </div>

            {isLoadingStationQueue ? <p className="muted">Loading station queue…</p> : null}
            {!isLoadingStationQueue && stationQueue?.batches.length ? (
              <div className="batch-grid">
                {stationQueue.batches.map((batch) => (
                  <article key={batch.batchKey} className="batch-card">
                    <strong>{batch.quantityTotal}x {batch.nameSnapshot}</strong>
                    <span>{batch.ticketIds.length} ticket(s)</span>
                    <span>Oldest age {formatDuration(batch.oldestAgeSeconds)}</span>
                </article>
                ))}
              </div>
            ) : null}

            {!isLoadingStationQueue && (!stationQueue || stationQueue.tickets.length === 0) ? <p className="empty-state">No active tickets for this station.</p> : null}

            <div className="ticket-grid">
              {stationQueue?.tickets.map((ticket) => {
                const ticketClasses = ['ticket-card']
                if (ticket.isRush) ticketClasses.push('ticket-card--rush')
                if (ticket.isVip) ticketClasses.push('ticket-card--vip')
                return (
                <article key={ticket.id} className={ticketClasses.join(' ')}>
                  <div className="ticket-card__header">
                    <div>
                      <h3>Order {shortId(ticket.orderId)}{ticket.isVip ? <span className="vip-star" title="VIP">★</span> : null}</h3>
                      <p className="muted">Ticket {shortId(ticket.id)} {ticket.tableId ? `• Table ${shortId(ticket.tableId)}` : '• Walk-in'}</p>
                    </div>
                    <div className="ticket-card__meta">
                      {ticket.isRush ? <span className="pill pill--warning">Rush</span> : null}
                      <span className={ticket.status === 'ready' ? 'pill pill--success' : 'pill'}>{ticket.status.replace('_', ' ')}</span>
                      <strong>{formatDuration(ticket.ageSeconds)}</strong>
                    </div>
                  </div>

                  <div className="ticket-progress">
                    <div className="ticket-progress__bar">
                      <div style={{ width: `${ticket.totalItems === 0 ? 0 : (ticket.readyItems / ticket.totalItems) * 100}%` }} />
                    </div>
                    <span>{ticket.readyItems}/{ticket.totalItems} ready</span>
                  </div>

                  <div className="item-list">
                    {ticket.items.map((item) => {
                      const isPending = pendingActionId === item.id
                      return (
                        <article key={item.id} className={item.attentionFlags.includes('allergy') ? 'item-card item-card--attention' : 'item-card'}>
                          <div className="item-card__header">
                            <div>
                              <h4>{item.quantity}x {item.nameSnapshot}</h4>
                              {item.localNameSnapshot ? <p className="muted">{item.localNameSnapshot}</p> : null}
                            </div>
                            <div className="pill-row">
                              <span className="pill">{item.status.replace('_', ' ')}</span>
                              <span className="pill">Age {formatDuration(item.ageSeconds)}</span>
                              {item.attentionFlags.includes('allergy') ? <span className="pill pill--danger">Allergy</span> : null}
                            </div>
                          </div>

                          <div className="item-card__details muted">
                            <span>Seat {item.seatNumber ?? '—'}</span>
                            <span>Course {item.course ?? '—'}</span>
                            <span>Started {formatTimestamp(item.startedAt)}</span>
                            <span>Ready {formatTimestamp(item.readyAt)}</span>
                            {selectedStation?.stationType === 'bar' && item.pourCost > 0 ? <span>Pour variance {item.pourCost}ml</span> : null}
                          </div>

                          {item.kitchenNote ? <p className="note-block">{item.kitchenNote}</p> : null}
                          {item.voidReason ? <p className="note-block note-block--warning">Void reason: {item.voidReason}</p> : null}

                          <div className="action-row">
                            <button className="action-button" onClick={() => void runItemAction(item.id, 'accept')} disabled={isPending || item.status !== 'open'}>
                              Accept
                            </button>
                            <button className="action-button" onClick={() => void runItemAction(item.id, 'start')} disabled={isPending || item.status !== 'accepted'}>
                              Start
                            </button>
                            <button className="action-button" onClick={() => void runItemAction(item.id, 'bump')} disabled={isPending || item.status !== 'in_progress'}>
                              Bump
                            </button>
                            <button className="action-button" onClick={() => void runItemAction(item.id, 'recall')} disabled={isPending || item.status !== 'ready'}>
                              Recall
                            </button>
                            <button className="action-button action-button--warning" onClick={() => void runItemAction(item.id, 'acknowledge-void')} disabled={isPending || item.status !== 'void_requested'}>
                              Ack void
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </article>
                )
              })}
            </div>
          </section>
        </section>
      ) : null}

      {view === 'expo' ? (
        <section className="panel screen-only">
          <div className="section-header">
            <div>
              <h2>Expo view</h2>
              <p className="muted">Grouped by order and table so front-of-house can see when all stations are aligned.</p>
            </div>
            {isLoadingExpo ? <span className="pill">Loading…</span> : null}
          </div>

          {expoEntries.length === 0 ? <p className="empty-state">No expo groups for the selected location.</p> : null}

          <div className="expo-grid">
            {expoEntries.map((entry) => (
              <article key={`${entry.orderId}:${entry.tableId ?? 'walkin'}`} className="expo-card">
                <div className="expo-card__header">
                  <div>
                    <h3>{entry.tableLabel ?? entry.tableId ?? 'Walk-in order'}</h3>
                    <p className="muted">Order {shortId(entry.orderId)}</p>
                  </div>
                  <div className="ticket-card__meta">
                    <span className={entry.fullyReady ? 'pill pill--success' : 'pill pill--warning'}>{entry.fullyReady ? 'Fully ready' : 'Waiting on stations'}</span>
                    <strong>{formatDuration(entry.ageSeconds)}</strong>
                  </div>
                </div>
                <div className="expo-stations">
                  {entry.stations.map((station) => (
                    <div key={station.ticketId} className="expo-station-row">
                      <div>
                        <strong>{station.stationName}</strong>
                        <p className="muted">{station.stationCode}</p>
                      </div>
                      <div className="expo-station-row__meta">
                        <span>{station.readyItems}/{station.totalItems} ready</span>
                        <span className={station.status === 'ready' ? 'pill pill--success' : 'pill'}>{station.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {view === 'analytics' ? (
        <section className="panel screen-only">
          <div className="section-header">
            <div>
              <h2>Cook-time analytics</h2>
              <p className="muted">Simple per-station averages from the P6 analytics endpoint.</p>
            </div>
            {isLoadingAnalytics ? <span className="pill">Loading…</span> : null}
          </div>

          {analytics?.alerts.length ? (
            <div className="alert-list">
              {analytics.alerts.map((alert) => (
                <article key={`${alert.delayedStationId}:${alert.type}`} className="notice notice--warning">
                  <strong>{alert.delayedStationName} is running behind.</strong>
                  <span>
                    Active age {formatDuration(alert.delayedAverageAgeSeconds)} vs baseline {formatDuration(alert.baselineSeconds)}.
                    {alert.suggestedReliefStationName ? ` Suggested relief: ${alert.suggestedReliefStationName}.` : ''}
                  </span>
                </article>
              ))}
            </div>
          ) : null}

          {!analytics || analytics.stations.length === 0 ? <p className="empty-state">No analytics available for the selected location.</p> : null}

          <div className="analytics-grid">
            {analytics?.stations.map((entry) => {
              const behind = entry.activeTicketItems > 0 && entry.averageActiveAgeSeconds > entry.averageCompletedSeconds * 1.5
              return (
                <article key={entry.stationId} className={behind ? 'analytics-card analytics-card--warning' : 'analytics-card'}>
                  <div className="analytics-card__header">
                    <div>
                      <h3>{entry.stationName}</h3>
                      <p className="muted">{entry.stationCode}</p>
                    </div>
                    {behind ? <span className="pill pill--warning">Behind</span> : <span className="pill pill--success">Stable</span>}
                  </div>
                  <dl className="metric-list">
                    <div>
                      <dt>Expected prep</dt>
                      <dd>{formatDuration(entry.expectedPrepTimeSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Avg complete</dt>
                      <dd>{formatDuration(entry.averageCompletedSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Avg active age</dt>
                      <dd>{formatDuration(entry.averageActiveAgeSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Active items</dt>
                      <dd>{entry.activeTicketItems}</dd>
                    </div>
                    <div>
                      <dt>Completed items</dt>
                      <dd>{entry.completedTicketItems}</dd>
                    </div>
                  </dl>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {view === 'plain-text' ? (
        <section className="panel">
          <div className="section-header screen-only">
            <div>
              <h2>Plain-text fallback</h2>
              <p className="muted">Useful for printing, screenshots, and low-fidelity troubleshooting.</p>
            </div>
            <button className="secondary-button" onClick={() => window.print()}>
              Print plain text
            </button>
          </div>
          <pre className="plain-text-sheet">{plainTextView}</pre>
        </section>
      ) : null}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
