import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useProducts } from '../hooks/useProducts'
import { getImageUrls, isValidImageUrl } from '../utils/productMapping'
import ImageLightbox from '../components/ImageLightbox'
import { filterInventoryByCategory, type CategoryTab } from '../utils/categoryFilter'
import { filterProductsBySearch } from '../utils/search'

const HOT_ITEMS_ADMIN_EMAIL = 'brains494@icloud.com'

export default function Admin() {
  const { user } = useAuth()
  const { products } = useProducts()
  const [error, setError] = useState<string | null>(null)
  const [hotItemIds, setHotItemIds] = useState<string[]>([])
  const [hotItemsLoading, setHotItemsLoading] = useState(false)
  const [hotItemsSaving, setHotItemsSaving] = useState(false)
  const [hotItemsCategory, setHotItemsCategory] = useState<CategoryTab>('all')
  const [hotItemsSearch, setHotItemsSearch] = useState('')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const canEditHotItems = user?.email?.toLowerCase() === HOT_ITEMS_ADMIN_EMAIL.toLowerCase()

  useEffect(() => {
    if (!canEditHotItems) return
    setHotItemsLoading(true)
    getDoc(doc(db, 'publicStore', 'publicStorewebsite'))
      .then((snap) => {
        const ids = (snap.data()?.hotItemIds as string[] | undefined) ?? []
        setHotItemIds(Array.isArray(ids) ? ids.slice(0, 10) : [])
      })
      .catch(() => setHotItemIds([]))
      .finally(() => setHotItemsLoading(false))
  }, [canEditHotItems])

  /* Automatically remove hot items that have no stock and persist to Firestore */
  useEffect(() => {
    if (!canEditHotItems || hotItemIds.length === 0 || products.length === 0) return
    const inStockIds = new Set(products.filter((p) => p.stock >= 1).map((p) => p.id))
    const filtered = hotItemIds.filter((id) => inStockIds.has(id))
    if (filtered.length === hotItemIds.length) return
    setHotItemIds(filtered)
    const docRef = doc(db, 'publicStore', 'publicStorewebsite')
    getDoc(docRef)
      .then((snap) => {
        const existing = snap.exists() ? snap.data() : {}
        return setDoc(docRef, { ...existing, hotItemIds: filtered }, { merge: true })
      })
      .catch(() => {})
  }, [canEditHotItems, hotItemIds, products])

  const toggleHotItem = (productId: string) => {
    setHotItemIds((prev) => {
      const idx = prev.indexOf(productId)
      if (idx >= 0) return prev.filter((id) => id !== productId)
      if (prev.length >= 10) return prev
      return [...prev, productId]
    })
  }

  const saveHotItems = async () => {
    setHotItemsSaving(true)
    setError(null)
    try {
      const docRef = doc(db, 'publicStore', 'publicStorewebsite')
      const snap = await getDoc(docRef)
      const existing = snap.exists() ? snap.data() : {}
      await setDoc(docRef, { ...existing, hotItemIds }, { merge: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save hot items')
    } finally {
      setHotItemsSaving(false)
    }
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to shop</Link>
      </p>
      <h1 className="section-title">Admin</h1>

      <section aria-label="Admin" style={{ marginTop: '1.5rem' }}>
        {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}

        {canEditHotItems && (
          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Hot items (10 featured on homepage)</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Select up to 10 products to feature in the Hot items grid. These appear at the top of the homepage.
            </p>
            {hotItemsLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Category:</span>
                  {(['all', 'devices', 'accessories', 'screens', 'custom'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setHotItemsCategory(cat)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        border: hotItemsCategory === cat ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 6,
                        background: hotItemsCategory === cat ? 'var(--accent-light)' : 'var(--bg-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      {cat === 'all' ? 'All' : cat === 'custom' ? 'Custom items' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                  <input
                    type="search"
                    placeholder="Search by name…"
                    value={hotItemsSearch}
                    onChange={(e) => setHotItemsSearch(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 160,
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.9rem',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}
                    aria-label="Search products"
                  />
                </div>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  Selected: {hotItemIds.length} / 10
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {filterProductsBySearch(
                    filterInventoryByCategory(
                      products.filter((p) => p.stock >= 1),
                      hotItemsCategory
                    ),
                    hotItemsSearch
                  ).map((p) => {
                    const selected = hotItemIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleHotItem(p.id)}
                        style={{
                          padding: '0.75rem',
                          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          borderRadius: 8,
                          background: selected ? 'var(--accent-light)' : 'var(--bg-subtle)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
{p.imageUrl && isValidImageUrl(p.imageUrl) && (
                        <button
                          type="button"
                          className="image-lightbox-trigger"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxImage(p.imageUrl!)
                          }}
                          style={{ padding: 0, border: 'none', background: 'none', flexShrink: 0 }}
                          aria-label="View image full screen"
                        >
                          <img src={p.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                        </button>
                        )}
                        <span style={{ flex: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        {selected && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setHotItemIds([])}
                    disabled={hotItemIds.length === 0 || hotItemsSaving}
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveHotItems}
                    disabled={hotItemsSaving}
                  >
                    {hotItemsSaving ? 'Saving…' : 'Save hot items'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {!canEditHotItems && (
          <p style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to manage hot items.</p>
        )}
      </section>

      {lightboxImage && (
        <ImageLightbox imageUrls={[lightboxImage]} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  )
}
