import { useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function NoteInput({ value, onChange, placeholder = 'Any thoughts...', rows = 3 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function insertBullet() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    // If we're at the very start or right after a newline, just insert the bullet.
    // Otherwise start a new line first.
    const prefix = start === 0 || before.endsWith('\n') ? '• ' : '\n• '
    const next = before + prefix + after
    onChange(next)
    // Restore cursor after the inserted bullet.
    const cursor = start + prefix.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase' }}>thoughts</span>
        <button
          type="button"
          onClick={insertBullet}
          title="Add bullet point"
          style={{
            padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
            border: '1px solid #E0E0E0', background: '#fff',
            fontSize: 11, color: '#666', lineHeight: 1.4,
          }}
        >
          • bullet
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px', border: '1.5px solid #E0E0E0',
          borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
          resize: 'none', outline: 'none', color: '#333', lineHeight: 1.5,
        }}
      />
    </div>
  )
}
