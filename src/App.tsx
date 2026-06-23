import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useOfflineSync } from './hooks/useOfflineSync'
import { LoginScreen } from './components/LoginScreen'
import { BottomNav } from './components/BottomNav'
import { LibraryScreen } from './screens/LibraryScreen'
import { AddScreen } from './screens/AddScreen'
import { ImportScreen } from './screens/ImportScreen'
import { SpotifyScreen } from './screens/SpotifyScreen'
import { TasteScreen } from './screens/TasteScreen'
import { ShowsScreen } from './screens/ShowsScreen'
import { RecommendScreen } from './screens/RecommendScreen'
import { DiscoverScreen } from './screens/DiscoverScreen'
import { ThingsScreen } from './screens/ThingsScreen'
import { HelpMeDecideScreen } from './screens/HelpMeDecideScreen'
import { GuideScreen } from './screens/GuideScreen'

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { pendingCount, syncStatus } = useOfflineSync()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #111111', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // In dev without Supabase configured, skip auth so the UI is explorable.
  const skipAuth = import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_URL
  if (!user && !skipAuth) return <LoginScreen />

  return (
    <>
      <div key={location.pathname} className="page-transition">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/add" element={<AddScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/spotify" element={<SpotifyScreen />} />
          <Route path="/taste" element={<TasteScreen />} />
          <Route path="/shows" element={<ShowsScreen />} />
          <Route path="/recommend" element={<RecommendScreen />} />
          <Route path="/discover" element={<DiscoverScreen />} />
          <Route path="/things" element={<ThingsScreen />} />
          <Route path="/decide" element={<HelpMeDecideScreen />} />
          <Route path="/guide" element={<GuideScreen />} />
        </Routes>
      </div>
      {/* Things is its own domain — the board carries its own capture buttons and
          the DomainSwitcher gets you back, so the media nav + FAB step aside. */}
      {location.pathname !== '/things' && <BottomNav />}
      {(pendingCount > 0 || syncStatus !== 'idle') && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
          left: 0, right: 0,
          background: '#1C1B19',
          color: '#ABA69C',
          fontSize: 11,
          textAlign: 'center',
          padding: '6px 16px',
          zIndex: 98,
          letterSpacing: '0.02em',
        }}>
          {syncStatus === 'syncing' && 'syncing...'}
          {syncStatus === 'synced' && 'synced'}
          {syncStatus === 'idle' && pendingCount > 0 && `${pendingCount} item${pendingCount === 1 ? '' : 's'} saved offline — will sync when back online`}
        </div>
      )}
    </>
  )
}
