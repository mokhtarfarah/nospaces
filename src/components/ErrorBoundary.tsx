import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  // Report the crash so we hear about it (no-op if Sentry isn't configured).
  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'Geist, sans-serif', color: '#1C1B19' }}>
          <p style={{ fontSize: 13, color: '#6F6B64', marginBottom: 8 }}>something went wrong</p>
          <p style={{ fontSize: 12, color: '#ABA69C', fontFamily: 'monospace' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, fontSize: 13, color: '#1C1B19', background: 'none', border: '1px solid #ECEAE6', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
          >
            try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
