import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isValidImageUrl } from '../utils/productMapping'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { getFriendlyErrorMessage } from '../utils/friendlyErrors'
import { formatCedi } from '../utils/currency'
import type { CashierPaymentDetails } from '../utils/cashierPayment'
import { resolveCustomerOrder, type OrderRefData } from '../utils/orderRefs'

type OrderItem = {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  cashierNote?: string
}
type OrderData = {
  orderNumber?: string
  items: OrderItem[]
  total: number
  currency?: string
  status: string
  paymentMethod?: string
  paymentStatus?: string
  paidAmount?: number
  paymentReference?: string
  paymentSenderName?: string
  amountSentByCustomer?: number
  cashierPaymentDetails?: CashierPaymentDetails
  createdAt: string | { toDate?: () => Date }
  customerInfo?: { name?: string; phone?: string; email?: string; address?: string }
}

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
      .then(async (refSnap) => {
        if (cancelled) return
        if (!refSnap.exists()) {
          setError('This order was removed or is no longer available.')
          return
        }
        const refData = refSnap.data() as OrderRefData
        const resolved = await resolveCustomerOrder(user.uid, refId, refData)
        if (cancelled) return
        if (!resolved) {
          setError('This order was removed or is no longer available.')
          return
        }
        const { summary, websiteOrder: d } = resolved
        setOrder({
          orderNumber: summary.orderNumber,
          items: summary.items as OrderItem[],
          total: summary.total,
          currency: summary.currency,
          status: summary.status,
          paymentMethod: d.paymentMethod as string | undefined,
          paymentStatus: d.paymentStatus as string | undefined,
          paidAmount: d.paidAmount != null ? Number(d.paidAmount) : undefined,
          paymentReference: d.paymentReference as string | undefined,
          paymentSenderName: d.paymentSenderName as string | undefined,
          amountSentByCustomer:
            d.amountSentByCustomer != null ? Number(d.amountSentByCustomer) : undefined,
          cashierPaymentDetails: d.cashierPaymentDetails as CashierPaymentDetails | undefined,
          createdAt: summary.createdAt,
          customerInfo: d.customerInfo as OrderData['customerInfo'],
        })
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err, 'general'))
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
      </div>
      {(order.cashierPaymentDetails?.summaryLines?.length || order.paymentMethod) && (
        <section className="order-payment-cashier" aria-label="Payment details for cashier">
          <h2 className="order-payment-cashier-title">Payment details (for cashier)</h2>
          {order.cashierPaymentDetails?.summaryLines?.length ? (
            <ul className="order-payment-cashier-list">
              {order.cashierPaymentDetails.summaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="order-payment-cashier-fallback">
              {order.paymentMethod && <p>Method: {order.paymentMethod}</p>}
              {order.paymentStatus && <p>Status: {order.paymentStatus}</p>}
              {order.paidAmount != null && order.paidAmount > 0 && (
                <p>Amount paid: {order.currency === 'GHS' ? formatCedi(order.paidAmount) : order.paidAmount}</p>
              )}
              {order.paymentReference && <p>Reference: {order.paymentReference}</p>}
              {order.paymentSenderName && <p>Sender: {order.paymentSenderName}</p>}
              {order.amountSentByCustomer != null && order.amountSentByCustomer > 0 && (
                <p>Total sent: {formatCedi(order.amountSentByCustomer)}</p>
              )}
            </div>
          )}
        </section>
      )}
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
              <span>
                {item.name} × {item.quantity}
                {item.cashierNote && (
                  <span className="order-cashier-note">
                    <span className="order-cashier-note-label">Note for cashier:</span> {item.cashierNote}
                  </span>
                )}
              </span>
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
