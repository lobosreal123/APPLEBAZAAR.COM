import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { newCartLineId } from '../utils/cartLineId'

export type CartItem = {
  cartLineId: string
  productId: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  maxStock: number
  /** Customer preference shown to cashier (e.g. color). */
  cashierNote?: string
}

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity' | 'cartLineId'> & { quantity?: number; cashierNote?: string }) => void
  removeItem: (cartLineId: string) => void
  updateQuantity: (cartLineId: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  subtotal: number
}

const CART_STORAGE_KEY = 'applebazaar-cart'

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((row: CartItem, idx: number) => ({
      ...row,
      cartLineId: row.cartLineId || `${row.productId}-${idx}`,
    }))
  } catch {
    return []
  }
}

const saveCart = (items: CartItem[]) => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)

  useEffect(() => {
    saveCart(items)
  }, [items])

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity' | 'cartLineId'> & { quantity?: number; cashierNote?: string }) => {
      const qty = Math.min(item.quantity ?? 1, item.maxStock)
      if (qty < 1) return
      const note = (item.cashierNote || '').trim()
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.productId === item.productId && (i.cashierNote || '').trim() === note
        )
        if (existing) {
          const newQty = Math.min(existing.quantity + qty, item.maxStock)
          if (newQty < 1) return prev.filter((i) => i.cartLineId !== existing.cartLineId)
          return prev.map((i) =>
            i.cartLineId === existing.cartLineId
              ? { ...i, quantity: newQty, maxStock: item.maxStock }
              : i
          )
        }
        const cashierNote = note || undefined
        return [
          ...prev,
          {
            ...item,
            cartLineId: newCartLineId(),
            quantity: qty,
            cashierNote,
          },
        ]
      })
    },
    []
  )

  const removeItem = useCallback((cartLineId: string) => {
    setItems((prev) => prev.filter((i) => i.cartLineId !== cartLineId))
  }, [])

  const updateQuantity = useCallback((cartLineId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.cartLineId === cartLineId
            ? { ...i, quantity: Math.max(0, Math.min(quantity, i.maxStock)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const value: CartContextValue = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    subtotal,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
