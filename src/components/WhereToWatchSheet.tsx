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
        padding: '20px 20px calc(28px + env(safe-area-inset-bottom))', zIndex: 211,
        maxWidth: 480, margin: '0 auto', maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: 0 }}>
            where to watch — {item.title}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#AAA', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}>×</button>
        </div>

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
            <ProviderGroup label="Stream" providers={data.stream} title={item.title} fallback={data.link ?? justWatch} />
            <ProviderGroup label="Rent" providers={data.rent} title={item.title} fallback={data.link ?? justWatch} />
            <ProviderGroup label="Buy" providers={data.buy} title={item.title} fallback={data.link ?? justWatch} />
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
          {'More detail on JustWatch ↗︎'}
        </a>
      </div>
    </>
  )
}

// Best-effort deep links: open the title's search on the specific service. Unknown
// services fall back to the JustWatch offer page.
const PROVIDER_SEARCH: Record<string, (q: string) => string> = {
  'netflix': q => `https://www.netflix.com/search?q=${q}`,
  'hulu': q => `https://www.hulu.com/search?q=${q}`,
  'disney plus': q => `https://www.disneyplus.com/search?q=${q}`,
  'amazon prime video': q => `https://www.amazon.com/s?k=${q}&i=instant-video`,
  'apple tv': q => `https://tv.apple.com/search?term=${q}`,
  'apple tv plus': q => `https://tv.apple.com/search?term=${q}`,
  'max': q => `https://play.max.com/search?q=${q}`,
  'hbo max': q => `https://play.max.com/search?q=${q}`,
  'peacock': q => `https://www.peacocktv.com/watch/search?q=${q}`,
  'peacock premium': q => `https://www.peacocktv.com/watch/search?q=${q}`,
  'paramount plus': () => `https://www.paramountplus.com/search/`,
}

function providerUrl(name: string, title: string, fallback: string): string {
  const key = name.toLowerCase().replace(/\+/g, ' plus').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const make = PROVIDER_SEARCH[key]
  return make ? make(encodeURIComponent(title)) : fallback
}

function ProviderGroup({ label, providers, title, fallback }: { label: string; providers?: Provider[]; title: string; fallback: string }) {
  if (!providers || providers.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {providers.map((p, i) => (
          <a
            key={i}
            href={providerUrl(p.name, title, fallback)}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #EEE', borderRadius: 8, background: '#FAFAFA', textDecoration: 'none', color: '#333' }}
          >
            <span style={{ fontSize: 12 }}>{p.name}{' ↗︎'}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
