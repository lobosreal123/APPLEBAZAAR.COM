import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCart } from '../contexts/CartContext'
import { getPosInventoryPath, parseProductId } from '../config'
import { getProductImageUrl, type Product } from '../components/ProductCard'
import { getImageUrls, isValidImageUrl } from '../utils/productMapping'
import { formatCedi } from '../utils/currency'

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

export default function ProductDetail() {
  const { id: encodedId } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set())
  const [storeNames, setStoreNames] = useState<string[]>([])
  const { addItem } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const storeLocationsFromState = (location.state as { storeLocations?: { ownerId: string; storeId: string }[] })?.storeLocations

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
            <img
              key={mainUrl}
              src={mainUrl}
              alt={product.name || 'Product'}
              onError={() => setFailedIndices((prev) => new Set(prev).add(selectedIndex))}
            />
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
                  onClick={() => setSelectedIndex(i)}
                  aria-label={`View image ${i + 1}`}
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
    </div>
  )
}
