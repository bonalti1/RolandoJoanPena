import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { ToastProvider } from './lib/toast.tsx'
import './index.css'

// Capture the PWA install prompt so Settings can offer an "Install app" button.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  ;(window as unknown as { __bip?: Event }).__bip = e
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
