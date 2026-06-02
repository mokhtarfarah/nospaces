import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { ViewSheet, VIEW_CONFIG, type ViewMode, type SortOption, type SortDir, type ReactionFilter } from '../components/ViewSheet'
import { ItemActionSheet } from '../components/ItemActionSheet'
import { DuplicatesSheet } from '../components/DuplicatesSheet'
import { useWikipediaInfo, type WikiInfo } from '../lib/wikipedia'
import { useArtwork } from '../lib/artwork'
import { getSeasons } from '../lib/seasons'
import { MOODS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'

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

// Comparison in the *ascending* sense for each sort. Direction is applied on top
// by sortItems, so 'asc'/'desc' is consistent across every view.
function compareItems(a: Item, b: Item, sort: SortOption): number {
  switch (sort) {
    case 'date_added':
      return new Date(a.date_added).getTime() - new Date(b.date_added).getTime()
    case 'updated':
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
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
      return (a.year ?? 0) - (b.year ?? 0)
  }
}

function sortItems(items: Item[], sort: SortOption, dir: SortDir): Item[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => sign * compareItems(a, b, sort))
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
  const { items, loading, markDone, markWantTo, deleteItem, editItem, toggleOwned, patchMetadata, duplicateCount, duplicateGroups, deleteMany } = useItems()
  const navigate = useNavigate()

  const handleSaveWiki = useCallback((id: string, wiki: WikiInfo) => {
    patchMetadata(id, { wikiUrl: wiki.url, wikiThumb: wiki.thumbnail, wikiSummary: wiki.summary })
  }, [patchMetadata])
  const dupes = duplicateCount()

  // Empty array = all categories. Single-select: tapping a type switches to just that
  // one (tap it again to clear back to All). Array kept so multi-select can return later.
  const [categories, setCategories] = useState<string[]>([])
  const [scratchOnly, setScratchOnly] = useState(false)
  const selectCategory = (t: string) => {
    setScratchOnly(false)
    setVibeFilter(null); setGenreFilter(null); setOpenDropdown(null)
    setCategories(prev => (prev.length === 1 && prev[0] === t ? [] : [t]))
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>('all')
  const [newMusicOnly, setNewMusicOnly] = useState(false)
  const [vibeFilter, setVibeFilter] = useState<string | null>(null)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'vibe' | 'genre' | null>(null)
  const [view, setView] = useState<ViewMode>('recent')
  const [dir, setDir] = useState<SortDir>(VIEW_CONFIG.recent.defaultDir)
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewSheetOpen, setViewSheetOpen] = useState(false)
  const [dupesOpen, setDupesOpen] = useState(false)
  const [doneItem, setDoneItem] = useState<Item | null>(null)
  const [actionItem, setActionItem] = useState<Item | null>(null)

  const sort: SortOption = VIEW_CONFIG[view].sort
  const group = VIEW_CONFIG[view].group

  // Tapping a new view switches to it (in its default order) and closes the sheet.
  // Tapping the already-active directional view just reverses the order, sheet stays open.
  const selectView = (v: ViewMode) => {
    if (v === view) {
      if (VIEW_CONFIG[v].directional) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
      else setViewSheetOpen(false)
    } else {
      setView(v)
      setDir(VIEW_CONFIG[v].defaultDir)
      setViewSheetOpen(false)
    }
  }

  // "New Music Tuesday" toggle only applies while viewing the Music category alone.
  const musicOnly = categories.length === 1 && categories[0] === 'music'

  // Base filter: everything except the tag/vibe filter. Used to compute which
  // vibe/genre chips should be shown so they don't vanish when one is selected.
  const baseFiltered = useMemo(() => {
    return items.filter(item => {
      if (scratchOnly) return !!item.metadata?.scratch
      if (item.metadata?.scratch) return false
      if (categories.length > 0 && !categories.includes(item.type)) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (reactionFilter !== 'all' && item.reaction !== reactionFilter) return false
      if (newMusicOnly && musicOnly && !itemSource(item).toLowerCase().includes('new music tuesday')) return false
      if (query) {
        const q = query.toLowerCase()
        const hit = item.title.toLowerCase().includes(q)
          || item.creator?.toLowerCase().includes(q)
          || item.tags?.some(t => t.toLowerCase().includes(q))  // incl. descriptor tags
        if (!hit) return false
      }
      return true
    })
  }, [items, categories, statusFilter, reactionFilter, newMusicOnly, musicOnly, query, scratchOnly])

  const filtered = useMemo(() => {
    let result = baseFiltered
    if (vibeFilter)  result = result.filter(item => item.moods?.includes(vibeFilter))
    if (genreFilter) result = result.filter(item => item.tags?.includes(genreFilter))
    return sortItems(result, sort, dir)
  }, [baseFiltered, vibeFilter, genreFilter, sort, dir])

  // Vibes and genres present in the current base-filtered set, for filter chips.
  const availableTags = useMemo(() => {
    const moodSet = new Set<string>()
    const genreSet = new Set<string>()
    baseFiltered.forEach(i => {
      i.moods?.forEach(m => moodSet.add(m))
      i.tags?.forEach(t => genreSet.add(t))
    })
    return {
      moods:  MOODS.filter(m => moodSet.has(m)),  // canonical MOODS order
      genres: [...genreSet].filter(isGenreTag).sort(),  // real genres only; descriptors stay searchable

    }
  }, [baseFiltered])

  // Reset vibe/genre filters when base filters change so they don't silently hide results.
  useEffect(() => { setVibeFilter(null); setGenreFilter(null); setOpenDropdown(null) }, [categories, statusFilter, reactionFilter, scratchOnly])

  const grouped = useMemo(() => {
    if (group === 'creator') return groupByCreator(filtered)
    if (group === 'status')  return groupByStatus(filtered)
    if (group === 'none')    return groupNone(filtered)
    return groupByMonth(filtered)
  }, [filtered, group])

  // Unique types from real data for filter row (excluding scratch items)
  const types = useMemo(() => {
    const seen = new Set<string>()
    items.filter(i => !i.metadata?.scratch).forEach(i => seen.add(i.type))
    return Array.from(seen).sort()
  }, [items])

  const hasScratch = useMemo(() => items.some(i => !!i.metadata?.scratch), [items])

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => setViewSheetOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {VIEW_CONFIG[view].label}
                <span style={{ fontSize: 12 }}>▾</span>
              </button>
              {VIEW_CONFIG[view].directional && (
                <button
                  onClick={() => setDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                  title="Reverse order"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#111', padding: '4px 4px', lineHeight: 1 }}
                >
                  {dir === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </div>
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
          <FilterChip label="all" active={categories.length === 0 && !scratchOnly} onClick={() => { setCategories([]); setScratchOnly(false) }} />
          {['film', 'book', 'music', 'tv', ...types.filter(t => !['film','book','music','tv'].includes(t))].map(t => (
            <FilterChip
              key={t}
              label={CATEGORY_LABEL[t] ?? TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
              active={categories.includes(t) && !scratchOnly}
              onClick={() => selectCategory(t)}
            />
          ))}
          {!types.includes('other') && (
            <FilterChip label="other" active={categories.includes('other') && !scratchOnly} onClick={() => selectCategory('other')} />
          )}
          {hasScratch && (
            <FilterChip label="? scratch" active={scratchOnly} onClick={() => { setScratchOnly(v => !v); setCategories([]) }} />
          )}
        </div>

        {/* Filter row 2 — status + vibe/genre dropdowns (+ reaction chips when on "done") */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'want_to', 'done'] as StatusFilter[]).map(s => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'all' : s === 'want_to' ? 'want to' : 'done'}
              active={statusFilter === s}
              onClick={() => { setStatusFilter(s); if (s === 'want_to') setReactionFilter('all') }}
            />
          ))}
          {(availableTags.moods.length > 0 || availableTags.genres.length > 0) && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              {availableTags.moods.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <DropdownButton
                    label="vibe"
                    value={vibeFilter}
                    active={openDropdown === 'vibe'}
                    onToggle={() => setOpenDropdown(d => d === 'vibe' ? null : 'vibe')}
                    onClear={() => { setVibeFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'vibe' && (
                    <DropdownMenu
                      options={availableTags.moods}
                      selected={vibeFilter}
                      onSelect={v => { setVibeFilter(f => f === v ? null : v); setOpenDropdown(null) }}
                    />
                  )}
                </div>
              )}
              {availableTags.genres.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <DropdownButton
                    label="genre"
                    value={genreFilter}
                    active={openDropdown === 'genre'}
                    onToggle={() => setOpenDropdown(d => d === 'genre' ? null : 'genre')}
                    onClear={() => { setGenreFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'genre' && (
                    <DropdownMenu
                      options={availableTags.genres}
                      selected={genreFilter}
                      onSelect={g => { setGenreFilter(f => f === g ? null : g); setOpenDropdown(null) }}
                    />
                  )}
                </div>
              )}
            </>
          )}
          {statusFilter === 'done' && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              {REACTION_ORDER.map(r => (
                <FilterChip
                  key={r}
                  label={REACTION_LABELS[r]}
                  active={reactionFilter === r}
                  onClick={() => setReactionFilter(reactionFilter === r ? 'all' : r)}
                />
              ))}
            </>
          )}
        </div>

        {/* New Music Tuesday toggle + shows-near-you link — only in the Music category */}
        {musicOnly && (
          <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center' }}>
            <FilterChip
              label="new music tuesday"
              active={newMusicOnly}
              onClick={() => setNewMusicOnly(v => !v)}
            />
            <button
              onClick={() => navigate('/shows')}
              style={{ marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', borderRadius: 16, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              📍 shows near you
            </button>
          </div>
        )}
      </header>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {dupes > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '10px 16px 0', padding: '8px 12px', background: '#F4F4F4', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{dupes} duplicate{dupes > 1 ? 's' : ''} found</span>
            <button
              onClick={() => setDupesOpen(true)}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 16, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              review
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
                    onSaveWiki={handleSaveWiki}
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
            onEdit={fields => { editItem(fresh.id, fields) }}
            onSetMoods={moods => editItem(fresh.id, { moods })}
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
          dir={dir}
          onSelect={selectView}
          onClose={() => setViewSheetOpen(false)}
        />
      )}

      {/* Duplicates review sheet */}
      {dupesOpen && (
        <DuplicatesSheet
          groups={duplicateGroups()}
          onConfirm={async ids => {
            setDupesOpen(false)
            const n = await deleteMany(ids)
            if (n) alert(`Removed ${n} duplicate${n > 1 ? 's' : ''}`)
          }}
          onClose={() => setDupesOpen(false)}
        />
      )}
    </div>
  )
}

function DropdownButton({ label, value, active, onToggle, onClear }: {
  label: string; value: string | null; active: boolean
  onToggle: () => void; onClear: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        padding: '5px 12px', borderRadius: 20,
        border: (value || active) ? '1.5px solid #111' : '1.5px solid #E0E0E0',
        background: value ? '#EDEDED' : active ? '#F4F4F4' : '#fff',
        color: (value || active) ? '#111' : '#555',
        fontSize: 13, fontWeight: value ? 600 : 400,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      <span>{value ?? label}</span>
      {value ? (
        <span
          onClickCapture={e => { e.stopPropagation(); onClear() }}
          style={{ fontSize: 11, color: '#666', lineHeight: 1, marginLeft: 1 }}
        >✕</span>
      ) : (
        <span style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>{active ? '▴' : '▾'}</span>
      )}
    </button>
  )
}

function DropdownMenu({ options, selected, onSelect }: {
  options: string[]; selected: string | null; onSelect: (v: string) => void
}) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% - 4px)', left: 0,
      background: '#fff', border: '1px solid #E8E8E8',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
      zIndex: 200, minWidth: 160, maxHeight: 220, overflowY: 'auto',
      padding: '4px 0',
    }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '9px 14px', background: selected === opt ? '#F4F4F4' : 'none',
            border: 'none', fontSize: 13, cursor: 'pointer',
            fontWeight: selected === opt ? 600 : 400,
            color: selected === opt ? '#111' : '#444',
          }}
        >
          {opt}
        </button>
      ))}
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

function ItemRow({ item, showType, onTap, onMarkDone, onMarkWantTo, onSaveWiki }: {
  item: Item
  showType: boolean
  onTap: () => void
  onMarkDone: () => void
  onMarkWantTo: () => void
  onSaveWiki?: (id: string, wiki: WikiInfo) => void
}) {
  const color = typeColor(item.type)

  // Use cached wiki data from metadata when available — skips the API call entirely.
  const metaWiki: WikiInfo | null = item.metadata?.wikiUrl
    ? { url: item.metadata.wikiUrl as string, thumbnail: (item.metadata.wikiThumb as string) ?? null, summary: (item.metadata.wikiSummary as string) ?? null }
    : null

  const { url: wikiUrl, thumbnail: wikiThumb } = useWikipediaInfo(item.type, item.title, item.creator, item.year, metaWiki)

  // Persist newly-resolved wiki data so future loads skip the API call.
  const wikiSaved = useRef(false)
  useEffect(() => {
    if (wikiUrl && !metaWiki && !wikiSaved.current) {
      wikiSaved.current = true
      onSaveWiki?.(item.id, { url: wikiUrl, thumbnail: wikiThumb, summary: null })
    }
  }, [wikiUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const thumbnail = artwork ?? wikiThumb

  // Season progress for TV shows that have a checklist.
  const tvSeasons = item.type === 'tv' ? getSeasons(item.metadata) : []
  const seasonsLabel = tvSeasons.length > 0 ? `${tvSeasons.filter(s => s.done).length}/${tvSeasons.length} seasons` : null

  const firstMood = item.moods?.[0] ?? null
  const runtimeOrPages = formatRuntime(item)

  const subtitle = item.status === 'done'
    ? [showType ? item.type : null, item.year, seasonsLabel, firstMood, runtimeOrPages, item.reaction ? REACTION_LABELS[item.reaction] : null].filter(Boolean).join(' · ')
    : [showType ? item.type : null, item.year, seasonsLabel, firstMood, runtimeOrPages].filter(Boolean).join(' · ')

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
          {!!item.metadata?.scratch && <span title="Needs identifying" style={{ fontWeight: 500, color: '#BBBBBB', fontSize: 11 }}>{'  '}?</span>}
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
            const url = (item.metadata?.spotifyUrl as string | undefined)
              ?? (item.metadata?.spotifyId ? `https://open.spotify.com/album/${item.metadata.spotifyId}` : null)
              ?? `https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))}`
            window.open(url, '_blank')
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
