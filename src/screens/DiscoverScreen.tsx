import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import { authHeaders } from '../lib/supabase'
import { DEFAULT_FEEDS, normaliseFeedUrl, guessFeedKind, type DiscoveryResult, type FeedEntry } from '../lib/feeds'
import { useArtwork } from '../lib/artwork'
import { useWikipediaInfo } from '../lib/wikipedia'
import { typeColor } from '../lib/colors'

// Editorial palette — matches taste + library pages
const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

type TypeFilter = 'all' | 'film' | 'book' | 'music' | 'tv'
const TYPE_TABS: TypeFilter[] = ['all', 'film', 'book', 'music', 'tv']

const CACHE_TTL_MS = 48 * 60 * 60 * 1000

function isStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS
}

function normaliseSources(results: DiscoveryResult[]): DiscoveryResult[] {
  return results.map(r => ({
    ...r,
    sources: Array.isArray(r.sources) ? r.sources
      : (r as unknown as { source?: string }).source
        ? [(r as unknown as { source: string }).source]
        : ["Claude's knowledge"],
  }))
}

export function DiscoverScreen() {
  const { items, addItem } = useItems()
  const { tasteProfile, discoveryCache, setDiscoveryCache, customFeeds, setCustomFeeds, dismissedDiscoverTitles, dismissDiscoverTitle, prefsLoaded } = usePrefs()
  const navigate = useNavigate()

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [intasteResults, setIntasteResults] = useState<DiscoveryResult[]>([])
  const [divertResults, setDivertResults] = useState<DiscoveryResult[]>([])
  const [intasteLoading, setIntasteLoading] = useState(false)
  const [divertLoading, setDivertLoading] = useState(false)
  const [divertLoaded, setDivertLoaded] = useState(false)
  const [intasteCachedAt, setIntasteCachedAt] = useState<string | null>(null)
  const [divertCachedAt, setDivertCachedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Map of lowercase title → first source label, for saved-this-session items
  const [savedItems, setSavedItems] = useState<Map<string, string>>(new Map())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [newFeedName, setNewFeedName] = useState('')
  const [addFeedOpen, setAddFeedOpen] = useState(false)

  const libraryTitleSet = useMemo(
    () => new Set(items.map(i => i.title.toLowerCase())),
    [items]
  )

  // Load in-taste from cache on mount
  useEffect(() => {
    if (!prefsLoaded) return
    const cached = discoveryCache?.intaste
    if (cached && !isStale(cached.cachedAt)) {
      setIntasteResults(normaliseSources(cached.results))
      setIntasteCachedAt(cached.cachedAt)
    }
    const cachedDivert = discoveryCache?.divert
    if (cachedDivert && !isStale(cachedDivert.cachedAt)) {
      setDivertResults(normaliseSources(cachedDivert.results))
      setDivertCachedAt(cachedDivert.cachedAt)
      setDivertLoaded(true)
    }
  }, [prefsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const libraryItems = useMemo(
    () => items.filter(i => i.reaction === 'loved_it' || i.reaction === 'liked_it').map(i => ({ title: i.title, type: i.type })),
    [items]
  )

  async function fetchMode(mode: 'intaste' | 'divert', force = false) {
    if (!tasteProfile) { setError('generate your taste profile on the taste page first'); return }
    if (mode === 'intaste') {
      const cached = discoveryCache?.intaste
      if (!force && cached && !isStale(cached.cachedAt)) return
      setIntasteLoading(true)
    } else {
      const cached = discoveryCache?.divert
      if (!force && cached && !isStale(cached.cachedAt)) return
      setDivertLoading(true)
    }
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/recommend-feeds', {
        method: 'POST', headers,
        body: JSON.stringify({ mode, type: 'all', tasteProfile, libraryItems, customFeeds }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'something went wrong'); return }
      const data = await res.json() as { recommendations: DiscoveryResult[] }
      const recs = normaliseSources(data.recommendations ?? [])
      if (mode === 'intaste') {
        setIntasteResults(recs); setIntasteCachedAt(new Date().toISOString()); setDiscoveryCache('intaste', recs)
      } else {
        setDivertResults(recs); setDivertCachedAt(new Date().toISOString()); setDivertLoaded(true); setDiscoveryCache('divert', recs)
      }
    } catch { setError('network error — try again') }
    finally { mode === 'intaste' ? setIntasteLoading(false) : setDivertLoading(false) }
  }

  async function handleSave(r: DiscoveryResult) {
    const key = r.title.toLowerCase()
    if (savedItems.has(key)) return
    const sourceLabel = r.sources[0] ?? "discover"
    await addItem(
      r.title, r.type, r.creator, r.year,
      { recommendationBlurb: r.why, discoverSource: sourceLabel },
      [], undefined,
      `discover · ${sourceLabel}`
    )
    setSavedItems(prev => new Map(prev).set(key, sourceLabel))
  }

  const dismissedSet = useMemo(() => new Set(dismissedDiscoverTitles), [dismissedDiscoverTitles])

  function filterResults(results: DiscoveryResult[]): DiscoveryResult[] {
    const seen = new Set<string>()
    return results.filter(r => {
      const key = r.title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      if (dismissedSet.has(key)) return false
      if (!savedItems.has(key) && libraryTitleSet.has(key)) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      return true
    })
  }

  const displayedIntaste = useMemo(() => filterResults(intasteResults), [intasteResults, typeFilter, libraryTitleSet, savedItems, dismissedSet]) // eslint-disable-line react-hooks/exhaustive-deps
  const displayedDivert = useMemo(() => filterResults(divertResults), [divertResults, typeFilter, libraryTitleSet, savedItems, dismissedSet]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddFeed() {
    const url = normaliseFeedUrl(newFeedUrl)
    if (!url) return
    const name = newFeedName.trim() || url
    const entry: FeedEntry = { url, name, types: ['cross'], kind: guessFeedKind(url) }
    setCustomFeeds([...customFeeds, entry])
    setNewFeedUrl(''); setNewFeedName(''); setAddFeedOpen(false)
  }

  const allFeeds = [...DEFAULT_FEEDS, ...customFeeds]
  const hasIntaste = intasteResults.length > 0
  const hasDivert = divertResults.length > 0

  return (
    <div style={{ padding: '20px 20px 100px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE }}>discover</div>
      </div>

      {/* Shows near you — prominent entry */}
      <button
        onClick={() => navigate('/shows')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', boxSizing: 'border-box',
          padding: '13px 16px', marginBottom: 20,
          background: INK, border: 'none', borderRadius: 10,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>shows near you</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>browse →</span>
      </button>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, borderBottom: `1px solid ${HAIR}`, paddingBottom: 14 }}>
        {TYPE_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 12, fontWeight: typeFilter === t ? 600 : 400,
              fontStyle: typeFilter === t ? 'italic' : 'normal',
              color: typeFilter === t ? INK : MUTE,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 20 }}>{error}</p>}

      {/* Empty / no profile state */}
      {!hasIntaste && !intasteLoading && (
        <div style={{ paddingTop: 20, paddingBottom: 40 }}>
          <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.6, marginBottom: 20 }}>
            {tasteProfile
              ? 'pull recommendations from your trusted sources'
              : 'generate your taste profile on the taste page first, then come back here'}
          </p>
          {tasteProfile && (
            <button
              onClick={() => fetchMode('intaste')}
              style={{ background: 'none', border: 'none', color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              fetch →
            </button>
          )}
        </div>
      )}

      {/* In taste section */}
      {(hasIntaste || intasteLoading) && (
        <div style={{ marginBottom: 40 }}>
          <SectionHeader label="in taste" cachedAt={intasteCachedAt} onRefresh={() => fetchMode('intaste', true)} refreshing={intasteLoading} />
          {intasteLoading && <p style={{ fontSize: 12, color: MUTE }}>loading…</p>}
          {displayedIntaste.length === 0 && !intasteLoading && typeFilter !== 'all' && (
            <p style={{ fontSize: 12, color: MUTE }}>no {typeFilter} picks this round</p>
          )}
          {displayedIntaste.map((r, i) => (
            <ResultRow key={i} result={r} savedSource={savedItems.get(r.title.toLowerCase()) ?? null} onSave={() => handleSave(r)} onDismiss={() => dismissDiscoverTitle(r.title)} />
          ))}
        </div>
      )}

      {/* Divert section */}
      {hasIntaste && (
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            label="divert"
            cachedAt={divertCachedAt}
            onRefresh={hasDivert ? () => fetchMode('divert', true) : undefined}
            refreshing={divertLoading}
            loadAction={!hasDivert ? () => fetchMode('divert') : undefined}
          />
          {divertLoading && <p style={{ fontSize: 12, color: MUTE }}>loading…</p>}
          {!divertLoaded && !divertLoading && (
            <p style={{ fontSize: 12, color: MUTE, lineHeight: 1.6 }}>things outside your usual patterns — coherent with your sensibility but further afield</p>
          )}
          {displayedDivert.length === 0 && divertLoaded && !divertLoading && typeFilter !== 'all' && (
            <p style={{ fontSize: 12, color: MUTE }}>no {typeFilter} picks this round</p>
          )}
          {displayedDivert.map((r, i) => (
            <ResultRow key={i} result={r} savedSource={savedItems.get(r.title.toLowerCase()) ?? null} onSave={() => handleSave(r)} onDismiss={() => dismissDiscoverTitle(r.title)} />
          ))}
        </div>
      )}

      {/* Sources */}
      <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
        <button onClick={() => setSourcesOpen(v => !v)} style={{ background: 'none', border: 'none', fontSize: 11, color: MUTE, cursor: 'pointer', padding: 0 }}>
          {sourcesOpen ? 'sources ▴' : 'sources ▾'} · {allFeeds.length}
        </button>
        {sourcesOpen && (
          <div style={{ marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>built-in</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {DEFAULT_FEEDS.map(f => (
                  <div key={f.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: GRAPHITE, flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: 10, color: MUTE }}>{f.kind}</span>
                  </div>
                ))}
              </div>
            </div>
            {customFeeds.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>custom</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {customFeeds.map(f => (
                    <div key={f.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: GRAPHITE, flex: 1 }}>{f.name}</span>
                      <button onClick={() => setCustomFeeds(customFeeds.filter(x => x.url !== f.url))} style={{ background: 'none', border: 'none', color: MUTE, fontSize: 12, cursor: 'pointer', padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {addFeedOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <input value={newFeedUrl} onChange={e => setNewFeedUrl(e.target.value)} placeholder="rss / substack / reddit url" style={inputStyle} />
                <input value={newFeedName} onChange={e => setNewFeedName(e.target.value)} placeholder="name (optional)" style={inputStyle} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setAddFeedOpen(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: MUTE, cursor: 'pointer', padding: 0 }}>cancel</button>
                  <button onClick={handleAddFeed} disabled={!newFeedUrl.trim()} style={{ background: 'none', border: 'none', fontSize: 12, color: newFeedUrl.trim() ? INK : MUTE, cursor: 'pointer', padding: 0, fontWeight: 600 }}>add</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddFeedOpen(true)} style={{ background: 'none', border: 'none', fontSize: 12, color: MUTE, cursor: 'pointer', padding: 0, marginTop: 8 }}>+ add source</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label, cachedAt, onRefresh, refreshing, loadAction }: {
  label: string
  cachedAt: string | null
  onRefresh?: () => void
  refreshing?: boolean
  loadAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${HAIR}`, paddingBottom: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {cachedAt && (
          <span style={{ fontSize: 10, color: MUTE }}>
            {new Date(cachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshing} style={{ background: 'none', border: 'none', color: refreshing ? MUTE : GRAPHITE, fontSize: 11, cursor: 'pointer', padding: 0 }}>
            {refreshing ? 'loading…' : 'refresh ↺'}
          </button>
        )}
        {loadAction && (
          <button onClick={loadAction} disabled={refreshing} style={{ background: 'none', border: 'none', color: refreshing ? MUTE : INK, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {refreshing ? 'loading…' : 'load →'}
          </button>
        )}
      </div>
    </div>
  )
}

function ResultRow({ result: r, savedSource, onSave, onDismiss }: {
  result: DiscoveryResult
  savedSource: string | null
  onSave: () => void
  onDismiss: () => void
}) {
  const sourceLabel = r.sources.length === 1 ? r.sources[0] : `${r.sources[0]} +${r.sources.length - 1}`
  const isSaved = savedSource !== null

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 24, marginBottom: 24, borderBottom: `1px solid ${HAIR}` }}>
      <DiscoverCover title={r.title} creator={r.creator} type={r.type} year={r.year} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + year */}
        <div style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{r.title}</span>
          {r.year && <span style={{ fontSize: 12, color: MUTE, marginLeft: 6 }}>{r.year}</span>}
        </div>
        {/* Creator */}
        {r.creator && (
          <div style={{ fontSize: 12, color: GRAPHITE, marginBottom: 6 }}>{r.creator}</div>
        )}
        {/* Type · source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: MUTE }}>{r.type} · via {sourceLabel}</span>
          <DiscoverWikiLink title={r.title} creator={r.creator} type={r.type} year={r.year} />
        </div>
        {/* Why blurb — the editorial reason to care */}
        {r.why && (
          <p style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.7, margin: '0 0 12px', fontStyle: 'italic' }}>{r.why}</p>
        )}
        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSaved ? (
            <span style={{ fontSize: 11, color: MUTE }}>saved ✓︎</span>
          ) : (
            <button
              onClick={onSave}
              style={{
                background: INK, color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, padding: '5px 12px', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + save
            </button>
          )}
          {!isSaved && (
            <button
              onClick={onDismiss}
              style={{ background: 'none', border: 'none', fontSize: 11, color: MUTE, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              not interested
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DiscoverCover({ title, creator, type, year }: { title: string; creator: string | null; type: string; year: number | null }) {
  const artwork = useArtwork(type, title, creator, year, null)
  const color = typeColor(type)
  const isMusic = type === 'music'
  const w = isMusic ? 72 : 56
  const h = isMusic ? 72 : 84
  return artwork
    ? <img src={artwork} alt="" style={{ width: w, height: h, objectFit: 'cover', border: `1px solid ${HAIR}`, flexShrink: 0 }} />
    : <div style={{ width: w, height: h, background: color.bg, flexShrink: 0, border: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: color.border, letterSpacing: '0.3px' }}>{type}</div>
}

function DiscoverWikiLink({ title, creator, type, year }: { title: string; creator: string | null; type: string; year: number | null }) {
  const { url } = useWikipediaInfo(type, title, creator, year, null)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="tlink" style={{ fontSize: 11 }}>
      wikipedia ↗︎
    </a>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', border: `1.5px solid ${HAIR}`,
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
