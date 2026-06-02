import { useState, useMemo } from 'react'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { ViewSheet, VIEW_CONFIG, type ViewMode, type SortOption, type ReactionFilter } from '../components/ViewSheet'
import { ItemActionSheet } from '../components/ItemActionSheet'
import { useWikipediaInfo } from '../lib/wikipedia'
import { useArtwork } from '../lib/artwork'
import { getSeasons } from '../lib/seasons'

type StatusFilter = 'all' | ItemStatus

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it:   'loved it',
  liked_it:   'liked it',
  eh:         'eh',
  not_for_me: 'not for me',
}

const REACTION_ORDER: ItemReaction[] = ['loved_it', 'liked_it', 'eh', 'not_for_me']

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function sortItems(items: Item[], sort: SortOption): Item[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'date_added':
        return new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
      case 'alpha':
        return a.title.localeCompare(b.title)
      case 'status':
        return a.status === b.status ? 0 : a.status === 'want_to' ? -1 : 1
      case 'reaction': {
        const ai = a.reaction ? REACTION_ORDER.indexOf(a.reaction) : 99
        const bi = b.reaction ? REACTION_ORDER.indexOf(b.reaction) : 99
        return ai - bi
      }
      case 'creator':
        return lastNameKey(a.creator).localeCompare(lastNameKey(b.creator))
      case 'year':
        return (b.year ?? 0) - (a.year ?? 0)
    }
  })
}

function groupByMonth(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const dateStr = item.status === 'done' && item.date_done ? item.date_done : item.date_added
    const key = formatMonthYear(dateStr)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

// Sort key for creators: by last name (last word), so authors/directors order by
// surname (e.g. "Donna Tartt" -> "tartt"). "Unknown" sinks to the bottom.
function lastNameKey(creator: string | null | undefined): string {
  const name = creator?.trim()
  if (!name) return '￿'
  return (name.split(/\s+/).pop() ?? name).toLowerCase()
}

function groupByCreator(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.creator?.trim() || 'Unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  // Alphabetical by last name, with "Unknown" last.
  return new Map(
    [...map.entries()].sort((a, b) =>
      a[0] === 'Unknown' ? 1 : b[0] === 'Unknown' ? -1 : lastNameKey(a[0]).localeCompare(lastNameKey(b[0])),
    ),
  )
}

function groupNone(items: Item[]): Map<string, Item[]> {
  return new Map([['', items]])
}

function groupByStatus(items: Item[]): Map<string, Item[]> {
  const wantTo = items.filter(i => i.status === 'want_to')
  const done   = items.filter(i => i.status === 'done')
  const map = new Map<string, Item[]>()
  if (wantTo.length > 0) map.set('Want to', wantTo)
  if (done.length > 0)   map.set('Done', done)
  return map
}

function itemSource(item: Item): string {
  return item.source_detail?.trim() || item.source.replace(/_/g, ' ')
}

export function LibraryScreen() {
  const { items, loading, markDone, markWantTo, deleteItem, editItem, toggleOwned, duplicateCount, removeDuplicates } = useItems()
  const dupes = duplicateCount()

  // Empty array = all categories. Single-select: tapping a type switches to just that
  // one (tap it again to clear back to All). Array kept so multi-select can return later.
  const [categories, setCategories] = useState<string[]>([])
  const selectCategory = (t: string) =>
    setCategories(prev => (prev.length === 1 && prev[0] === t ? [] : [t]))
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>('all')
  const [newMusicOnly, setNewMusicOnly] = useState(false)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [view, setView] = useState<ViewMode>('recent')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewSheetOpen, setViewSheetOpen] = useState(false)
  const [doneItem, setDoneItem] = useState<Item | null>(null)
  const [actionItem, setActionItem] = useState<Item | null>(null)

  const sort: SortOption = VIEW_CONFIG[view].sort
  const group = VIEW_CONFIG[view].group

  // "New Music Tuesday" toggle only applies while viewing the Music category alone.
  const musicOnly = categories.length === 1 && categories[0] === 'music'

  const filtered = useMemo(() => {
    const result = items.filter(item => {
      if (categories.length > 0 && !categories.includes(item.type)) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (reactionFilter !== 'all' && item.reaction !== reactionFilter) return false
      if (newMusicOnly && musicOnly && !itemSource(item).toLowerCase().includes('new music tuesday')) return false
      if (ownedOnly && !item.metadata?.owned) return false
      if (query && !item.title.toLowerCase().includes(query.toLowerCase()) &&
          !item.creator?.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    return sortItems(result, sort)
  }, [items, categories, statusFilter, reactionFilter, newMusicOnly, musicOnly, query, sort])

  const grouped = useMemo(() => {
    if (group === 'creator') return groupByCreator(filtered)
    if (group === 'status')  return groupByStatus(filtered)
    if (group === 'none')    return groupNone(filtered)
    return groupByMonth(filtered)
  }, [filtered, group])

  // Unique types from real data for filter row
  const types = useMemo(() => {
    const seen = new Set<string>()
    items.forEach(i => seen.add(i.type))
    return Array.from(seen).sort()
  }, [items])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff' }}>
      {/* Header */}
      <header style={{
        padding: '56px 16px 0',
        background: '#fff',
        borderBottom: '1px solid #E8E8E8',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.2px' }}>Library</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setViewSheetOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {VIEW_CONFIG[view].label}{reactionFilter !== 'all' ? ` · ${REACTION_LABELS[reactionFilter]}` : ''} <span style={{ fontSize: 12 }}>▾</span>
            </button>
            <button
              onClick={() => setLayout(l => (l === 'list' ? 'grid' : 'list'))}
              title={layout === 'list' ? 'Grid view' : 'List view'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              {layout === 'list' ? <GridIcon /> : <ListIcon />}
            </button>
            <button
              onClick={() => setSearchOpen(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4 }}
            >
              <SearchIcon />
            </button>
          </div>
        </div>

        {searchOpen && (
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search titles, creators..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px', border: '1px solid #ddd',
              borderRadius: 8, fontSize: 16, marginBottom: 8, outline: 'none',
            }}
          />
        )}

        {/* Filter row 1 — category */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 8 }}>
          <FilterChip label="all" active={categories.length === 0} onClick={() => setCategories([])} />
          {['film', 'book', 'music', 'tv', ...types.filter(t => !['film','book','music','tv'].includes(t))].map(t => (
            <FilterChip
              key={t}
              label={CATEGORY_LABEL[t] ?? TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
              active={categories.includes(t)}
              onClick={() => selectCategory(t)}
            />
          ))}
          {!types.includes('other') && (
            <FilterChip label="Other" active={categories.includes('other')} onClick={() => selectCategory('other')} />
          )}
        </div>

        {/* Filter row 2 — status + owned */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['all', 'want_to', 'done'] as StatusFilter[]).map(s => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'all' : s === 'want_to' ? 'want to' : 'done'}
              active={statusFilter === s}
              onClick={() => { setStatusFilter(s); if (s === 'want_to') setReactionFilter('all') }}
            />
          ))}
          <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
          <FilterChip label="⌂ owned" active={ownedOnly} onClick={() => setOwnedOnly(v => !v)} />
        </div>

        {/* New Music Tuesday toggle — only in the Music category */}
        {musicOnly && (
          <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center' }}>
            <FilterChip
              label="new music tuesday"
              active={newMusicOnly}
              onClick={() => setNewMusicOnly(v => !v)}
            />
          </div>
        )}
      </header>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {dupes > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '10px 16px 0', padding: '8px 12px', background: '#F4F4F4', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{dupes} duplicate{dupes > 1 ? 's' : ''} found</span>
            <button
              onClick={async () => { const n = await removeDuplicates(); if (n) alert(`Removed ${n} duplicate${n > 1 ? 's' : ''}`) }}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 16, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              remove
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999', fontSize: 14 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month || 'all'}>
              {month && (
                <div style={{ padding: '22px 16px 8px', fontSize: 11, fontWeight: 600, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase' }}>
                  {month}
                </div>
              )}
              {layout === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '4px 14px 12px' }}>
                  {monthItems.map(item => (
                    <GridCard key={item.id} item={item} square={musicOnly} onTap={() => setActionItem(item)} />
                  ))}
                </div>
              ) : (
                monthItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    showType={categories.length !== 1}
                    onTap={() => setActionItem(item)}
                    onMarkDone={() => setDoneItem(item)}
                    onMarkWantTo={() => markWantTo(item.id)}
                  />
                ))
              )}
            </div>
          ))
        )}
      </div>

      {/* Mark as done sheet */}
      {doneItem && (
        <MarkDoneSheet
          item={doneItem}
          onConfirm={(reaction, note, moods) => {
            markDone(doneItem.id, reaction, note, moods)
            setDoneItem(null)
          }}
          onClose={() => setDoneItem(null)}
        />
      )}

      {/* Item action sheet */}
      {actionItem && (() => {
        // Always read fresh item from state so status/reaction are current
        const fresh = items.find(i => i.id === actionItem.id) ?? actionItem
        return (
          <ItemActionSheet
            item={fresh}
            onEdit={fields => { editItem(fresh.id, fields); setActionItem(null) }}
            onToggleOwned={owned => toggleOwned(fresh.id, owned)}
            onMarkDone={(reaction, note, moods) => { markDone(fresh.id, reaction, note, moods); setActionItem(null) }}
            onEditReaction={(reaction, note, moods) => { editItem(fresh.id, { reaction, note: note || null, moods }); setActionItem(null) }}
            onSetSeasons={seasons => editItem(fresh.id, { metadata: { ...fresh.metadata, seasons } })}
            onDelete={() => { deleteItem(fresh.id); setActionItem(null) }}
            onClose={() => setActionItem(null)}
          />
        )
      })()}

      {/* View sheet */}
      {viewSheetOpen && (
        <ViewSheet
          current={view}
          onChange={setView}
          reactionFilter={reactionFilter}
          onReactionChange={setReactionFilter}
          showReactionFilter={statusFilter !== 'want_to'}
          onClose={() => setViewSheetOpen(false)}
        />
      )}
    </div>
  )
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#222', marginBottom: 6 }}>
        {hasItems ? 'nothing matches' : 'your library is empty'}
      </div>
      <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
        {hasItems ? 'try changing your filters' : 'tap add to save your first item'}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        border: active && !disabled ? '1.5px solid #111111' : '1.5px solid #E0E0E0',
        borderRadius: 20,
        background: active && !disabled ? '#EDEDED' : '#fff',
        color: disabled ? '#C4C4C4' : active ? '#111111' : '#555',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function ItemRow({ item, showType, onTap, onMarkDone, onMarkWantTo }: {
  item: Item
  showType: boolean
  onTap: () => void
  onMarkDone: () => void
  onMarkWantTo: () => void
}) {
  const color = typeColor(item.type)

  // Wikipedia article link (+ image as a fallback); best cover comes from /api/art.
  const { url: wikiUrl, thumbnail: wikiThumb } = useWikipediaInfo(item.type, item.title, item.creator, item.year)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const thumbnail = artwork ?? wikiThumb

  // Season progress for TV shows that have a checklist.
  const tvSeasons = item.type === 'tv' ? getSeasons(item.metadata) : []
  const seasonsLabel = tvSeasons.length > 0 ? `${tvSeasons.filter(s => s.done).length}/${tvSeasons.length} seasons` : null

  // Creator lives on the title line; source moved to the action card (kept off the row).
  const subtitle = item.status === 'done'
    ? [item.year, seasonsLabel, item.reaction ? REACTION_LABELS[item.reaction] : null].filter(Boolean).join(' · ')
    : [showType ? item.type : null, item.year, seasonsLabel].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onTap}
      style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4F4F4', padding: '4px 16px', cursor: 'pointer' }}
    >
      <Thumb src={thumbnail} type={item.type} color={color} />
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
        <div style={{ fontSize: 14, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1px' }}>
          <span style={{ fontWeight: 500 }}>{item.title}</span>
          {item.creator && <span style={{ fontWeight: 400, color: '#A0A0A0' }}>{'  ·  '}{item.creator}</span>}
          {item.note && <span title="Has a note" style={{ fontWeight: 400, color: '#C0C0C0', fontSize: 11 }}>{'  '}✎</span>}
          {!!item.metadata?.owned && <span title="Owned" style={{ fontWeight: 400, color: '#999', fontSize: 11 }}>{'  '}⌂</span>}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
      </div>
      {/* Spotify quick-link — music only */}
      {item.type === 'music' && (
        <button
          onClick={e => {
            e.stopPropagation()
            const q = encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))
            window.open(`https://open.spotify.com/search/${q}`, '_blank')
          }}
          title="Open in Spotify"
          style={{
            flexShrink: 0, marginLeft: 8, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid #E6E6E6', background: '#F6F6F6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
          }}
        >
          <SpotifyGlyph />
        </button>
      )}
      {/* Wikipedia quick-link — film/tv/book (music uses Spotify instead) */}
      {item.type !== 'music' && wikiUrl && (
        <button
          onClick={e => {
            e.stopPropagation()
            window.open(wikiUrl, '_blank')
          }}
          title="Open Wikipedia page"
          style={{
            flexShrink: 0, marginLeft: 8, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid #E6E6E6', background: '#F6F6F6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
          }}
        >
          <WikiGlyph />
        </button>
      )}
      {/* Action button */}
      <button
        onClick={e => { e.stopPropagation(); item.status === 'want_to' ? onMarkDone() : onMarkWantTo() }}
        title={item.status === 'want_to' ? 'Mark as done' : 'Move back to want to'}
        style={{
          flexShrink: 0,
          marginLeft: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `1.5px solid ${item.status === 'done' ? color.border : '#DDD'}`,
          background: item.status === 'done' ? color.bg : '#fff',
          color: item.status === 'done' ? color.border : '#CCC',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        }}
      >
        ✓
      </button>
    </div>
  )
}

const TYPE_EMOJI: Record<string, string> = { film: '🎬', tv: '📺', music: '🎵', book: '📚', other: '✦' }

const CATEGORY_LABEL: Record<string, string> = { film: 'films', book: 'books', music: 'music', tv: 'tv', other: 'other' }

// Small cover/poster thumbnail. Falls back to a type-colored tile so rows stay aligned.
function Thumb({ src, type, color }: { src: string | null; type: string; color: { bg: string; border: string } }) {
  const box: React.CSSProperties = { width: 42, height: 42, borderRadius: 0, flexShrink: 0, marginRight: 14, alignSelf: 'center' }
  if (src) {
    return <img src={src} alt="" loading="lazy" style={{ ...box, objectFit: 'cover', border: '1px solid #EEE', background: '#F4F4F4' }} />
  }
  return (
    <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
      {TYPE_EMOJI[type] ?? '✦'}
    </div>
  )
}

// Grid layout cover card. square=true for music (album covers are 1:1).
function GridCard({ item, square, onTap }: { item: Item; square: boolean; onTap: () => void }) {
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const aspect = square ? '1 / 1' : '2 / 3'
  const reactionDot = item.status === 'done' && item.reaction === 'loved_it'
    ? '#1A1A1A'
    : item.status === 'done'
    ? '#AAAAAA'
    : null
  return (
    <div onClick={onTap} style={{ cursor: 'pointer', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: aspect, overflow: 'hidden', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #EBEBEB' }}>
        {artwork
          ? <img src={artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ fontSize: 18, color: color.border, opacity: 0.4 }}>✦</div>}
        {reactionDot && (
          <div style={{
            position: 'absolute', bottom: 5, right: 5,
            width: 7, height: 7, borderRadius: '50%',
            background: reactionDot, border: '1px solid rgba(255,255,255,0.6)',
          }} />
        )}
      </div>
      <div style={{ marginTop: 5 }}>
        <div style={{ fontSize: 12, color: '#111', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.1px' }}>{item.title}</div>
        {item.creator && (
          <div style={{ fontSize: 10, color: '#AAA', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.creator}</div>
        )}
      </div>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function SpotifyGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#666" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}

function WikiGlyph() {
  return <span style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#555', lineHeight: 1 }}>W</span>
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}
