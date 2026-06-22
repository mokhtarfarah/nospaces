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
const NUMERAL = '#CFCBC2' // light grey for the masthead-list numerals

type TypeKey = 'film' | 'music' | 'book' | 'tv'
// Section order: film → music → book → tv (locked in session-52 spec)
const TYPE_ORDER: TypeKey[] = ['film', 'music', 'book', 'tv']
const TYPE_LABEL: Record<TypeKey, string> = { film: 'films', music: 'music', book: 'books', tv: 'tv' }
type MediumFilter = 'all' | TypeKey

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
  const [mediumFilter, setMediumFilter] = useState<MediumFilter>('all')
  const [detail, setDetail] = useState<DiscoveryResult | null>(null) // tapped pick → detail card

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
  const [moodOpen, setMoodOpen] = useState(false) // mood input row visible

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
    // "For you" is the default, not an opt-in. If there's a taste profile and no
    // fresh cache, fetch personalised picks automatically (self-guards on the
    // 48h cache, so this is at most one paid call per cache window, not per visit).
    if (tasteProfile && (!cached || isStale(cached.cachedAt))) fetchMode('intaste')
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
    setMoodLoading(true); setMoodActive(true); setError(null)
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
    setMoodActive(false); setMoodResults([]); setMoodInput(''); setMoodOpen(false)
  }

  function selectStream(next: Stream) {
    setStream(next); setMoodOpen(false)
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

  // What "for you" shows: personalised in-taste picks whenever there's a taste
  // profile (auto-loaded above). Editorial picks are a fallback ONLY for the true
  // cold start — someone with no taste profile yet.
  const hasProfile = !!tasteProfile
  const hasIntaste = intasteResults.length > 0
  const usingEditorial = !hasProfile
  const forYouSource = useMemo(
    () => hasProfile ? intasteResults : TYPE_ORDER.flatMap(t => editorialPicksFor(t)),
    [intasteResults, hasProfile]
  )

  // The active result set (mood overrides the stream toggle entirely).
  const activeResults = moodActive ? moodResults : (stream === 'further' ? divertResults : forYouSource)
  const displayed = useMemo(
    () => filterResults(activeResults),
    [activeResults, libraryTitleSet, savedItems, dismissedSet] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // One flat, numbered run. The medium switcher narrows it; "all" interleaves.
  const shown = useMemo(
    () => mediumFilter === 'all' ? displayed : displayed.filter(r => r.type === mediumFilter),
    [displayed, mediumFilter]
  )

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

  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div style={{ padding: '20px 20px 100px', fontFamily: 'inherit' }}>

      {/* Header — matches the rest of the app: small, left-aligned */}
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: INK }}>discover</h1>
        <span style={{ fontSize: 10, color: MUTE, letterSpacing: '1px', textTransform: 'uppercase' }}>{dateLabel}</span>
      </header>

      {error && <p style={{ fontSize: 12, color: '#C0392B', textAlign: 'center', margin: '12px 0 0' }}>{error}</p>}

      {/* Stream row — for you · further afield | in the mood (Library chip pattern) */}
      {moodActive ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0 10px' }}>
          <span style={{ fontSize: 13, color: '#111', fontStyle: 'italic' }}>in the mood for “{moodInput.trim() || '…'}”</span>
          <button onClick={clearMood} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0 }}>clear ✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Chip label="for you" active={stream === 'foryou'} onClick={() => selectStream('foryou')} />
          {tasteProfile && (
            <Chip label="further afield" active={stream === 'further'} onClick={() => selectStream('further')} />
          )}
          <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
          <Chip label="in the mood…" active={moodOpen} onClick={() => setMoodOpen(v => !v)} />
        </div>
      )}

      {/* Mood input — expands from the nav */}
      {moodOpen && !moodActive && (
        <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
          <input
            value={moodInput}
            onChange={e => setMoodInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runMoodSearch() }}
            placeholder="something funny but smart…"
            autoFocus
            style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', border: `1.5px solid ${HAIR}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: INK }}
          />
          <button
            onClick={runMoodSearch}
            disabled={!moodInput.trim() || moodLoading}
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: 8, border: 'none', background: moodInput.trim() && !moodLoading ? INK : HAIR, color: moodInput.trim() && !moodLoading ? '#fff' : MUTE, fontSize: 13, fontWeight: 600, cursor: moodInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >
            {moodLoading ? '…' : 'go'}
          </button>
        </div>
      )}

      {/* Medium switcher — second chip row, same pattern as Library's status row */}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', borderBottom: `1px solid #E8E8E8`, marginBottom: 16 }}>
        <Chip label="all" active={mediumFilter === 'all'} onClick={() => setMediumFilter('all')} />
        {TYPE_ORDER.map(t => (
          <Chip key={t} label={TYPE_LABEL[t]} active={mediumFilter === t} onClick={() => setMediumFilter(t)} />
        ))}
      </div>

      {/* Count + refresh */}
      {!isLoadingActive && shown.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: MUTE }}>{shown.length} {shown.length === 1 ? 'pick' : 'picks'}</span>
          {!moodActive && stream === 'foryou' && hasIntaste && (
            <button onClick={() => fetchMode('intaste', true)} disabled={intasteLoading} style={{ background: 'none', border: 'none', color: intasteLoading ? MUTE : GRAPHITE, fontSize: 11, cursor: 'pointer', padding: 0 }}>
              {intasteLoading ? 'loading…' : 'refresh ↺'}
            </button>
          )}
        </div>
      )}

      {/* Editorial explainer — only at true cold start (no taste profile) */}
      {!moodActive && usingEditorial && (
        <div style={{ marginBottom: 20, padding: '12px 14px', background: '#FAF9F7', borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: GRAPHITE, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: INK, fontWeight: 600 }}>starter picks</strong> — a hand-picked shortlist of broadly loved films, music, books and tv while you get going. Not personalised.{' '}
            <span style={{ color: GRAPHITE }}>Build a taste profile on the taste page for recommendations made for you.</span>
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoadingActive && <p style={{ fontSize: 12, color: MUTE, textAlign: 'center', marginBottom: 24 }}>loading…</p>}

      {/* Empty */}
      {!isLoadingActive && shown.length === 0 && (
        <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
          {moodActive ? 'nothing matched — try a different mood'
            : stream === 'further' ? 'nothing further afield this round — refresh to try again'
            : mediumFilter !== 'all' ? `no ${TYPE_LABEL[mediumFilter as TypeKey]} this round`
            : 'no picks yet — refresh to pull a fresh set'}
        </p>
      )}

      {/* The numbered run */}
      {!isLoadingActive && shown.map((r, i) => (
        <ResultRow
          key={r.title.toLowerCase()}
          result={r}
          index={i + 1}
          savedSource={savedItems.get(r.title.toLowerCase()) ?? null}
          onOpen={() => setDetail(r)}
          onSave={() => handleSave(r)}
          onDismiss={() => dismissDiscoverTitle(r.title)}
        />
      ))}

      {/* Detail card — opens when a pick is tapped (Library sheet pattern) */}
      {detail && (
        <DetailSheet
          result={detail}
          savedSource={savedItems.get(detail.title.toLowerCase()) ?? null}
          onSave={() => handleSave(detail)}
          onDismiss={() => { dismissDiscoverTitle(detail.title); setDetail(null) }}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Sources */}
      <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14, marginTop: 16 }}>
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

// Same tab-chip as Library (TabChip) so the two screens read as one app.
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '4px 2px 8px', border: 'none', background: 'none',
        color: active ? '#111' : '#888', fontSize: 13,
        fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function ResultRow({ result: r, index, savedSource, onOpen, onSave, onDismiss }: {
  result: DiscoveryResult
  index: number
  savedSource: string | null
  onOpen: () => void
  onSave: () => void
  onDismiss: () => void
}) {
  const artwork = useArtwork(r.type, r.title, r.creator, r.year, null)
  const fallbackTint = typeColor(r.type).bg
  const isSaved = savedSource !== null
  const meta = [r.type, r.year ?? undefined, r.creator ?? undefined].filter(Boolean).join(' · ')
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div onClick={onOpen} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', marginBottom: 8, cursor: 'pointer' }}>
      {/* Ghosted cover art — blurred + faded in from the right, behind the text */}
      {artwork ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${artwork})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(4px)', opacity: 0.42, transform: 'scale(1.08)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 30%, #000 100%)',
          maskImage: 'linear-gradient(90deg, transparent 30%, #000 100%)',
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 35%, ${fallbackTint})` }} />
      )}

      <div style={{ position: 'relative', display: 'flex', gap: 14, padding: '14px 14px 16px' }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: NUMERAL, lineHeight: 1, flexShrink: 0, letterSpacing: '-0.5px' }}>{index}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{r.title}</div>
          <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.3px', textTransform: 'uppercase', margin: '3px 0 8px' }}>
            {meta}
          </div>
          {r.why && (
            <p style={{
              fontSize: 13, color: '#4A453E', lineHeight: 1.65, margin: '0 0 10px', fontStyle: 'italic',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {r.why}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isSaved ? (
              <span style={{ fontSize: 11, color: MUTE }}>saved ✓︎</span>
            ) : (
              <button onClick={e => { stop(e); onSave() }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: INK, cursor: 'pointer', fontFamily: 'inherit', borderBottom: `1px solid ${INK}`, lineHeight: 1.4 }}>
                save to library
              </button>
            )}
            {!isSaved && (
              <button onClick={e => { stop(e); onDismiss() }} style={{ background: 'none', border: 'none', fontSize: 11, color: MUTE, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                not for me
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTE }}>more ›</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tap a pick → this detail card (mirrors the Library item sheet).
function DetailSheet({ result: r, savedSource, onSave, onDismiss, onClose }: {
  result: DiscoveryResult
  savedSource: string | null
  onSave: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  const artwork = useArtwork(r.type, r.title, r.creator, r.year, null)
  const color = typeColor(r.type)
  const isSaved = savedSource !== null
  const w = r.type === 'music' ? 64 : 52
  const h = r.type === 'music' ? 64 : 78
  const sourceLabel = r.sources.length <= 1 ? (r.sources[0] ?? 'discover') : `${r.sources[0]} +${r.sources.length - 1}`
  const meta = [typeColor(r.type).label, r.creator ?? undefined, r.year ?? undefined].filter(Boolean).join(' · ')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '10px 20px 28px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '92dvh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBB', fontSize: 16, lineHeight: 1, padding: '0 0 4px' }}>✕</button>
        </div>

        {/* Header — cover + title + meta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          {artwork
            ? <img src={artwork} alt="" style={{ width: w, height: h, objectFit: 'cover', border: '1px solid #EEE', flexShrink: 0 }} />
            : <div style={{ width: w, height: h, background: color.bg, border: '1px solid #EEE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: color.border }}>{r.type}</div>}
          <div style={{ minWidth: 0, paddingTop: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: INK }}>{r.title}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{meta}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: MUTE }}>via {sourceLabel}</span>
              <DiscoverWikiLink title={r.title} creator={r.creator} type={r.type} year={r.year} />
            </div>
          </div>
        </div>

        {/* Why — full blurb, given room */}
        {r.why && (
          <div style={{ background: '#F7F7F7', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>why this</div>
            <p style={{ fontSize: 14, color: '#3A352E', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{r.why}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isSaved ? (
            <span style={{ fontSize: 13, color: MUTE }}>saved to library ✓︎</span>
          ) : (
            <button onClick={onSave} style={{ background: INK, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
              save to library
            </button>
          )}
          {!isSaved && (
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', fontSize: 13, color: MUTE, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              not for me
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function DiscoverWikiLink({ title, creator, type, year }: { title: string; creator: string | null; type: string; year: number | null }) {
  const { url } = useWikipediaInfo(type, title, creator, year, null)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="tlink" style={{ fontSize: 11, marginLeft: 'auto' }}>
      wikipedia ↗︎
    </a>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', border: `1.5px solid ${HAIR}`,
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
