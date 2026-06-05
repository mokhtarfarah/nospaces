import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Item } from '../lib/database.types'
import { itemGaps, dismissGaps } from '../lib/gaps'
import { useArtwork } from '../lib/artwork'
import { authHeaders } from '../lib/supabase'
import { fetchWikiInfo } from '../lib/wikipedia'

import { MOOD_REMAP } from '../lib/moods'

// ---------------------------------------------------------------------------
// Batch auto-fill tools
// ---------------------------------------------------------------------------

function AutoFillTools({ items, editItem }: {
  items: Item[]
  editItem: (id: string, fields: Record<string, unknown>) => Promise<void>
}) {
  // Derive from itemGaps() so dismissed gaps are respected — consistent with DATA GAPS list
  const untagged = useMemo(() => items.filter(i => itemGaps(i).includes('genre')), [items])
  const needsRuntime = useMemo(() => items.filter(i => itemGaps(i).some(g => g === 'runtime' || g === 'pages')), [items])
  const needsMoodMigration = useMemo(() =>
    items.filter(i => i.moods?.some(m => m in MOOD_REMAP || m === 'gripping' || m === 'project' || m === 'classic')), [items])
  const needsWiki = useMemo(() => items.filter(i => itemGaps(i).includes('wiki')), [items])

  // Flag covers that are genuinely low-res (< 300px) — will look soft on retina.
  // Each source encodes size in the URL; we check the specific pattern.
  function coverIsTooSmall(url: string): boolean {
    const tmdb = url.match(/\/t\/p\/(w\d+)\//)
    if (tmdb) return parseInt(tmdb[1].slice(1)) < 300
    if (url.includes('covers.openlibrary.org')) return /-[SM]\.jpg$/i.test(url)
    const dz = url.match(/\/(\d+)x\d+-\d+-\d+-\d+-\d+\.jpg/)
    if (dz) return parseInt(dz[1]) < 300
    const itunes = url.match(/\/(\d+)x\d+bb\.jpg/)
    if (itunes) return parseInt(itunes[1]) < 300
    return false
  }
  const needsArtRefresh = useMemo(() =>
    items.filter(i => {
      const url = i.metadata?.coverUrl as string | undefined
      return url && coverIsTooSmall(url)
    }), [items])

  const total = untagged.length + needsRuntime.length + needsMoodMigration.length + needsWiki.length + needsArtRefresh.length
  if (total === 0) return null

  // Genre backfill
  const [backfilling, setBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState(0)
  const [backfillTotal, setBackfillTotal] = useState(0)
  const backfillCancel = useRef(false)
  const [backfillConfirm, setBackfillConfirm] = useState(false)
  const [backfillFailed, setBackfillFailed] = useState<Item[]>([])
  const [backfillResult, setBackfillResult] = useState<{ ok: number; fail: number } | null>(null)

  // Runtime/pages backfill
  const [rtRunning, setRtRunning] = useState(false)
  const [rtProgress, setRtProgress] = useState(0)
  const [rtTotal2, setRtTotal2] = useState(0)
  const rtCancel = useRef(false)
  const [rtConfirm, setRtConfirm] = useState(false)
  const [rtFailed, setRtFailed] = useState<Item[]>([])
  const [rtResult, setRtResult] = useState<{ ok: number; fail: number } | null>(null)

  // Mood migration
  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState(0)

  // Wiki backfill
  const [wikiRunning, setWikiRunning] = useState(false)
  const [wikiProgress, setWikiProgress] = useState(0)
  const [wikiTotal2, setWikiTotal2] = useState(0)
  const wikiCancel = useRef(false)


  // Art refresh
  const [artRunning, setArtRunning] = useState(false)
  const [artProgress, setArtProgress] = useState(0)
  const [artTotal2, setArtTotal2] = useState(0)
  const artCancel = useRef(false)
  const [artResult, setArtResult] = useState<number | null>(null)

  const cost = (n: number) => `~$${(n * 0.001).toFixed(2)}`

  async function runGenres(targets: Item[] = untagged) {
    if (backfilling || targets.length === 0) return
    backfillCancel.current = false
    setBackfillConfirm(false); setBackfillResult(null)
    setBackfilling(true); setBackfillProgress(0); setBackfillTotal(targets.length)
    const BATCH = 5; const failed: Item[] = []; let ok = 0
    for (let i = 0; i < targets.length; i += BATCH) {
      if (backfillCancel.current) break
      await Promise.all(targets.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/genres', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type }) })
          if (!res.ok) { failed.push(item); return }
          const { tags } = await res.json()
          if (tags?.length > 0) { await editItem(item.id, { tags }); ok++ } else failed.push(item)
        } catch { failed.push(item) }
      }))
      setBackfillProgress(Math.min(i + BATCH, targets.length))
      if (i + BATCH < targets.length) await new Promise(r => setTimeout(r, 300))
    }
    setBackfilling(false); backfillCancel.current = false
    setBackfillFailed(failed); setBackfillResult({ ok, fail: failed.length })
  }

  async function runRuntime(targets: Item[] = needsRuntime) {
    if (rtRunning || targets.length === 0) return
    rtCancel.current = false
    setRtConfirm(false); setRtResult(null)
    setRtRunning(true); setRtProgress(0); setRtTotal2(targets.length)
    const BATCH = 5; const failed: Item[] = []; let ok = 0
    for (let i = 0; i < targets.length; i += BATCH) {
      if (rtCancel.current) break
      await Promise.all(targets.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/runtime', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type, year: item.year }) })
          if (!res.ok) { failed.push(item); return }
          const data = await res.json()
          const patch: Record<string, unknown> = { ...item.metadata }
          if (item.type === 'book' && typeof data.pages === 'number') patch.pages = data.pages
          if ((item.type === 'film' || item.type === 'tv') && typeof data.runtime === 'number') patch.runtime = data.runtime
          await editItem(item.id, { metadata: patch }); ok++
        } catch { failed.push(item) }
      }))
      setRtProgress(Math.min(i + BATCH, targets.length))
      if (i + BATCH < targets.length) await new Promise(r => setTimeout(r, 300))
    }
    setRtRunning(false); rtCancel.current = false
    setRtFailed(failed); setRtResult({ ok, fail: failed.length })
  }

  async function runMoodMigration() {
    if (migrating || needsMoodMigration.length === 0) return
    setMigrating(true); setMigrateProgress(0)
    for (const item of needsMoodMigration) {
      const remapped: string[] = []
      const fields: Record<string, unknown> = {}
      for (const m of (item.moods ?? [])) {
        if (m === 'gripping') { remapped.push('intense'); continue }
        if (m === 'project' || m === 'easy') continue
        if (m === 'classic') {
          fields.tags = [...new Set([...(item.tags ?? []), item.type === 'book' ? 'classics' : 'classic'])]
          continue
        }
        if (m in MOOD_REMAP) { const r = MOOD_REMAP[m]; if (r) remapped.push(r); continue }
        remapped.push(m)
      }
      fields.moods = [...new Set(remapped)]
      try { await editItem(item.id, fields) } catch { /* skip */ }
      setMigrateProgress(p => p + 1)
    }
    setMigrating(false)
  }

  async function runWiki() {
    if (wikiRunning || needsWiki.length === 0) return
    wikiCancel.current = false
    setWikiRunning(true); setWikiProgress(0); setWikiTotal2(needsWiki.length)
    const BATCH = 6
    for (let i = 0; i < needsWiki.length; i += BATCH) {
      if (wikiCancel.current) break
      await Promise.all(needsWiki.slice(i, i + BATCH).map(async item => {
        try {
          const info = await fetchWikiInfo(item.type, item.title, item.creator, item.year)
          if (info.url) await editItem(item.id, { metadata: { ...item.metadata, wikiUrl: info.url, wikiThumb: info.thumbnail, wikiSummary: info.summary } })
        } catch { /* skip */ }
      }))
      setWikiProgress(Math.min(i + BATCH, needsWiki.length))
    }
    setWikiRunning(false); wikiCancel.current = false
  }

  async function runArtRefresh() {
    if (artRunning || needsArtRefresh.length === 0) return
    artCancel.current = false; setArtResult(null)
    setArtRunning(true); setArtProgress(0); setArtTotal2(needsArtRefresh.length)
    const BATCH = 10; let cleared = 0
    for (let i = 0; i < needsArtRefresh.length; i += BATCH) {
      if (artCancel.current) break
      await Promise.all(needsArtRefresh.slice(i, i + BATCH).map(async item => {
        try {
          const { coverUrl: _drop, ...restMeta } = (item.metadata ?? {}) as Record<string, unknown>
          await editItem(item.id, { metadata: restMeta }); cleared++
        } catch { /* skip */ }
      }))
      setArtProgress(Math.min(i + BATCH, needsArtRefresh.length))
    }
    setArtRunning(false); artCancel.current = false; setArtResult(cleared)
  }

  const run = { background: 'none', border: 'none', fontSize: 12, color: '#1C1B19', cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 } as const
  const ghost = { background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: '0 4px' } as const
  const warn = { background: 'none', border: 'none', fontSize: 12, color: '#C00', cursor: 'pointer', padding: '0 4px', fontWeight: 600 } as const

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#ABA69C', margin: '0 0 10px' }}>fill automatically</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

        {untagged.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>genres — {untagged.length} missing</span>
            {backfilling
              ? <span style={{ fontSize: 12, color: '#888' }}>{Math.min(backfillProgress + 5, backfillTotal)}/{backfillTotal}… <button onClick={() => { backfillCancel.current = true }} style={ghost}>cancel</button></span>
              : backfillResult
                ? <span style={{ fontSize: 12, color: '#888' }}>{backfillResult.ok} tagged{backfillResult.fail > 0 && <> · <button onClick={() => runGenres(backfillFailed)} style={warn}>retry {backfillResult.fail}</button></>} <button onClick={() => setBackfillResult(null)} style={ghost}>×</button></span>
                : backfillConfirm
                  ? <span style={{ fontSize: 12, color: '#888' }}>{cost(untagged.length)} · <button onClick={() => runGenres()} style={run}>run</button> <button onClick={() => setBackfillConfirm(false)} style={ghost}>cancel</button></span>
                  : <button onClick={() => setBackfillConfirm(true)} style={run}>fill →</button>}
          </div>
        )}

        {needsRuntime.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>runtime / pages — {needsRuntime.length} missing</span>
            {rtRunning
              ? <span style={{ fontSize: 12, color: '#888' }}>{Math.min(rtProgress + 5, rtTotal2)}/{rtTotal2}… <button onClick={() => { rtCancel.current = true }} style={ghost}>cancel</button></span>
              : rtResult
                ? <span style={{ fontSize: 12, color: '#888' }}>{rtResult.ok} filled{rtResult.fail > 0 && <> · <button onClick={() => runRuntime(rtFailed)} style={warn}>retry {rtResult.fail}</button></>} <button onClick={() => setRtResult(null)} style={ghost}>×</button></span>
                : rtConfirm
                  ? <span style={{ fontSize: 12, color: '#888' }}>{cost(needsRuntime.length)} · <button onClick={() => runRuntime()} style={run}>run</button> <button onClick={() => setRtConfirm(false)} style={ghost}>cancel</button></span>
                  : <button onClick={() => setRtConfirm(true)} style={run}>fill →</button>}
          </div>
        )}

        {needsMoodMigration.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>old vibe words — {needsMoodMigration.length} items</span>
            {migrating
              ? <span style={{ fontSize: 12, color: '#888' }}>updating {migrateProgress}/{needsMoodMigration.length}…</span>
              : <button onClick={runMoodMigration} style={run}>clean up →</button>}
          </div>
        )}

        {needsWiki.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>wiki links — {needsWiki.length} missing</span>
            {wikiRunning
              ? <span style={{ fontSize: 12, color: '#888' }}>{Math.min(wikiProgress + 6, wikiTotal2)}/{wikiTotal2}… <button onClick={() => { wikiCancel.current = true }} style={ghost}>cancel</button></span>
              : <button onClick={runWiki} style={run}>fill →</button>}
          </div>
        )}

        {needsArtRefresh.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>cover art — {needsArtRefresh.length} below 300px</span>
            {artRunning
              ? <span style={{ fontSize: 12, color: '#888' }}>{Math.min(artProgress + 10, artTotal2)}/{artTotal2}… <button onClick={() => { artCancel.current = true }} style={ghost}>cancel</button></span>
              : artResult !== null
                ? <span style={{ fontSize: 12, color: '#888' }}>{artResult} cleared — reload to fetch fresh <button onClick={() => setArtResult(null)} style={ghost}>×</button></span>
                : <button onClick={runArtRefresh} style={run}>refresh →</button>}
          </div>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual gap rows
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

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

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Batch auto-fill tools */}
          <AutoFillTools items={items} editItem={editItem} />

          {/* Individual gap items */}
          {incomplete.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#ABA69C', margin: 0 }}>data gaps</p>
                <p style={{ fontSize: 12, color: '#ABA69C', margin: 0 }}>
                  {incomplete.length} item{incomplete.length !== 1 ? 's' : ''}
                </p>
              </div>
              <p style={{ fontSize: 12, color: '#ABA69C', margin: '0 0 10px' }}>
                tap to fill · ✓︎ to dismiss
              </p>

              {gapTypes.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
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

              <div style={{ border: '1px solid #ECEAE6', borderRadius: 8 }}>
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
