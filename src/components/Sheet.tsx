// The shared bottom-sheet chrome — a dimmed backdrop with a rounded card that
// rises from the bottom edge. Used by the Things composers and the media Add
// composer so "adding" reads the same in both worlds (a card over the page, not
// a navigation away). Tap the backdrop to close.
export function Sheet({ children, onClose, maxWidth = 640, padBottom = 24 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number; padBottom?: number }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,27,25,0.4)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth, borderRadius: '20px 20px 0 0',
        padding: `20px 18px calc(${padBottom}px + env(safe-area-inset-bottom))`,
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}
