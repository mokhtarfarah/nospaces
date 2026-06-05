import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ItemActionSheet } from '../components/ItemActionSheet'
import { VIBES } from '../lib/moods'
import { typeColor } from '../lib/colors'
import type { Item } from '../lib/database.types'

type SeenChoice = 'new' | 'revisit'
type TypeChoice = 'film' | 'tv' | 'book' | 'music' | 'any'
type TimeChoice = 'quick' | 'medium' | 'long' | 'any'
type Step = 'seen' | 'type' | 'time' | 'vibe' | 'result'

interface Picks {
  seen: SeenChoice | null
  type: TypeChoice | null
  time: TimeChoice | null
  vibe: string | null
}

const TYPE_OPTIONS: { value: TypeChoice; label: string }[] = [
  { value: 'film',  label: 'a film' },
  { value: 'tv',    label: 'tv' },
  { value: 'book',  label: 'a book' },
  { value: 'music', label: 'music' },
  { value: 'any',   label: 'anything' },
]

const TIME_OPTIONS_FILM: { value: TimeChoice; label: string; sub: string }[] = [
  { value: 'quick',  label: 'short',           sub: 'under 95 min' },
  { value: 'medium', label: 'feature',         sub: '95 – 135 min' },
  { value: 'long',   label: 'long one',        sub: '135+ min' },
  { value: 'any',    label: "doesn't matter",  sub: '' },
]

const TIME_OPTIONS_BOOK: { value: TimeChoice; label: string; sub: string }[] = [
  { value: 'quick',  label: 'quick read',      sub: 'under 200 pages' },
  { value: 'medium', label: 'medium',          sub: '200 – 400 pages' },
  { value: 'long',   label: 'long haul',       sub: '400+ pages' },
  { value: 'any',    label: "doesn't matter",  sub: '' },
]

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed | 0
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function candidatePool(items: Item[], picks: Picks): Item[] {
  // Status pool: new = want_to, revisit = done. null = not yet chosen (empty)
  const targetStatus = picks.seen === 'new' ? 'want_to' : picks.seen === 'revisit' ? 'done' : null
  if (!targetStatus) return []
  let pool = items.filter(i => i.status === targetStatus)

  if (picks.type && picks.type !== 'any') {
    pool = pool.filter(i => i.type === picks.type)
  }

  if (picks.time && picks.time !== 'any') {
    pool = pool.filter(i => {
      if (picks.type === 'film') {
        const rt = i.metadata?.runtime as number | undefined
        if (!rt) return true
        if (picks.time === 'quick')  return rt <= 95
        if (picks.time === 'medium') return rt > 95 && rt <= 135
        if (picks.time === 'long')   return rt > 135
      }
      if (picks.type === 'book') {
        const pg = i.metadata?.pages as number | undefined
        if (!pg) return true
        if (picks.time === 'quick')  return pg <= 200
        if (picks.time === 'medium') return pg > 200 && pg <= 400
        if (picks.time === 'long')   return pg > 400
      }
      return true
    })
  }

  if (picks.vibe) {
    pool = pool.filter(i => Array.isArray(i.moods) && i.moods.includes(picks.vibe!))
  }

  return pool
}

function availableVibes(pool: Item[]): string[] {
  const counts: Record<string, number> = {}
  for (const item of pool) {
    if (!Array.isArray(item.moods)) continue
    for (const m of item.moods) {
      if (VIBES.includes(m)) counts[m] = (counts[m] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v)
    .slice(0, 7)
}

// --- UI primitives -----------------------------------------------------------

function OptionPill({
  label, sub, active, onClick,
}: {
  label: string; sub?: string; active?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: sub ? '14px 24px 12px' : '14px 28px',
        borderRadius: 100,
        border: active ? '1.5px solid #1C1B19' : '1.5px solid #D5D3CF',
        background: active ? '#1C1B19' : '#fff',
        color: active ? '#fff' : '#1C1B19',
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
        transition: 'all 0.1s',
        flexShrink: 0,
      }}
    >
      {label}
      {sub && (
        <span style={{ fontSize: 11, opacity: active ? 0.7 : 0.45, fontWeight: 400 }}>{sub}</span>
      )}
    </button>
  )
}

function ResultCard({ item, onTap }: { item: Item; onTap: () => void }) {
  const color = typeColor(item.type)
  const vibes = (item.moods ?? []).filter(m => VIBES.includes(m)).slice(0, 3)
  const coverUrl = item.metadata?.coverUrl as string | undefined

  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 0',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid #ECEAE6',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          style={{
            width: 48,
            height: item.type === 'music' ? 48 : 64,
            objectFit: 'cover',
            borderRadius: 4,
            flexShrink: 0,
            background: color.bg,
          }}
        />
      ) : (
        <div style={{
          width: 48,
          height: item.type === 'music' ? 48 : 64,
          borderRadius: 4,
          background: color.bg,
          border: `1.5px solid ${color.border}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 10, color: color.border, fontWeight: 600, letterSpacing: '0.04em' }}>
            {item.type}
          </span>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1B19', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 13, color: '#6F6B64', marginBottom: vibes.length > 0 ? 6 : 0 }}>
          {[item.creator, item.year].filter(Boolean).join(' · ')}
        </div>
        {vibes.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {vibes.map(v => (
              <span key={v} style={{
                fontSize: 11,
                color: '#6F6B64',
                background: '#F4F2EF',
                padding: '2px 7px',
                borderRadius: 100,
              }}>{v}</span>
            ))}
          </div>
        )}
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ABA69C" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

// --- Main screen -------------------------------------------------------------

export function HelpMeDecideScreen() {
  const navigate = useNavigate()
  const { items, markDone, markWantTo, markInProgress, deleteItem, editItem,
          toggleOwned, toggleCanon, patchMetadata } = useItems()

  const [step, setStep] = useState<Step>('seen')
  const [picks, setPicks] = useState<Picks>({ seen: null, type: null, time: null, vibe: null })
  const [resultSeed, setResultSeed] = useState(Date.now())
  const [actionItem, setActionItem] = useState<Item | null>(null)

  // Types available in the current seen-pool
  const availableTypes = useMemo(() => {
    if (!picks.seen) return new Set<string>()
    const status = picks.seen === 'new' ? 'want_to' : 'done'
    return new Set(items.filter(i => i.status === status).map(i => i.type))
  }, [items, picks.seen])

  function handleSeen(seen: SeenChoice) {
    const newPicks: Picks = { seen, type: null, time: null, vibe: null }
    setPicks(newPicks)
    setStep('type')
  }

  function handleType(type: TypeChoice) {
    const newPicks: Picks = { ...picks, type, time: null, vibe: null }
    setPicks(newPicks)
    if (type === 'film' || type === 'book') {
      setStep('time')
    } else {
      const pool = candidatePool(items, newPicks)
      const vibes = availableVibes(pool)
      setStep(vibes.length >= 2 ? 'vibe' : 'result')
    }
  }

  function handleTime(time: TimeChoice) {
    const newPicks: Picks = { ...picks, time, vibe: null }
    setPicks(newPicks)
    const pool = candidatePool(items, newPicks)
    const vibes = availableVibes(pool)
    setStep(vibes.length >= 2 ? 'vibe' : 'result')
  }

  function handleVibe(vibe: string | null) {
    const newPicks: Picks = { ...picks, vibe }
    setPicks(newPicks)
    setResultSeed(Date.now())
    setStep('result')
  }

  const vibeOptions = useMemo(() => {
    const pool = candidatePool(items, { ...picks, vibe: null })
    return availableVibes(pool)
  }, [items, picks])

  const resultItems = useMemo(() => {
    const pool = candidatePool(items, picks)
    if (pool.length === 0) return []
    return seededShuffle(pool, resultSeed).slice(0, 3)
  }, [items, picks, resultSeed])

  function goBack() {
    if (step === 'seen')   { navigate('/library'); return }
    if (step === 'type')   { setStep('seen'); return }
    if (step === 'time')   { setStep('type'); return }
    if (step === 'vibe') {
      if (picks.type === 'film' || picks.type === 'book') setStep('time')
      else setStep('type')
      return
    }
    if (step === 'result') {
      if (vibeOptions.length >= 2) { setStep('vibe'); return }
      if (picks.type === 'film' || picks.type === 'book') { setStep('time'); return }
      setStep('type')
    }
  }

  const poolSize = useMemo(() => candidatePool(items, picks).length, [items, picks])

  // ---------------------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
    }}>
      {/* top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px 8px',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        gap: 12,
      }}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
            color: '#6F6B64', fontSize: 14, fontFamily: 'inherit',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {step === 'seen' ? 'library' : 'back'}
        </button>

        {step !== 'seen' && (
          <button
            onClick={() => { setPicks({ seen: null, type: null, time: null, vibe: null }); setStep('seen') }}
            style={{
              marginLeft: 'auto',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 0', color: '#ABA69C', fontSize: 13, fontFamily: 'inherit',
            }}
          >
            start over
          </button>
        )}
      </div>

      {/* content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>

        {/* SEEN STEP */}
        {step === 'seen' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: '#ABA69C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                help me decide
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1B19', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                seen it before, or something new?
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <OptionPill label="new to me" onClick={() => handleSeen('new')} />
              <OptionPill label="seen it before" onClick={() => handleSeen('revisit')} />
            </div>
          </>
        )}

        {/* TYPE STEP */}
        {step === 'type' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: '#ABA69C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                {picks.seen === 'revisit' ? 'revisit' : 'something new'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1B19', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                what are you in the mood for?
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {TYPE_OPTIONS
                .filter(o => o.value === 'any' || availableTypes.has(o.value))
                .map(o => (
                  <OptionPill key={o.value} label={o.label} onClick={() => handleType(o.value)} />
                ))
              }
            </div>
          </>
        )}

        {/* TIME STEP */}
        {step === 'time' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: '#ABA69C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                {picks.type === 'film' ? 'film' : 'book'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1B19', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                {picks.type === 'film' ? 'how long?' : 'how much of a commitment?'}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(picks.type === 'film' ? TIME_OPTIONS_FILM : TIME_OPTIONS_BOOK).map(o => (
                <OptionPill key={o.value} label={o.label} sub={o.sub} onClick={() => handleTime(o.value)} />
              ))}
            </div>
          </>
        )}

        {/* VIBE STEP */}
        {step === 'vibe' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: '#ABA69C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                feeling
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1B19', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                any particular vibe?
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {vibeOptions.map(v => (
                <OptionPill key={v} label={v} onClick={() => handleVibe(v)} />
              ))}
              <OptionPill label="anything goes" onClick={() => handleVibe(null)} />
            </div>
          </>
        )}

        {/* RESULT STEP */}
        {step === 'result' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#ABA69C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                {resultItems.length === 0 ? 'no matches' : picks.seen === 'revisit' ? 'revisit' : 'your pick'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1B19', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                {resultItems.length === 0
                  ? 'nothing quite fits'
                  : resultItems.length === 1
                    ? 'this one.'
                    : picks.seen === 'revisit'
                      ? 'worth another go.'
                      : 'here\'s what we\'ve got.'}
              </div>
              {resultItems.length === 0 && (
                <p style={{ fontSize: 14, color: '#6F6B64', marginTop: 10, lineHeight: 1.5 }}>
                  no items match those filters. try loosening a constraint.
                </p>
              )}
            </div>

            {resultItems.length > 0 && (
              <div>
                {resultItems.map(item => (
                  <ResultCard
                    key={item.id}
                    item={item}
                    onTap={() => setActionItem(item)}
                  />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              {poolSize > resultItems.length && (
                <button
                  onClick={() => setResultSeed(Date.now())}
                  style={{
                    padding: '12px 22px', borderRadius: 100,
                    border: '1.5px solid #D5D3CF', background: '#fff',
                    color: '#1C1B19', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  none of these
                </button>
              )}
              <button
                onClick={() => { setPicks({ seen: null, type: null, time: null, vibe: null }); setStep('seen') }}
                style={{
                  padding: '12px 22px', borderRadius: 100,
                  border: '1.5px solid #D5D3CF', background: '#fff',
                  color: '#6F6B64', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                start over
              </button>
            </div>
          </>
        )}
      </div>

      {actionItem && (() => {
        const fresh = items.find(i => i.id === actionItem.id) ?? actionItem
        return (
          <ItemActionSheet
            key={fresh.id}
            item={fresh}
            onEdit={fields => { editItem(fresh.id, fields) }}
            onToggleOwned={owned => toggleOwned(fresh.id, owned)}
            onToggleCanon={canon => toggleCanon(fresh.id, canon)}
            onPatchMetadata={patch => patchMetadata(fresh.id, patch)}
            onPatchTags={tags => editItem(fresh.id, { tags })}
            onMarkInProgress={() => { markInProgress(fresh.id); setActionItem(null) }}
            onMarkWantTo={() => { markWantTo(fresh.id); setActionItem(null) }}
            onMarkDone={(reaction, note, moods) => { markDone(fresh.id, reaction, note, moods); setActionItem(null) }}
            onEditReaction={(reaction, note, moods) => { editItem(fresh.id, { reaction, note: note || null, moods }); setActionItem(null) }}
            onSetSeasons={seasons => editItem(fresh.id, { metadata: { ...fresh.metadata, seasons } })}
            onDelete={() => { deleteItem(fresh.id); setActionItem(null) }}
            onKeep={reaction => {
              if (reaction) markDone(fresh.id, reaction, fresh.note ?? '', fresh.moods ?? [])
              patchMetadata(fresh.id, { review: false })
              setActionItem(null)
            }}
            onClose={() => setActionItem(null)}
          />
        )
      })()}
    </div>
  )
}
