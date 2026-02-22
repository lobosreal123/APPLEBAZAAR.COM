import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isValidImageUrl } from '../utils/productMapping'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { formatCedi } from '../utils/currency'

type OrderItem = { id: string; name: string; price: number; quantity: number; imageUrl?: string }
type OrderData = {
  orderNumber?: string
  items: OrderItem[]
  total: number
  currency?: string
  status: string
  paymentMethod?: string
  paymentStatus?: string
  paidAmount?: number
  createdAt: string | { toDate?: () => Date }
  customerInfo?: { name?: string; phone?: string; email?: string; address?: string }
}

type OrderRef = { ownerId: string; storeId: string; orderId: string; orderNumber: string; createdAt: string }

export default function ViewOrder() {
  const { refId } = useParams<{ refId: string }>()
  const { user, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user || !refId) {
      if (!authLoading && !user) setLoading(false)
      return
    }
    let cancelled = false
    const refDoc = doc(db, 'users', user.uid, 'orderRefs', refId)
    getDoc(refDoc)
      .then((refSnap) => {
        if (cancelled || !refSnap.exists()) {
          if (!refSnap.exists() && !cancelled) setError('Order not found.')
          return undefined
        }
        const refData = refSnap.data() as OrderRef
        const orderDoc = doc(db, 'users', refData.ownerId, 'stores', refData.storeId, 'websiteOrders', refData.orderId)
        return getDoc(orderDoc).then((orderSnap) => ({ orderSnap, refData }))
      })
      .then((result) => {
        if (cancelled || !result) return
        const { orderSnap, refData } = result
        if (!orderSnap.exists()) {
          setError('Order not found.')
          return
        }
        const d = orderSnap.data()!
        setOrder({
          orderNumber: refData.orderNumber ?? d.orderNumber,
          items: (d.items ?? []) as OrderItem[],
          total: Number(d.total ?? 0),
          currency: d.currency,
          status: String(d.status ?? 'pending'),
          paymentMethod: d.paymentMethod,
          paymentStatus: d.paymentStatus,
          paidAmount: d.paidAmount != null ? Number(d.paidAmount) : undefined,
          createdAt: d.createdAt ?? refData.createdAt,
          customerInfo: d.customerInfo,
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load order')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading, refId])

  if (authLoading || loading) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading order…</p>
  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>
        <Link to="/my-orders" className="btn-outline" style={{ display: 'inline-block', textDecoration: 'none' }}>Back to my orders</Link>
      </div>
    )
  }
  if (!order) return null

  const formatDate = (raw: OrderData['createdAt']) => {
    if (!raw) return '—'
    const d = typeof raw === 'string' ? new Date(raw) : (raw as { toDate?: () => Date }).toDate?.() ?? new Date()
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
  }

  const totalFormatted = order.currency === 'GHS' ? formatCedi(order.total) : `$${order.total.toFixed(2)}`

  return (
    <div style={{ padding: '2rem 0', maxWidth: 560 }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/my-orders" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to my orders</Link>
      </p>
      <h1 className="section-title">Order {order.orderNumber || 'details'}</h1>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Placed {formatDate(order.createdAt)}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>Status: {order.status}</p>
        {order.paymentMethod && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
            Payment: {order.paymentMethod}
            {order.paymentStatus && ` · ${order.paymentStatus}`}
            {order.paidAmount != null && order.paidAmount > 0 && ` · ${order.currency === 'GHS' ? formatCedi(order.paidAmount) : `$${order.paidAmount.toFixed(2)}`} paid`}
          </p>
        )}
      </div>
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Items</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {order.items.map((item, idx) => (
          <li
            key={`${item.id}-${idx}`}
            style={{
              padding: '0.75rem 1rem',
              borderBottom: idx < order.items.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              {item.imageUrl && isValidImageUrl(item.imageUrl) ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 6, background: 'var(--bg-subtle)', flexShrink: 0 }} aria-hidden />
              )}
              <span>{item.name} × {item.quantity}</span>
            </div>
            <span style={{ flexShrink: 0 }}>{order.currency === 'GHS' ? formatCedi(item.price * item.quantity) : `$${(item.price * item.quantity).toFixed(2)}`}</span>
          </li>
        ))}
      </ul>
      <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total: {totalFormatted}</p>
      {order.customerInfo && (order.customerInfo.name || order.customerInfo.address) && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '1.25rem 0 0.5rem' }}>Delivery</h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text)', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 8 }}>
            {order.customerInfo.name && <p style={{ margin: 0 }}>{order.customerInfo.name}</p>}
            {order.customerInfo.phone && <p style={{ margin: '0.25rem 0 0' }}>{order.customerInfo.phone}</p>}
            {order.customerInfo.address && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{order.customerInfo.address}</p>}
          </div>
        </>
      )}
    </div>
  )
}
