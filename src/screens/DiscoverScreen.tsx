import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import { authHeaders } from '../lib/supabase'
import { DEFAULT_FEEDS, normaliseFeedUrl, guessFeedKind, type DiscoveryResult, type FeedEntry } from '../lib/feeds'

type Mode = 'intaste' | 'divert'
type TypeFilter = 'all' | 'film' | 'book' | 'music' | 'tv'

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'film', label: 'film' },
  { value: 'book', label: 'book' },
  { value: 'music', label: 'music' },
  { value: 'tv', label: 'tv' },
]

const CACHE_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

function isStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS
}

export function DiscoverScreen() {
  const navigate = useNavigate()
  const { items, addItem } = useItems()
  const {
    tasteProfile,
    discoveryCache,
    setDiscoveryCache,
    customFeeds,
    setCustomFeeds,
    prefsLoaded,
  } = usePrefs()

  const [mode, setMode] = useState<Mode>('intaste')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [savedTitles, setSavedTitles] = useState<Set<string>>(new Set())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [newFeedName, setNewFeedName] = useState('')
  const [addFeedOpen, setAddFeedOpen] = useState(false)

  // Library title set for dedup display
  const libraryTitleSet = useMemo(
    () => new Set(items.map(i => i.title.toLowerCase())),
    [items]
  )

  // Load from cache when mode changes or prefs load
  useEffect(() => {
    if (!prefsLoaded) return
    const cached = discoveryCache?.[mode]
    if (cached && !isStale(cached.cachedAt)) {
      setResults(cached.results)
      setCachedAt(cached.cachedAt)
    } else {
      setResults([])
      setCachedAt(null)
    }
  }, [mode, prefsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRecommendations(force = false) {
    if (!tasteProfile) {
      setError('generate your taste profile on the taste page first, then come back')
      return
    }
    const cached = discoveryCache?.[mode]
    if (!force && cached && !isStale(cached.cachedAt)) {
      setResults(cached.results)
      setCachedAt(cached.cachedAt)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const libraryItems = items
        .filter(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
        .map(i => ({ title: i.title, type: i.type }))

      const res = await fetch('/api/recommend-feeds', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode, type: 'all', tasteProfile, libraryItems, customFeeds }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'something went wrong')
        return
      }
      const data = await res.json() as { recommendations: DiscoveryResult[]; warning?: string }
      setResults(data.recommendations ?? [])
      setCachedAt(new Date().toISOString())
      setDiscoveryCache(mode, data.recommendations ?? [])
    } catch {
      setError('network error — try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(r: DiscoveryResult) {
    await addItem(r.title, r.type, r.creator, r.year, { discoverSource: r.source })
    setSavedTitles(prev => new Set([...prev, r.title.toLowerCase()]))
  }

  function handleAddFeed() {
    const url = normaliseFeedUrl(newFeedUrl)
    if (!url) return
    const name = newFeedName.trim() || url
    const kind = guessFeedKind(url)
    const entry: FeedEntry = { url, name, types: ['cross'], kind }
    setCustomFeeds([...customFeeds, entry])
    setNewFeedUrl('')
    setNewFeedName('')
    setAddFeedOpen(false)
  }

  function handleRemoveCustomFeed(url: string) {
    setCustomFeeds(customFeeds.filter(f => f.url !== url))
  }

  // Filter + deduplicate results against library
  const displayed = useMemo(() => {
    const seen = new Set<string>()
    return results.filter(r => {
      const key = r.title.toLowerCase()
      if (libraryTitleSet.has(key)) return false
      if (seen.has(key)) return false
      seen.add(key)
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      return true
    })
  }, [results, typeFilter, libraryTitleSet])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, film: 0, book: 0, music: 0, tv: 0 }
    const seen = new Set<string>()
    for (const r of results) {
      const key = r.title.toLowerCase()
      if (libraryTitleSet.has(key) || seen.has(key)) continue
      seen.add(key)
      counts.all++
      counts[r.type] = (counts[r.type] ?? 0) + 1
    }
    return counts
  }, [results, libraryTitleSet])

  const allFeeds = [...DEFAULT_FEEDS, ...customFeeds]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 100px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/add')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ABA69C', fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#1C1B19' }}>discover</h1>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['intaste', 'divert'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: mode === m ? '1.5px solid #1C1B19' : '1.5px solid #E0E0E0',
              background: mode === m ? '#1C1B19' : '#fff',
              color: mode === m ? '#fff' : '#ABA69C',
              fontWeight: mode === m ? 600 : 400,
            }}
          >
            {m === 'intaste' ? 'in taste' : 'divert'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fetchRecommendations(true)}
          disabled={loading}
          style={{ background: 'none', border: 'none', color: loading ? '#CCC' : '#1C1B19', fontSize: 12, cursor: loading ? 'default' : 'pointer', padding: 0 }}
        >
          {loading ? 'loading…' : results.length > 0 ? 'refresh ↺' : 'fetch →'}
        </button>
      </div>

      {/* Mode description */}
      <p style={{ fontSize: 12, color: '#ABA69C', marginBottom: 20, lineHeight: 1.5 }}>
        {mode === 'intaste'
          ? 'picks from your trusted sources that match your taste — updated every 48 hours'
          : 'things outside your usual patterns, coherent with your sensibility but further afield'}
      </p>

      {/* Error / no-profile state */}
      {error && (
        <div style={{ fontSize: 13, color: '#C0392B', marginBottom: 20 }}>{error}</div>
      )}

      {/* Empty / prompt state */}
      {!loading && results.length === 0 && !error && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 13, color: '#ABA69C', marginBottom: 16, lineHeight: 1.6 }}>
            {tasteProfile
              ? 'tap fetch to pull recommendations from your sources'
              : 'go to the taste page and generate your taste profile first, then come back'}
          </p>
          {tasteProfile && (
            <button
              onClick={() => fetchRecommendations()}
              style={{ padding: '8px 20px', border: '1.5px solid #1C1B19', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}
            >
              fetch →
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map(f => {
              const count = typeCounts[f.value]
              if (f.value !== 'all' && count === 0) return null
              return (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                    border: typeFilter === f.value ? '1.5px solid #1C1B19' : '1.5px solid #E0E0E0',
                    background: typeFilter === f.value ? '#1C1B19' : '#fff',
                    color: typeFilter === f.value ? '#fff' : '#ABA69C',
                    fontStyle: typeFilter === f.value ? 'italic' : 'normal',
                  }}
                >
                  {f.label}{f.value !== 'all' && count > 0 ? ` · ${count}` : ''}
                </button>
              )
            })}
          </div>

          {/* Result list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
            {displayed.map((r, i) => {
              const alreadySaved = savedTitles.has(r.title.toLowerCase())
              return (
                <div key={i} style={{ borderBottom: '1px solid #ECEAE6', paddingBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1B19' }}>{r.title}</span>
                      {r.creator && <span style={{ fontSize: 12, color: '#6F6B64' }}> — {r.creator}</span>}
                    </div>
                    <button
                      onClick={() => !alreadySaved && handleSave(r)}
                      style={{
                        flexShrink: 0, padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: alreadySaved ? 'default' : 'pointer',
                        border: alreadySaved ? '1.5px solid #CCC' : '1.5px solid #1C1B19',
                        background: '#fff', color: alreadySaved ? '#CCC' : '#1C1B19', fontWeight: 500,
                      }}
                    >
                      {alreadySaved ? 'saved ✓︎' : '+ save'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#ABA69C', marginBottom: 6 }}>
                    {r.type}{r.year ? ` · ${r.year}` : ''} · via {r.source}
                  </div>
                  <p style={{ fontSize: 12, color: '#6F6B64', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{r.why}</p>
                </div>
              )
            })}
            {displayed.length === 0 && typeFilter !== 'all' && (
              <p style={{ fontSize: 13, color: '#ABA69C' }}>no {typeFilter} picks this round — try a different type or refresh</p>
            )}
          </div>

          {/* Cache timestamp */}
          {cachedAt && (
            <p style={{ fontSize: 11, color: '#CCC', marginBottom: 24 }}>
              fetched {new Date(cachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · refreshes every 48h
            </p>
          )}
        </>
      )}

      {/* Sources section */}
      <div style={{ borderTop: '1px solid #ECEAE6', paddingTop: 16 }}>
        <button
          onClick={() => setSourcesOpen(v => !v)}
          style={{ background: 'none', border: 'none', fontSize: 12, color: '#ABA69C', cursor: 'pointer', padding: 0 }}
        >
          {sourcesOpen ? 'sources ▴' : 'sources ▾'} · {allFeeds.length}
        </button>

        {sourcesOpen && (
          <div style={{ marginTop: 14 }}>
            {/* Default feeds */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>built-in</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DEFAULT_FEEDS.map(f => (
                  <div key={f.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6F6B64', flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: 10, color: '#CCC' }}>{f.kind}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom feeds */}
            {customFeeds.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>custom</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {customFeeds.map(f => (
                    <div key={f.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#6F6B64', flex: 1 }}>{f.name}</span>
                      <button
                        onClick={() => handleRemoveCustomFeed(f.url)}
                        style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add feed */}
            {addFeedOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <input
                  value={newFeedUrl}
                  onChange={e => setNewFeedUrl(e.target.value)}
                  placeholder="rss / substack / reddit feed url"
                  style={inputStyle}
                />
                <input
                  value={newFeedName}
                  onChange={e => setNewFeedName(e.target.value)}
                  placeholder="name (optional)"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAddFeedOpen(false)} style={{ ...btnStyle, color: '#ABA69C' }}>cancel</button>
                  <button onClick={handleAddFeed} disabled={!newFeedUrl.trim()} style={{ ...btnStyle, color: newFeedUrl.trim() ? '#1C1B19' : '#CCC' }}>add</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddFeedOpen(true)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#ABA69C', cursor: 'pointer', padding: 0, marginTop: 8 }}
              >
                + add source
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', border: '1.5px solid #E0E0E0',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', padding: '4px 0',
}
