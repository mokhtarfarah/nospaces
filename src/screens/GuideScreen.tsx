import { useNavigate } from 'react-router-dom'

export function GuideScreen() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '16px 20px 12px',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        borderBottom: '1px solid #ECEAE6',
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

      <div style={{ padding: '28px 24px 0' }}>

        {/* header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', color: '#ABA69C', marginBottom: 10 }}>how to use</div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: '#1C1B19', letterSpacing: '-0.025em', margin: '0 0 12px', lineHeight: 1.15 }}>
            your personal<br />media library.
          </h1>
          <p style={{ fontSize: 15, color: '#6F6B64', lineHeight: 1.65, margin: 0 }}>
            save films, books, albums, and shows. log how they land.
            build a picture of your taste over time.
          </p>
        </div>

        {/* ── 01 SAVING ────────────────────────────────────────── */}
        <Section num="01" title="saving things" desc="three ways in — all of them do the same thing. you give nospaces a clue and it finds the item, fills in the details, and adds it to your want-to list.">
          <AddIllustration />
          <Tips items={[
            { label: 'type or search', text: 'describe or name it — "that new Villeneuve film", an album, a book title. search finds it.' },
            { label: 'photo',          text: 'tap "from a photo" in the add screen. snap a poster, a shelf, a screenshot — it reads every title in the image.' },
            { label: 'email',          text: 'forward anything to anything@nospaces.xyz — a newsletter, a review, a recommendation. every title in it gets saved.' },
          ]} />
          <Extras items={[
            { label: 'letterboxd', text: 'tap + → import from letterboxd to bring in your watchlist and ratings. stars map to reactions automatically.' },
            { label: 'spotify',    text: 'tap + → sync from spotify to pull your saved albums. repeat syncs only add new ones.' },
          ]} />
        </Section>

        {/* ── 02 REACTING ──────────────────────────────────────── */}
        <Section num="02" title="logging a reaction" desc={`tap any item in your library and hit "mark as done" once you've finished it. tell it how it landed — the rating, the feel, and your take.`}>
          <ReactionIllustration />
          <Tips items={[
            { label: 'rating',  text: 'loved it · liked it · eh · not for me. no stars, just how it actually hit.' },
            { label: 'vibe',    text: 'the feel of it — dark, nostalgic, playful, intense, cozy... add as many as fit.' },
            { label: 'verdict', text: 'your personal label — comfort, hyperfixation, overrated, so bad it\'s good...' },
            { label: '◆ canon', text: 'all-time favourites. tap canon on things you\'d genuinely put in a top 10. shows up on your taste page.' },
          ]} />
          <Extras items={[
            { label: 'in progress', text: 'reading something? halfway through a season? tap "mark as in progress" so you know what you\'re currently on.' },
            { label: 'note',        text: 'free-text field in the reaction view if you want to say more about it.' },
          ]} />
        </Section>

        {/* ── 03 LIBRARY ───────────────────────────────────────── */}
        <Section num="03" title="your library" desc="everything in one place. filter by type (film, book, music, tv), status (want to / done), vibe, genre, or reaction. search by name. tap any item to open its action card.">
          <LibraryIllustration />
          <Tips items={[
            { label: 'filter ▾',       text: 'tap to filter by vibe, verdict, genre, or series. the badge shows how many are active.' },
            { label: 'help me decide', text: 'can\'t choose? tap the link in the library header. it asks 3 questions and picks something from your backlog.' },
          ]} />
          <Extras items={[
            { label: 'tidy',   text: '"tidy · N" in the header flags items missing info — year, director, runtime, genre. tap to fill them in one by one, or auto-fill in bulk.' },
            { label: 'series', text: 'tap an item → edit → series field. groups trilogies, book series, and tv seasons together in the library.' },
          ]} />
        </Section>

        {/* ── 04 DISCOVER ──────────────────────────────────────── */}
        <Section num="04" title="discover" desc="the discover tab suggests things you haven't seen based on what you've loved and liked. the more you react, the sharper it gets.">
          <DiscoverIllustration />
          <Tips items={[
            { label: 'suggestions',    text: 'looks at your loved + liked reactions, finds patterns in vibes and genres, then surfaces things that match your actual taste.' },
            { label: 'shows near you', text: 'in the music category, tap "shows near you" to see upcoming concerts for artists in your library.' },
          ]} />
        </Section>

        {/* ── 05 TASTE ─────────────────────────────────────────── */}
        <Section num="05" title="your taste" desc="the taste tab is your snapshot — a breakdown of how you've reacted to things, your all-time canon, and the vibes and genres you keep coming back to.">
          <TasteIllustration />
          <Tips items={[
            { label: 'reactions', text: 'see your loved / liked / eh breakdown per type — film, book, music, tv.' },
            { label: '◆ canon',   text: 'all the things you\'ve marked canon, organised by type. your curated collection.' },
            { label: 'vibes',     text: 'patterns across everything you\'ve reacted to — the moods and genres that keep showing up.' },
          ]} />
        </Section>

      </div>
    </div>
  )
}

// ── Layout primitives ─────────────────────────────────────────────────────────

function Section({
  num, title, desc, children,
}: {
  num: string; title: string; desc: string; children?: React.ReactNode
}) {
  return (
    <div style={{ paddingBottom: 36, marginBottom: 36, borderBottom: '1px solid #ECEAE6' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#ABA69C', fontWeight: 500, letterSpacing: '0.06em', flexShrink: 0 }}>{num}</span>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C1B19', margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 14, color: '#6F6B64', lineHeight: 1.65, margin: 0 }}>{desc}</p>
      {children}
    </div>
  )
}

// Grid layout so all description text starts at the same left edge
function Tips({ items }: { items: { label: string; text: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 10, alignItems: 'start', marginTop: 16 }}>
      {items.map(({ label, text }) => (
        <>
          <span key={`${label}-lbl`} style={{
            fontSize: 11, fontWeight: 600, color: '#1C1B19',
            background: '#F4F2EF', padding: '2px 8px', borderRadius: 4,
            lineHeight: 1.6, whiteSpace: 'nowrap',
          }}>{label}</span>
          <span key={`${label}-txt`} style={{ fontSize: 13, color: '#6F6B64', lineHeight: 1.6 }}>{text}</span>
        </>
      ))}
    </div>
  )
}

// Secondary details — lighter style, attached to the bottom of a section
function Extras({ items }: { items: { label: string; text: string }[] }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #ECEAE6', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 8, alignItems: 'start' }}>
      {items.map(({ label, text }) => (
        <>
          <span key={`${label}-lbl`} style={{
            fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.03em',
            background: '#F4F2EF', padding: '2px 7px', borderRadius: 3,
            lineHeight: 1.6, whiteSpace: 'nowrap',
          }}>{label}</span>
          <span key={`${label}-txt`} style={{ fontSize: 12, color: '#ABA69C', lineHeight: 1.6 }}>{text}</span>
        </>
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

function AddIllustration() {
  return (
    <div style={card}>
      {[
        { num: '1', label: 'type or describe it',      hint: '"that Villeneuve film" · "Sally Rooney novel"' },
        { num: '2', label: 'snap or share a photo',    hint: 'poster · shelf · article · screenshot' },
        { num: '3', label: 'forward an email',         hint: 'anything@nospaces.xyz' },
      ].map(({ num, label, hint }, i, arr) => (
        <div key={num} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '10px 0',
          borderBottom: i < arr.length - 1 ? '1px solid #ECEAE6' : 'none',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', background: '#F4F2EF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#6F6B64', flexShrink: 0, marginTop: 1,
          }}>{num}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1B19', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, color: '#ABA69C' }}>{hint}</div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: '1px solid #ECEAE6',
        fontSize: 11, color: '#ABA69C', textAlign: 'center' as const,
      }}>
        nospaces finds it and fills in the details
      </div>
    </div>
  )
}

function ReactionIllustration() {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: '#ABA69C', marginBottom: 10 }}>how did it land?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'loved it', active: true },
          { label: 'liked it', active: false },
          { label: 'eh', active: false },
          { label: 'not for me', active: false },
        ].map(({ label, active }) => (
          <div key={label} style={{
            padding: '10px 0', textAlign: 'center' as const, borderRadius: 8,
            border: active ? '1.5px solid #1C1B19' : '1.5px solid #ECEAE6',
            background: active ? '#1C1B19' : '#fff',
            color: active ? '#fff' : '#6F6B64',
            fontSize: 12, fontWeight: active ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #ECEAE6', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: '#ABA69C', letterSpacing: '0.07em', marginBottom: 7 }}>VIBE</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          {['dark', 'epic', 'intense'].map((v, i) => (
            <span key={v} style={{
              padding: '3px 10px', borderRadius: 100, fontSize: 11,
              border: i === 0 ? '1px solid #1C1B19' : '1px solid #ECEAE6',
              background: i === 0 ? '#1C1B19' : '#fff',
              color: i === 0 ? '#fff' : '#6F6B64',
            }}>{v}</span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#ABA69C', letterSpacing: '0.07em', marginBottom: 7 }}>VERDICT</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {['hyperfixation', 'delivers'].map((v, i) => (
            <span key={v} style={{
              padding: '3px 10px', borderRadius: 100, fontSize: 11,
              border: i === 0 ? '1px solid #1C1B19' : '1px solid #ECEAE6',
              background: i === 0 ? '#1C1B19' : '#fff',
              color: i === 0 ? '#fff' : '#6F6B64',
            }}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function LibraryIllustration() {
  return (
    <div style={card}>
      {/* filter bar — current UI: status tabs + filter button */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #ECEAE6' }}>
        {[
          { label: 'all', active: true },
          { label: 'want to', active: false },
          { label: 'in progress', active: false },
          { label: 'done', active: false },
        ].map(({ label, active }) => (
          <span key={label} style={{
            fontSize: 11, fontWeight: active ? 600 : 400,
            color: active ? '#1C1B19' : '#ABA69C',
            fontStyle: active ? 'italic' : 'normal',
            whiteSpace: 'nowrap' as const, flexShrink: 0,
          }}>{label}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ABA69C', flexShrink: 0 }}>filter ▾</span>
      </div>
      {/* item rows */}
      {[
        { type: 'film',  title: 'dune: part two', meta: 'Denis Villeneuve · 2024', dot: '#C4B9AB' },
        { type: 'book',  title: 'normal people',  meta: 'Sally Rooney · 2018',    dot: '#B3C4C4' },
        { type: 'music', title: 'cowboy carter',  meta: 'Beyoncé · 2024',         dot: '#C4C4B3' },
      ].map(({ type, title, meta, dot }) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #ECEAE6' }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: dot, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1C1B19' }}>{title}</div>
            <div style={{ fontSize: 10, color: '#ABA69C' }}>{type} · {meta}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D5D3CF" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      ))}
    </div>
  )
}

function DiscoverIllustration() {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: '#ABA69C', marginBottom: 12 }}>based on your taste · dark films</div>
      {[
        { title: 'the zone of interest', meta: 'Jonathan Glazer · 2023', dot: '#C4B9AB' },
        { title: 'all of us strangers',  meta: 'Andrew Haigh · 2023',    dot: '#C4B5AB' },
      ].map(({ title, meta, dot }) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #ECEAE6' }}>
          <div style={{ width: 34, height: 46, borderRadius: 4, background: dot, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1B19', marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 10, color: '#ABA69C' }}>{meta}</div>
          </div>
          <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', border: '1px solid #ECEAE6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ABA69C" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>
      ))}
      <div style={{ paddingTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
        {['dark', 'arthouse', 'intense'].map((v, i) => (
          <span key={v} style={{
            padding: '3px 10px', borderRadius: 100, fontSize: 11,
            border: i === 0 ? '1px solid #1C1B19' : '1px solid #ECEAE6',
            background: i === 0 ? '#1C1B19' : '#fff',
            color: i === 0 ? '#fff' : '#6F6B64',
          }}>{v}</span>
        ))}
      </div>
    </div>
  )
}

function TasteIllustration() {
  return (
    <div style={card}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#ABA69C', letterSpacing: '0.07em', marginBottom: 10 }}>REACTIONS</div>
        {[
          { type: 'film',  loved: 8,  total: 14 },
          { type: 'book',  loved: 5,  total: 14 },
          { type: 'music', loved: 12, total: 16 },
        ].map(({ type, loved, total }) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#6F6B64', width: 32, flexShrink: 0 }}>{type}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#ECEAE6', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: '#1C1B19', width: `${(loved / total) * 100}%` }} />
            </div>
            <span style={{ fontSize: 10, color: '#ABA69C', flexShrink: 0 }}>{loved} loved</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #ECEAE6', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: '#ABA69C', letterSpacing: '0.07em', marginBottom: 10 }}>◆ CANON</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#C4B9AB', '#B3C4C4', '#C4C4B3', '#C4BCAB'].map((color, i) => (
            <div key={i} style={{ width: 36, height: 48, borderRadius: 4, background: color, flexShrink: 0 }} />
          ))}
          <div style={{
            width: 36, height: 48, borderRadius: 4, background: '#F4F2EF', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: '#ABA69C' }}>+8</span>
          </div>
        </div>
      </div>
    </div>
  )
}
