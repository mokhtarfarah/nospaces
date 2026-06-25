import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { HOME_CITIES, type City } from '../lib/shows'
import type { DiscoveryResult, FeedEntry } from '../lib/feeds'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any)

interface DiscoveryCache {
  results: DiscoveryResult[]
  cachedAt: string
}

interface Prefs {
  cities?: City[]
  tasteProfile?: string
  tasteProfileGeneratedAt?: string
  thingsTaste?: string
  thingsTasteGeneratedAt?: string
  discoveryCache?: { intaste?: DiscoveryCache; divert?: DiscoveryCache }
  customFeeds?: FeedEntry[]
  dismissedDiscoverTitles?: string[]
  seenDiscoverTitles?: string[]
}

// Per-user preferences, synced across devices via the public.user_prefs table.
// Falls back to in-memory defaults until the row loads / when signed out.
export function usePrefs() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<Prefs>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setPrefs({}); setLoaded(true); return }
    const { data } = await db().from('user_prefs').select('prefs').eq('user_id', user.id).maybeSingle()
    setPrefs((data?.prefs as Prefs) ?? {})
    setLoaded(true)
  }, [user])

  useEffect(() => { load() }, [load])

  // Keep in sync if another device changes prefs.
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`user_prefs:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_prefs', filter: `user_id=eq.${user.id}` },
        () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, load])

  async function patch(next: Partial<Prefs>) {
    if (!user) return
    const merged = { ...prefs, ...next }
    setPrefs(merged) // optimistic
    await db().from('user_prefs').upsert({ user_id: user.id, prefs: merged }, { onConflict: 'user_id' })
  }

  // The user's city list — their saved one, or the built-in defaults until they
  // customise it. Once they edit, the full list is persisted.
  const cities: City[] = prefs.cities ?? HOME_CITIES

  const setCities = (next: City[]) => patch({ cities: next })

  const setTasteProfile = (profile: string) =>
    patch({ tasteProfile: profile, tasteProfileGeneratedAt: new Date().toISOString() })

  const setThingsTaste = (synthesis: string) =>
    patch({ thingsTaste: synthesis, thingsTasteGeneratedAt: new Date().toISOString() })

  const setDiscoveryCache = (mode: 'intaste' | 'divert', results: DiscoveryResult[]) =>
    patch({ discoveryCache: { ...prefs.discoveryCache, [mode]: { results, cachedAt: new Date().toISOString() } } })

  const setCustomFeeds = (feeds: FeedEntry[]) => patch({ customFeeds: feeds })

  const dismissDiscoverTitle = (title: string) => {
    const existing = prefs.dismissedDiscoverTitles ?? []
    const key = title.toLowerCase()
    if (existing.includes(key)) return
    patch({ dismissedDiscoverTitles: [...existing, key] })
  }

  const addSeenDiscoverTitles = (titles: string[]) => {
    const existing = prefs.seenDiscoverTitles ?? []
    const next = [...new Set([...existing, ...titles.map(t => t.toLowerCase())])].slice(-150)
    patch({ seenDiscoverTitles: next })
  }

  return {
    cities, setCities,
    tasteProfile: prefs.tasteProfile,
    tasteProfileGeneratedAt: prefs.tasteProfileGeneratedAt,
    setTasteProfile,
    thingsTaste: prefs.thingsTaste,
    thingsTasteGeneratedAt: prefs.thingsTasteGeneratedAt,
    setThingsTaste,
    discoveryCache: prefs.discoveryCache,
    setDiscoveryCache,
    customFeeds: prefs.customFeeds ?? [],
    setCustomFeeds,
    dismissedDiscoverTitles: prefs.dismissedDiscoverTitles ?? [],
    dismissDiscoverTitle,
    seenDiscoverTitles: prefs.seenDiscoverTitles ?? [],
    addSeenDiscoverTitles,
    prefsLoaded: loaded,
  }
}
