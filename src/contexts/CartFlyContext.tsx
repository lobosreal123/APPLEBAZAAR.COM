import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import CartFlyLayer, { type CartFlyParticle } from '../components/CartFlyLayer'

export const HEADER_CART_ID = 'header-cart-btn'

type CartFlyContextValue = {
  playFlyToCart: (sourceEl: HTMLElement | null, imageUrl?: string) => void
  cartBump: boolean
}

const CartFlyContext = createContext<CartFlyContextValue | null>(null)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function CartFlyProvider({ children }: { children: ReactNode }) {
  const [flies, setFlies] = useState<CartFlyParticle[]>([])
  const [cartBump, setCartBump] = useState(false)

  const bumpCart = useCallback(() => {
    setCartBump(true)
    window.setTimeout(() => setCartBump(false), 480)
  }, [])

  const playFlyToCart = useCallback(
    (sourceEl: HTMLElement | null, imageUrl?: string) => {
      const cartEl = document.getElementById(HEADER_CART_ID)
      if (!cartEl) {
        bumpCart()
        return
      }

      if (prefersReducedMotion()) {
        bumpCart()
        return
      }

      const from = sourceEl?.getBoundingClientRect()
      const to = cartEl.getBoundingClientRect()
      if (!from || from.width < 1 || from.height < 1) {
        bumpCart()
        return
      }

      const startX = from.left + from.width / 2
      const startY = from.top + from.height / 2
      const endX = to.left + to.width / 2
      const endY = to.top + to.height / 2

      setFlies((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          startX,
          startY,
          deltaX: endX - startX,
          deltaY: endY - startY,
          imageUrl,
        },
      ])
    },
    [bumpCart]
  )

  const handleFlyEnd = useCallback(
    (id: string) => {
      setFlies((prev) => prev.filter((f) => f.id !== id))
      bumpCart()
    },
    [bumpCart]
  )

  return (
    <CartFlyContext.Provider value={{ playFlyToCart, cartBump }}>
      {children}
      <CartFlyLayer flies={flies} onFlyEnd={handleFlyEnd} />
    </CartFlyContext.Provider>
  )
}

export function useCartFly() {
  const ctx = useContext(CartFlyContext)
  if (!ctx) throw new Error('useCartFly must be used within CartFlyProvider')
  return ctx
}
