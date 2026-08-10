import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getPosStoreConfigs, toCompositeId } from '../config'
import { getImageUrls } from '../utils/productMapping'
import { getActiveNamedPrices } from '../utils/namedPrices'
import type { Product } from '../components/ProductCard'

const CACHE_KEY = 'applebazaar_products_v1'
const CACHE_TTL_MS = 5 * 60 * 1000

type ProductsContextValue = {
  products: Product[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

/** List mapping: skip long description; keep first few images for cards. */
function mapInventoryToProduct(id: string, data: Record<string, unknown>): Product {
  const imageUrls = getImageUrls(data).slice(0, 3)
  const color = ((data.color as string) || (data.colour as string) || '').trim() || undefined
  const storage = ((data.storage as string) || (data.storageCapacity as string) || '').trim() || undefined
  const namedPrices = getActiveNamedPrices(data.namedPrices)
  const basePrice = typeof data.price === 'number' ? data.price : Number(data.price) ?? 0
  return {
    id,
    name: ((data.name as string) || (data.model as string) || '').trim() || '',
    description: '',
    price: namedPrices[0]?.price > 0 ? namedPrices[0].price : basePrice,
    namedPrices: namedPrices.length > 0 ? namedPrices : undefined,
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

function loadCachedProducts(): Product[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; products: Product[] }
    if (!parsed?.products?.length || !parsed.at) return null
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.products
  } catch {
    return null
  }
}

function saveCachedProducts(products: Product[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), products }))
  } catch {
    /* quota / private mode */
  }
}

async function fetchProductsFromFirestore(): Promise<Product[]> {
  const configs = getPosStoreConfigs()
  if (!configs.length) {
    throw new Error(
      'POS store not configured. Set VITE_POS_OWNER_UID and VITE_POS_STORE_ID (or VITE_POS_STORE_IDS) in .env'
    )
  }

  const results = await Promise.all(
    configs.map(({ ownerId, storeId }) => {
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
  )

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

  const dedupeKey = (p: Product) =>
    `${(p.name || '').toLowerCase()}|${p.price}|${p.color ?? ''}|${p.storage ?? ''}`
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
    console.log(
      '[Products] Loaded',
      raw.length,
      'raw →',
      list.length,
      'deduped from',
      configs.length,
      'store(s)'
    )
  }
  return list
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const cached = loadCachedProducts()
  const [products, setProducts] = useState<Product[]>(() => cached ?? [])
  const [loading, setLoading] = useState(() => !cached?.length)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const list = await fetchProductsFromFirestore()
      setProducts(list)
      saveCachedProducts(list)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
      if (!products.length) setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchProductsFromFirestore()
        if (cancelled) return
        setProducts(list)
        saveCachedProducts(list)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load inventory')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ products, loading, error, refresh }),
    [products, loading, error]
  )

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider')
  return ctx
}
