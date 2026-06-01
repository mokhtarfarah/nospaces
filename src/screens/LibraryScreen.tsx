import { useState } from 'react'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { SEED_ITEMS } from '../lib/seeds'

type CategoryFilter = 'all' | 'film' | 'book' | 'music' | 'tv' | 'other'
type StatusFilter = 'all' | ItemStatus
type ReactionFilter = 'all' | ItemReaction

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it: 'Loved it',
  liked_it: 'Liked it',
  eh: 'Eh',
  not_for_me: 'Not for me',
}

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function groupByMonth(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = formatMonthYear(item.status === 'done' && item.date_done ? item.date_done : item.date_added)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

export function LibraryScreen() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const items = SEED_ITEMS.filter(item => {
    if (category !== 'all' && item.type !== category) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (reactionFilter !== 'all' && item.reaction !== reactionFilter) return false
    if (query && !item.title.toLowerCase().includes(query.toLowerCase()) && !item.creator?.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const grouped = groupByMonth(items)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff' }}>
      {/* Header */}
      <header style={{
        padding: '56px 16px 0',
        background: '#fff',
        borderBottom: '1px solid #E8E8E8',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>Library</h1>
          <button
            onClick={() => setSearchOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4 }}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search titles, creators..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 8,
              outline: 'none',
            }}
          />
        )}

        {/* Filter row 1 — category */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 8 }}>
          {(['all', 'film', 'book', 'music', 'tv', 'other'] as CategoryFilter[]).map(c => (
            <FilterChip
              key={c}
              label={c === 'all' ? 'All' : TYPE_COLORS[c]?.label ?? 'Other'}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>

        {/* Filter row 2 — status + reaction */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['all', 'want_to', 'done'] as StatusFilter[]).map(s => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'All' : s === 'want_to' ? 'Want to' : 'Done'}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
          <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
          {(['loved_it', 'liked_it', 'eh', 'not_for_me'] as ItemReaction[]).map(r => (
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
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'other').map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: val.border }} />
              <span style={{ fontSize: 10, color: '#888' }}>{val.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999', fontSize: 14 }}>
            Nothing here yet
          </div>
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month}>
              <div style={{
                padding: '6px 16px',
                background: '#F6F6F6',
                fontSize: 12,
                fontWeight: 600,
                color: '#666',
                letterSpacing: '0.2px',
              }}>
                {month}
              </div>
              {monthItems.map(item => (
                <ItemRow key={item.id} item={item} showType={category === 'all'} />
              ))}
            </div>
          ))
        )}
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

function ItemRow({ item, showType }: { item: Item; showType: boolean }) {
  const color = typeColor(item.type)

  const sourceLabel = item.source_detail ?? item.source.replace('_', ' ')

  const subtitle = item.status === 'done'
    ? [item.creator, item.year, item.reaction ? REACTION_LABELS[item.reaction] : null].filter(Boolean).join(' · ')
    : [showType ? item.type : null, item.creator, sourceLabel].filter(Boolean).join(' · ')

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid #F2F2F2',
      padding: '10px 16px 10px 0',
      marginLeft: 16,
    }}>
      <div style={{ width: 3, borderRadius: 2, background: color.border, flexShrink: 0, marginRight: 12, alignSelf: 'stretch' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}
