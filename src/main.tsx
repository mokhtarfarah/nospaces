import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { AuthProvider } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'
import './index.css'

// Crash reporting. No-op until VITE_SENTRY_DSN is set in Vercel — so local dev
// and any build without the env var simply don't report anything.
const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture a sliver of performance traces; errors are always captured.
    tracesSampleRate: 0.1,
  })
}

// Self-heal after a deploy. Code-split chunks are hashed (index-AbC123.js), so a
// new deploy renames them — a phone holding the old page open then reaches for a
// chunk that no longer exists and a lazy import() fails ("Failed to fetch
// dynamically imported module"). Vite fires `vite:preloadError` for exactly this;
// reload once to pick up the new build. The sessionStorage guard stops a reload
// loop if the failure is something else (a genuinely missing/broken chunk).
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('reloaded-for-chunk') === '1') return
  sessionStorage.setItem('reloaded-for-chunk', '1')
  window.location.reload()
})
// Clear the guard once the app boots cleanly, so a *future* stale-deploy can heal too.
window.addEventListener('load', () => sessionStorage.removeItem('reloaded-for-chunk'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
