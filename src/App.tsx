import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './components/LoginScreen'
import { BottomNav } from './components/BottomNav'
import { LibraryScreen } from './screens/LibraryScreen'
import { AddScreen } from './screens/AddScreen'

export default function App() {
  const { user, loading } = useAuth()

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
      <Routes>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/add" element={<AddScreen />} />
      </Routes>
      <BottomNav />
    </>
  )
}
