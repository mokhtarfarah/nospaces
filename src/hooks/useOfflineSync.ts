import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { getAllQueued, removeQueued, queuedCount } from '../lib/offlineQueue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any)

export type SyncStatus = 'idle' | 'syncing' | 'synced'

export function useOfflineSync() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')

  const refreshCount = useCallback(async () => {
    const n = await queuedCount()
    setPendingCount(n)
  }, [])

  useEffect(() => { refreshCount() }, [refreshCount])

  const flush = useCallback(async () => {
    if (!user) return
    const queued = await getAllQueued()
    if (!queued.length) return

    setSyncStatus('syncing')
    for (const item of queued) {
      try {
        await db().from('items').insert({
          user_id: user.id,
          title: item.title,
          type: item.type,
          creator: item.creator,
          year: item.year,
          metadata: item.metadata,
          tags: item.tags,
          status: item.done ? 'done' : 'want_to',
          reaction: item.done?.reaction ?? null,
          note: item.done?.note?.trim() || null,
          date_done: item.done ? new Date(item.timestamp).toISOString() : null,
          source: 'quick_add',
          source_detail: item.source_detail ?? null,
        })
        await removeQueued(item.id)
      } catch {
        // Leave in queue — retry next time we come online
      }
    }
    await refreshCount()
    setSyncStatus('synced')
    setTimeout(() => setSyncStatus('idle'), 2500)
  }, [user, refreshCount])

  useEffect(() => {
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

  return { pendingCount, syncStatus, refreshCount }
}
