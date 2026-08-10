import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

const HOT_ITEMS_DOC = 'publicStorewebsite'
const HOT_ITEMS_COLLECTION = 'publicStore'
const CACHE_KEY = 'applebazaar_hot_items_v1'
const CACHE_TTL_MS = 5 * 60 * 1000

function loadCachedIds(): string[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; ids: string[] }
    if (!parsed?.at || !Array.isArray(parsed.ids)) return null
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.ids
  } catch {
    return null
  }
}

/** Fetches hot/featured item IDs from Firestore (max 10). Public read. */
export function useHotItems(): { hotItemIds: string[]; loading: boolean } {
  const cached = loadCachedIds()
  const [hotItemIds, setHotItemIds] = useState<string[]>(() => cached ?? [])
  const [loading, setLoading] = useState(() => !cached)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, HOT_ITEMS_COLLECTION, HOT_ITEMS_DOC))
      .then((snap) => {
        if (cancelled) return
        const ids = (snap.data()?.hotItemIds as string[] | undefined) ?? []
        const next = Array.isArray(ids) ? ids.slice(0, 10) : []
        setHotItemIds(next)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), ids: next }))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled && !cached) setHotItemIds([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { hotItemIds, loading }
}
