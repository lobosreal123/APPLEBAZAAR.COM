import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'

const LOCAL_KEY = 'applebazaar_favorites'

function readLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeLocalFavorites(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

type FavoritesContextValue = {
  favoriteIds: Set<string>
  loading: boolean
  isFavorite: (productId: string) => boolean
  toggleFavorite: (productId: string) => void
  count: number
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(readLocalFavorites()))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set(readLocalFavorites()))
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'favorites'))
        if (cancelled) return
        const fromCloud = new Set<string>()
        for (const d of snap.docs) {
          const id = (d.data()?.productId as string) || d.id
          if (id) fromCloud.add(id)
        }
        const local = readLocalFavorites()
        const merged = new Set([...fromCloud, ...local])
        setFavoriteIds(merged)
        writeLocalFavorites([...merged])

        for (const productId of local) {
          if (!fromCloud.has(productId)) {
            await setDoc(doc(db, 'users', user.uid, 'favorites', productId), {
              productId,
              addedAt: new Date().toISOString(),
            })
          }
        }
      } catch {
        if (!cancelled) setFavoriteIds(new Set(readLocalFavorites()))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const persist = useCallback(
    async (next: Set<string>, productId: string, added: boolean) => {
      writeLocalFavorites([...next])
      if (!user) return
      const ref = doc(db, 'users', user.uid, 'favorites', productId)
      try {
        if (added) {
          await setDoc(ref, { productId, addedAt: new Date().toISOString() })
        } else {
          await deleteDoc(ref)
        }
      } catch {
        /* keep local state; cloud sync may retry on next visit */
      }
    },
    [user]
  )

  const toggleFavorite = useCallback(
    (productId: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        const added = !next.has(productId)
        if (added) next.add(productId)
        else next.delete(productId)
        void persist(next, productId, added)
        return next
      })
    },
    [persist]
  )

  const isFavorite = useCallback((productId: string) => favoriteIds.has(productId), [favoriteIds])

  const value = useMemo(
    () => ({
      favoriteIds,
      loading,
      isFavorite,
      toggleFavorite,
      count: favoriteIds.size,
    }),
    [favoriteIds, loading, isFavorite, toggleFavorite]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
