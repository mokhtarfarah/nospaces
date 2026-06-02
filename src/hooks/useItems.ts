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

  async function editItem(id: string, fields: {
    title?: string
    creator?: string | null
    type?: string
    year?: number | null
    note?: string | null
    reaction?: ItemReaction | null
  }) {
    await db().from('items').update(fields).eq('id', id)
    await fetch()
  }

  return { items, loading, addItem, markDone, markWantTo, deleteItem, editItem, refetch: fetch }
}
