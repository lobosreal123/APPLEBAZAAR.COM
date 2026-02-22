import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getPosStoreConfigs, toCompositeId } from '../config'
import { getImageUrls } from '../utils/productMapping'
import type { Product } from '../components/ProductCard'

/** Map POS inventory doc to website Product. id can be doc id (single store) or composite ownerId|storeId|docId. */
function mapInventoryToProduct(id: string, data: Record<string, unknown>): Product {
  const imageUrls = getImageUrls(data)
  const color = ((data.color as string) || (data.colour as string) || '').trim() || undefined
  const storage = ((data.storage as string) || (data.storageCapacity as string) || '').trim() || undefined
  return {
    id,
    name: ((data.name as string) || (data.model as string) || '').trim() || '',
    description: (data.description as string) ?? '',
    price: typeof data.price === 'number' ? data.price : Number(data.price) ?? 0,
    imageUrl: imageUrls[0] || undefined,
    imageUrls,
    stock: typeof data.stock === 'number' ? data.stock : Number(data.stock) ?? 0,
    createdAt: data.createdAt as { seconds: number } | undefined,
    category: (data.category as string) ?? undefined,
    isAccessory: data.isAccessory === true,
    isCustomItem: data.isCustomItem === true,
    color: color || undefined,
    storage: storage || undefined,
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const configs = getPosStoreConfigs()

    if (!configs.length) {
      setError('POS store not configured. Set VITE_POS_OWNER_UID and VITE_POS_STORE_ID (or VITE_POS_STORE_IDS) in .env')
      setLoading(false)
      return
    }

    const fetchAll = configs.map(({ ownerId, storeId }) => {
      const coll = collection(db, 'users', ownerId, 'stores', storeId, 'inventory')
      return getDocs(query(coll, where('stock', '>=', 1))).then((snap) =>
        snap.docs.map((d) => ({
          ownerId,
          storeId,
          docId: d.id,
          data: d.data(),
        }))
      )
    })

    Promise.all(fetchAll)
      .then((results) => {
        if (cancelled) return
        const useCompositeId = configs.length > 1
        const raw: Product[] = []
        for (const docs of results) {
          for (const { ownerId, storeId, docId, data } of docs) {
            const id = useCompositeId ? toCompositeId(ownerId, storeId, docId) : docId
            const p = mapInventoryToProduct(id, data)
            p.storeLocations = [{ ownerId, storeId }]
            raw.push(p)
          }
        }
        const dedupeKey = (p: Product) => `${(p.name || '').toLowerCase()}|${p.price}|${p.color ?? ''}|${p.storage ?? ''}`
        const byKey = new Map<string, Product>()
        for (const p of raw) {
          const key = dedupeKey(p)
          const existing = byKey.get(key)
          if (existing) {
            existing.stock += p.stock
            const locs = existing.storeLocations ?? []
            const loc = p.storeLocations![0]
            const seen = new Set(locs.map((l) => `${l.ownerId}|${l.storeId}`))
            if (!seen.has(`${loc.ownerId}|${loc.storeId}`)) locs.push(loc)
            if (p.imageUrls?.length && !existing.imageUrls?.length) {
              existing.imageUrls = p.imageUrls
              existing.imageUrl = p.imageUrl
            }
          } else {
            byKey.set(key, { ...p })
          }
        }
        const list = Array.from(byKey.values())
        if (import.meta.env.DEV) {
          const withImage = list.filter((p) => p.imageUrls?.length)
          console.log('[useProducts] Loaded', raw.length, 'raw →', list.length, 'deduped from', configs.length, 'store(s),', withImage.length, 'with image(s)')
        }
        setProducts(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inventory')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { products, loading, error }
}
