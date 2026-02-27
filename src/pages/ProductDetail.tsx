import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCart } from '../contexts/CartContext'
import { useProducts } from '../hooks/useProducts'
import { getPosInventoryPath, parseProductId } from '../config'
import { getProductImageUrl, type Product } from '../components/ProductCard'
import { getImageUrls, isValidImageUrl } from '../utils/productMapping'
import { formatCedi } from '../utils/currency'
import ImageLightbox from '../components/ImageLightbox'
import { getItemDisplayCategory } from '../utils/categoryFilter'

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

const SIMILAR_LIMIT = 6

/** First token of name as model (e.g. "16" from "16 camera", "XR" from "XR screen"). */
function getModelFromName(name: string): string {
  const token = (name || '').trim().split(/\s+/)[0]
  return token || ''
}

export default function ProductDetail() {
  const { id: encodedId } = useParams<{ id: string }>()
  const { products } = useProducts()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set())
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [storeNames, setStoreNames] = useState<string[]>([])
  const { addItem } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const storeLocationsFromState = (location.state as { storeLocations?: { ownerId: string; storeId: string }[] })?.storeLocations

  const similarItems = useMemo(() => {
    if (!product || !products.length) return []
    const currentCat = getItemDisplayCategory(product)
    if (!currentCat) return []
    const model = getModelFromName(product.name)
    const sameCategory = products.filter(
      (p) => p.id !== product.id && p.stock >= 1 && getItemDisplayCategory(p) === currentCat
    )
    if (!model) return sameCategory.slice(0, SIMILAR_LIMIT)
    const nameLower = (n: string) => (n || '').toLowerCase()
    const modelLower = model.toLowerCase()
    sameCategory.sort((a, b) => {
      const aMatch = nameLower(a.name).includes(modelLower) ? 0 : 1
      const bMatch = nameLower(b.name).includes(modelLower) ? 0 : 1
      return aMatch - bMatch
    })
    return sameCategory.slice(0, SIMILAR_LIMIT)
  }, [product, products])

  useEffect(() => {
    if (!encodedId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const parsed = parseProductId(encodedId)
    if (parsed) {
      const { ownerId, storeId, docId } = parsed
      setStoreNames([])
      const invPromise = getDoc(doc(db, 'users', ownerId, 'stores', storeId, 'inventory', docId))
      const locsToFetch = storeLocationsFromState ?? [{ ownerId, storeId }]
      const uniqueOwnerIds = [...new Set(locsToFetch.map((l) => l.ownerId))]
      invPromise
        .then((snap) => {
          if (cancelled) return
          if (snap.exists()) {
            setProduct(mapInventoryToProduct(encodedId, snap.data()))
          } else {
            setError('Product not found')
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      Promise.all(uniqueOwnerIds.map((uid) => getDoc(doc(db, 'users', uid))))
        .then((snaps) => {
          if (!cancelled) {
            const names = snaps
              .filter((s) => s.exists())
              .map((s) => (s.data()?.storeName as string) || '')
              .filter(Boolean)
            const unique = [...new Set(names)]
            setStoreNames(unique)
          }
        })
        .catch(() => { /* ignore */ })
    } else {
      const path = getPosInventoryPath()
      if (!path.length) {
        setError('POS store not configured.')
        setLoading(false)
        return
      }
      const [users, ownerId, stores, storeId, inventory] = path
      setStoreNames([])
      const invPromise = getDoc(doc(db, users, ownerId, stores, storeId, inventory, encodedId))
      const locsToFetch = storeLocationsFromState ?? [{ ownerId, storeId }]
      const uniqueOwnerIds = [...new Set(locsToFetch.map((l) => l.ownerId))]
      invPromise
        .then((snap) => {
          if (cancelled) return
          if (snap.exists()) {
            setProduct(mapInventoryToProduct(snap.id, snap.data()))
          } else {
            setError('Product not found')
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      Promise.all(uniqueOwnerIds.map((uid) => getDoc(doc(db, users, uid))))
        .then((snaps) => {
          if (!cancelled) {
            const names = snaps
              .filter((s) => s.exists())
              .map((s) => (s.data()?.storeName as string) || '')
              .filter(Boolean)
            const unique = [...new Set(names)]
            setStoreNames(unique)
          }
        })
        .catch(() => { /* ignore */ })
    }
    return () => {
      cancelled = true
    }
  }, [encodedId, storeLocationsFromState])

  useEffect(() => {
    setSelectedIndex(0)
    setFailedIndices(new Set())
  }, [product?.id])

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <button type="button" className="product-detail-back" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', display: 'inline-block', background: 'none', border: 'none' }}>
          ← Back
        </button>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }
  if (error || !product) {
    return (
      <div style={{ padding: '2rem' }}>
        <button type="button" className="product-detail-back" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', display: 'inline-block', background: 'none', border: 'none' }}>
          ← Back
        </button>
        <p style={{ color: 'var(--error)' }}>{error ?? 'Not found'}</p>
      </div>
    )
  }

  const inStock = product.stock >= 1

  const handleAddToCart = () => {
    if (!inStock) return
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: getProductImageUrl(product),
      maxStock: product.stock,
      quantity: 1,
    })
  }

  const raw = product.imageUrls?.length ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : [])
  const urls = raw.filter((u): u is string => typeof u === 'string' && isValidImageUrl(u))
  const mainUrl = urls[selectedIndex]
  const mainFailed = mainUrl && failedIndices.has(selectedIndex)

  return (
    <div className="product-detail">
      <button
        type="button"
        className="product-detail-back"
        onClick={() => navigate(-1)}
        aria-label="Back to shop"
      >
        ← Back
      </button>
      {inStock && storeNames.length > 0 && (
        <p className="product-detail-store">
          SHOP: {storeNames.length === 1 ? storeNames[0] : storeNames.join(' · ')}
        </p>
      )}
      <div className="product-detail-gallery">
        <div className="product-detail-image">
          {mainUrl && !mainFailed ? (
            <button
              type="button"
              className="image-lightbox-trigger"
              onClick={() => setLightboxOpen(true)}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', width: '100%', display: 'block' }}
              aria-label="View image full screen"
            >
              <img
                key={mainUrl}
                src={mainUrl}
                alt={product.name || 'Product'}
                onError={() => setFailedIndices((prev) => new Set(prev).add(selectedIndex))}
              />
            </button>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>No image</span>
          )}
        </div>
        {urls.length > 1 && (
          <div className="product-detail-thumbnails">
            {urls.map((url, i) => {
              if (failedIndices.has(i)) return null
              return (
                <button
                  key={`${i}-${url.slice(0, 40)}`}
                  type="button"
                  className={`product-detail-thumb ${selectedIndex === i ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedIndex(i)
                    setLightboxOpen(true)
                  }}
                  aria-label={`View image ${i + 1} full screen`}
                >
                  <img src={url} alt="" onError={() => setFailedIndices((prev) => new Set(prev).add(i))} />
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="product-detail-info">
        <h1>{product.name}</h1>
        {(product.color || product.storage) && (
          <p className="product-detail-specs">
            {[product.color, product.storage].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="product-detail-price">{formatCedi(product.price)}</p>
        {product.description && <p className="product-detail-desc">{product.description}</p>}
        <p className="product-detail-stock">
          {inStock ? (
            <span style={{ color: 'var(--success)' }}>In stock</span>
          ) : (
            <span style={{ color: 'var(--error)' }}>Out of stock</span>
          )}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={handleAddToCart}
          disabled={!inStock}
        >
          {inStock ? 'Add to cart' : 'Out of stock'}
        </button>
      </div>

      {lightboxOpen && urls.length > 0 && (
        <ImageLightbox
          imageUrls={urls}
          initialIndex={selectedIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {similarItems.length > 0 && (
        <section className="product-detail-similar" aria-label="Similar items">
          <h2 className="product-detail-similar-title">Similar items</h2>
          <div className="product-detail-similar-list">
            {similarItems.map((p) => {
              const imgUrl = getProductImageUrl(p)
              return (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="product-detail-similar-item"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('applebazaar_returnScrollY', String(window.scrollY))
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <div className="product-detail-similar-img">
                    {imgUrl && isValidImageUrl(imgUrl) ? (
                      <img src={imgUrl} alt="" />
                    ) : (
                      <span className="product-detail-similar-noimg">No image</span>
                    )}
                  </div>
                  <span className="product-detail-similar-name" title={p.name}>
                    {p.name}
                  </span>
                  <span className="product-detail-similar-price">{formatCedi(p.price)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
