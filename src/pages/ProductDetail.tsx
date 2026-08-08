import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSwipe } from '../hooks/useSwipe'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCart } from '../contexts/CartContext'
import { useCartFly } from '../contexts/CartFlyContext'
import { useProducts } from '../hooks/useProducts'
import { getPosInventoryPath, parseProductId } from '../config'
import { getProductImageUrl, type Product } from '../components/ProductCard'
import { getImageUrls, isValidImageUrl } from '../utils/productMapping'
import { formatCedi } from '../utils/currency'
import ImageLightbox from '../components/ImageLightbox'
import AddToCartPreferenceModal from '../components/AddToCartPreferenceModal'
import FavoriteToggle from '../components/FavoriteToggle'
import { getItemDisplayCategory } from '../utils/categoryFilter'
import { getActiveNamedPrices } from '../utils/namedPrices'

function mapInventoryToProduct(id: string, data: Record<string, unknown>): Product {
  const imageUrls = getImageUrls(data)
  const color = ((data.color as string) || (data.colour as string) || '').trim() || undefined
  const storage = ((data.storage as string) || (data.storageCapacity as string) || '').trim() || undefined
  const namedPrices = getActiveNamedPrices(data.namedPrices)
  const basePrice = typeof data.price === 'number' ? data.price : Number(data.price) ?? 0
  return {
    id,
    name: ((data.name as string) || (data.model as string) || '').trim() || '',
    description: (data.description as string) ?? '',
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
  const [preferenceModalOpen, setPreferenceModalOpen] = useState(false)
  const [selectedPriceName, setSelectedPriceName] = useState<string | null>(null)
  const [storeNames, setStoreNames] = useState<string[]>([])
  const { addItem } = useCart()
  const { playFlyToCart } = useCartFly()
  const flySourceRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const storeLocationsFromState = (location.state as { storeLocations?: { ownerId: string; storeId: string }[] })?.storeLocations

  const priceOptions = product?.namedPrices ?? []
  const selectedTier = priceOptions.find((t) => t.name === selectedPriceName) ?? priceOptions[0]
  const unitPrice = selectedTier?.price ?? product?.price ?? 0

  useEffect(() => {
    if (!product) return
    const tiers = product.namedPrices ?? []
    if (tiers.length === 0) {
      setSelectedPriceName(null)
      return
    }
    setSelectedPriceName((prev) =>
      prev && tiers.some((t) => t.name === prev) ? prev : tiers[0].name
    )
  }, [product?.id, product?.namedPrices])

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

  const raw = product
    ? product.imageUrls?.length
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : []
    : []
  const urls = raw.filter((u): u is string => typeof u === 'string' && isValidImageUrl(u))

  const goPrevImage = useCallback(() => {
    if (urls.length <= 1) return
    setSelectedIndex((i) => {
      let next = i <= 0 ? urls.length - 1 : i - 1
      while (failedIndices.has(next) && next !== i) {
        next = next <= 0 ? urls.length - 1 : next - 1
      }
      return next
    })
  }, [urls.length, failedIndices])

  const goNextImage = useCallback(() => {
    if (urls.length <= 1) return
    setSelectedIndex((i) => {
      let next = i >= urls.length - 1 ? 0 : i + 1
      while (failedIndices.has(next) && next !== i) {
        next = next >= urls.length - 1 ? 0 : next + 1
      }
      return next
    })
  }, [urls.length, failedIndices])

  const gallerySwipe = useSwipe(goNextImage, goPrevImage)

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

  const handleAddToCartClick = () => {
    if (!inStock) return
    setPreferenceModalOpen(true)
  }

  const handlePreferenceConfirm = (cashierNote: string | null) => {
    if (!product || !inStock) return
    const moq = selectedTier?.moq && selectedTier.moq > 0 ? selectedTier.moq : 1
    if (moq > product.stock) {
      window.alert(
        `"${selectedTier?.name ?? 'This price'}" requires a minimum of ${moq}, but only ${product.stock} are in stock.`
      )
      return
    }
    playFlyToCart(flySourceRef.current, getProductImageUrl(product))
    addItem({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      priceName: selectedTier?.name,
      moq: selectedTier?.moq,
      imageUrl: getProductImageUrl(product),
      maxStock: product.stock,
      quantity: moq,
      cashierNote: cashierNote ?? undefined,
    })
    setPreferenceModalOpen(false)
  }

  const mainUrl = urls[selectedIndex]
  const mainFailed = mainUrl && failedIndices.has(selectedIndex)
  const validCount = urls.filter((_, i) => !failedIndices.has(i)).length

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
        <div
          ref={flySourceRef}
          className="product-detail-image"
          onTouchStart={urls.length > 1 ? gallerySwipe.onTouchStart : undefined}
          onTouchEnd={urls.length > 1 ? gallerySwipe.onTouchEnd : undefined}
        >
          {mainUrl && !mainFailed ? (
            <>
              <button
                type="button"
                className="image-lightbox-trigger"
                onClick={() => {
                  if (gallerySwipe.consumeClick()) return
                  setLightboxOpen(true)
                }}
                aria-label="View image full screen"
              >
                <img
                  key={mainUrl}
                  src={mainUrl}
                  alt={product.name || 'Product'}
                  draggable={false}
                  onError={() => setFailedIndices((prev) => new Set(prev).add(selectedIndex))}
                />
              </button>
              {urls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="product-detail-gallery-nav product-detail-gallery-prev"
                    aria-label="Previous image"
                    onClick={(e) => {
                      e.stopPropagation()
                      goPrevImage()
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="product-detail-gallery-nav product-detail-gallery-next"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation()
                      goNextImage()
                    }}
                  >
                    ›
                  </button>
                  <span className="product-detail-gallery-counter" aria-live="polite">
                    {selectedIndex + 1} / {validCount || urls.length}
                  </span>
                  <span className="product-detail-swipe-hint">Swipe to browse photos</span>
                </>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>No image</span>
          )}
        </div>
        {urls.length > 1 && (
          <div className="product-detail-thumbnails" role="tablist" aria-label="Product images">
            {urls.map((url, i) => {
              if (failedIndices.has(i)) return null
              return (
                <button
                  key={`${i}-${url.slice(0, 40)}`}
                  type="button"
                  role="tab"
                  className={`product-detail-thumb ${selectedIndex === i ? 'active' : ''}`}
                  onClick={() => setSelectedIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-selected={selectedIndex === i}
                >
                  <img src={url} alt="" draggable={false} onError={() => setFailedIndices((prev) => new Set(prev).add(i))} />
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="product-detail-info">
        <div className="product-detail-title-row">
          <h1>{product.name}</h1>
          <FavoriteToggle productId={product.id} size="md" />
        </div>
        {(product.color || product.storage) && (
          <p className="product-detail-specs">
            {[product.color, product.storage].filter(Boolean).join(' · ')}
          </p>
        )}
        {priceOptions.length > 0 ? (
          <div className="product-detail-price-options" role="radiogroup" aria-label="Price options">
            <p className="product-detail-price-options-label">Price options</p>
            {priceOptions.map((tier) => {
              const selected = (selectedPriceName ?? priceOptions[0]?.name) === tier.name
              return (
                <label
                  key={tier.name}
                  className={`product-detail-price-option ${selected ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="price-option"
                    value={tier.name}
                    checked={selected}
                    onChange={() => setSelectedPriceName(tier.name)}
                  />
                  <span className="product-detail-price-option-name">{tier.name}</span>
                  <span className="product-detail-price-option-value">{formatCedi(tier.price)}</span>
                  {tier.moq != null && tier.moq > 0 && (
                    <span className="product-detail-price-option-moq">MOQ {tier.moq}</span>
                  )}
                </label>
              )
            })}
          </div>
        ) : (
          <p className="product-detail-price">{formatCedi(product.price)}</p>
        )}
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
          onClick={handleAddToCartClick}
          disabled={!inStock}
        >
          {inStock
            ? selectedTier?.moq && selectedTier.moq > 1
              ? `Add ${selectedTier.moq}+ to cart`
              : 'Add to cart'
            : 'Out of stock'}
        </button>
      </div>

      <AddToCartPreferenceModal
        open={preferenceModalOpen}
        productName={product.name || 'Product'}
        listedSpecs={[product.color, product.storage].filter(Boolean).join(' · ') || undefined}
        onConfirm={handlePreferenceConfirm}
        onClose={() => setPreferenceModalOpen(false)}
      />

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
                  <span className="product-detail-similar-price">
                    {p.namedPrices && p.namedPrices.length > 0
                      ? p.namedPrices.map((t) => `${t.name} ${formatCedi(t.price)}`).join(' · ')
                      : formatCedi(p.price)}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
