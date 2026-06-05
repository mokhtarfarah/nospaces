import { useNavigate } from 'react-router-dom'

export function GuideScreen() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#fff',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
    }}>
      {/* top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px 8px',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        borderBottom: '1px solid #ECEAE6',
        marginBottom: 0,
      }}>
        <button
          onClick={() => navigate('/library')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
            color: '#6F6B64', fontSize: 14, fontFamily: 'inherit',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          library
        </button>
      </div>

      <div style={{ padding: '28px 24px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', color: '#ABA69C', marginBottom: 10 }}>
          how to use
        </div>
        <h1 style={{
          fontSize: 30, fontWeight: 700, color: '#1C1B19',
          letterSpacing: '-0.025em', margin: '0 0 12px', lineHeight: 1.15,
        }}>
          your personal<br />media library.
        </h1>
        <p style={{ fontSize: 15, color: '#6F6B64', lineHeight: 1.65, margin: '0 0 36px' }}>
          save films, books, albums, and shows you want to try. log how they land.
          build a picture of your taste over time.
        </p>

        {/* ── SECTION 1: SAVING ─────────────────────────────────── */}
        <GuideSection
          num="01"
          title="saving things"
          desc="tap the + button (bottom right of any screen) and type anything — a film title, a book name, an album, a show. nospaces finds it and drops it into your want-to list."
        >
          <AddIllustration />
          <Tips items={[
            { label: 'search', text: 'type or describe it — "that new Villeneuve film", "something dark and literary"' },
            { label: 'photo', text: 'tap "from a photo" to snap a poster, a shelf, an article — it reads the image and extracts every title' },
            { label: 'email', text: 'forward anything to anything@nospaces.xyz — newsletters, friends\' recs, reviews — it saves automatically' },
          ]} />
        </GuideSection>

        {/* ── SECTION 2: REACTING ───────────────────────────────── */}
        <GuideSection
          num="02"
          title="logging a reaction"
          desc={`once you've finished something, tap it in your library and hit "mark as done". pick how it landed.`}
        >
          <ReactionIllustration />
          <Tips items={[
            { label: 'rating', text: 'loved it · liked it · eh · not for me — honest, not star-based' },
            { label: 'vibe', text: 'tag the feel of it — dark, nostalgic, playful, intense, cozy... as many as fit' },
            { label: 'verdict', text: 'your personal label — comfort, hyperfixation, overrated, so bad it\'s good...' },
          ]} />
        </GuideSection>

        {/* ── SECTION 3: BROWSING ───────────────────────────────── */}
        <GuideSection
          num="03"
          title="your library"
          desc={`browse everything you've saved. filter by type, status, vibe, or genre. when you can't choose what to watch or read next, use "help me decide".`}
        >
          <LibraryIllustration />
          <Tips items={[
            { label: 'filter', text: 'filter by status (want to / done), vibe, genre, or reaction — or just search by name' },
            { label: 'help me decide', text: 'stuck on what\'s next? tap it in the library header — it walks you through a few questions and picks something' },
            { label: '◆ canon', text: 'tap ◆ canon on anything you\'d call an all-time favourite — separate bucket, shows on your taste page' },
          ]} />
        </GuideSection>

        {/* ── SECTION 4: DISCOVER ───────────────────────────────── */}
        <GuideSection
          num="04"
          title="discover"
          desc="the discover tab uses what you've reacted to — vibes, genres, reactions — to surface things you haven't tried yet. the more you log, the sharper it gets."
        >
          <DiscoverIllustration />
          <Tips items={[
            { label: 'how it works', text: 'it looks at your loved + liked reactions and finds patterns — then suggests things that match your actual taste, not just popular picks' },
            { label: 'music shows', text: 'in the music tab, tap "shows near you" to see upcoming concerts by artists in your library' },
          ]} />
        </GuideSection>

        {/* ── MORE THINGS ───────────────────────────────────────── */}
        <div style={{ paddingTop: 28, paddingBottom: 8, borderTop: '1px solid #ECEAE6', marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', color: '#ABA69C', margin: '0 0 20px' }}>
            a few more things
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                label: 'data gaps',
                desc: '"tidy · N" in the library header flags items missing info — director, year, runtime, genre. tap to fill them one by one. you can also auto-fill in bulk.',
              },
              {
                label: 'series',
                desc: 'tap any item → edit → series to group things (e.g. a trilogy, a book series, tv seasons). they\'ll appear together in the library.',
              },
              {
                label: 'in progress',
                desc: 'reading something? halfway through a season? tap "mark as in progress" so you know what you\'re currently on.',
              },
              {
                label: 'spotify sync',
                desc: 'tap + → sync from spotify to pull in all your saved albums at once. repeating it only grabs new ones.',
              },
              {
                label: 'letterboxd',
                desc: 'tap + → import from letterboxd to bring in your watchlist and ratings. ratings map to reactions automatically.',
              },
            ].map(({ label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#1C1B19',
                  minWidth: 108, paddingTop: 1, lineHeight: 1.4,
                }}>{label}</span>
                <span style={{ fontSize: 13, color: '#6F6B64', lineHeight: 1.6 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Layout components ─────────────────────────────────────────────────────────

function GuideSection({
  num, title, desc, children,
}: {
  num: string; title: string; desc: string; children?: React.ReactNode
}) {
  return (
    <div style={{ paddingBottom: 32, marginBottom: 32, borderBottom: '1px solid #ECEAE6' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#ABA69C', fontWeight: 500, letterSpacing: '0.06em' }}>{num}</span>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C1B19', margin: 0, letterSpacing: '-0.015em' }}>
          {title}
        </h2>
      </div>
      <p style={{ fontSize: 14, color: '#6F6B64', lineHeight: 1.65, margin: '0 0 0' }}>
        {desc}
      </p>
      {children}
    </div>
  )
}

function Tips({ items }: { items: { label: string; text: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      {items.map(({ label, text }) => (
        <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#1C1B19',
            background: '#F4F2EF', padding: '2px 8px', borderRadius: 4,
            flexShrink: 0, marginTop: 1, lineHeight: 1.6,
          }}>{label}</span>
          <span style={{ fontSize: 13, color: '#6F6B64', lineHeight: 1.6 }}>{text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Illustrations ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#FAFAF9',
  border: '1px solid #ECEAE6',
  borderRadius: 12,
  padding: '16px',
  margin: '20px 0 4px',
}

const pill = (active?: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  borderRadius: 100,
  border: active ? '1.5px solid #1C1B19' : '1.5px solid #D5D3CF',
  background: active ? '#1C1B19' : '#fff',
  color: active ? '#fff' : '#6F6B64',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  whiteSpace: 'nowrap' as const,
})

function AddIllustration() {
  return (
    <div style={card}>
      {/* FAB hint */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#ABA69C' }}>tap + to open add</span>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#1C1B19',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>
      {/* fake text field */}
      <div style={{
        border: '1px solid #ECEAE6', borderRadius: 8,
        padding: '10px 12px', fontSize: 13, color: '#ABA69C',
        background: '#fff', marginBottom: 10,
      }}>
        describe or type anything...
      </div>
      {/* input methods row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['from a photo', 'email forward', 'save as note'].map(label => (
          <div key={label} style={{
            padding: '5px 10px', border: '1px solid #ECEAE6', borderRadius: 6,
            fontSize: 11, color: '#6F6B64', background: '#fff', whiteSpace: 'nowrap',
          }}>{label}</div>
        ))}
      </div>
    </div>
  )
}

function ReactionIllustration() {
  return (
    <div style={card}>
      {/* item row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #ECEAE6' }}>
        <div style={{ width: 36, height: 50, borderRadius: 4, background: '#E8E4DE', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 2 }}>dune: part two</div>
          <div style={{ fontSize: 11, color: '#ABA69C' }}>Denis Villeneuve · 2024 · film</div>
        </div>
      </div>
      {/* reaction grid */}
      <div style={{ fontSize: 11, color: '#ABA69C', marginBottom: 10 }}>how did it land?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'loved it', active: true },
          { label: 'liked it', active: false },
          { label: 'eh', active: false },
          { label: 'not for me', active: false },
        ].map(({ label, active }) => (
          <div key={label} style={{
            padding: '10px 0', textAlign: 'center', borderRadius: 8,
            border: active ? '1.5px solid #1C1B19' : '1.5px solid #ECEAE6',
            background: active ? '#1C1B19' : '#fff',
            color: active ? '#fff' : '#6F6B64',
            fontSize: 13, fontWeight: active ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>
    </div>
  )
}

function LibraryIllustration() {
  return (
    <div style={card}>
      {/* filter bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #ECEAE6', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['all', 'want to', 'done'].map((label, i) => (
          <span key={label} style={{
            fontSize: 12, fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? '#1C1B19' : '#ABA69C',
            fontStyle: i === 0 ? 'italic' : 'normal',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{label}</span>
        ))}
        <span style={{ fontSize: 12, color: '#ABA69C', whiteSpace: 'nowrap', flexShrink: 0 }}>filter ▾</span>
      </div>
      {/* library rows */}
      {[
        { type: 'film', title: 'dune: part two', meta: 'Denis Villeneuve', dot: '#C4B9AB' },
        { type: 'book', title: 'normal people', meta: 'Sally Rooney', dot: '#B3C4C4' },
        { type: 'music', title: 'cowboy carter', meta: 'Beyoncé', dot: '#C4C4B3' },
      ].map(({ type, title, meta, dot }) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #ECEAE6' }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: dot, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1B19' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#ABA69C' }}>{type} · {meta}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DiscoverIllustration() {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: '#ABA69C', marginBottom: 12 }}>because you loved dark films</div>
      {[
        { title: 'the zone of interest', meta: 'Jonathan Glazer · 2023', dot: '#C4B9AB' },
        { title: 'all of us strangers', meta: 'Andrew Haigh · 2023', dot: '#C4B9AB' },
      ].map(({ title, meta, dot }) => (
        <div key={title} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 0', borderBottom: '1px solid #ECEAE6',
        }}>
          <div style={{ width: 36, height: 48, borderRadius: 4, background: dot, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#ABA69C' }}>{meta}</div>
          </div>
          <span style={{ fontSize: 11, color: '#ECEAE6' }}>+</span>
        </div>
      ))}
      <div style={{ paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        <span style={pill(true)}>dark</span>
        <span style={pill()}>arthouse</span>
        <span style={pill()}>intense</span>
      </div>
    </div>
  )
}
