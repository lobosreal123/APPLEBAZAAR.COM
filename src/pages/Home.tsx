import { useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { useHotItems } from '../hooks/useHotItems'
import { useShopCategory } from '../contexts/ShopCategoryContext'
import { useFavorites } from '../contexts/FavoritesContext'
import ProductCard from '../components/ProductCard'
import {
  CATEGORY_TABS,
  SUB_CATEGORIES,
  filterInventoryByCategory,
  filterBySubCategory,
  inStock,
} from '../utils/categoryFilter'
import { filterProductsBySearch } from '../utils/search'

export default function Home() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') ?? ''
  const favoritesOnly = searchParams.get('view') === 'favorites'
  const { products, loading, error } = useProducts()
  const { hotItemIds } = useHotItems()
  const { activeTab, effectiveSub } = useShopCategory()
  const { favoriteIds, count: favoritesCount } = useFavorites()

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

  const inStockOnly = products.filter(inStock)
  const byCategory = filterInventoryByCategory(inStockOnly, activeTab)
  const subTabs = activeTab !== 'all' ? SUB_CATEGORIES[activeTab] : []
  const bySub =
    activeTab !== 'all' && effectiveSub
      ? filterBySubCategory(byCategory, activeTab, effectiveSub)
      : byCategory
  const filtered = filterProductsBySearch(bySub, searchQuery)

  const favoriteProducts = useMemo(() => {
    const saved = inStockOnly.filter((p) => favoriteIds.has(p.id))
    return filterProductsBySearch(saved, searchQuery).sort((a, b) => a.name.localeCompare(b.name))
  }, [inStockOnly, favoriteIds, searchQuery])

  const displayProducts = favoritesOnly ? favoriteProducts : filtered

  const hotItems = hotItemIds.length > 0
    ? hotItemIds
        .map((id) => inStockOnly.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .slice(0, 10)
    : inStockOnly.slice(0, 10)

  if (loading) {
    return (
      <div className="home-layout">
        <div className="home-main">
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading products…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-layout">
        <div className="home-main">
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--error)' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="home-layout">
        <div className="home-main">
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No products in inventory yet.
          </p>
        </div>
      </div>
    )
  }

  const activeCategoryLabel =
    CATEGORY_TABS.find((t) => t.id === activeTab)?.label ?? 'All'
  const activeSubLabel =
    subTabs.find((s) => s.id === effectiveSub)?.label ?? null

  return (
    <div className="home-layout">
      <div className="home-main">
        {!favoritesOnly && (
          <div className="shop-atmosphere" aria-hidden="true">
            <span className="shop-atmosphere-orb shop-atmosphere-orb-a" />
            <span className="shop-atmosphere-orb shop-atmosphere-orb-b" />
          </div>
        )}
        {activeTab === 'all' && !favoritesOnly && hotItems.length > 0 && (
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
          <h2 className="section-title home-inventory-title">
            {favoritesOnly ? 'Your favorites' : 'Shop inventory'}
          </h2>
          {favoritesOnly && (
            <p style={{ marginBottom: '0.75rem' }}>
              <Link to="/" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
                ← Back to full shop
              </Link>
            </p>
          )}
          <p className="home-inventory-active" aria-live="polite">
            {favoritesOnly ? (
              <>
                Showing <strong>{favoriteProducts.length}</strong> saved item
                {favoriteProducts.length === 1 ? '' : 's'}
                {searchQuery ? (
                  <>
                    {' '}
                    · search &ldquo;{searchQuery}&rdquo;
                  </>
                ) : null}
              </>
            ) : (
              <>
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
              </>
            )}
          </p>
        </header>
        <div className={`product-grid${favoritesOnly ? ' favorites-grid' : ''}`}>
          {displayProducts.length === 0 ? (
            <p className="home-empty" style={{ gridColumn: '1 / -1' }}>
              {favoritesOnly
                ? favoritesCount === 0
                  ? 'You have not saved any favorites yet. Tap ♡ on a product to save it here.'
                  : searchQuery
                    ? `No favorites match "${searchQuery}".`
                    : 'Your saved favorites are out of stock or no longer available.'
                : searchQuery
                ? `No items match "${searchQuery}". Try a different search or category.`
                : 'No items in this category right now.'}
            </p>
          ) : (
            displayProducts.map((p) => (
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
