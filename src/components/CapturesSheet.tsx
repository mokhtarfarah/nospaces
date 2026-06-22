import { isFailure, type EmailCapture } from '../lib/captures'

const OUTCOME_LABEL: Record<EmailCapture['outcome'], string> = {
  nothing_found: 'couldn’t read any media',
  error: 'something went wrong',
  duplicates: 'already in your library',
}

// Relative time, lowercase + glyph-safe (no emoji), matching the editorial tone.
function ago(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Read-only feed of forwarded emails that added nothing to the library — the
// silent cases the "for review" inbox can't show (it only holds saved items).
export function CapturesSheet({ captures, onClear, onClose }: {
  captures: EmailCapture[]
  onClear: () => void
  onClose: () => void
}) {
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 4px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', margin: 0 }}>email captures</p>
          {captures.length > 0 && (
            <button onClick={onClear} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#6F6B64' }}>
              clear
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#ABA69C', margin: '0 0 14px' }}>
          forwards that didn’t add anything to your library
        </p>

        <div style={{ flex: 1, overflowY: 'auto', marginRight: -20, paddingRight: 20 }}>
          {captures.length === 0 ? (
            <p style={{ fontSize: 13, color: '#ABA69C', padding: '24px 0', textAlign: 'center' }}>
              nothing here — every forward has landed.
            </p>
          ) : (
            captures.map(c => <CaptureRow key={c.id} capture={c} />)
          )}
        </div>
      </div>
    </>
  )
}

function CaptureRow({ capture: c }: { capture: EmailCapture }) {
  const failure = isFailure(c)
  return (
    <div style={{
      padding: '11px 12px', marginBottom: 8, borderRadius: 10,
      border: '1px solid #ECEAE6', background: failure ? '#fff' : '#FAFAF8',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          flexShrink: 0, width: 6, height: 6, borderRadius: 3, marginTop: 5,
          background: failure ? '#1C1B19' : '#D7D3CC',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: failure ? '#1C1B19' : '#6F6B64',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.subject?.trim() || '(no subject)'}
          </div>
          <div style={{ fontSize: 11, color: '#ABA69C', marginTop: 3 }}>
            {OUTCOME_LABEL[c.outcome]} · {ago(c.created_at)}
          </div>
          {c.snippet && (
            <div style={{
              fontSize: 11, color: '#ABA69C', fontStyle: 'italic', marginTop: 5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {c.snippet}
            </div>
          )}
          {failure && (
            <div style={{ fontSize: 11, color: '#6F6B64', marginTop: 6 }}>
              try forwarding it again
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
