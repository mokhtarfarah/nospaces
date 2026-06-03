import { useState, useEffect } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { authHeaders } from '../lib/supabase'
import { NoteInput } from './NoteInput'
import { MoodChips } from './MoodChips'
import { VIBES, VERDICTS } from '../lib/moods'
import { useWikipediaInfo, clearWikiCache } from '../lib/wikipedia'
import { useArtwork } from '../lib/artwork'
import { useBookBlurb } from '../lib/blurb'
import { getSeasons, useSeasonCount, type Season } from '../lib/seasons'
import { WhereToWatchSheet } from './WhereToWatchSheet'
import { genresForType, isGenreTag } from '../lib/genres'

interface Props {
  item: Item
  onEdit: (fields: { title: string; creator: string | null; type: string; year: number | null; tags?: string[]; source_detail?: string | null; metadata?: Record<string, unknown> }) => void
  onMarkDone: (reaction: ItemReaction, note: string, moods: string[]) => void
  onEditReaction: (reaction: ItemReaction, note: string, moods: string[]) => void
  onSetSeasons: (seasons: Season[]) => void
  onSetMoods: (moods: string[]) => void
  onSetTags: (tags: string[]) => void
  onToggleOwned: (owned: boolean) => void
  onDelete: () => void
  onClose: () => void
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']


const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it: 'loved it', liked_it: 'liked it', eh: 'eh', not_for_me: 'not for me',
}

type View = 'main' | 'edit' | 'reaction'

// A candidate match offered after re-identify (from the AI's alternatives or a catalog lookup).
type Candidate = { title: string; creator: string | null; year: number | null; metadata?: Record<string, unknown>; tags?: string[] }

// Runtime (film/tv) or page count (book) for display on the card. Null if unknown.
function formatRuntime(item: Item): string | null {
  if (item.type === 'book') {
    const p = item.metadata?.pages
    return typeof p === 'number' && p > 0 ? `${p} pp` : null
  }
  if (item.type === 'film' || item.type === 'tv') {
    const r = item.metadata?.runtime
    return typeof r === 'number' && r > 0 ? `${r} min` : null
  }
  return null
}

export function ItemActionSheet({ item, onEdit, onMarkDone, onEditReaction, onSetSeasons, onSetMoods, onSetTags, onToggleOwned, onDelete, onClose }: Props) {
  const [view, setView] = useState<View>('main')
  const [title, setTitle] = useState(item.title)
  const [creator, setCreator] = useState(item.creator ?? '')
  const [type, setType] = useState(item.type)
  const [year, setYear] = useState(item.year?.toString() ?? '')
  const [reaction, setReaction] = useState<ItemReaction | null>(item.reaction)
  const [note, setNote] = useState(item.note ?? '')
  const [selectedMoods, setSelectedMoods] = useState<string[]>(item.moods ?? [])

  function toggleMood(mood: string) {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    )
  }
  const [coverUrl, setCoverUrl] = useState((item.metadata?.coverUrl as string | null) ?? '')
  const [series, setSeries] = useState((item.metadata?.series as string | null) ?? '')
  const [sourceDetail, setSourceDetail] = useState(item.source_detail ?? '')
  const [reidentifying, setReidentifying] = useState(false)
  // After a re-identify, hold the other candidates so the user can pick the right
  // one if the AI grabbed the wrong match. null = picker hidden.
  const [picks, setPicks] = useState<Candidate[] | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showBlurb, setShowBlurb] = useState(false)
  const [tagsEditing, setTagsEditing] = useState(false)
  const [reactionTagsOpen, setReactionTagsOpen] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>(() => getSeasons(item.metadata))
  const [watchOpen, setWatchOpen] = useState(false)
  const color = typeColor(item.type)

  // Persist the season checklist (kept in local state for instant feedback).
  function updateSeasons(next: Season[]) {
    setSeasons(next)
    onSetSeasons(next)
  }
  const toggleSeason = (n: number) =>
    updateSeasons(seasons.map(s => (s.n === n ? { ...s, done: !s.done } : s)))
  const addSeason = () =>
    updateSeasons([...seasons, { n: (seasons[seasons.length - 1]?.n ?? 0) + 1, done: false }])
  const removeLastSeason = () => updateSeasons(seasons.slice(0, -1))

  // Auto-fill the season count from TVmaze when a TV show has none yet (display only;
  // it persists once a season is ticked).
  const autoCount = useSeasonCount(item.title, item.type === 'tv' && seasons.length === 0)
  useEffect(() => {
    if (item.type === 'tv' && seasons.length === 0 && autoCount && autoCount > 0) {
      setSeasons(Array.from({ length: autoCount }, (_, i) => ({ n: i + 1, done: false })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount])

  // Wikipedia article link (null if no page exists / type not linked).
  // Music resolves a page (for the cover) but keeps Spotify as its button.
  const metaWiki = item.metadata?.wikiUrl
    ? { url: item.metadata.wikiUrl as string, thumbnail: (item.metadata.wikiThumb as string) ?? null, summary: (item.metadata.wikiSummary as string) ?? null }
    : null
  const { url, summary, thumbnail: wikiThumb } = useWikipediaInfo(item.type, item.title, item.creator, item.year, metaWiki?.summary ? metaWiki : null)
  const wikiUrl = item.type === 'music' ? null : url
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, coverUrl || null)
  const cover = artwork ?? wikiThumb
  // For books with no Wikipedia summary, fall back to an Open Library / Apple Books blurb.
  const bookBlurb = useBookBlurb(item.title, item.creator, item.year, item.type === 'book' && !summary)
  // Priority: recommendation blurb (from list) > captured blurb (from photo) > wiki > book
  const recBlurb = item.metadata?.recommendationBlurb as string | undefined
  const capturedBlurb = item.metadata?.capturedBlurb as string | undefined
  const blurb = recBlurb ?? capturedBlurb ?? summary ?? bookBlurb.summary
  const blurbSource = recBlurb
    ? (item.recommended_by ?? 'recommendation')
    : capturedBlurb ? null
    : summary ? 'Wikipedia'
    : bookBlurb.source

  // Spotify URL for music items. Synced albums link directly; others fall back to search.
  const spotifyUrl = item.type === 'music'
    ? ((item.metadata?.spotifyUrl as string | undefined)
        ?? (item.metadata?.spotifyId ? `https://open.spotify.com/album/${item.metadata.spotifyId}` : null)
        ?? `https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))}`)
    : null

  function handleSaveDetails() {
    const metadata: Record<string, unknown> = { ...item.metadata, coverUrl: coverUrl.trim() || null }
    delete metadata.scratch  // clear scratch flag when user confirms the identity
    if (series.trim()) metadata.series = series.trim()
    else delete metadata.series
    onEdit({
      title: title.trim() || item.title,
      creator: creator.trim() || null,
      type,
      year: year ? parseInt(year) : null,
      source_detail: sourceDetail.trim() || null,
      metadata,
    })
    onClose()
  }

  // autoSave=true (main card): save result immediately, no edit view.
  // autoSave=false (edit view header): populate edit fields for review.
  // Scratch items always drop into edit regardless.
  async function handleReidentify(autoSave = false) {
    if (reidentifying) return
    setReidentifying(true)
    try {
      // Include year in the input string to help anchor disambiguation (e.g. a 2005
      // film adaptation vs the 1813 novel it was based on). Also pass typeHint so the
      // identify API strongly prefers the existing type.
      const currentTitle = autoSave ? item.title : (title.trim() || item.title)
      const currentYear  = autoSave ? item.year  : (year ? parseInt(year) : item.year)
      const currentType  = autoSave ? item.type  : type
      const inputStr = currentYear ? `${currentTitle} (${currentYear})` : currentTitle

      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ input: inputStr, typeHint: currentType }),
      })
      const r = await res.json()
      if (item.metadata?.scratch || !autoSave) {
        // Edit-view path: populate fields and let user review before saving.
        if (r.title) setTitle(r.title)
        if (r.creator) setCreator(r.creator)
        if (r.type) setType(r.type)
        if (r.year) setYear(String(r.year))
        if (item.metadata?.scratch) { setCoverUrl(''); setView('edit') }
      } else {
        // Auto-save path: apply the top result, then surface the AI's other
        // candidates so the user can correct it if it grabbed the wrong match.
        applyCandidate({ title: r.title, creator: r.creator, year: r.year, metadata: r.metadata, tags: r.tags })
        const alts: Candidate[] = (Array.isArray(r.alternatives) ? r.alternatives : [])
          .filter((a: Candidate) => a?.title && a.title.toLowerCase() !== (r.title || item.title).toLowerCase())
          .map((a: Candidate) => ({ title: a.title, creator: a.creator ?? null, year: a.year ?? null, metadata: a.metadata, tags: a.tags }))
        setPicks(alts) // [] still opens the panel so "look it up online" is reachable
      }
    } catch {
      // ignore — item stays as-is
    } finally {
      setReidentifying(false)
    }
  }

  // Apply one chosen match onto the item. Never override the existing type — if the
  // AI returned a different form (e.g. book instead of film), keep what the user had.
  function applyCandidate(c: Candidate) {
    const metadata: Record<string, unknown> = { ...item.metadata }
    if (c.metadata?.runtime) metadata.runtime = c.metadata.runtime
    if (c.metadata?.pages) metadata.pages = c.metadata.pages
    const newTitle   = c.title   || item.title
    const newCreator = c.creator || item.creator
    const newYear    = c.year    ?? item.year
    // Clear cache for both old and new keys so the Wikipedia hook re-fetches.
    clearWikiCache(item.type, item.title, item.creator, item.year)
    clearWikiCache(item.type, newTitle,   newCreator,   newYear)
    onEdit({
      title:   newTitle,
      creator: newCreator,
      type:    item.type, // always keep existing type
      year:    newYear,
      tags:    c.tags?.length ? c.tags : item.tags,
      metadata,
    })
  }

  // Search real catalogs (iTunes / TMDB / Open Library) for more matches to choose from.
  async function lookUpOnline() {
    if (lookingUp) return
    setLookingUp(true)
    try {
      const q = year ? `${title.trim() || item.title} (${year})` : (title.trim() || item.title)
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}`, { headers: await authHeaders() })
      const data = await res.json()
      const more: Candidate[] = (data.results ?? [])
        .filter((r: Candidate) => r?.title)
        .map((r: Candidate) => ({ title: r.title, creator: r.creator ?? null, year: r.year ?? null, metadata: r.metadata, tags: r.tags }))
      setPicks(prev => {
        const base = prev ?? []
        const seen = new Set(base.map(p => p.title.toLowerCase()))
        return [...base, ...more.filter(m => !seen.has(m.title.toLowerCase()))]
      })
    } catch {
      /* ignore — leave list as-is */
    } finally {
      setLookingUp(false)
    }
  }

  function handleSaveReaction() {
    if (!reaction) return
    if (item.status === 'want_to') {
      onMarkDone(reaction, note, selectedMoods)
    } else {
      onEditReaction(reaction, note, selectedMoods)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '6px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '96dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {view === 'main' && (
          <>
            {/* Item preview — square cover for albums, poster (2:3) for everything else */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
              {(() => {
                const w = item.type === 'music' ? 64 : 52
                const h = item.type === 'music' ? 64 : 78
                const box: React.CSSProperties = { width: w, height: h, borderRadius: 0, flexShrink: 0, objectFit: 'cover', border: '1px solid #EEE' }
                return cover
                  ? <img src={cover} alt="" style={box} />
                  : <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: color.border }}>{item.type === 'other' ? '' : item.type}</div>
              })()}
              <div style={{ minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                  {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year, formatRuntime(item)].filter(Boolean).join(' · ')}
                  {item.reaction && ` · ${REACTION_LABELS[item.reaction]}`}
                </div>
                {typeof item.metadata?.series === 'string' && item.metadata.series.trim() && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>↳ {item.metadata.series}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {(() => {
                    // Recommendation: show URL link if available; skip plain-text label
                    // when a blurb toggle already shows the same source name.
                    if (item.source_detail === 'recommendation' && item.recommended_by) {
                      const url = item.metadata?.recommendationUrl as string | undefined
                      if (url) return null  // "see source" link appears inline at the end of the blurb text instead
                      if (blurb) return null  // blurb toggle already says "via [list]"
                      return <div style={{ fontSize: 11, color: '#B0B0B0' }}>from {item.recommended_by}</div>
                    }
                    // "quick add" is the obvious default — it's noise, so hide it.
                    // Keep meaningful sources (letterboxd, spotify, email, photo, …) visible.
                    const label = item.source_detail?.trim()
                      || (item.source === 'quick_add' ? '' : item.source.replace(/_/g, ' '))
                    // Don't say it twice: if the blurb toggle already shows "via [source]"
                    // (e.g. a newsletter item with its blurb), skip the header label.
                    if (label && blurb && blurbSource && label.toLowerCase() === blurbSource.toLowerCase()) return null
                    return label
                      ? <div style={{ fontSize: 11, color: '#B0B0B0' }}>from {label}</div>
                      : null
                  })()}
                  <button
                    onClick={() => onToggleOwned(!item.metadata?.owned)}
                    style={{
                      padding: '2px 8px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
                      border: item.metadata?.owned ? '1px solid #ECEAE6' : '1.5px solid #DDD',
                      background: '#fff',
                      color: item.metadata?.owned ? '#ABA69C' : '#AAA',
                      fontWeight: 400, flexShrink: 0,
                    }}
                  >
                    {item.metadata?.owned ? '⌂ owned' : '⌂ own it?'}
                  </button>
                  {!item.metadata?.scratch && (
                    <>
                      <button onClick={() => setView('edit')} className="tlink" style={{ flexShrink: 0 }}>edit</button>
                      <button onClick={() => handleReidentify(true)} disabled={reidentifying} className="tlink" style={{ flexShrink: 0 }}>
                        {reidentifying ? 'identifying…' : 're-identify'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {picks !== null && (
              <div style={{ marginBottom: 16, border: '1px solid #EEE', borderRadius: 10, padding: '10px 12px', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#777' }}>got the wrong one? pick the right match</span>
                  <button onClick={() => setPicks(null)} style={{ background: 'none', border: 'none', color: '#AAA', fontSize: 11, cursor: 'pointer', padding: 0 }}>dismiss</button>
                </div>
                {picks.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { applyCandidate(c); setPicks(null) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', border: '1px solid #EEE', borderRadius: 8, background: '#fff', marginBottom: 6, cursor: 'pointer', fontSize: 13 }}
                  >
                    <strong>{c.title}</strong>
                    {[c.creator, c.year].filter(Boolean).length > 0 && (
                      <span style={{ color: '#888', fontSize: 11 }}> · {[c.creator, c.year].filter(Boolean).join(' · ')}</span>
                    )}
                  </button>
                ))}
                <button
                  onClick={lookUpOnline}
                  disabled={lookingUp}
                  style={{ background: 'none', border: 'none', color: '#111', fontSize: 12, cursor: lookingUp ? 'default' : 'pointer', padding: 0, marginTop: 2 }}
                >
                  {lookingUp ? 'searching…' : picks.length > 0 ? 'look up more online' : 'look it up online'}
                </button>
              </div>
            )}

            {/* Blurb toggle + inline quick links (Spotify / Wikipedia / Watch) in one row */}
            {(blurb || spotifyUrl || wikiUrl || item.type === 'film' || item.type === 'tv') && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {blurb && (
                    <button onClick={() => setShowBlurb(v => !v)} className="tlink">
                      {/* Wikipedia blurbs always read "about this" (not "via Wikipedia") so
                          cards stay consistent across categories — and it avoids duplicating
                          the wikipedia ↗ link when that's shown. Other sources keep "via [source]". */}
                      <span>{blurbSource && blurbSource !== 'Wikipedia' ? `via ${blurbSource}` : 'about this'}</span>
                      <span style={{ fontSize: 10 }}>{showBlurb ? '▴' : '▾'}</span>
                    </button>
                  )}
                  {spotifyUrl && (
                    <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="tlink">
                      <SpotifyIcon /> spotify
                    </a>
                  )}
                  {wikiUrl && (
                    <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="tlink">
                      {'wikipedia ↗︎'}
                    </a>
                  )}
                  {(item.type === 'film' || item.type === 'tv') && (
                    <button onClick={() => setWatchOpen(true)} className="tlink">
                      {'▶︎ watch'}
                    </button>
                  )}
                </div>
                {showBlurb && blurb && (
                  <div style={{ fontSize: 12, color: '#999', lineHeight: 1.5, marginTop: 5, fontStyle: 'italic' }}>
                    {blurb}{' '}
                    {(item.metadata?.recommendationUrl as string | undefined) && (
                      <a
                        href={item.metadata?.recommendationUrl as string}
                        target="_blank"
                        rel="noreferrer"
                        className="tlink"
                        style={{ fontStyle: 'normal', whiteSpace: 'nowrap', display: 'inline' }}
                      >
                        {'see source ↗︎'}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {item.type === 'tv' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                  seasons
                  {seasons.length > 0 && (
                    <span style={{ fontWeight: 400, color: '#999' }}>
                      {`  ·  ${seasons.filter(s => s.done).length}/${seasons.length} watched`}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {seasons.map(s => (
                    <button
                      key={s.n}
                      onClick={() => toggleSeason(s.n)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                        border: s.done ? `1.5px solid ${color.border}` : '1.5px solid #E0E0E0',
                        background: s.done ? color.bg : '#fff',
                        color: s.done ? color.border : '#555',
                        fontWeight: s.done ? 600 : 400,
                      }}
                    >
                      {s.done ? '✓ ' : ''}S{s.n}
                    </button>
                  ))}
                  <button
                    onClick={addSeason}
                    style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px dashed #CCC', background: '#fff', color: '#777', cursor: 'pointer' }}
                  >
                    + season
                  </button>
                  {seasons.length > 0 && (
                    <button
                      onClick={removeLastSeason}
                      title="Remove last season"
                      style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid #EED', background: '#fff', color: '#C0392B', cursor: 'pointer' }}
                    >
                      −
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scratch prompt — shown instead of normal content for unidentified items */}
            {item.metadata?.scratch && (
              <div style={{ background: '#F7F7F7', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#AAA', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6 }}>description saved</div>
                <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5, fontStyle: 'italic' }}>{item.title}</div>
              </div>
            )}

            {/* Tags — editorial typographic lines at rest; "edit tags" reveals the chip
                editors. Genre + feel (vibes) + how-it-landed (verdicts, done items only). */}
            {!item.metadata?.scratch && (() => {
              const vocab = genresForType(item.type)
              const descriptors = (item.tags ?? []).filter(t => !isGenreTag(t))
              const activeGenres = [...new Set((item.tags ?? []).filter(t => isGenreTag(t)))]
              const feel = (item.moods ?? []).filter(m => VIBES.includes(m))
              const landed = item.status === 'want_to' ? [] : (item.moods ?? []).filter(m => VERDICTS.includes(m))
              const hasAny = activeGenres.length > 0 || feel.length > 0 || landed.length > 0
              const inactiveGenres = vocab.filter(g => !activeGenres.includes(g))

              function toggleGenre(genre: string) {
                const next = new Set(activeGenres)
                next.has(genre) ? next.delete(genre) : next.add(genre)
                onSetTags([...next, ...descriptors])
              }
              function toggleMood(mood: string) {
                const next = (item.moods ?? []).includes(mood)
                  ? (item.moods ?? []).filter(m => m !== mood)
                  : [...(item.moods ?? []), mood]
                setSelectedMoods(next)
                onSetMoods(next)
              }

              // One editorial line — lead term emphasized, middot-separated.
              const line = (terms: string[]) => terms.length === 0 ? null : (
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1C1B19' }}>
                  {terms.map((t, i) => (
                    <span key={t}>
                      {i > 0 && <span style={{ color: '#ABA69C', margin: '0 7px' }}>·</span>}
                      <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
                    </span>
                  ))}
                </div>
              )
              const editChip = (label: string, on: boolean, onClick: () => void) => (
                <button key={label} onClick={onClick} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', flexShrink: 0,
                  border: on ? '1.5px solid #111' : '1px solid #E6E3DE',
                  background: on ? '#111' : '#fff', color: on ? '#fff' : '#888', fontWeight: on ? 600 : 400,
                }}>{on ? `${label} ×` : label}</button>
              )

              return (
                <div style={{ marginBottom: 14 }}>
                  {!tagsEditing ? (
                    <>
                      {hasAny && (
                        <div style={{ marginBottom: 7 }}>
                          {line(activeGenres)}
                          {line(feel)}
                          {line(landed)}
                        </div>
                      )}
                      <button onClick={() => setTagsEditing(true)} className="tlink">{hasAny ? 'edit tags ▾' : '+ add tags'}</button>
                    </>
                  ) : (
                    <div>
                      {vocab.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>genre</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {activeGenres.map(g => editChip(g, true, () => toggleGenre(g)))}
                            {inactiveGenres.map(g => editChip(g, false, () => toggleGenre(g)))}
                          </div>
                        </div>
                      )}
                      <MoodChips
                        size="sm"
                        groups={item.status === 'want_to' ? 'vibes-only' : 'all'}
                        isActive={m => (item.moods ?? []).includes(m)}
                        onToggle={toggleMood}
                      />
                      <button onClick={() => setTagsEditing(false)} className="tlink">done ▴</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {item.note && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>thoughts</div>
                <div style={{ fontSize: 12, color: '#57534E', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {renderNote(item.note)}
                </div>
              </div>
            )}

            {confirmDelete ? (
              <div style={footer}>
                <p style={{ fontSize: 13, color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>
                  delete "{item.title}"? this cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
                  <button onClick={onDelete} style={{ ...actionBtn('#fff'), flex: 1, background: '#C0392B', border: 'none' }}>delete</button>
                </div>
              </div>
            ) : item.metadata?.scratch ? (
              <div style={{ ...footer, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleReidentify(false)}
                  disabled={reidentifying}
                  style={{ ...actionBtn('#fff'), flex: 2, background: reidentifying ? '#CCC' : '#111', border: 'none' }}
                >
                  {reidentifying ? 'identifying…' : 'identify now'}
                </button>
                <button onClick={() => setConfirmDelete(true)} style={{ ...actionBtn('#C0392B'), flex: 1 }}>delete</button>
              </div>
            ) : (
              <div style={{ ...footer, display: 'flex', gap: 8 }}>
                <button onClick={() => setView('reaction')} style={{ ...actionBtn('#333'), flex: 1 }}>
                  {item.status === 'want_to' ? 'mark as done' : 'edit reaction'}
                </button>
                <button onClick={() => setConfirmDelete(true)} style={{ ...actionBtn('#C0392B'), flex: 1 }}>delete</button>
              </div>
            )}
          </>
        )}

        {view === 'edit' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ ...sectionHeading, margin: 0 }}>edit details</p>
              <button
                onClick={() => handleReidentify(false)}
                disabled={reidentifying}
                style={{ background: 'none', border: 'none', fontSize: 12, color: reidentifying ? '#BBB' : '#111', cursor: reidentifying ? 'default' : 'pointer', padding: 0 }}
              >
                {reidentifying ? 'identifying…' : 're-identify'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
              <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator" style={inputStyle} />
              <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" type="number" style={inputStyle} />
              <input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="source (e.g. a friend, NYT, a newsletter)" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(type === 'film' || type === 'book' || type === 'tv') && (
                  <input value={series} onChange={e => setSeries(e.target.value)} placeholder="series (e.g. Dune)" style={{ ...inputStyle, flex: 1 }} />
                )}
                <input
                  value={coverUrl}
                  onChange={e => setCoverUrl(e.target.value)}
                  placeholder="cover image url"
                  style={{ ...inputStyle, flex: 1 }}
                />
                {coverUrl.trim() && (
                  <img
                    src={coverUrl.trim()}
                    alt=""
                    onError={e => (e.currentTarget.style.display = 'none')}
                    style={{ width: 36, height: 36, objectFit: 'cover', border: '1px solid #EEE', flexShrink: 0 }}
                  />
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {TYPES.map(t => {
                const c = typeColor(t)
                const active = type === t
                return (
                  <button key={t} onClick={() => setType(t)} style={{
                    padding: '5px 12px',
                    border: active ? `1.5px solid ${c.border}` : '1.5px solid #E0E0E0',
                    borderRadius: 20,
                    background: active ? c.bg : '#fff',
                    color: active ? c.border : '#555',
                    fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  }}>
                    {TYPE_COLORS[t]?.label ?? t}
                  </button>
                )
              })}
            </div>
            <div style={{ ...footer, display: 'flex', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
              <button onClick={handleSaveDetails} style={{ ...actionBtn('#fff'), flex: 1, background: '#111111', border: 'none' }}>save</button>
            </div>
          </>
        )}

        {view === 'reaction' && (
          <>
            <p style={sectionHeading}>
              {item.status === 'want_to' ? 'mark as done' : 'edit reaction'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              {REACTIONS.map(r => (
                <button key={r.value} onClick={() => setReaction(r.value)} style={reactionBtnStyle(reaction === r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <NoteInput value={note} onChange={setNote} />
            </div>
            {/* Hybrid: first "mark as done" shows the full vibe picker. "edit reaction" on a
                done item keeps it minimal — a quiet "edit tags" link reveals it on demand. */}
            {item.status === 'want_to' ? (
              <>
                <p style={fieldLabel}>vibe <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#C9C6C0' }}>· optional</span></p>
                <div style={{ marginBottom: 16 }}>
                  <MoodChips isActive={m => selectedMoods.includes(m)} onToggle={toggleMood} />
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setReactionTagsOpen(v => !v)} className="tlink">{reactionTagsOpen ? 'done ▴' : 'edit tags ▾'}</button>
                {reactionTagsOpen && (
                  <div style={{ marginTop: 10 }}>
                    <MoodChips isActive={m => selectedMoods.includes(m)} onToggle={toggleMood} />
                  </div>
                )}
              </div>
            )}
            <div style={{ ...footer, display: 'flex', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
              <button onClick={handleSaveReaction} disabled={!reaction} style={{ ...actionBtn('#fff'), flex: 1, background: reaction ? '#111111' : '#ccc', border: 'none' }}>save</button>
            </div>
          </>
        )}
      </div>
      {watchOpen && (
        <WhereToWatchSheet
          item={{ title: item.title, year: item.year, type: item.type }}
          onClose={() => setWatchOpen(false)}
        />
      )}
    </>
  )
}

// Render a note. Lines that start with "-", "*", or "•" become a bullet list;
// other non-empty lines render as paragraphs. Lets you jot a quick list in a note.
function renderNote(note: string) {
  const lines = note.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`u${blocks.length}`} style={{ margin: '0 0 4px', paddingLeft: 18 }}>
        {bullets.map((b, i) => <li key={i} style={{ marginBottom: 2 }}>{b}</li>)}
      </ul>,
    )
    bullets = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ''))
    } else {
      flush()
      if (line) blocks.push(<p key={`p${blocks.length}`} style={{ margin: '0 0 4px' }}>{line}</p>)
    }
  }
  flush()
  return blocks
}

function SpotifyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}


// Pinned footer so action buttons stay visible even when the sheet scrolls.
const footer: React.CSSProperties = {
  position: 'sticky', bottom: 0, background: '#fff', zIndex: 1,
  paddingTop: 10, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', marginTop: 6,
}

function actionBtn(color: string): React.CSSProperties {
  return {
    width: '100%', padding: '9px', border: '1.5px solid #E0E0E0',
    borderRadius: 10, background: '#fff', fontSize: 13,
    fontWeight: 500, color, cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: '1.5px solid #E0E0E0',
  borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

// Editorial heading + field-label styles, shared so the sub-views match the main card.
const sectionHeading: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 14 }
const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }

// Monochrome reaction button — matches the editorial ink-on-white palette (no type colour).
function reactionBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
    border: active ? '2px solid #1C1B19' : '1.5px solid #E6E3DE',
    background: active ? '#F4F2EE' : '#fff',
    color: active ? '#1C1B19' : '#6F6B64',
    fontWeight: active ? 600 : 400,
  }
}
