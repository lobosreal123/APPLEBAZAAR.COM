import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCedi } from '../utils/currency'

export type Product = {
  id: string
  name: string
  description: string
  price: number
  /** First image URL (for cart, list). Same as imageUrls[0] when multiple images exist. */
  imageUrl?: string
  /** All image URLs for this item. Use imageUrls[0] or imageUrl for card/cart. */
  imageUrls: string[]
  stock: number
  createdAt?: { seconds: number }
  /** POS category fields for filtering (All, Phones, Accessories, Screens, Custom). */
  category?: string
  isAccessory?: boolean
  isCustomItem?: boolean
}

/** First displayable image URL (from imageUrls or legacy imageUrl). */
export function getProductImageUrl(product: Product): string | undefined {
  if (product.imageUrls?.length) return product.imageUrls[0]
  return product.imageUrl
}

export default function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false)
  const inStock = product.stock >= 1
  const src = getProductImageUrl(product)
  const showImage = src && !imgError

  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-card-image">
        {showImage ? (
          <img
            src={src}
            alt={product.name || 'Product'}
            onLoad={() => {
              if (import.meta.env.DEV) console.log('[ProductCard] Image loaded:', product.id)
            }}
            onError={() => {
              if (import.meta.env.DEV) console.warn('[ProductCard] Image failed to load:', product.id, src)
              setImgError(true)
            }}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No image</span>
        )}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.name || 'Product'}</h3>
        <p className="product-card-price">{formatCedi(product.price)}</p>
        <p className={`product-card-meta ${inStock ? '' : 'out'}`}>
          {inStock ? 'In stock' : 'Out of stock'}
        </p>
      </div>
    </Link>
  )
}
