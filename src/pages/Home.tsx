import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { useHotItems } from '../hooks/useHotItems'
import ProductCard from '../components/ProductCard'
import {
  CATEGORY_TABS,
  filterInventoryByCategory,
  inStock,
  type CategoryTab,
} from '../utils/categoryFilter'
import { filterProductsBySearch } from '../utils/search'

const STORAGE_KEY = 'applebazaar_category'

function getStoredCategory(): CategoryTab {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (s && ['all', 'devices', 'accessories', 'screens', 'custom'].includes(s)) return s as CategoryTab
  } catch {
    /* ignore */
  }
  return 'all'
}

export default function Home() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') ?? ''
  const { products, loading, error } = useProducts()
  const { hotItemIds } = useHotItems()
  const [activeTab, setActiveTab] = useState<CategoryTab>(() => getStoredCategory())

  const selectTab = useCallback((id: CategoryTab) => {
    setActiveTab(id)
    try {
      sessionStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const inStockOnly = products.filter(inStock)
  const byCategory = filterInventoryByCategory(inStockOnly, activeTab)
  const filtered = filterProductsBySearch(byCategory, searchQuery)

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

  return (
    <>
      {hotItems.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title hot-items-title">Hot items</h2>
          <div className="product-grid hot-items-grid">
            {hotItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <h2 className="section-title">Shop inventory</h2>
      <div className="category-tabs" role="tablist">
        {CATEGORY_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-button ${activeTab === id ? 'active' : ''}`}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="product-grid">
        {filtered.length === 0 ? (
          <p style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', textAlign: 'center' }}>
            {searchQuery
              ? `No items match "${searchQuery}". Try a different search or category.`
              : 'No items in this category right now.'}
          </p>
        ) : (
          filtered.map((p) => <ProductCard key={p.id} product={p} />)
        )}
      </div>
    </>
  )
}
