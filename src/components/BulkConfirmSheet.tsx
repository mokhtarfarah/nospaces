import { useState } from 'react'
import type { AiResult } from './ConfirmSheet'
import { useArtwork } from '../lib/artwork'

export interface BulkItem {
  id: number
  file: File
  preview: string       // object URL for the photo thumbnail
  result: AiResult | null
  error: boolean
  checked: boolean
}

function ResultRow({ item, onToggle, onEdit }: {
  item: BulkItem
  onToggle: () => void
  onEdit: (field: 'title' | 'type' | 'creator' | 'year', value: string) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const cover = useArtwork(
    item.result?.type ?? 'other',
    item.result?.title ?? '',
    item.result?.creator ?? null,
    item.result?.year ?? null,
    null,
  )

  if (!item.result) {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0F0F0', alignItems: 'center', opacity: 0.5 }}>
        <img src={item.preview} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#C00' }}>couldn't identify</span>
      </div>
    )
  }

  const thumb = cover ?? item.preview

  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0F0F0', alignItems: 'flex-start', opacity: item.checked ? 1 : 0.4 }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginTop: 2,
          border: item.checked ? '1.5px solid #111' : '1.5px solid #CCC',
          background: item.checked ? '#111' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {item.checked && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Thumbnail */}
      <img src={thumb} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={item.result.title}
            onBlur={e => { onEdit('title', e.target.value); setEditingTitle(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onEdit('title', (e.target as HTMLInputElement).value); setEditingTitle(false) } }}
            style={{ width: '100%', fontSize: 13, fontWeight: 500, border: 'none', borderBottom: '1px solid #111', outline: 'none', padding: '0 0 2px', background: 'transparent' }}
          />
        ) : (
          <div
            onClick={() => setEditingTitle(true)}
            style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }}
          >
            {item.result.title}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Type pill */}
          <select
            value={item.result.type}
            onChange={e => onEdit('type', e.target.value)}
            style={{ fontSize: 11, color: '#8A857C', border: 'none', borderRadius: 4, padding: '2px 5px', background: '#F4F2EE', cursor: 'pointer' }}
          >
            {['film', 'tv', 'book', 'music', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {item.result.creator && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{item.result.creator}</span>}
          {item.result.year && <span>{item.result.year}</span>}
        </div>
      </div>
    </div>
  )
}

export function BulkConfirmSheet({ items: initialItems, onConfirm, onClose }: {
  items: BulkItem[]
  onConfirm: (items: BulkItem[], status: 'want_to' | 'done') => void
  onClose: () => void
}) {
  const [items, setItems] = useState(initialItems)
  // One status for the whole batch — a photo dump is usually all-backlog or
  // all-already-done. Reactions can be added per item later in the library.
  const [status, setStatus] = useState<'want_to' | 'done'>('want_to')

  const checked = items.filter(i => i.checked && i.result)
  const identifiedCount = items.filter(i => i.result).length

  const toggle = (id: number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i))

  const edit = (id: number, field: 'title' | 'type' | 'creator' | 'year', value: string) =>
    setItems(prev => prev.map(i => {
      if (i.id !== id || !i.result) return i
      const updated = { ...i.result }
      if (field === 'year') updated.year = parseInt(value) || null
      else (updated as Record<string, unknown>)[field] = value
      return { ...i, result: updated }
    }))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '6px 20px 0', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 2px', flexShrink: 0 }}>
          {identifiedCount} of {items.length} identified
        </p>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px', flexShrink: 0 }}>
          tap title to edit · uncheck to skip
        </p>

        {/* Whole-batch status — want to (backlog) vs already did */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          {(['want_to', 'done'] as const).map(s => {
            const active = status === s
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  flex: 1, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', border: 'none',
                  background: active ? '#E6E1D7' : '#F4F2EE',
                  color: active ? '#1C1B19' : '#8A857C',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                }}
              >
                {s === 'want_to' ? 'want to' : 'already did'}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginRight: -20, paddingRight: 20 }}>
          {items.map(item => (
            <ResultRow
              key={item.id}
              item={item}
              onToggle={() => toggle(item.id)}
              onEdit={(field, value) => edit(item.id, field, value)}
            />
          ))}
        </div>

        <div style={{ flexShrink: 0, paddingTop: 12, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onConfirm(checked, status)}
            disabled={checked.length === 0}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12,
              border: 'none', background: checked.length ? '#111' : '#DDD', color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: checked.length ? 'pointer' : 'default',
            }}
          >
            {checked.length
              ? `save ${checked.length} item${checked.length > 1 ? 's' : ''} as ${status === 'done' ? 'done' : 'want to'}`
              : 'nothing selected'}
          </button>
        </div>
      </div>
    </>
  )
}
