import { createRoot } from 'react-dom/client'

const base: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', color: '#111', background: '#f5f5f5', minHeight: '100vh', margin: 0, padding: 0 }
const shell: React.CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '40px 24px' }
const header: React.CSSProperties = { marginBottom: 32 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }
const card: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
const cardValue: React.CSSProperties = { fontSize: 32, fontWeight: 700, margin: '8px 0 0' }
const cardLabel: React.CSSProperties = { fontSize: 14, color: '#666', margin: 0 }

const modules = [
  { name: 'Organizations', status: 'active' },
  { name: 'CRM', status: 'active' },
  { name: 'Orders', status: 'active' },
  { name: 'Payments', status: 'active' },
  { name: 'Inventory', status: 'active' },
  { name: 'Staff', status: 'active' },
  { name: 'Restaurant', status: 'active' },
  { name: 'Finance', status: 'active' },
]

function App() {
  return (
    <div style={base}>
      <div style={shell}>
        <div style={header}>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>African POS</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>Admin Console</h1>
        </div>

        <div style={grid}>
          <article style={card}>
            <p style={cardLabel}>System Health</p>
            <p style={{ ...cardValue, fontSize: 24, color: '#22c55e' }}>Healthy</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Tenants</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Integrations Online</p>
            <p style={cardValue}>0</p>
          </article>
          <article style={card}>
            <p style={cardLabel}>Integrations Offline</p>
            <p style={cardValue}>0</p>
          </article>
        </div>

        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Modules</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {modules.map((mod) => (
            <div key={mod.name} style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <span style={{ fontWeight: 500 }}>{mod.name}</span>
              <span style={{ fontSize: 13, color: '#22c55e', background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>{mod.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
