import { useState, useEffect } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useWikipediaInfo } from '../lib/wikipedia'
import { useArtwork } from '../lib/artwork'
import { useBookBlurb } from '../lib/blurb'
import { getSeasons, useSeasonCount, type Season } from '../lib/seasons'
import { WhereToWatchSheet } from './WhereToWatchSheet'

interface Props {
  item: Item
  onEdit: (fields: { title: string; creator: string | null; type: string; year: number | null }) => void
  onMarkDone: (reaction: ItemReaction, note: string) => void
  onEditReaction: (reaction: ItemReaction, note: string) => void
  onSetSeasons: (seasons: Season[]) => void
  onDelete: () => void
  onClose: () => void
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']

const TYPE_EMOJI: Record<string, string> = { film: '🎬', tv: '📺', music: '🎵', book: '📚', other: '✦' }

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

export function ItemActionSheet({ item, onEdit, onMarkDone, onEditReaction, onSetSeasons, onDelete, onClose }: Props) {
  const [view, setView] = useState<View>('main')
  const [title, setTitle] = useState(item.title)
  const [creator, setCreator] = useState(item.creator ?? '')
  const [type, setType] = useState(item.type)
  const [year, setYear] = useState(item.year?.toString() ?? '')
  const [reaction, setReaction] = useState<ItemReaction | null>(item.reaction)
  const [note, setNote] = useState(item.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
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
  const { url, summary, thumbnail: wikiThumb } = useWikipediaInfo(item.type, item.title, item.creator, item.year)
  const wikiUrl = item.type === 'music' ? null : url
  const artwork = useArtwork(item.type, item.title, item.creator, item.year)
  const cover = artwork ?? wikiThumb
  // For books with no Wikipedia summary, fall back to an Open Library / Apple Books blurb.
  const bookBlurb = useBookBlurb(item.title, item.creator, item.year, item.type === 'book' && !summary)
  const blurb = summary ?? bookBlurb.summary
  const blurbSource = summary ? 'Wikipedia' : bookBlurb.source

  // Quick links (Spotify / Wikipedia / Where to watch) as one row of soft pills.
  const links: { key: string; label: string; icon: React.ReactNode; onClick: () => void }[] = []
  if (item.type === 'music') {
    links.push({
      key: 'spotify', label: 'spotify', icon: <SpotifyIcon />,
      onClick: () => window.open(`https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))}`, '_blank'),
    })
  }
  if (wikiUrl) {
    links.push({
      key: 'wiki', label: 'wikipedia', icon: <WikiIcon />,
      onClick: () => window.open(wikiUrl, '_blank'),
    })
  }
  if (item.type === 'film' || item.type === 'tv') {
    links.push({
      key: 'watch', label: 'watch', icon: <span style={{ fontSize: 12, color: '#333' }}>▶</span>,
      onClick: () => setWatchOpen(true),
    })
  }
  const quickLinks = links.length > 0 && (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {links.map(l => (
        <button key={l.key} onClick={l.onClick} style={linkPill}>
          {l.icon}<span>{l.label}</span>
        </button>
      ))}
    </div>
  )

  function handleSaveDetails() {
    onEdit({
      title: title.trim() || item.title,
      creator: creator.trim() || null,
      type,
      year: year ? parseInt(year) : null,
    })
    onClose()
  }

  function handleSaveReaction() {
    if (!reaction) return
    if (item.status === 'want_to') {
      onMarkDone(reaction, note)
    } else {
      onEditReaction(reaction, note)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />

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
                  : <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{TYPE_EMOJI[item.type] ?? '✦'}</div>
              })()}
              <div style={{ minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                  {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
                  {item.reaction && ` · ${REACTION_LABELS[item.reaction]}`}
                </div>
                <div style={{ fontSize: 11, color: '#B0B0B0', marginTop: 4 }}>
                  From {item.source_detail?.trim() || item.source.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {item.note && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#AAA', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 5 }}>your note</div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5, paddingLeft: 12, borderLeft: '3px solid #111', fontStyle: 'italic' }}>
                  {item.note}
                </div>
              </div>
            )}

            {blurb && (
              <div style={{ fontSize: 12, color: '#777', lineHeight: 1.5, marginBottom: 16, background: '#F7F7F7', borderRadius: 8, padding: '10px 12px' }}>
                {blurb}
                {blurbSource && <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#AAA' }}>via {blurbSource}</span>}
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

            {quickLinks}

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
            ) : (
              <div style={{ ...footer, display: 'flex', gap: 8 }}>
                <button onClick={() => setView('edit')} style={{ ...actionBtn('#333'), flex: 1 }}>edit</button>
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
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 16 }}>edit details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
              <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator" style={inputStyle} />
              <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" type="number" style={inputStyle} />
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
            {quickLinks}
            <div style={{ ...footer, display: 'flex', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
              <button onClick={handleSaveDetails} style={{ ...actionBtn('#fff'), flex: 1, background: '#111111', border: 'none' }}>save</button>
            </div>
          </>
        )}

        {view === 'reaction' && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 16 }}>
              {item.status === 'want_to' ? 'mark as done' : 'edit reaction'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {REACTIONS.map(r => (
                <button key={r.value} onClick={() => setReaction(r.value)} style={{
                  padding: '12px 8px',
                  border: reaction === r.value ? `2px solid ${color.border}` : '1.5px solid #E0E0E0',
                  borderRadius: 10,
                  background: reaction === r.value ? color.bg : '#fff',
                  fontSize: 14,
                  fontWeight: reaction === r.value ? 600 : 400,
                  color: reaction === r.value ? color.border : '#444',
                  cursor: 'pointer',
                }}>
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any thoughts..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', marginBottom: 16 }}
            />
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

function SpotifyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}

function WikiIcon() {
  return <span style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: '#202122', lineHeight: 1 }}>W</span>
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

// Compact pill for the quick-link row (Spotify / Wikipedia / Watch).
const linkPill: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '8px 6px', border: '1px solid #E6E6E6', borderRadius: 10,
  background: '#FAFAFA', fontSize: 12, fontWeight: 500, color: '#333', cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: '1.5px solid #E0E0E0',
  borderRadius: 10, fontSize: 16, fontFamily: 'inherit', outline: 'none',
}
