import { useState, useEffect, useMemo } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import { authHeaders } from '../lib/supabase'
import { DEFAULT_FEEDS, normaliseFeedUrl, guessFeedKind, type DiscoveryResult, type FeedEntry } from '../lib/feeds'
import { editorialPicksFor } from '../lib/editorialPicks'
import { useArtwork } from '../lib/artwork'
import { useWikipediaInfo } from '../lib/wikipedia'
import { typeColor } from '../lib/colors'

// Editorial palette — matches taste + library pages
const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

type TypeKey = 'film' | 'music' | 'book' | 'tv'
// Section order: film → music → book → tv (locked in session-52 spec)
const TYPE_ORDER: TypeKey[] = ['film', 'music', 'book', 'tv']
const TYPE_LABEL: Record<TypeKey, string> = { film: 'films', music: 'music', book: 'books', tv: 'tv' }
const PREVIEW_COUNT = 3 // picks shown per section before "more →"

type Stream = 'foryou' | 'further'

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
        : ["nospaces"],
  }))
}

export function DiscoverScreen() {
  const { items, addItem } = useItems()
  const { tasteProfile, discoveryCache, setDiscoveryCache, customFeeds, setCustomFeeds, dismissedDiscoverTitles, dismissDiscoverTitle, seenDiscoverTitles, addSeenDiscoverTitles, prefsLoaded } = usePrefs()

  const [stream, setStream] = useState<Stream>('foryou')
  const [drillType, setDrillType] = useState<TypeKey | null>(null)

  const [intasteResults, setIntasteResults] = useState<DiscoveryResult[]>([])
  const [divertResults, setDivertResults] = useState<DiscoveryResult[]>([])
  const [intasteLoading, setIntasteLoading] = useState(false)
  const [divertLoading, setDivertLoading] = useState(false)
  const [divertLoaded, setDivertLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mood search — free-text "in the mood for…". One paid AI call per search.
  const [moodInput, setMoodInput] = useState('')
  const [moodResults, setMoodResults] = useState<DiscoveryResult[]>([])
  const [moodActive, setMoodActive] = useState(false)
  const [moodLoading, setMoodLoading] = useState(false)

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

  // Load cached streams on mount
  useEffect(() => {
    if (!prefsLoaded) return
    const cached = discoveryCache?.intaste
    if (cached && !isStale(cached.cachedAt)) {
      setIntasteResults(normaliseSources(cached.results))
    }
    const cachedDivert = discoveryCache?.divert
    if (cachedDivert && !isStale(cachedDivert.cachedAt)) {
      setDivertResults(normaliseSources(cachedDivert.results))
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
        body: JSON.stringify({ mode, type: 'all', tasteProfile, libraryItems, customFeeds, priorRecs: seenDiscoverTitles }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'something went wrong'); return }
      const data = await res.json() as { recommendations: DiscoveryResult[] }
      const recs = normaliseSources(data.recommendations ?? [])
      addSeenDiscoverTitles(recs.map(r => r.title))
      if (mode === 'intaste') {
        setIntasteResults(recs); setDiscoveryCache('intaste', recs)
      } else {
        setDivertResults(recs); setDivertLoaded(true); setDiscoveryCache('divert', recs)
      }
    } catch { setError('network error — try again') }
    finally { mode === 'intaste' ? setIntasteLoading(false) : setDivertLoading(false) }
  }

  async function runMoodSearch() {
    const q = moodInput.trim()
    if (!q || moodLoading) return
    setMoodLoading(true); setMoodActive(true); setDrillType(null); setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/recommend-feeds', {
        method: 'POST', headers,
        body: JSON.stringify({ mood: q, type: 'all', tasteProfile, libraryItems, customFeeds, priorRecs: seenDiscoverTitles }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'something went wrong'); setMoodActive(false); return }
      const data = await res.json() as { recommendations: DiscoveryResult[] }
      const recs = normaliseSources(data.recommendations ?? [])
      addSeenDiscoverTitles(recs.map(r => r.title))
      setMoodResults(recs)
    } catch { setError('network error — try again'); setMoodActive(false) }
    finally { setMoodLoading(false) }
  }

  function clearMood() {
    setMoodActive(false); setMoodResults([]); setMoodInput(''); setDrillType(null)
  }

  function selectStream(next: Stream) {
    setStream(next); setDrillType(null)
    if (next === 'further' && tasteProfile && !divertLoaded && !divertLoading) fetchMode('divert')
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

  // De-dupe + drop dismissed / already-in-library (unless saved this session).
  function filterResults(results: DiscoveryResult[]): DiscoveryResult[] {
    const seen = new Set<string>()
    return results.filter(r => {
      const key = r.title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      if (dismissedSet.has(key)) return false
      if (!savedItems.has(key) && libraryTitleSet.has(key)) return false
      return true
    })
  }

  // What "for you" shows: personalised in-taste picks when loaded, else the
  // free editorial cold-start list (no wall, no profile required).
  const hasIntaste = intasteResults.length > 0
  const usingEditorial = !hasIntaste
  const forYouSource = useMemo(
    () => hasIntaste ? intasteResults : TYPE_ORDER.flatMap(t => editorialPicksFor(t)),
    [intasteResults, hasIntaste]
  )

  // The active result set (mood overrides the stream toggle entirely).
  const activeResults = moodActive ? moodResults : (stream === 'further' ? divertResults : forYouSource)
  const displayed = useMemo(
    () => filterResults(activeResults),
    [activeResults, libraryTitleSet, savedItems, dismissedSet] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const byType = useMemo(() => {
    const m = new Map<TypeKey, DiscoveryResult[]>()
    for (const t of TYPE_ORDER) m.set(t, [])
    for (const r of displayed) {
      const arr = m.get(r.type as TypeKey)
      if (arr) arr.push(r)
    }
    return m
  }, [displayed])

  function handleAddFeed() {
    const url = normaliseFeedUrl(newFeedUrl)
    if (!url) return
    const name = newFeedName.trim() || url
    const entry: FeedEntry = { url, name, types: ['cross'], kind: guessFeedKind(url) }
    setCustomFeeds([...customFeeds, entry])
    setNewFeedUrl(''); setNewFeedName(''); setAddFeedOpen(false)
  }

  const allFeeds = [...DEFAULT_FEEDS, ...customFeeds]
  const isLoadingActive = moodActive ? moodLoading : (stream === 'further' ? divertLoading : intasteLoading)
  const visibleTypes = drillType ? [drillType] : TYPE_ORDER

  return (
    <div style={{ padding: '20px 20px 100px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: INK }}>discover</h1>
      </div>

      {/* Mood search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          value={moodInput}
          onChange={e => setMoodInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runMoodSearch() }}
          placeholder="in the mood for…"
          style={{
            flex: 1, boxSizing: 'border-box', padding: '9px 12px',
            border: `1.5px solid ${HAIR}`, borderRadius: 8, fontSize: 14,
            fontFamily: 'inherit', outline: 'none', color: INK,
          }}
        />
        <button
          onClick={runMoodSearch}
          disabled={!moodInput.trim() || moodLoading}
          style={{
            flexShrink: 0, padding: '0 14px', borderRadius: 8, border: 'none',
            background: moodInput.trim() && !moodLoading ? INK : HAIR,
            color: moodInput.trim() && !moodLoading ? '#fff' : MUTE,
            fontSize: 13, fontWeight: 600, cursor: moodInput.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          {moodLoading ? '…' : 'go'}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 16 }}>{error}</p>}

      {/* Mood-results banner — overrides the stream view until cleared */}
      {moodActive ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
          <span style={{ fontSize: 12, color: GRAPHITE, fontStyle: 'italic' }}>
            in the mood for “{moodInput.trim() || '…'}”
          </span>
          <button onClick={clearMood} style={{ background: 'none', border: 'none', color: GRAPHITE, fontSize: 12, cursor: 'pointer', padding: 0 }}>
            clear ✕
          </button>
        </div>
      ) : (
        /* Stream toggle: for you ⇄ further afield */
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, borderBottom: `1px solid ${HAIR}`, paddingBottom: 14 }}>
          <StreamTab label="for you" active={stream === 'foryou'} onClick={() => selectStream('foryou')} />
          {tasteProfile && (
            <StreamTab label="further afield" active={stream === 'further'} onClick={() => selectStream('further')} />
          )}
          {hasIntaste && stream === 'foryou' && (
            <button
              onClick={() => fetchMode('intaste', true)}
              disabled={intasteLoading}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: intasteLoading ? MUTE : GRAPHITE, fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              {intasteLoading ? 'loading…' : 'refresh ↺'}
            </button>
          )}
        </div>
      )}

      {/* Drill-in back link */}
      {drillType && (
        <button onClick={() => setDrillType(null)} style={{ background: 'none', border: 'none', color: GRAPHITE, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 18 }}>
          ← all
        </button>
      )}

      {/* Cold-start nudge: profile exists but personalised picks not loaded yet */}
      {!moodActive && stream === 'foryou' && tasteProfile && usingEditorial && !intasteLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 24, padding: '11px 14px', background: '#FAF9F7', borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: GRAPHITE }}>showing starter picks</span>
          <button onClick={() => fetchMode('intaste', true)} style={{ background: 'none', border: 'none', color: INK, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            load your picks →
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoadingActive && (
        <p style={{ fontSize: 12, color: MUTE, marginBottom: 24 }}>loading…</p>
      )}

      {/* Empty (mood / divert returned nothing) */}
      {!isLoadingActive && displayed.length === 0 && (moodActive || stream === 'further') && (
        <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.6, marginBottom: 24 }}>
          {moodActive ? 'nothing matched — try a different mood' : 'nothing further afield this round — refresh to try again'}
        </p>
      )}

      {/* Type-first stacked sections */}
      {!isLoadingActive && visibleTypes.map(t => {
        const all = byType.get(t) ?? []
        if (all.length === 0) return null
        const shown = drillType ? all : all.slice(0, PREVIEW_COUNT)
        const hasMore = !drillType && all.length > PREVIEW_COUNT
        return (
          <div key={t} style={{ marginBottom: 34 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${HAIR}`, paddingBottom: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{TYPE_LABEL[t]}</span>
              {hasMore && (
                <button onClick={() => setDrillType(t)} style={{ background: 'none', border: 'none', color: GRAPHITE, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  more · {all.length} →
                </button>
              )}
            </div>
            {shown.map((r, i) => (
              <ResultRow key={i} result={r} savedSource={savedItems.get(r.title.toLowerCase()) ?? null} onSave={() => handleSave(r)} onDismiss={() => dismissDiscoverTitle(r.title)} />
            ))}
          </div>
        )
      })}

      {/* Sources */}
      <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14, marginTop: 8 }}>
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

function StreamTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontStyle: active ? 'italic' : 'normal',
        color: active ? INK : MUTE,
      }}
    >
      {label}
    </button>
  )
}

function ResultRow({ result: r, savedSource, onSave, onDismiss }: {
  result: DiscoveryResult
  savedSource: string | null
  onSave: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
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
        {/* Why blurb — clamped to ~2 lines in the feed, full on tap */}
        {r.why && (
          <p
            onClick={() => setExpanded(v => !v)}
            style={{
              fontSize: 13, color: GRAPHITE, lineHeight: 1.7, margin: '0 0 12px',
              fontStyle: 'italic', cursor: 'pointer',
              ...(expanded ? {} : {
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }),
            }}
          >
            {r.why}
          </p>
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
  // Same width for every type so covers share a left edge and the text column
  // starts at the same x; music stays square (album art) instead of portrait.
  const w = 56
  const h = isMusic ? 56 : 84
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
