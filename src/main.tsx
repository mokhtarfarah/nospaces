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
