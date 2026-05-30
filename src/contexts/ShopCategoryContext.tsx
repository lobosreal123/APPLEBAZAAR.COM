import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  SUB_CATEGORIES,
  type CategoryTab,
} from '../utils/categoryFilter'

const STORAGE_KEY = 'applebazaar_category'
const SUB_STORAGE_PREFIX = 'applebazaar_sub_'

function getStoredCategory(): CategoryTab {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (s && ['all', 'devices', 'accessories', 'screens', 'custom', 'iphone-box'].includes(s))
      return s as CategoryTab
  } catch {
    /* ignore */
  }
  return 'all'
}

function getStoredSub(mainTab: Exclude<CategoryTab, 'all'>): string | null {
  try {
    const s = sessionStorage.getItem(SUB_STORAGE_PREFIX + mainTab)
    const subs = SUB_CATEGORIES[mainTab]
    if (s && subs?.some((sub) => sub.id === s)) return s
  } catch {
    /* ignore */
  }
  return null
}

type ShopCategoryContextValue = {
  activeTab: CategoryTab
  activeSub: string | null
  effectiveSub: string | null
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  toggleDrawer: () => void
  selectTab: (id: CategoryTab) => void
  selectSub: (id: string) => void
}

const ShopCategoryContext = createContext<ShopCategoryContextValue | null>(null)

export function ShopCategoryProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<CategoryTab>(() => getStoredCategory())
  const [activeSub, setActiveSub] = useState<string | null>(() => {
    const tab = getStoredCategory()
    if (tab === 'all') return null
    return getStoredSub(tab) ?? 'all'
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  const subTabs = activeTab !== 'all' ? SUB_CATEGORIES[activeTab] : []
  const effectiveSub =
    activeSub && subTabs?.some((s) => s.id === activeSub) ? activeSub : subTabs?.[0]?.id ?? null

  const goToShop = useCallback(() => {
    if (location.pathname === '/') return
    const q = searchParams.get('q')
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }, [location.pathname, navigate, searchParams])

  const selectTab = useCallback(
    (id: CategoryTab) => {
      setActiveTab(id)
      if (id === 'all') {
        setActiveSub(null)
      } else {
        setActiveSub('all')
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, id)
      } catch {
        /* ignore */
      }
      goToShop()
    },
    [goToShop]
  )

  const selectSub = useCallback(
    (subId: string) => {
      setActiveSub(subId)
      if (activeTab !== 'all') {
        try {
          sessionStorage.setItem(SUB_STORAGE_PREFIX + activeTab, subId)
        } catch {
          /* ignore */
        }
      }
      goToShop()
    },
    [activeTab, goToShop]
  )

  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), [])

  const value = useMemo(
    () => ({
      activeTab,
      activeSub,
      effectiveSub,
      drawerOpen,
      setDrawerOpen,
      toggleDrawer,
      selectTab,
      selectSub,
    }),
    [activeTab, activeSub, effectiveSub, drawerOpen, selectTab, selectSub, toggleDrawer]
  )

  return (
    <ShopCategoryContext.Provider value={value}>{children}</ShopCategoryContext.Provider>
  )
}

export function useShopCategory(): ShopCategoryContextValue {
  const ctx = useContext(ShopCategoryContext)
  if (!ctx) throw new Error('useShopCategory must be used within ShopCategoryProvider')
  return ctx
}
