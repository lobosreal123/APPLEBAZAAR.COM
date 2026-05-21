import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type OrderLineItem = {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  cashierNote?: string
}

export type OrderRefData = {
  ownerId: string
  storeId: string
  orderId: string
  orderNumber?: string
  createdAt: string
  status?: string
  total?: number
  currency?: string
  items?: OrderLineItem[]
  paymentMethod?: string
  paymentStatus?: string
  paidAmount?: number
}

export type CustomerOrderSummary = {
  id: string
  refId: string
  orderNumber?: string
  items: OrderLineItem[]
  total: number
  currency?: string
  status: string
  createdAt: string
}

export type ResolvedCustomerOrder = {
  summary: CustomerOrderSummary
  /** Live websiteOrders document (for order detail page). */
  websiteOrder: Record<string, unknown>
}

/** Load live order from websiteOrders; remove stale orderRef if the store deleted the order. */
export async function resolveCustomerOrder(
  customerUid: string,
  refId: string,
  refData: OrderRefData
): Promise<ResolvedCustomerOrder | null> {
  const { ownerId, storeId, orderId } = refData
  if (!ownerId || !storeId || !orderId) return null

  const orderDoc = doc(db, 'users', ownerId, 'stores', storeId, 'websiteOrders', orderId)
  const orderSnap = await getDoc(orderDoc)

  if (!orderSnap.exists()) {
    try {
      await deleteDoc(doc(db, 'users', customerUid, 'orderRefs', refId))
    } catch {
      /* ignore cleanup errors */
    }
    return null
  }

  const d = orderSnap.data()!
  const summary: CustomerOrderSummary = {
    id: orderSnap.id,
    refId,
    orderNumber: (refData.orderNumber ?? d.orderNumber) as string | undefined,
    items: (d.items ?? refData.items ?? []) as OrderLineItem[],
    total: Number(d.total ?? refData.total ?? 0),
    currency: (d.currency ?? refData.currency) as string | undefined,
    status: String(d.status ?? refData.status ?? 'pending'),
    createdAt: String(d.createdAt ?? refData.createdAt ?? new Date().toISOString()),
  }

  return { summary, websiteOrder: d }
}
