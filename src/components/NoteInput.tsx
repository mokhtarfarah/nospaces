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

  // Bullet auto-continue, like any text editor: Enter on a bullet line starts a
  // fresh bullet; Enter on an *empty* bullet ends the list (drops the marker).
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = ref.current
    if (e.key !== 'Enter' || e.shiftKey || !el) return
    const start = el.selectionStart
    if (start !== el.selectionEnd) return // active selection — let Enter replace it
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const line = value.slice(lineStart, start)
    const m = line.match(/^[-*•]\s+/)
    if (!m) return // not a bullet line — default newline
    e.preventDefault()
    const before = value.slice(0, start)
    const after = value.slice(start)
    if (line.slice(m[0].length).trim() === '') {
      // Empty bullet → exit the list: clear the marker on this line.
      const next = value.slice(0, lineStart) + after
      onChange(next)
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(lineStart, lineStart) })
    } else {
      const insert = '\n• '
      onChange(before + insert + after)
      const cursor = start + insert.length
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor, cursor) })
    }
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
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: '#ABA69C', padding: 0, fontFamily: 'inherit',
          }}
        >
          • bullet
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
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
