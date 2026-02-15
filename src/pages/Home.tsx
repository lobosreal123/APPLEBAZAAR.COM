import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import ProductCard from '../components/ProductCard'
import {
  CATEGORY_TABS,
  filterInventoryByCategory,
  inStock,
  type CategoryTab,
} from '../utils/categoryFilter'
import { filterProductsBySearch } from '../utils/search'

const STORAGE_KEY = 'applebazaar_category'
const HERO_LINE_1 = 'Quality devices, trusted prices'
const HERO_LINE_2 = 'Shop New and pre-owned electronics with confidence.'
const TYPEWRITER_MS = 55

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
  const [activeTab, setActiveTab] = useState<CategoryTab>(() => getStoredCategory())
  const [heroLine1, setHeroLine1] = useState('')
  const [heroLine2, setHeroLine2] = useState('')
  const typewriterStarted = useRef(false)

  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typewriterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loading || products.length === 0) return
    let i1 = 0
    let i2 = 0
    const PAUSE_BEFORE_REPEAT_MS = 2200

    const runCycle = () => {
      if (typewriterStarted.current) return
      typewriterStarted.current = true
      const tick = () => {
        if (i1 < HERO_LINE_1.length) {
          setHeroLine1(HERO_LINE_1.slice(0, i1 + 1))
          i1 += 1
        } else if (i2 < HERO_LINE_2.length) {
          setHeroLine2(HERO_LINE_2.slice(0, i2 + 1))
          i2 += 1
        } else {
          if (typewriterIntervalRef.current) {
            clearInterval(typewriterIntervalRef.current)
            typewriterIntervalRef.current = null
          }
          typewriterStarted.current = false
          typewriterTimeoutRef.current = setTimeout(() => {
            typewriterTimeoutRef.current = null
            i1 = 0
            i2 = 0
            setHeroLine1('')
            setHeroLine2('')
            runCycle()
          }, PAUSE_BEFORE_REPEAT_MS)
        }
      }
      typewriterIntervalRef.current = setInterval(tick, TYPEWRITER_MS)
    }
    runCycle()
    return () => {
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current)
      if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current)
    }
  }, [loading, products.length])

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
      <section className="hero">
        <h1 className="hero-title-animated">
          {heroLine1}
          {heroLine1.length < HERO_LINE_1.length && <span className="hero-cursor" aria-hidden>|</span>}
        </h1>
        <p className="hero-subtitle-animated">
          {heroLine2}
          {heroLine2.length > 0 && heroLine2.length < HERO_LINE_2.length && <span className="hero-cursor" aria-hidden>|</span>}
        </p>
      </section>

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
