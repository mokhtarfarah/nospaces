import type { ItemReaction } from './database.types'

export interface QueuedCapture {
  id: string
  timestamp: number
  title: string
  type: string
  creator: string | null
  year: number | null
  metadata: Record<string, unknown>
  tags: string[]
  done?: { reaction: ItemReaction | null; note: string }
  source_detail?: string | null
}

const DB_NAME = 'nospaces-offline'
const STORE = 'capture-queue'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueCapture(item: Omit<QueuedCapture, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB()
  const record: QueuedCapture = { ...item, id: crypto.randomUUID(), timestamp: Date.now() }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllQueued(): Promise<QueuedCapture[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedCapture[])
    req.onerror = () => reject(req.error)
  })
}

export async function removeQueued(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function queuedCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
