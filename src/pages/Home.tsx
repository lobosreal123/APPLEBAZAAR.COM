import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { useHotItems } from '../hooks/useHotItems'
import ProductCard from '../components/ProductCard'
import ShopFilters from '../components/ShopFilters'
import {
  CATEGORY_TABS,
  SUB_CATEGORIES,
  filterInventoryByCategory,
  filterBySubCategory,
  inStock,
  type CategoryTab,
} from '../utils/categoryFilter'
import { filterProductsBySearch } from '../utils/search'

const STORAGE_KEY = 'applebazaar_category'
const SUB_STORAGE_PREFIX = 'applebazaar_sub_'

function getStoredCategory(): CategoryTab {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (s && ['all', 'devices', 'accessories', 'screens', 'custom'].includes(s)) return s as CategoryTab
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

export default function Home() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') ?? ''
  const { products, loading, error } = useProducts()
  const { hotItemIds } = useHotItems()
  const [activeTab, setActiveTab] = useState<CategoryTab>(() => getStoredCategory())
  const [activeSub, setActiveSub] = useState<string | null>(() => {
    const tab = getStoredCategory()
    if (tab === 'all') return null
    return getStoredSub(tab) ?? 'all'
  })

  const pendingScrollY = useRef<number | null>(null)

  useEffect(() => {
    try {
      const y = sessionStorage.getItem('applebazaar_returnScrollY')
      if (y !== null) {
        sessionStorage.removeItem('applebazaar_returnScrollY')
        const py = parseInt(y, 10)
        if (!isNaN(py)) pendingScrollY.current = py
      }
    } catch {
      /* ignore */
    }
  }, [])

  useLayoutEffect(() => {
    if (!loading && pendingScrollY.current !== null) {
      const y = pendingScrollY.current
      pendingScrollY.current = null
      window.scrollTo(0, y)
    }
  }, [loading])

  const selectTab = useCallback((id: CategoryTab) => {
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
  }, [])

  const selectSub = useCallback((subId: string) => {
    setActiveSub(subId)
    if (activeTab !== 'all') {
      try {
        sessionStorage.setItem(SUB_STORAGE_PREFIX + activeTab, subId)
      } catch {
        /* ignore */
      }
    }
  }, [activeTab])

  const inStockOnly = products.filter(inStock)
  const byCategory = filterInventoryByCategory(inStockOnly, activeTab)
  const subTabs = activeTab !== 'all' ? SUB_CATEGORIES[activeTab] : []
  const effectiveSub = activeSub && subTabs?.some((s) => s.id === activeSub) ? activeSub : subTabs?.[0]?.id ?? null
  const bySub =
    activeTab !== 'all' && effectiveSub
      ? filterBySubCategory(byCategory, activeTab, effectiveSub)
      : byCategory
  const filtered = filterProductsBySearch(bySub, searchQuery)

  const hotItems = hotItemIds.length > 0
    ? hotItemIds
        .map((id) => inStockOnly.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .slice(0, 10)
    : inStockOnly.slice(0, 10)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading products…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--error)' }}>{error}</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>No products in inventory yet.</p>
      </div>
    )
  }

  const activeCategoryLabel =
    CATEGORY_TABS.find((t) => t.id === activeTab)?.label ?? 'All'
  const activeSubLabel =
    subTabs.find((s) => s.id === effectiveSub)?.label ?? null

  return (
    <div className="home-layout">
      <ShopFilters
        activeTab={activeTab}
        effectiveSub={effectiveSub}
        onSelectTab={selectTab}
        onSelectSub={selectSub}
      />
      <div className="home-main">
        {hotItems.length > 0 && (
          <section className="home-hot-section">
            <h2 className="section-title hot-items-title">
              <span aria-hidden>🔥</span>{' '}
              <span className="hot-items-text">Hot items</span>
            </h2>
            <div className="product-grid hot-items-grid">
              {hotItems.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  persistPosition={{ category: activeTab, sub: effectiveSub }}
                />
              ))}
            </div>
          </section>
        )}

        <header className="home-inventory-header">
          <h2 className="section-title home-inventory-title">Shop inventory</h2>
          <p className="home-inventory-active" aria-live="polite">
            Showing: <strong>{activeCategoryLabel}</strong>
            {activeSubLabel ? (
              <>
                {' '}
                · <strong>{activeSubLabel}</strong>
              </>
            ) : null}
            {searchQuery ? (
              <>
                {' '}
                · search &ldquo;{searchQuery}&rdquo;
              </>
            ) : null}
          </p>
        </header>
        <div className="product-grid">
          {filtered.length === 0 ? (
            <p className="home-empty" style={{ gridColumn: '1 / -1' }}>
              {searchQuery
                ? `No items match "${searchQuery}". Try a different search or category.`
                : 'No items in this category right now.'}
            </p>
          ) : (
            filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                persistPosition={{ category: activeTab, sub: effectiveSub }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
