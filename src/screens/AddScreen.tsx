import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ConfirmSheet, type AiResult } from '../components/ConfirmSheet'
import { BulkConfirmSheet, type BulkItem } from '../components/BulkConfirmSheet'
import type { ItemReaction } from '../lib/database.types'
import { fetchWikiInfo } from '../lib/wikipedia'
import { authHeaders } from '../lib/supabase'

interface Candidate {
  title: string
  creator: string
  type: string
  year: number | null
}

async function identifyText(input: string, typeHint?: string | null): Promise<AiResult> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ input, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'auth_error' : 'AI request failed')
  return res.json()
}

async function describeToSearch(input: string): Promise<{ searchQuery: string; type: string | null; sortByRecency?: boolean }> {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ input }),
  })
  if (!res.ok) return { searchQuery: input, type: null }
  return res.json()
}

async function catalogLookup(q: string, recency = false): Promise<Candidate[]> {
  const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}${recency ? '&recency=1' : ''}`, { headers: await authHeaders() })
  if (!res.ok) return []
  const { results } = await res.json()
  return Array.isArray(results) ? results : []
}

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Shrink large photos in the browser before upload. Keeps the request under the
// host's body-size limit AND speeds up identification, with no loss for recognition
// (the AI doesn't need full resolution to read a poster/cover). Re-encoding to JPEG
// also normalizes iPhone HEIC photos, the only types the AI accepts. Falls back to
// the raw file if the browser can't decode it.
async function prepareImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const MAX_EDGE = 1600
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' }
  } catch {
    return { base64: await fileToBase64(file), mimeType: file.type || 'image/png' }
  }
}

async function identifyImage(file: File, typeHint?: string | null): Promise<AiResult> {
  const { base64, mimeType } = await prepareImage(file)
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ imageBase64: base64, mimeType, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'auth_error' : 'AI request failed')
  return res.json()
}

import type { Item } from '../lib/database.types'

function LibraryTools({ items, editItem, open }: {
  items: Item[]
  editItem: (id: string, fields: Record<string, unknown>) => Promise<void>
  open: boolean
}) {
  const [backfilling, setBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState(0)
  const [backfillTotal, setBackfillTotal] = useState(0)
  const cancelRef = useRef(false)
  const [backfillConfirm, setBackfillConfirm] = useState(false)
  const [backfillFailed, setBackfillFailed] = useState<Item[]>([])
  const [backfillResult, setBackfillResult] = useState<{ ok: number; fail: number } | null>(null)

  const [rtBackfilling, setRtBackfilling] = useState(false)
  const [rtProgress, setRtProgress] = useState(0)
  const [rtTotal, setRtTotal] = useState(0)
  const rtCancelRef = useRef(false)
  const [rtConfirm, setRtConfirm] = useState(false)
  const [rtFailed, setRtFailed] = useState<Item[]>([])
  const [rtResult, setRtResult] = useState<{ ok: number; fail: number } | null>(null)

  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState(0)
  const [wikiBackfilling, setWikiBackfilling] = useState(false)
  const [wikiProgress, setWikiProgress] = useState(0)
  const [wikiTotal, setWikiTotal] = useState(0)
  const wikiCancelRef = useRef(false)

  const untagged = useMemo(() =>
    items.filter(i => (!i.tags || i.tags.length === 0) && ['film','tv','book','music'].includes(i.type)), [items])
  const needsRuntime = useMemo(() =>
    items.filter(i => {
      if (i.type === 'film' || i.type === 'tv') return !i.metadata?.runtime
      if (i.type === 'book') return !i.metadata?.pages
      return false
    }), [items])
  const needsMoodMigration = useMemo(() =>
    items.filter(i => i.moods?.some(m => m === 'gripping' || m === 'project' || m === 'easy' || m === 'classic')), [items])
  const needsWiki = useMemo(() =>
    items.filter(i => !i.metadata?.wikiUrl && ['film','tv','book','music'].includes(i.type)), [items])

  const total = untagged.length + needsRuntime.length + needsMoodMigration.length + needsWiki.length
  if (total === 0 || !open) return null

  async function runBackfill(targetItems: Item[] = untagged) {
    if (backfilling || targetItems.length === 0) return
    cancelRef.current = false
    setBackfillConfirm(false)
    setBackfillResult(null)
    setBackfilling(true)
    setBackfillProgress(0)
    setBackfillTotal(targetItems.length)
    const BATCH = 5
    const failed: Item[] = []
    let ok = 0
    for (let i = 0; i < targetItems.length; i += BATCH) {
      if (cancelRef.current) break
      await Promise.all(targetItems.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/genres', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type }) })
          if (!res.ok) { failed.push(item); return }
          const { tags } = await res.json()
          if (tags?.length > 0) { await editItem(item.id, { tags }); ok++ }
          else failed.push(item)
        } catch { failed.push(item) }
      }))
      setBackfillProgress(Math.min(i + BATCH, targetItems.length))
      if (i + BATCH < targetItems.length) await new Promise(r => setTimeout(r, 300))
    }
    setBackfilling(false)
    cancelRef.current = false
    setBackfillFailed(failed)
    setBackfillResult({ ok, fail: failed.length })
  }

  async function runRtBackfill(targetItems: Item[] = needsRuntime) {
    if (rtBackfilling || targetItems.length === 0) return
    rtCancelRef.current = false
    setRtConfirm(false)
    setRtResult(null)
    setRtBackfilling(true)
    setRtProgress(0)
    setRtTotal(targetItems.length)
    const BATCH = 5
    const failed: Item[] = []
    let ok = 0
    for (let i = 0; i < targetItems.length; i += BATCH) {
      if (rtCancelRef.current) break
      await Promise.all(targetItems.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/runtime', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type, year: item.year }) })
          if (!res.ok) { failed.push(item); return }
          const data = await res.json()
          const patch: Record<string, unknown> = { ...item.metadata }
          if (item.type === 'book' && typeof data.pages === 'number') patch.pages = data.pages
          if ((item.type === 'film' || item.type === 'tv') && typeof data.runtime === 'number') patch.runtime = data.runtime
          if (patch.pages !== item.metadata?.pages || patch.runtime !== item.metadata?.runtime) { await editItem(item.id, { metadata: patch }); ok++ }
          else ok++ // got a response, just no change needed
        } catch { failed.push(item) }
      }))
      setRtProgress(Math.min(i + BATCH, targetItems.length))
      if (i + BATCH < targetItems.length) await new Promise(r => setTimeout(r, 300))
    }
    setRtBackfilling(false)
    rtCancelRef.current = false
    setRtFailed(failed)
    setRtResult({ ok, fail: failed.length })
  }

  async function runMoodMigration() {
    if (migrating || needsMoodMigration.length === 0) return
    setMigrating(true); setMigrateProgress(0)
    for (const item of needsMoodMigration) {
      const next = (item.moods ?? []).map(m => m === 'gripping' ? 'intense' : m).filter(m => m !== 'project' && m !== 'easy' && m !== 'classic')
      const fields: Record<string, unknown> = { moods: [...new Set(next)] }
      if (item.moods?.includes('classic')) {
        const tag = item.type === 'book' ? 'classics' : 'classic'
        fields.tags = [...new Set([...(item.tags ?? []), tag])]
      }
      try { await editItem(item.id, fields) } catch { /* skip */ }
      setMigrateProgress(p => p + 1)
    }
    setMigrating(false)
  }

  async function runWikiBackfill() {
    if (wikiBackfilling || needsWiki.length === 0) return
    wikiCancelRef.current = false
    setWikiBackfilling(true); setWikiProgress(0); setWikiTotal(needsWiki.length)
    const BATCH = 6
    for (let i = 0; i < needsWiki.length; i += BATCH) {
      if (wikiCancelRef.current) break
      await Promise.all(needsWiki.slice(i, i + BATCH).map(async item => {
        try {
          const info = await fetchWikiInfo(item.type, item.title, item.creator, item.year)
          if (info.url) await editItem(item.id, { metadata: { ...item.metadata, wikiUrl: info.url, wikiThumb: info.thumbnail, wikiSummary: info.summary } })
        } catch { /* skip */ }
      }))
      setWikiProgress(Math.min(i + BATCH, needsWiki.length))
    }
    setWikiBackfilling(false); wikiCancelRef.current = false
  }

  const btnStyle = { padding: '7px 16px', borderRadius: 20, border: '1.5px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const
  const ghostBtn = { background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: '0 4px' } as const
  const warnBtn = { background: 'none', border: 'none', fontSize: 12, color: '#C00', cursor: 'pointer', padding: '0 4px', fontWeight: 600 } as const
  const cost = (n: number) => `~${n} API calls (~$${(n * 0.001).toFixed(2)})`

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {untagged.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>{untagged.length} item{untagged.length !== 1 ? 's' : ''} without genre tags</span>
          {backfilling
            ? <span style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>tagging {Math.min(backfillProgress + 5, backfillTotal)}/{backfillTotal}… <button onClick={() => { cancelRef.current = true }} style={ghostBtn}>cancel</button></span>
            : backfillResult
              ? <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
                  tagged {backfillResult.ok}
                  {backfillResult.fail > 0 && <> · <span style={{ color: '#C00' }}>{backfillResult.fail} failed</span> <button onClick={() => runBackfill(backfillFailed)} style={warnBtn}>retry {backfillResult.fail}</button></>}
                  <button onClick={() => setBackfillResult(null)} style={ghostBtn}>done</button>
                </span>
              : backfillConfirm
                ? <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                    {cost(untagged.length)} ·{' '}
                    <button onClick={() => runBackfill()} style={{ ...ghostBtn, color: '#111', fontWeight: 600 }}>run</button>
                    <button onClick={() => setBackfillConfirm(false)} style={ghostBtn}>cancel</button>
                  </span>
                : <button onClick={() => setBackfillConfirm(true)} style={btnStyle}>tag my library</button>}
        </div>
      )}
      {needsRuntime.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>{needsRuntime.length} item{needsRuntime.length !== 1 ? 's' : ''} missing runtime or pages</span>
          {rtBackfilling
            ? <span style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>filling {Math.min(rtProgress + 5, rtTotal)}/{rtTotal}… <button onClick={() => { rtCancelRef.current = true }} style={ghostBtn}>cancel</button></span>
            : rtResult
              ? <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
                  filled {rtResult.ok}
                  {rtResult.fail > 0 && <> · <span style={{ color: '#C00' }}>{rtResult.fail} failed</span> <button onClick={() => runRtBackfill(rtFailed)} style={warnBtn}>retry {rtResult.fail}</button></>}
                  <button onClick={() => setRtResult(null)} style={ghostBtn}>done</button>
                </span>
              : rtConfirm
                ? <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                    {cost(needsRuntime.length)} ·{' '}
                    <button onClick={() => runRtBackfill()} style={{ ...ghostBtn, color: '#111', fontWeight: 600 }}>run</button>
                    <button onClick={() => setRtConfirm(false)} style={ghostBtn}>cancel</button>
                  </span>
                : <button onClick={() => setRtConfirm(true)} style={btnStyle}>fill in</button>}
        </div>
      )}
      {needsMoodMigration.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#888' }}>{needsMoodMigration.length} item{needsMoodMigration.length !== 1 ? 's' : ''} use old vibe words</span>
          {migrating
            ? <span style={{ fontSize: 13, color: '#555' }}>updating {migrateProgress} of {needsMoodMigration.length}…</span>
            : <button onClick={runMoodMigration} style={btnStyle}>clean up</button>}
        </div>
      )}
      {needsWiki.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#888' }}>{needsWiki.length} item{needsWiki.length !== 1 ? 's' : ''} missing saved wiki links</span>
          {wikiBackfilling
            ? <span style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>fetching {Math.min(wikiProgress + 6, wikiTotal)}/{wikiTotal}… <button onClick={() => { wikiCancelRef.current = true }} style={ghostBtn}>cancel</button></span>
            : <button onClick={runWikiBackfill} style={btnStyle}>fill in links</button>}
        </div>
      )}
    </div>
  )
}

export function AddScreen() {
  const { addItem, items, editItem } = useItems()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiSource, setAiSource] = useState('quick add')
  const [aiQuery, setAiQuery] = useState('') // the exact text the user typed (for "use as typed")
  const typeHint = null
  const imageRef = useRef<HTMLInputElement>(null)
  const [bulkItems, setBulkItems] = useState<BulkItem[] | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [pickerCandidates, setPickerCandidates] = useState<Candidate[] | null>(null)
  const [sonnetPrompt, setSonnetPrompt] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Handle results pre-filled from iOS Shortcut via URL params
  useEffect(() => {
    const t = searchParams.get('title')
    if (!t) return
    const result: AiResult = {
      title: t,
      creator: searchParams.get('creator') ?? '',
      type: searchParams.get('type') ?? 'other',
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
      confidence: (searchParams.get('confidence') ?? 'high') as AiResult['confidence'],
      metadata: {},
      tags: [],
      ambiguous: false,
      alternatives: [],
    }
    setAiSource('photo')
    setAiResult(result)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clipboard reading is handled by the "From Shortcut" button only — no auto-read on mount

  // Handle images shared via iOS share sheet (Web Share Target)
  useEffect(() => {
    if (searchParams.get('shared') !== 'true') return
    caches.open('nospaces-share-target').then(async cache => {
      const response = await cache.match('shared-image')
      if (!response) return
      const blob = await response.blob()
      const file = new File([blob], 'shared.png', { type: blob.type || 'image/png' })
      await cache.delete('shared-image')
      processImageFile(file, 'screenshot')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop paste support (Ctrl+V / Cmd+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) processImageFile(file, 'screenshot')
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function processImageFile(file: File, source: string) {
    setError('')
    setLoading(true)
    try {
      const result = await identifyImage(file, typeHint)
      setAiSource(source)
      setAiQuery('')
      setAiResult(result)
    } catch (err) {
      setError(err instanceof Error && err.message === 'auth_error'
        ? 'Session expired — reload the app and try again.'
        : 'Could not identify from image.')
    } finally {
      setLoading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  async function processMultipleImages(files: File[]) {
    setBulkLoading(true)
    setError('')
    // Build skeleton rows immediately so the sheet can show progress
    const skeletons: BulkItem[] = files.map((file, i) => ({
      id: i,
      file,
      preview: URL.createObjectURL(file),
      result: null,
      error: false,
      checked: false,
    }))
    setBulkItems(skeletons)
    setBulkLoading(false)

    // Identify all in parallel, updating each row as it resolves
    await Promise.all(files.map(async (file, i) => {
      try {
        const result = await identifyImage(file, typeHint)
        setBulkItems(prev => prev
          ? prev.map(it => it.id === i ? { ...it, result, checked: result.confidence !== 'low' } : it)
          : prev)
      } catch {
        setBulkItems(prev => prev
          ? prev.map(it => it.id === i ? { ...it, error: true } : it)
          : prev)
      }
    }))
  }

  async function handleBulkConfirm(items: BulkItem[]) {
    for (const item of items) {
      if (!item.result) continue
      await addItem(item.result.title, item.result.type, item.result.creator, item.result.year, item.result.metadata, item.result.tags)
    }
    // Revoke object URLs to free memory
    bulkItems?.forEach(i => URL.revokeObjectURL(i.preview))
    setBulkItems(null)
    navigate('/library')
  }

  async function handleSubmit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (!title.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      // Step 1: Haiku intent parse
      const { searchQuery, type: parsedType, sortByRecency } = await describeToSearch(title.trim())

      // Step 2: Catalog lookup
      if (searchQuery.trim()) {
        const all = await catalogLookup(searchQuery.trim(), sortByRecency)
        const typed = parsedType ? all.filter(r => r.type === parsedType) : all
        const candidates = typed.length > 0 ? typed : all
        if (candidates.length > 0) {
          setPickerCandidates(candidates)
          setLoading(false)
          return
        }
      }

      // Step 3: No catalog results — prompt before using Sonnet
      setSonnetPrompt(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'auth_error') {
        setError('Session expired — reload the app and try again.')
      } else {
        setError('Could not reach AI — saved as typed.')
        await addItem(title.trim())
        setTitle('')
        navigate('/library')
      }
    } finally {
      setLoading(false)
    }
  }

  function handlePickCandidate(candidate: Candidate) {
    const result: AiResult = {
      title: candidate.title,
      creator: candidate.creator,
      type: candidate.type,
      year: candidate.year,
      confidence: 'high',
      metadata: {},
      tags: [],
      blurb: null,
      ambiguous: false,
      alternatives: [],
    }
    setPickerCandidates(null)
    setAiSource('quick add')
    setAiQuery(title.trim())
    setAiResult(result)
  }

  async function handleFallbackIdentify() {
    setPickerCandidates(null)
    setSonnetPrompt(false)
    setLoading(true)
    try {
      const result = await identifyText(title.trim(), typeHint)
      setAiSource('quick add')
      setAiQuery(title.trim())
      setAiResult(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'auth_error') {
        setError('Session expired — reload the app and try again.')
      } else {
        setError('Could not reach AI — saved as typed.')
        await addItem(title.trim())
        setTitle('')
        navigate('/library')
      }
    } finally {
      setLoading(false)
    }
  }


  async function handleConfirm(item: AiResult, done: { reaction: ItemReaction | null; note: string } | null) {
    const metadata = item.blurb ? { ...item.metadata, capturedBlurb: item.blurb } : item.metadata
    await addItem(item.title, item.type, item.creator, item.year, metadata, item.tags, done ?? undefined)
    navigator.clipboard?.writeText('').catch(() => {})
    setAiResult(null)
    setTitle('')
    navigate('/library')
  }

  async function handleSaveAsScratch() {
    // Empty box → just guide them into typing the description (the scratch text IS the title).
    if (!title.trim()) { inputRef.current?.focus(); return }
    await addItem(title.trim(), 'other', null, null, { scratch: true }, [])
    setTitle('')
    navigate('/library')
  }

  const [moreWaysOpen, setMoreWaysOpen] = useState(false)
  const [libToolsOpen, setLibToolsOpen] = useState(false)
  const hasLibraryWork = useMemo(() => {
    const untagged = items.filter(i => (!i.tags || i.tags.length === 0) && ['film','tv','book','music'].includes(i.type))
    const needsRuntime = items.filter(i => {
      if (i.type === 'film' || i.type === 'tv') return !i.metadata?.runtime
      if (i.type === 'book') return !i.metadata?.pages
      return false
    })
    const needsMoodMigration = items.filter(i => i.moods?.some(m => m === 'gripping' || m === 'project' || m === 'easy'))
    return (untagged.length + needsRuntime.length + needsMoodMigration.length) > 0
  }, [items])

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 32px', letterSpacing: '-0.2px' }}>add</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
          }}
          placeholder="a film, book, album, or show — or describe it"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px', fontSize: 16,
            border: '1px solid #E4E4E4', borderRadius: 12,
            resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
          }}
        />

        <button
          type="submit"
          disabled={!title.trim() || loading}
          style={{
            width: '100%', marginTop: 12, padding: '14px',
            background: title.trim() && !loading ? '#111111' : '#E2E2E2',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
            cursor: title.trim() && !loading ? 'pointer' : 'default',
          }}
        >
          {loading ? 'identifying…' : 'identify & save'}
        </button>

        {/* Photo — compact grey pill, clearly a different input mode */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={() => !bulkLoading && imageRef.current?.click()}
            style={{
              padding: '10px 22px', borderRadius: 24, border: 'none',
              background: '#F0F0F0', fontSize: 14, color: '#444', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <CameraIcon />
            {bulkLoading ? 'identifying…' : 'add from photos'}
          </button>
        </div>

        {!loading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveAsScratch}
              style={{ border: 'none', background: 'none', color: '#BBB', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              save as note
            </button>
          </div>
        )}

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error.toLowerCase()}</p>}

        {sonnetPrompt && !loading && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#F7F7F7', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>
              nothing found in the catalog — identify with Sonnet instead?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={handleFallbackIdentify}
                style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                identify with Sonnet
              </button>
              <button
                onClick={() => setSonnetPrompt(false)}
                style={{ padding: '8px 18px', borderRadius: 20, border: '1px solid #DDD', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </form>

      <div style={{ marginTop: 20, borderTop: '1px solid #ECEAE6', paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          <button
            onClick={() => setMoreWaysOpen(o => !o)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: 0 }}
          >
            more ways to add
          </button>
          {hasLibraryWork && (
            <button
              onClick={() => setLibToolsOpen(o => !o)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: 0 }}
            >
              library tools
            </button>
          )}
        </div>
        {moreWaysOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button type="button" onClick={() => navigate('/recommend')} style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}>find recommendations</button>
            <button type="button" onClick={() => navigate('/import')} style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}>import from Letterboxd</button>
            <button type="button" onClick={() => navigate('/spotify')} style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}>sync from Spotify</button>
          </div>
        )}
        <LibraryTools items={items} editItem={editItem} open={libToolsOpen} />
      </div>

      {/* Image input — single pick → single confirm, multi-pick → bulk confirm */}
      <input ref={imageRef} type="file" accept="image/*" multiple
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          if (files.length === 0) return
          if (files.length === 1) processImageFile(files[0], 'photo')
          else processMultipleImages(files)
          if (imageRef.current) imageRef.current.value = ''
        }}
        style={{ display: 'none' }} />

      {aiResult && (
        <ConfirmSheet
          result={aiResult}
          source={aiSource}
          query={aiQuery}
          onConfirm={handleConfirm}
          onClose={() => setAiResult(null)}
        />
      )}

      {bulkItems && (
        <BulkConfirmSheet
          items={bulkItems}
          onConfirm={handleBulkConfirm}
          onClose={() => { bulkItems.forEach(i => URL.revokeObjectURL(i.preview)); setBulkItems(null) }}
        />
      )}

      {pickerCandidates && (
        <PickerSheet
          query={title.trim()}
          candidates={pickerCandidates}
          onPick={handlePickCandidate}
          onFallback={handleFallbackIdentify}
          onClose={() => setPickerCandidates(null)}
        />
      )}
    </div>
  )
}


function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}


function PickerSheet({ query, candidates, onPick, onFallback, onClose }: {
  query: string
  candidates: Candidate[]
  onPick: (c: Candidate) => void
  onFallback: () => void
  onClose: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '20px 0 calc(env(safe-area-inset-bottom) + 24px)',
        maxHeight: '70dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #ECEAE6', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            results for "{query}"
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => onPick(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '14px 20px',
                background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                borderBottom: i < candidates.length - 1 ? '1px solid #F4F4F4' : 'none',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.3px', color: '#AAA', flexShrink: 0, width: 30 }}>{c.type === 'other' ? '' : c.type}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: '#888', marginTop: 1 }}>
                  {[c.creator, c.year].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px 0', borderTop: '1px solid #ECEAE6', flexShrink: 0, textAlign: 'center' }}>
          <button
            onClick={onFallback}
            style={{ background: 'none', border: 'none', fontSize: 13, color: '#999', cursor: 'pointer', padding: 0 }}
          >
            none of these — identify with Sonnet instead
          </button>
        </div>
      </div>
    </>
  )
}

