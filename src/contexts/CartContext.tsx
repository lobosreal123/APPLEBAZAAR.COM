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
  /** POS named price option label (e.g. Retail, Wholesale). */
  priceName?: string
  /** Minimum order quantity for this price option. */
  moq?: number
}

type CartContextValue = {
  items: CartItem[]
  addItem: (
    item: Omit<CartItem, 'quantity' | 'cartLineId'> & {
      quantity?: number
      cashierNote?: string
      priceName?: string
      moq?: number
    }
  ) => void
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

const sameLine = (a: CartItem, b: { productId: string; cashierNote?: string; priceName?: string }) =>
  a.productId === b.productId &&
  (a.cashierNote || '').trim() === (b.cashierNote || '').trim() &&
  (a.priceName || '') === (b.priceName || '')

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)

  useEffect(() => {
    saveCart(items)
  }, [items])

  const addItem = useCallback(
    (
      item: Omit<CartItem, 'quantity' | 'cartLineId'> & {
        quantity?: number
        cashierNote?: string
        priceName?: string
        moq?: number
      }
    ) => {
      const moq = item.moq && item.moq > 0 ? item.moq : 1
      const qty = Math.min(Math.max(item.quantity ?? moq, moq), item.maxStock)
      if (qty < 1) return
      const note = (item.cashierNote || '').trim()
      const priceName = (item.priceName || '').trim() || undefined
      setItems((prev) => {
        const existing = prev.find((i) =>
          sameLine(i, { productId: item.productId, cashierNote: note, priceName })
        )
        if (existing) {
          const newQty = Math.min(Math.max(existing.quantity + qty, moq), item.maxStock)
          if (newQty < 1) return prev.filter((i) => i.cartLineId !== existing.cartLineId)
          return prev.map((i) =>
            i.cartLineId === existing.cartLineId
              ? {
                  ...i,
                  quantity: newQty,
                  maxStock: item.maxStock,
                  price: item.price,
                  priceName,
                  moq: item.moq,
                }
              : i
          )
        }
        return [
          ...prev,
          {
            ...item,
            cartLineId: newCartLineId(),
            quantity: qty,
            cashierNote: note || undefined,
            priceName,
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
        .map((i) => {
          if (i.cartLineId !== cartLineId) return i
          const moq = i.moq && i.moq > 0 ? i.moq : 1
          const next = Math.max(0, Math.min(quantity, i.maxStock))
          if (next > 0 && next < moq) {
            window.alert(`"${i.priceName || i.name}" requires a minimum order of ${moq}.`)
            return { ...i, quantity: moq }
          }
          return { ...i, quantity: next }
        })
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
