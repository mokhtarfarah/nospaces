import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import {
  parseLetterboxdCsv, buildInserts, filmKey,
  type ParsedFilm, type BuildResult,
} from '../lib/letterboxd'

export function ImportScreen() {
  const { items, importItems } = useItems()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<BuildResult | null>(null)
  const [counts, setCounts] = useState({ watch: 0, rated: 0 })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  async function handleFiles(files: FileList | null) {
    setError(''); setPreview(null); setDone(null)
    if (!files || files.length === 0) return
    try {
      const films: ParsedFilm[] = []
      for (const f of Array.from(files)) {
        films.push(...parseLetterboxdCsv(await f.text()))
      }
      if (films.length === 0) {
        setError("Couldn't find any films in that file. Make sure it's a Letterboxd CSV.")
        return
      }
      // Rating present → watched & rated (done); otherwise → watchlist (want to).
      const rated = films.filter(f => f.rating != null)
      const watchlist = films.filter(f => f.rating == null)

      // Existing film keys so we don't create duplicates.
      const existingKeys = new Set(
        items.filter(i => i.type === 'film').map(i => filmKey(i.title, i.year)),
      )
      setCounts({ watch: watchlist.length, rated: rated.length })
      setPreview(buildInserts(watchlist, rated, existingKeys))
    } catch {
      setError('Could not read that file.')
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
        Import from Letterboxd
      </h1>
      <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5, margin: '0 0 24px' }}>
        On Letterboxd: <b>Settings → Data → Export Your Data</b>. Unzip it, then upload
        <code style={{ background: '#F2F2F2', padding: '1px 5px', borderRadius: 4, margin: '0 3px' }}>watchlist.csv</code>
        and
        <code style={{ background: '#F2F2F2', padding: '1px 5px', borderRadius: 4, margin: '0 3px' }}>ratings.csv</code>.
        You can pick both at once.
      </p>

      <label
        style={{
          display: 'block', textAlign: 'center', padding: '24px 16px',
          border: '1.5px dashed #D8D8D8', borderRadius: 14, cursor: 'pointer',
          color: '#555', fontSize: 14, background: '#FAFAFA',
        }}
      >
        Choose CSV file(s)
        <input
          type="file" accept=".csv,text/csv" multiple
          onChange={e => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </label>

      {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 14 }}>{error}</p>}

      {preview && (
        <div style={{ marginTop: 24 }}>
          <div style={{ border: '1px solid #EEE', borderRadius: 14, padding: 18 }}>
            <Row label="To watch (want to)" value={counts.watch} />
            <Row label="Watched & rated (done)" value={counts.rated} />
            <Row label="Already in your library — skipped" value={preview.skippedExisting} muted />
            <div style={{ height: 1, background: '#EEE', margin: '12px 0' }} />
            <Row label="New films to add" value={preview.inserts.length} bold />
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
            {saving ? 'Importing…' : `Import ${preview.inserts.length} films`}
          </button>
        </div>
      )}

      {done != null && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#111', fontWeight: 600 }}>
            Imported {done} film{done === 1 ? '' : 's'} 🎬
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
