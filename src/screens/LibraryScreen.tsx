import { useState, useMemo } from 'react'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { SortSheet, type SortOption } from '../components/SortSheet'

type CategoryFilter = 'all' | string
type StatusFilter = 'all' | ItemStatus
type ReactionFilter = 'all' | ItemReaction

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it:   'Loved it',
  liked_it:   'Liked it',
  eh:         'Eh',
  not_for_me: 'Not for me',
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
        return (a.creator ?? '').localeCompare(b.creator ?? '')
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

export function LibraryScreen() {
  const { items, loading, markDone, markWantTo } = useItems()

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>('all')
  const [sort, setSort] = useState<SortOption>('date_added')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [doneItem, setDoneItem] = useState<Item | null>(null)

  const SORT_LABELS: Record<SortOption, string> = {
    date_added: 'Date added',
    alpha:      'A → Z',
    status:     'Status',
    reaction:   'Reaction',
    creator:    'Creator',
    year:       'Year',
  }

  const filtered = useMemo(() => {
    let result = items.filter(item => {
      if (category !== 'all' && item.type !== category) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (reactionFilter !== 'all' && item.reaction !== reactionFilter) return false
      if (query && !item.title.toLowerCase().includes(query.toLowerCase()) &&
          !item.creator?.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    return sortItems(result, sort)
  }, [items, category, statusFilter, reactionFilter, query, sort])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])

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
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>Library</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setSortSheetOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {SORT_LABELS[sort]} <span style={{ fontSize: 14 }}>↕</span>
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
              borderRadius: 8, fontSize: 14, marginBottom: 8, outline: 'none',
            }}
          />
        )}

        {/* Filter row 1 — category */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 8 }}>
          <FilterChip label="All" active={category === 'all'} onClick={() => setCategory('all')} />
          {['film', 'book', 'music', 'tv', ...types.filter(t => !['film','book','music','tv'].includes(t))].map(t => (
            <FilterChip
              key={t}
              label={TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
              active={category === t}
              onClick={() => setCategory(t)}
            />
          ))}
          {!types.includes('other') && (
            <FilterChip label="Other" active={category === 'other'} onClick={() => setCategory('other')} />
          )}
        </div>

        {/* Filter row 2 — status + reaction */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['all', 'want_to', 'done'] as StatusFilter[]).map(s => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'All' : s === 'want_to' ? 'Want to' : 'Done'}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
          <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
          {REACTION_ORDER.map(r => (
            <FilterChip
              key={r}
              label={REACTION_LABELS[r]}
              active={reactionFilter === r}
              onClick={() => setReactionFilter(reactionFilter === r ? 'all' : r)}
            />
          ))}
        </div>
      </header>

      {/* Legend — only when category = all */}
      {category === 'all' && (
        <div style={{ display: 'flex', gap: 12, padding: '8px 16px', borderBottom: '1px solid #F0F0F0' }}>
          {(['film', 'book', 'music', 'tv'] as const).map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[k].border }} />
              <span style={{ fontSize: 10, color: '#888' }}>{TYPE_COLORS[k].label}</span>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999', fontSize: 14 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month}>
              <div style={{ padding: '6px 16px', background: '#F6F6F6', fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: '0.2px' }}>
                {month}
              </div>
              {monthItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  showType={category === 'all'}
                  onMarkDone={() => setDoneItem(item)}
                  onMarkWantTo={() => markWantTo(item.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Mark as done sheet */}
      {doneItem && (
        <MarkDoneSheet
          item={doneItem}
          onConfirm={(reaction, note) => {
            markDone(doneItem.id, reaction, note)
            setDoneItem(null)
          }}
          onClose={() => setDoneItem(null)}
        />
      )}

      {/* Sort sheet */}
      {sortSheetOpen && (
        <SortSheet
          current={sort}
          onChange={setSort}
          onClose={() => setSortSheetOpen(false)}
        />
      )}
    </div>
  )
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>
        {hasItems ? '🔍' : '📚'}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#222', marginBottom: 6 }}>
        {hasItems ? 'Nothing matches' : 'Your library is empty'}
      </div>
      <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
        {hasItems ? 'Try changing your filters' : 'Tap Add to save your first item'}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        border: active ? '1.5px solid #002FA7' : '1.5px solid #E0E0E0',
        borderRadius: 20,
        background: active ? '#E6EBFA' : '#fff',
        color: active ? '#002FA7' : '#555',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function ItemRow({ item, showType, onMarkDone, onMarkWantTo }: {
  item: Item
  showType: boolean
  onMarkDone: () => void
  onMarkWantTo: () => void
}) {
  const color = typeColor(item.type)
  const sourceLabel = item.source_detail ?? item.source.replace(/_/g, ' ')

  const subtitle = item.status === 'done'
    ? [item.creator, item.year, item.reaction ? REACTION_LABELS[item.reaction] : null].filter(Boolean).join(' · ')
    : [showType ? item.type : null, item.creator, sourceLabel].filter(Boolean).join(' · ')

  return (
    <div
      style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #F2F2F2', padding: '10px 16px 10px 0', marginLeft: 16 }}
    >
      <div style={{ width: 3, borderRadius: 2, background: color.border, flexShrink: 0, marginRight: 12, alignSelf: 'stretch' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
      {/* Action button */}
      <button
        onClick={item.status === 'want_to' ? onMarkDone : onMarkWantTo}
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

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}
