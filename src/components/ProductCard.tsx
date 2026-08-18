import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatCedi } from '../utils/currency'
import { isValidImageUrl } from '../utils/productMapping'
import type { NamedPrice } from '../utils/namedPrices'
import { getDisplayPrice } from '../utils/namedPrices'
import FavoriteToggle from './FavoriteToggle'
import PriceOptionsModal from './PriceOptionsModal'

const STORAGE_KEY = 'applebazaar_category'
const SUB_STORAGE_PREFIX = 'applebazaar_sub_'

export type Product = {
  id: string
  name: string
  description: string
  price: number
  /** POS named price tiers (Retail / Wholesale / etc.). */
  namedPrices?: NamedPrice[]
  /** First image URL (for cart, list). Same as imageUrls[0] when multiple images exist. */
  imageUrl?: string
  /** All image URLs for this item. Use imageUrls[0] or imageUrl for card/cart. */
  imageUrls: string[]
  stock: number
  createdAt?: { seconds: number }
  /** POS category fields for filtering (All, Devices, Accessories, Screens, Custom). */
  category?: string
  isAccessory?: boolean
  isCustomItem?: boolean
  /** Color (e.g. Black, Silver). From inventory color/storage. */
  color?: string
  /** Storage capacity (e.g. 64GB, 128GB). From inventory storage/storageCapacity. */
  storage?: string
  /** Store locations where this item exists (for deduped multi-store products). */
  storeLocations?: { ownerId: string; storeId: string }[]
}

/** First displayable image URL (from imageUrls or legacy imageUrl). Returns undefined for invalid URLs. */
export function getProductImageUrl(product: Product): string | undefined {
  const url = product.imageUrls?.length ? product.imageUrls[0] : product.imageUrl
  return url && isValidImageUrl(url) ? url : undefined
}

type ProductCardProps = {
  product: Product
  /** When provided, persists category/sub so they are restored when user returns from product detail. */
  persistPosition?: { category: string; sub: string | null }
}

export default function ProductCard({ product, persistPosition }: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const navigate = useNavigate()
  const inStock = product.stock >= 1
  const src = getProductImageUrl(product)
  const showImage = src && !imgError
  const tiers = product.namedPrices ?? []
  const fromPrice = getDisplayPrice(product.price, tiers)

  const saveScrollAndNavigate = () => {
    try {
      sessionStorage.setItem('applebazaar_returnScrollY', String(window.scrollY))
      if (persistPosition) {
        sessionStorage.setItem(STORAGE_KEY, persistPosition.category)
        if (persistPosition.sub)
          sessionStorage.setItem(SUB_STORAGE_PREFIX + persistPosition.category, persistPosition.sub)
      }
    } catch {
      /* ignore */
    }
  }

  const openPriceModal = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPriceModalOpen(true)
  }

  const goToProductWithPrice = (option: NamedPrice) => {
    try {
      sessionStorage.setItem(`applebazaar_price_${product.id}`, option.name)
    } catch {
      /* ignore */
    }
    setPriceModalOpen(false)
    saveScrollAndNavigate()
    navigate(`/product/${product.id}`, {
      state: product.storeLocations?.length
        ? { storeLocations: product.storeLocations, selectedPriceName: option.name }
        : { selectedPriceName: option.name },
    })
  }

  return (
    <>
      <Link
        to={`/product/${product.id}`}
        className="product-card"
        onClick={saveScrollAndNavigate}
        state={product.storeLocations?.length ? { storeLocations: product.storeLocations } : undefined}
      >
        <div className="product-card-image">
          <FavoriteToggle productId={product.id} className="product-card-favorite" />
          {showImage ? (
            <img
              src={src}
              alt={product.name || 'Product'}
              loading="lazy"
              decoding="async"
              onError={() => {
                if (import.meta.env.DEV)
                  console.warn('[ProductCard] Image failed to load:', product.id, src)
                setImgError(true)
              }}
            />
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No image</span>
          )}
        </div>
        <div className="product-card-body">
          <h3 className="product-card-title">{product.name || 'Product'}</h3>
          {(product.color || product.storage) && (
            <p className="product-card-specs">
              {[product.color, product.storage].filter(Boolean).join(' · ')}
            </p>
          )}
          {tiers.length > 0 ? (
            <div className="product-card-price-panels" aria-label="Price options">
              {tiers.map((tier) => (
                <button
                  key={tier.name}
                  type="button"
                  className="product-card-price-panel"
                  onClick={openPriceModal}
                  aria-label={`${tier.name} ${formatCedi(tier.price)}`}
                >
                  <span className="product-card-price-panel-name">{tier.name}</span>
                  <span className="product-card-price-panel-value">{formatCedi(tier.price)}</span>
                  {tier.moq != null && tier.moq > 0 && (
                    <span className="product-card-price-panel-moq">MOQ {tier.moq}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="product-card-price">{formatCedi(fromPrice)}</p>
          )}
          <p className={`product-card-meta ${inStock ? '' : 'out'}`}>
            {inStock ? 'In stock' : 'Out of stock'}
          </p>
        </div>
      </Link>

      <PriceOptionsModal
        open={priceModalOpen}
        productName={product.name || 'Product'}
        options={tiers}
        confirmLabel="Select & view"
        onConfirm={goToProductWithPrice}
        onClose={() => setPriceModalOpen(false)}
      />
    </>
  )
}
