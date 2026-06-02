import { useEffect, useState } from 'react'

// Lighter v1 of "where to watch". Self-contained popup that lists US streaming options
// for a film/TV item via /api/watch (TMDB). Safe to delete this file to remove the feature.
interface Provider {
  name: string
  logo: string | null
}

interface WatchData {
  configured: boolean
  found?: boolean
  link?: string | null
  stream?: Provider[]
  rent?: Provider[]
  buy?: Provider[]
  error?: boolean
}

export function WhereToWatchSheet({ item, onClose }: {
  item: { title: string; year: number | null; type: string }
  onClose: () => void
}) {
  const [data, setData] = useState<WatchData | null>(null)

  useEffect(() => {
    let cancelled = false
    const sp = new URLSearchParams({ title: item.title, type: item.type })
    if (item.year) sp.set('year', String(item.year))
    fetch(`/api/watch?${sp}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ configured: true, error: true }) })
    return () => { cancelled = true }
  }, [item.title, item.year, item.type])

  const justWatch = `https://www.justwatch.com/us/search?q=${encodeURIComponent([item.title, item.year].filter(Boolean).join(' '))}`

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 210 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 40px', zIndex: 211,
        maxWidth: 480, margin: '0 auto', maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 16px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 16px' }}>
          Where to watch — {item.title}
        </p>

        {data === null && <p style={{ fontSize: 13, color: '#999' }}>Checking…</p>}

        {data && !data.configured && (
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>
            Streaming info isn't set up yet (needs a TMDB key). You can still check on JustWatch below.
          </p>
        )}

        {data?.configured && data.found === false && (
          <p style={{ fontSize: 13, color: '#777' }}>No streaming info found for this one.</p>
        )}

        {data?.configured && data.found && (
          <>
            <ProviderGroup label="Stream" providers={data.stream} />
            <ProviderGroup label="Rent" providers={data.rent} />
            <ProviderGroup label="Buy" providers={data.buy} />
            {!(data.stream?.length || data.rent?.length || data.buy?.length) && (
              <p style={{ fontSize: 13, color: '#777' }}>Not available on any US service right now.</p>
            )}
          </>
        )}

        <a
          href={data?.link ?? justWatch}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', textAlign: 'center', marginTop: 20,
            padding: '11px', borderRadius: 10, border: '1px solid #E6E6E6',
            background: '#FAFAFA', color: '#333', fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}
        >
          More detail on JustWatch ↗
        </a>
      </div>
    </>
  )
}

function ProviderGroup({ label, providers }: { label: string; providers?: Provider[] }) {
  if (!providers || providers.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {providers.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.logo && <img src={p.logo} alt="" width={28} height={28} style={{ borderRadius: 6, border: '1px solid #EEE' }} />}
            <span style={{ fontSize: 12, color: '#333' }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
