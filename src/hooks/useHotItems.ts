import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

const HOT_ITEMS_DOC = 'publicStorewebsite'
const HOT_ITEMS_COLLECTION = 'publicStore'

/** Fetches hot/featured item IDs from Firestore (max 6). Public read. */
export function useHotItems(): { hotItemIds: string[]; loading: boolean } {
  const [hotItemIds, setHotItemIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, HOT_ITEMS_COLLECTION, HOT_ITEMS_DOC))
      .then((snap) => {
        if (cancelled) return
        const ids = (snap.data()?.hotItemIds as string[] | undefined) ?? []
        setHotItemIds(Array.isArray(ids) ? ids.slice(0, 6) : [])
      })
      .catch(() => {
        if (!cancelled) setHotItemIds([])
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
