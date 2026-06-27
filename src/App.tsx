import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useOfflineSync } from './hooks/useOfflineSync'
import { LoginScreen } from './components/LoginScreen'
import { BottomNav } from './components/BottomNav'
import { MediaComposer } from './components/MediaComposer'
import { clearStack } from './lib/layout'
import { LibraryScreen } from './screens/LibraryScreen'
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
  const navigate = useNavigate()
  const { pendingCount, syncStatus } = useOfflineSync()

  // "add" is now a bottom-sheet card, not a page. The FAB opens it over whatever
  // screen you're on; the legacy /add route (iOS shortcut deep-links, the "back to
  // add" links in import/recommend/spotify) opens it over the library so there's a
  // real page behind the sheet instead of a blank screen.
  const [fabAdd, setFabAdd] = useState(false)
  const isAddRoute = location.pathname === '/add'
  const addOpen = fabAdd || isAddRoute
  const closeAdd = () => { setFabAdd(false); if (isAddRoute) navigate('/library', { replace: true }) }
  const doneAdd = () => { setFabAdd(false); navigate('/library', { replace: isAddRoute }) }

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
          {/* /add keeps the library behind the add sheet (see addOpen below). */}
          <Route path="/add" element={<LibraryScreen />} />
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
      {/* Things is its own domain — the board carries its own capture buttons + its
          own bottom bar, so the media nav + FAB step aside there. Both bars embed
          the media/things switcher on their left now (no separate strip). */}
      {location.pathname !== '/things' && <BottomNav onAdd={() => setFabAdd(true)} />}
      {addOpen && <MediaComposer onClose={closeAdd} onDone={doneAdd} />}
      {(pendingCount > 0 || syncStatus !== 'idle') && (
        <div style={{
          position: 'fixed',
          bottom: clearStack(),
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
