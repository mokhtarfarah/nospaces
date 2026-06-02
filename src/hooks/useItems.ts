import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Item, ItemReaction } from '../lib/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any)

export function useItems() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await db().from('items')
      .select('*')
      .eq('user_id', user.id)
      .order('date_added', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function addItem(
    title: string,
    type = 'other',
    creator: string | null = null,
    year: number | null = null,
    metadata: Record<string, unknown> = {},
    tags: string[] = [],
  ) {
    if (!user) return
    await db().from('items').insert({
      user_id: user.id,
      title,
      type,
      creator,
      year,
      metadata,
      tags,
      status: 'want_to',
      source: 'quick_add',
    })
    await fetch()
  }

  async function markDone(id: string, reaction: ItemReaction, note: string) {
    await db().from('items').update({
      status: 'done',
      reaction,
      note: note || null,
      date_done: new Date().toISOString(),
    }).eq('id', id)
    await fetch()
  }

  async function markWantTo(id: string) {
    await db().from('items').update({
      status: 'want_to',
      reaction: null,
      note: null,
      date_done: null,
    }).eq('id', id)
    await fetch()
  }

  async function deleteItem(id: string) {
    await db().from('items').delete().eq('id', id)
    await fetch()
  }

  // Count duplicate items (same type + title + creator, ignoring case/punctuation).
  function duplicateCount(): number {
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const seen = new Set<string>()
    let dupes = 0
    for (const it of items) {
      const k = `${it.type}|${norm(it.title)}|${norm(it.creator ?? '')}`
      if (seen.has(k)) dupes++
      else seen.add(k)
    }
    return dupes
  }

  // Remove duplicates, keeping the "best" of each group (done > has note/reaction >
  // earliest added). Returns how many were removed.
  async function removeDuplicates(): Promise<number> {
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const groups = new Map<string, Item[]>()
    for (const it of items) {
      const k = `${it.type}|${norm(it.title)}|${norm(it.creator ?? '')}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(it)
    }
    const score = (i: Item) => (i.status === 'done' ? 4 : 0) + (i.note ? 2 : 0) + (i.reaction ? 1 : 0)
    const toDelete: string[] = []
    for (const g of groups.values()) {
      if (g.length < 2) continue
      const keep = [...g].sort((a, b) => score(b) - score(a) || new Date(a.date_added).getTime() - new Date(b.date_added).getTime())[0]
      for (const i of g) if (i.id !== keep.id) toDelete.push(i.id)
    }
    if (!toDelete.length) return 0
    await db().from('items').delete().in('id', toDelete)
    await fetch()
    return toDelete.length
  }

  async function editItem(id: string, fields: {
    title?: string
    creator?: string | null
    type?: string
    year?: number | null
    note?: string | null
    reaction?: ItemReaction | null
    metadata?: Record<string, unknown>
  }) {
    await db().from('items').update(fields).eq('id', id)
    await fetch()
  }

  return { items, loading, addItem, markDone, markWantTo, deleteItem, editItem, duplicateCount, removeDuplicates, refetch: fetch }
}
