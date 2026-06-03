import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import {
  buildAuthUrl, exchangeCodeForToken, fetchSavedAlbums,
  buildSpotifyInserts, albumKey,
  type SpotifyBuildResult,
} from '../lib/spotify'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const redirectUri = () => `${window.location.origin}/spotify`

export function SpotifyScreen() {
  const { items, importItems } = useItems()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [phase, setPhase] = useState<'idle' | 'syncing'>('idle')
  const [preview, setPreview] = useState<SpotifyBuildResult | null>(null)
  const [total, setTotal] = useState(0)
  const [firstImport, setFirstImport] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const ran = useRef(false)

  // Handle the OAuth redirect back from Spotify (?code=... or ?error=...).
  useEffect(() => {
    if (ran.current) return
    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')
    if (oauthError) { setError('Spotify connection was cancelled.'); setSearchParams({}, { replace: true }); return }
    if (!code) return
    ran.current = true
    // Wait until items have loaded so the first-import check is accurate.
    runSync(code)
  }, [searchParams, items]) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setError('')
    if (!CLIENT_ID) { setError('Spotify isn’t configured yet (missing client ID).'); return }
    window.location.href = await buildAuthUrl(CLIENT_ID, redirectUri())
  }

  async function runSync(code: string) {
    setPhase('syncing'); setError('')
    try {
      const token = await exchangeCodeForToken(CLIENT_ID!, redirectUri(), code)
      const albums = await fetchSavedAlbums(token)
      setTotal(albums.length)

      const music = items.filter(i => i.type === 'music')
      const isFirst = !music.some(i => i.source_detail === 'spotify')
      setFirstImport(isFirst)
      const existingKeys = new Set(music.map(i => albumKey(i.title, i.creator ?? '')))
      const existingIds = new Set(
        music.map(i => (i.metadata as { spotifyId?: string } | null)?.spotifyId).filter(Boolean) as string[],
      )
      setPreview(buildSpotifyInserts(albums, existingKeys, existingIds, isFirst))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong talking to Spotify.')
    } finally {
      setPhase('idle')
      setSearchParams({}, { replace: true }) // clean ?code= from the URL
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setSaving(true)
    try {
      const n = await importItems(preview.inserts as unknown as Record<string, unknown>[])
      setDone(n)
      setPreview(null)
    } catch {
      setError('Something went wrong saving. Nothing was lost — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '56px 16px 96px', background: '#fff', minHeight: '100dvh' }}>
      <button
        onClick={() => navigate('/add')}
        style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, padding: 0, marginBottom: 16, cursor: 'pointer' }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.2px' }}>
        Sync from Spotify
      </h1>
      <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5, margin: '0 0 24px' }}>
        Pulls your <b>saved albums</b> into your library. Your first sync adds them as
        <b> “want to”</b> so you can work through them; after that, newly saved albums come in as
        <b> “done.”</b> Tap sync any time — nothing happens automatically.
      </p>

      {/* Connect / sync action */}
      {!preview && done == null && (
        <button
          onClick={connect}
          disabled={phase === 'syncing'}
          style={{
            width: '100%', padding: '14px',
            background: phase === 'syncing' ? '#E2E2E2' : '#1DB954',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
            cursor: phase === 'syncing' ? 'default' : 'pointer',
          }}
        >
          {phase === 'syncing' ? 'Reading your albums…' : 'Connect Spotify & sync'}
        </button>
      )}

      {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 14 }}>{error}</p>}

      {preview && (
        <div style={{ marginTop: 24 }}>
          <div style={{ border: '1px solid #EEE', borderRadius: 14, padding: 18 }}>
            <Row label="Saved albums on Spotify" value={total} />
            <Row label="Already in your library — skipped" value={preview.skippedExisting} muted />
            <div style={{ height: 1, background: '#EEE', margin: '12px 0' }} />
            <Row
              label={`New albums to add (as ${firstImport ? 'want to' : 'done'})`}
              value={preview.inserts.length}
              bold
            />
          </div>

          <button
            onClick={handleConfirm}
            disabled={saving || preview.inserts.length === 0}
            style={{
              width: '100%', marginTop: 16, padding: '14px',
              background: saving || preview.inserts.length === 0 ? '#E2E2E2' : '#111111',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
              cursor: saving || preview.inserts.length === 0 ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Adding…' : preview.inserts.length === 0 ? 'Nothing new to add' : `Add ${preview.inserts.length} album${preview.inserts.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {done != null && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#111', fontWeight: 600 }}>
            Added {done} album{done === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => navigate('/library')}
            style={{
              marginTop: 12, padding: '12px 24px', background: '#111111', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go to library
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: 14, color: muted ? '#AAA' : '#555' }}>{label}</span>
      <span style={{ fontSize: bold ? 18 : 15, fontWeight: bold ? 700 : 500, color: muted ? '#AAA' : '#111' }}>{value}</span>
    </div>
  )
}
