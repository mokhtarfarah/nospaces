import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Item } from '../lib/database.types'
import { itemGaps, dismissGaps } from '../lib/gaps'
import { useArtwork } from '../lib/artwork'

function GapRow({ item, gaps, onOpen, onDismiss }: { item: Item; gaps: string[]; onOpen: () => void; onDismiss: () => void }) {
  const art = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const storedThumb = (item.metadata?.wikiThumb as string | null) ?? null
  const allGaps = !art && !storedThumb ? [...gaps, 'cover'] : gaps
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #F4F2EE' }}>
      <button
        onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: 1, minWidth: 0 }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, color: '#1C1B19', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
          <span style={{ fontSize: 11, color: '#ABA69C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.creator || item.type}
          </span>
        </span>
        <span style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '45%' }}>
          {allGaps.map(g => (
            <span key={g} style={{ fontSize: 10, color: '#6F6B64', background: '#F4F2EE', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{g}</span>
          ))}
        </span>
      </button>
      <button
        onClick={onDismiss}
        title="mark as complete — won't appear again"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', color: '#CCCCCC', fontSize: 14, flexShrink: 0, lineHeight: 1 }}
      >
        ✓︎
      </button>
    </div>
  )
}

export function GapsSheet({ items, editItem, onClose }: {
  items: Item[]
  editItem: (id: string, fields: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [gapFilter, setGapFilter] = useState<string | null>(null)

  const incomplete = useMemo(() =>
    items
      .map(i => ({ item: i, gaps: itemGaps(i) }))
      .filter(x => x.gaps.length > 0)
      .sort((a, b) => b.gaps.length - a.gaps.length),
    [items]
  )

  const gapTypes = useMemo(() => {
    const order = ['wiki', 'genre', 'creator', 'year', 'runtime', 'pages']
    const present = new Set<string>()
    incomplete.forEach(x => x.gaps.forEach(g => present.add(g)))
    return order.filter(g => present.has(g))
  }, [incomplete])

  const shown = gapFilter ? incomplete.filter(x => x.gaps.includes(gapFilter)) : incomplete

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 16px', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexShrink: 0, marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', margin: 0 }}>data gaps</p>
          <p style={{ fontSize: 12, color: '#ABA69C', margin: 0 }}>
            {incomplete.length} item{incomplete.length !== 1 ? 's' : ''}
          </p>
        </div>
        <p style={{ fontSize: 12, color: '#ABA69C', margin: '0 0 12px' }}>
          tap an item to fill it in — ✓︎ to dismiss
        </p>

        {gapTypes.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, flexShrink: 0 }}>
            {[{ label: 'all', value: null }, ...gapTypes.map(g => ({ label: `missing ${g}`, value: g }))].map(({ label, value }) => {
              const on = gapFilter === value
              return (
                <button
                  key={label}
                  onClick={() => setGapFilter(value)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                    border: on ? '1.5px solid #1C1B19' : '1.5px solid #E0E0E0',
                    background: on ? '#1C1B19' : '#fff', color: on ? '#fff' : '#6F6B64',
                    fontWeight: on ? 600 : 400, fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ECEAE6', borderRadius: 8 }}>
          {shown.map(({ item, gaps }) => (
            <GapRow
              key={item.id}
              item={item}
              gaps={gaps}
              onOpen={() => {
                onClose()
                navigate(`/library?item=${item.id}&edit=1&tidy=1${gapFilter ? `&gap=${encodeURIComponent(gapFilter)}` : ''}`)
              }}
              onDismiss={() => editItem(item.id, { metadata: dismissGaps(item, gaps) })}
            />
          ))}
        </div>
      </div>
    </>
  )
}
