import { createRoot } from 'react-dom/client'

const base: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', color: '#111', background: '#f5f5f5', minHeight: '100vh', margin: 0, padding: 0 }
const shell: React.CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '40px 24px' }
const header: React.CSSProperties = { marginBottom: 32 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }
const card: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
const cardValue: React.CSSProperties = { fontSize: 32, fontWeight: 700, margin: '8px 0 0' }
const cardLabel: React.CSSProperties = { fontSize: 14, color: '#666', margin: 0 }
const linkGrid: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' }
const linkBtn: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textDecoration: 'none', color: '#111', fontWeight: 500 }

function App() {
  return (
    <div style={base}>
      <div style={shell}>
        <div style={header}>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>African POS</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>Owner Dashboard</h1>
        </div>

        <div style={grid}>
          <article style={card}>
            <p style={cardLabel}>Revenue Today</p>
            <p style={cardValue}>KES 0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Orders Today</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Staff on Duty</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Locations</p>
            <p style={cardValue}>0</p>
          </article>
        </div>

        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Quick Links</h2>
        <div style={linkGrid}>
          <a href="/reports" style={linkBtn}>Reports</a>
          <a href="/staff" style={linkBtn}>Staff</a>
          <a href="/settings" style={linkBtn}>Settings</a>
          <a href="/integrations" style={linkBtn}>Integrations</a>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
