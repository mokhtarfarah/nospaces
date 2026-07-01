import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, authHeaders } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Item, ItemReaction } from '../lib/database.types'
import { enqueueCapture } from '../lib/offlineQueue'

// Types we keep genres for. Anything else (other) never gets auto-genred.
const GENRE_TYPES = ['film', 'tv', 'book', 'music']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any)

// Local cross-instance sync. Each screen mounts its own useItems() (e.g. the add
// sheet's instance sits over the library's), so a write in one instance doesn't
// update the others' state. Supabase realtime is the CROSS-DEVICE path, but it's
// a network round-trip that lags — and drops entirely — on the free tier, so a
// just-added item wouldn't show in the library until a manual refresh. These
// listeners give same-client immediacy: every write pings its sibling instances
// to silently refetch right away. Realtime still handles other devices/tabs.
const localWriteListeners = new Set<() => void>()
function notifyLocalWrite(except: () => void) {
  for (const fn of localWriteListeners) if (fn !== except) fn()
}

export function useItems() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  // Mirror of `items` that updates synchronously on every write. patchMetadata
  // reads from this, NOT its captured `items` closure — so two back-to-back
  // patches on the same item (e.g. taste tags then a cutout, in autoTagFromImage)
  // each merge against the previous one instead of both merging against the stale
  // pre-write snapshot, which would silently drop the first patch from the DB.
  const itemsRef = useRef<Item[]>([])
  useEffect(() => { itemsRef.current = items }, [items])

  // `silent` refetches (after edits) skip the loading flag so the list stays
  // mounted and keeps the user's scroll position.
  //
  // Depend on user?.id, NOT the whole `user` object: Supabase refreshes the
  // auth token whenever the app regains focus (e.g. returning from the Spotify
  // app), which emits a new `session` → a new `user` reference for the same
  // person. Keying on the stable id keeps `fetch` identity stable across those
  // refreshes, so the mount effect below doesn't re-run a non-silent refetch —
  // which would flash "Loading…", collapse the list and reset scroll to the top
  // on every app resume. Realtime keeps data fresh while away.
  const userId = user?.id ?? null
  const fetch = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) { setItems([]); setLoading(false); return }
    if (!opts?.silent) setLoading(true)
    const { data } = await db().from('items')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  // Register this instance for same-client write notifications (see
  // localWriteListeners above). `notifyOthers` skips this same listener so the
  // instance that made the write doesn't double-fetch — it already refetches
  // itself inline.
  const localListenerRef = useRef<() => void>(() => {})
  useEffect(() => {
    const listener = () => fetch({ silent: true })
    localListenerRef.current = listener
    localWriteListeners.add(listener)
    return () => { localWriteListeners.delete(listener) }
  }, [fetch])
  const notifyOthers = useCallback(() => notifyLocalWrite(localListenerRef.current), [])

  // A per-hook-instance suffix so two mounted useItems() (e.g. the library page
  // with the add sheet open over it) don't collide on one channel topic — Supabase
  // throws "cannot add postgres_changes callbacks after subscribe()" if a second
  // subscription reuses an already-subscribed topic. Each instance gets its own.
  const channelTag = useRef(Math.random().toString(36).slice(2))

  // Re-fetch whenever another device (or tab) writes to this user's items.
  // Keyed on the stable id (see fetch above) so a focus-driven token refresh
  // doesn't needlessly tear down and re-subscribe the channel on every resume.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`items:${userId}:${channelTag.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` }, () => {
        fetch({ silent: true })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetch])

  async function addItem(
    title: string,
    type = 'other',
    creator: string | null = null,
    year: number | null = null,
    metadata: Record<string, unknown> = {},
    tags: string[] = [],
    // Optional: log as already-done with a reaction/note in one step (skips the
    // separate mark-as-done flow for things you've already watched/read/heard).
    done?: { reaction: ItemReaction | null; note: string },
    // Optional: override the default 'quick_add' source label shown on the action card.
    source_detail?: string,
  ) {
    if (!user) return null
    if (!navigator.onLine) {
      await enqueueCapture({ title, type, creator, year, metadata, tags, done, source_detail })
      return null
    }
    const { data: inserted } = await db().from('items').insert({
      user_id: user.id,
      title,
      type,
      creator,
      year,
      metadata,
      tags,
      status: done ? 'done' : 'want_to',
      reaction: done?.reaction ?? null,
      note: done?.note?.trim() || null,
      date_done: done ? new Date().toISOString() : null,
      source: 'quick_add',
      source_detail: source_detail ?? null,
    }).select('id').single()
    await fetch()
    notifyOthers()
    // Auto-fill genres in the background when the add path didn't supply any
    // (catalog-pick, bulk photo, shortcut, save-as-typed all arrive tagless —
    // only the AI-identify path carries genres). Fire-and-forget; the realtime
    // subscription refreshes the row when it lands.
    if (inserted?.id && tags.length === 0 && GENRE_TYPES.includes(type) && title) {
      void fillGenres(inserted.id, title, creator, type)
    }
    // Auto-fill vibes too, but as PROVISIONAL guesses — stored in
    // metadata.unconfirmedVibes, never in moods, so the taste page + recommender
    // (which read moods) only ever count vibes Farah has actually confirmed. The
    // action card surfaces them for one-tap confirm. Bulk imports (Letterboxd /
    // Spotify) go through importItems, not here, so they're skipped for cost.
    if (inserted?.id && GENRE_TYPES.includes(type) && title) {
      void fillVibes(inserted.id, title, creator, type, year)
    }
    return (inserted?.id as string | undefined) ?? null
  }

  // Ask /api/vibes (Haiku, ~$0.001) for 1–3 provisional vibes and stash them on
  // metadata.unconfirmedVibes (NOT moods — they're unconfirmed guesses).
  async function fillVibes(id: string, title: string, creator: string | null, type: string, year: number | null) {
    try {
      const r = await window.fetch('/api/vibes', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ title, creator, type, year }),
      })
      if (!r.ok) return
      const data = await r.json()
      const vibes: string[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (!vibes.length) return
      // Re-fetch the row's current metadata before writing to avoid clobbering a
      // concurrent genres patch (both run in parallel; they write different columns
      // but metadata is a JSON blob so we must merge carefully).
      const { data: row } = await db().from('items').select('metadata').eq('id', id).single()
      const meta = { ...(row?.metadata ?? {}), unconfirmedVibes: vibes }
      await db().from('items').update({ metadata: meta }).eq('id', id)
      await fetch({ silent: true })
      notifyOthers()
    } catch { /* no vibes — on-open fill will retry */ }
  }

  // Ask /api/genres (Haiku, cheap) for 1–3 genres and patch them onto the row.
  async function fillGenres(id: string, title: string, creator: string | null, type: string) {
    try {
      const res = await fetch_genres(title, creator, type)
      if (res.length) {
        await db().from('items').update({ tags: res }).eq('id', id)
        await fetch({ silent: true })
        notifyOthers()
      }
    } catch { /* leave untagged — on-open fill or library-tools backfill can retry */ }
  }
  async function fetch_genres(title: string, creator: string | null, type: string): Promise<string[]> {
    const r = await window.fetch('/api/genres', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ title, creator, type }),
    })
    const data = await r.json()
    return Array.isArray(data.tags) ? data.tags : []
  }

  async function markDone(id: string, reaction: ItemReaction, note: string, moods: string[] = []) {
    const item = items.find(i => i.id === id)
    const metadata = item ? { ...item.metadata } : {}
    delete metadata.unconfirmedVibes
    const { error } = await db().from('items').update({
      status: 'done',
      reaction,
      note: note || null,
      moods,
      date_done: new Date().toISOString(),
      metadata,
    }).eq('id', id)
    if (error) throw error
    await fetch({ silent: true })
    notifyOthers()
  }

  async function markWantTo(id: string) {
    await db().from('items').update({
      status: 'want_to',
      reaction: null,
      note: null,
      date_done: null,
    }).eq('id', id)
    await fetch({ silent: true })
    notifyOthers()
  }

  async function markInProgress(id: string) {
    await db().from('items').update({
      status: 'in_progress',
      date_done: null,
    }).eq('id', id)
    await fetch({ silent: true })
    notifyOthers()
  }

  async function deleteItem(id: string) {
    await db().from('items').delete().eq('id', id)
    await fetch({ silent: true })
    notifyOthers()
  }

  // Batch-insert pre-built rows (used by the Letterboxd import). Rows arrive
  // without user_id; we stamp it on, chunk to stay under request limits, then
  // refetch once. Returns how many were inserted.
  async function importItems(rows: Record<string, unknown>[]): Promise<number> {
    if (!user || rows.length === 0) return 0
    const stamped = rows.map(r => ({ ...r, user_id: user.id }))
    const CHUNK = 500
    for (let i = 0; i < stamped.length; i += CHUNK) {
      await db().from('items').insert(stamped.slice(i, i + CHUNK))
    }
    await fetch()
    notifyOthers()
    return stamped.length
  }

  // Count duplicate items (same type + title + creator, ignoring case/punctuation).
  // Media only — things (products, plans, mood images) live in their own domain and
  // legitimately repeat titles (every mood image is titled "inspiration").
  function duplicateCount(): number {
    const norm = (s: string) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const seen = new Set<string>()
    let dupes = 0
    for (const it of items) {
      if (it.type === 'thing') continue
      const k = `${it.type}|${norm(it.title)}|${norm(it.creator ?? '')}`
      if (seen.has(k)) dupes++
      else seen.add(k)
    }
    return dupes
  }

  // Groups of suspected duplicates (same type + title + creator, ignoring
  // case/punctuation), each with 2+ members. Sorted "best first" so the review
  // sheet can pre-select a sensible item to keep (done > note > reaction > earliest).
  function duplicateGroups(): Item[][] {
    const norm = (s: string) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const groups = new Map<string, Item[]>()
    for (const it of items) {
      if (it.type === 'thing') continue
      const k = `${it.type}|${norm(it.title)}|${norm(it.creator ?? '')}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(it)
    }
    const score = (i: Item) => (i.status === 'done' ? 4 : 0) + (i.note ? 2 : 0) + (i.reaction ? 1 : 0)
    return [...groups.values()]
      .filter(g => g.length >= 2)
      .map(g => [...g].sort((a, b) => score(b) - score(a) || new Date(a.date_added).getTime() - new Date(b.date_added).getTime()))
  }

  // Delete a chosen set of items (used by the duplicates review sheet). Returns count.
  async function deleteMany(ids: string[]): Promise<number> {
    if (!ids.length) return 0
    await db().from('items').delete().in('id', ids)
    await fetch()
    notifyOthers()
    return ids.length
  }

  // Patch a subset of metadata fields and update local state immediately — no
  // full refetch, so callers like the Wikipedia cache-write don't fan out into
  // 50 round-trips when many items resolve at once.
  async function patchMetadata(id: string, patch: Record<string, unknown>) {
    const item = itemsRef.current.find(i => i.id === id)
    if (!item) return
    const newMeta = { ...item.metadata, ...patch }
    // Update the ref synchronously so a second patch in the same tick sees this one.
    itemsRef.current = itemsRef.current.map(i => i.id === id ? { ...i, metadata: newMeta } : i)
    setItems(itemsRef.current)
    await db().from('items').update({ metadata: newMeta }).eq('id', id)
    notifyOthers()
  }

  async function toggleOwned(id: string, owned: boolean) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const metadata = { ...item.metadata }
    if (owned) metadata.owned = true
    else delete metadata.owned
    await db().from('items').update({ metadata }).eq('id', id)
    await fetch({ silent: true })
    notifyOthers()
  }

  async function toggleCanon(id: string, canon: boolean) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const metadata = { ...item.metadata }
    if (canon) metadata.canon = true
    else delete metadata.canon
    await db().from('items').update({ metadata }).eq('id', id)
    await fetch({ silent: true })
    notifyOthers()
  }

  async function editItem(id: string, fields: {
    title?: string
    creator?: string | null
    type?: string
    year?: number | null
    note?: string | null
    reaction?: ItemReaction | null
    moods?: string[]
    tags?: string[]
    source_detail?: string | null
    metadata?: Record<string, unknown>
    status?: string
    date_done?: string | null
    date_added?: string
  }) {
    const { error } = await db().from('items').update(fields).eq('id', id)
    if (error) throw error
    await fetch({ silent: true })
    notifyOthers()
  }

  return { items, loading, addItem, importItems, markDone, markWantTo, markInProgress, deleteItem, editItem, toggleOwned, toggleCanon, patchMetadata, duplicateCount, duplicateGroups, deleteMany, refetch: fetch }
}
