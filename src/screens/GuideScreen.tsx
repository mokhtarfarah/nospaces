import { useNavigate } from 'react-router-dom'
import { clearFab } from '../lib/layout'

export function GuideScreen() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', paddingBottom: clearFab() }}>

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
            { label: 'verdict', text: 'optional — a label for the special ones. comfort, would revisit, guilty pleasure, my secret gem, stuck with me... leave it blank and it just reads as done.' },
            { label: '★ desert island', text: 'all-time picks. tap desert island on things you\'d genuinely keep forever. shows up on your taste page.' },
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
            { label: 'tidy',   text: 'open the ⋯ menu in the library header → tidy. it walks you through items missing info — year, director, runtime, genre — to fill one by one, or auto-fill in bulk.' },
            { label: 'series', text: 'tap an item → edit → series field. groups trilogies and book series together in the library.' },
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
        <Section num="05" title="your taste" desc="the taste tab is your snapshot — your defining vibes, an ai-written taste profile, your desert island picks, and the creators you always love.">
          <TasteIllustration />
          <Tips items={[
            { label: 'vibes',          text: 'the moods and feels that define your taste — derived from everything you\'ve tagged.' },
            { label: '★ desert island', text: 'the things you\'d keep forever, organised by type. your curated collection.' },
            { label: 'always loved',   text: 'directors, authors, artists where you\'ve never not loved their work.' },
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
  const rows = [
    {
      num: '1',
      label: 'type or describe it',
      desc: 'name it, describe it, or be vague — "that new Villeneuve film", "something by Sally Rooney". search finds it.',
    },
    {
      num: '2',
      label: 'snap or share a photo',
      desc: 'tap "from a photo" in the add screen. point it at a poster, a shelf, a screenshot — it reads every title in the image.',
    },
    {
      num: '3',
      label: 'forward an email',
      desc: 'forward anything to anything@nospaces.xyz — a newsletter, a photo, a title, a review. everything in it gets saved.',
    },
  ]
  return (
    <div style={card}>
      {rows.map(({ num, label, desc }, i) => (
        <div key={num} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 0',
          borderBottom: i < rows.length - 1 ? '1px solid #ECEAE6' : 'none',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', background: '#F4F2EF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#6F6B64', flexShrink: 0, marginTop: 2,
          }}>{num}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: '#6F6B64', lineHeight: 1.55 }}>{desc}</div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 12, paddingTop: 12, borderTop: '1px solid #ECEAE6',
        fontSize: 13, fontWeight: 600, color: '#1C1B19',
      }}>
        nospaces finds it and fills in the details.
      </div>
    </div>
  )
}

function ReactionIllustration() {
  const btnBase: React.CSSProperties = {
    padding: '11px 8px', borderRadius: 10, fontSize: 13,
    textAlign: 'center' as const,
  }
  return (
    <div style={card}>
      {/* Item header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #ECEAE6' }}>
        <div style={{ width: 4, height: 32, borderRadius: 2, background: '#C4B9AB', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>dune: part two</div>
          <div style={{ fontSize: 11, color: '#ABA69C' }}>Denis Villeneuve</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1B19', marginBottom: 12 }}>what did you think?</div>

      {/* loved it / liked it */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ ...btnBase, border: '2px solid #1C1B19', background: '#F4F2EE', color: '#1C1B19', fontWeight: 600 }}>loved it</div>
        <div style={{ ...btnBase, border: '1.5px solid #E6E3DE', background: '#fff', color: '#6F6B64' }}>liked it</div>
      </div>

      {/* desert island full-width */}
      <div style={{ ...btnBase, border: '1.5px solid #E6E3DE', background: '#fff', color: '#6F6B64', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 10 }}>☆</span> desert island
      </div>

      {/* eh / not for me */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ ...btnBase, border: '1.5px solid #E6E3DE', background: '#fff', color: '#6F6B64' }}>eh</div>
        <div style={{ ...btnBase, border: '1.5px solid #E6E3DE', background: '#fff', color: '#6F6B64' }}>not for me</div>
      </div>

      {/* vibe */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase' as const, marginBottom: 8 }}>
        vibe <span style={{ textTransform: 'none' as const, fontWeight: 400, color: '#D5D3CF' }}>· optional</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
        {['dark', 'epic', 'intense', 'melancholic', 'lush'].map((v, i) => (
          <span key={v} style={{
            padding: '4px 10px', borderRadius: 100, fontSize: 11,
            border: i === 0 ? '1px solid #1C1B19' : '1px solid #ECEAE6',
            background: i === 0 ? '#1C1B19' : '#fff',
            color: i === 0 ? '#fff' : '#6F6B64',
          }}>{v}</span>
        ))}
      </div>
    </div>
  )
}

function LibraryIllustration() {
  const rows = [
    { title: 'dune: part two', creator: 'Denis Villeneuve', sub: 'film · 2024 · sci-fi · loved it', bg: '#E8E4DE', square: false },
    { title: 'normal people',  creator: 'Sally Rooney',     sub: 'book · 2018 · literary',          bg: '#DFE8E8', square: false },
    { title: 'cowboy carter',  creator: 'Beyoncé',          sub: 'music · 2024',                    bg: '#E8E8DF', square: true  },
  ]
  return (
    <div style={card}>
      {/* filter bar — current UI */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 12, marginBottom: 4, borderBottom: '1px solid #ECEAE6' }}>
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
      {/* item rows — matching current ItemRow design: thumb + title·creator + subtitle + ✓ */}
      {rows.map(({ title, creator, sub, bg, square }) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F4F4F4' }}>
          <div style={{ width: square ? 36 : 28, height: square ? 36 : 48, borderRadius: 4, background: bg, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ fontWeight: 500, color: '#111' }}>{title}</span>
              <span style={{ color: '#ABA69C' }}>  ·  {creator}</span>
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{sub}</div>
          </div>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            border: '1.5px solid #DDD', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#CCC',
          }}>✓</div>
        </div>
      ))}
    </div>
  )
}

function DiscoverIllustration() {
  const results = [
    {
      title: 'the zone of interest',
      creator: 'Jonathan Glazer',
      meta: 'film · 2023 · via dark films',
      why: 'matches your taste for dark, slow-burn films with a heavy atmosphere.',
      bg: '#C4B9AB',
    },
    {
      title: 'all of us strangers',
      creator: 'Andrew Haigh',
      meta: 'film · 2023 · via melancholic',
      why: 'you loved similar quiet, emotional films.',
      bg: '#C4B5AB',
    },
  ]
  return (
    <div style={card}>
      {results.map(({ title, creator, meta, why, bg }, i) => (
        <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16, marginBottom: i < results.length - 1 ? 16 : 0, borderBottom: i < results.length - 1 ? '1px solid #ECEAE6' : 'none' }}>
          <div style={{ width: 42, height: 62, borderRadius: 3, background: bg, flexShrink: 0, border: '1px solid #ECEAE6' }} />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>{title}</span>
              <span style={{ fontSize: 11, color: '#6F6B64' }}> — {creator}</span>
            </div>
            <div style={{ fontSize: 10, color: '#ABA69C', marginBottom: 6 }}>{meta}</div>
            <div style={{ fontSize: 11, color: '#6F6B64', fontStyle: 'italic' as const, lineHeight: 1.5, marginBottom: 8 }}>{why}</div>
            <span style={{ fontSize: 11, color: '#ABA69C', textDecoration: 'underline' }}>+ save</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function TasteIllustration() {
  return (
    <div style={card}>
      {/* Top vibe chips — matches hero section of taste page */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16, paddingBottom: 16, borderBottom: '1.5px solid #1C1B19' }}>
        {['dark', 'melancholic', 'intense', 'nostalgic', 'lush', 'epic'].map((v, i) => (
          <span key={v} style={{
            padding: '3px 10px', borderRadius: 100, fontSize: 11,
            border: i < 3 ? '1px solid #1C1B19' : '1px solid #ECEAE6',
            background: i < 3 ? '#1C1B19' : '#fff',
            color: i < 3 ? '#fff' : '#6F6B64',
          }}>{v}</span>
        ))}
      </div>

      {/* Category card — matches CategoryCard component */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #ECEAE6' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const, color: '#1C1B19' }}>film</span>
          <span style={{ fontSize: 11, color: '#ABA69C' }}>14 rated · 71% loved</span>
        </div>
        {/* desert island tiles */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase' as const, color: '#ABA69C', marginBottom: 8 }}>desert island</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['#C4B9AB', '#C0B5A8', '#C8BCAF', '#BDB5AB'].map((bg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, gap: 3, width: 44 }}>
              <div style={{ width: 44, height: 64, borderRadius: 3, background: bg, border: '1px solid #ECEAE6' }} />
              <div style={{ fontSize: 9, color: '#6F6B64', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {['dune', 'there will be blood', 'hereditary', 'mulholland dr.'][i]}
              </div>
            </div>
          ))}
        </div>
        {/* ranked genres */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {['sci-fi', 'drama', 'thriller', 'arthouse'].map((g, i) => (
            <span key={g} style={{ fontSize: 11, color: i === 0 ? '#1C1B19' : '#6F6B64', fontWeight: i === 0 ? 600 : 400 }}>{g}{i < 3 ? ' ·' : ''}</span>
          ))}
        </div>
      </div>

      {/* Second category */}
      <div style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const, color: '#1C1B19' }}>book</span>
          <span style={{ fontSize: 11, color: '#ABA69C' }}>8 rated · 62% loved</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#DFE8E8', '#D8E0E0'].map((bg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, gap: 3, width: 44 }}>
              <div style={{ width: 44, height: 64, borderRadius: 3, background: bg, border: '1px solid #ECEAE6' }} />
              <div style={{ fontSize: 9, color: '#6F6B64', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {['normal people', 'the sympathizer'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
