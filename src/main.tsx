import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import AuthGate from './components/AuthGate.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { ToastProvider } from './lib/toast.tsx'
import { ConfirmDeleteProvider } from './lib/confirmDelete.tsx'
import { runMigrations } from './lib/migrations.ts'
import './index.css'

// Bring any stale saved defaults (old purple theme, single-word name) forward
// before the app reads them. Runs once per browser.
runMigrations()

// Capture the PWA install prompt so Settings can offer an "Install app" button.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  ;(window as unknown as { __bip?: Event }).__bip = e
})

/**
 * Last line of defence. Anything that throws while rendering would otherwise
 * leave a blank white page with no clue what happened — this shows the actual
 * error instead, so a bad deploy can be diagnosed from the screen itself.
 */
class Boundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f6f7f9' }}>
        <div style={{ maxWidth: 460, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111' }}>Something went wrong loading the app</h1>
          <p style={{ fontSize: 14, color: '#555', marginTop: 8, lineHeight: 1.5 }}>
            Usually this means a setting is missing on this site. Send this message over:
          </p>
          <pre style={{ fontSize: 12, background: '#f3f4f6', padding: 12, borderRadius: 10, overflowX: 'auto', color: '#b91c1c', whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => location.reload()} style={{ marginTop: 12, background: '#2563eb', color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
    <ThemeProvider>
      <ToastProvider>
        <ConfirmDeleteProvider>
          <AuthGate>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthGate>
        </ConfirmDeleteProvider>
      </ToastProvider>
    </ThemeProvider>
    </Boundary>
  </React.StrictMode>,
)
