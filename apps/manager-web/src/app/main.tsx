import { createRoot } from 'react-dom/client'

const base: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', color: '#111', background: '#f5f5f5', minHeight: '100vh', margin: 0, padding: 0 }
const shell: React.CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '40px 24px' }
const header: React.CSSProperties = { marginBottom: 32 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }
const card: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
const cardValue: React.CSSProperties = { fontSize: 32, fontWeight: 700, margin: '8px 0 0' }
const cardLabel: React.CSSProperties = { fontSize: 14, color: '#666', margin: 0 }
const actionGrid: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' }
const actionBtn: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textDecoration: 'none', color: '#111', fontWeight: 500, cursor: 'pointer', border: 'none', fontSize: 14 }

function App() {
  return (
    <div style={base}>
      <div style={shell}>
        <div style={header}>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>African POS</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>Manager Portal</h1>
        </div>

        <div style={grid}>
          <article style={card}>
            <p style={cardLabel}>Open Orders</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Tables Occupied</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Today&apos;s Revenue</p>
            <p style={cardValue}>KES 0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Staff on Duty</p>
            <p style={cardValue}>0</p>
          </article>
        </div>

        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Quick Actions</h2>
        <div style={actionGrid}>
          <button style={actionBtn} onClick={() => alert('New Order flow')}>New Order</button>
          <button style={actionBtn} onClick={() => alert('Floor view')}>View Floor</button>
          <button style={actionBtn} onClick={() => alert('Close Shift flow')}>Close Shift</button>
          <button style={actionBtn} onClick={() => alert('Reports')}>Reports</button>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
