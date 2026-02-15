import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, query, getDocs, getDoc, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

type OrderItem = { id: string; name: string; price: number; quantity: number; imageUrl?: string }
type Order = {
  id: string
  refId: string
  orderNumber?: string
  items: OrderItem[]
  total: number
  currency?: string
  status: string
  createdAt: string | { toDate?: () => Date } | Date
}

type OrderRef = { ownerId: string; storeId: string; orderId: string; orderNumber: string; createdAt: string }

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      setOrders([])
      return
    }
    let cancelled = false
    setError(null)
    const refsCol = collection(db, 'users', user.uid, 'orderRefs')
    const q = query(refsCol, orderBy('createdAt', 'desc'))
    getDocs(q)
      .then(async (snap) => {
        if (cancelled) return
        const refs = snap.docs.map((refDoc) => ({ refDoc, refData: refDoc.data() as OrderRef }))
        const orderPromises = refs.map(({ refDoc, refData }) => {
          const orderDoc = doc(db, 'users', refData.ownerId, 'stores', refData.storeId, 'websiteOrders', refData.orderId)
          return getDoc(orderDoc).then((orderSnap) => ({ orderSnap, refData, refId: refDoc.id }))
        })
        const results = await Promise.all(orderPromises)
        const list: Order[] = []
        for (const { orderSnap, refData, refId } of results) {
          try {
            if (orderSnap.exists()) {
              const d = orderSnap.data()
              list.push({
                id: orderSnap.id,
                refId,
                orderNumber: refData.orderNumber ?? d?.orderNumber,
                items: (d?.items ?? []) as OrderItem[],
                total: Number(d?.total ?? 0),
                currency: d?.currency,
                status: String(d?.status ?? 'pending'),
                createdAt: d?.createdAt ?? refData.createdAt,
              })
            }
          } catch {
            // Skip orders that fail (e.g. permission or deleted)
          }
        }
        if (!cancelled) setOrders(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load orders')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  if (loading) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading orders…</p>
  if (error) return <p style={{ color: 'var(--error)', padding: '2rem' }}>{error}</p>

  if (orders.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 className="section-title">My orders</h1>
        <p style={{ color: 'var(--text-muted)' }}>You haven’t placed any orders yet.</p>
      </div>
    )
  }

  const formatDate = (raw: Order['createdAt']) => {
    if (!raw) return '—'
    const d = typeof raw === 'string'
      ? new Date(raw)
      : raw && typeof (raw as { toDate?: () => Date }).toDate === 'function'
        ? (raw as { toDate: () => Date }).toDate()
        : new Date(raw as Date)
    return d.toLocaleDateString()
  }

  const formatTotal = (order: Order) => {
    const sym = order.currency === 'GHS' ? 'GH₵' : '$'
    return `${sym}${order.total.toFixed(2)}`
  }

  const hasPendingOrders = orders.some((o) => String(o.status).toLowerCase() === 'pending')
  const whatsappNumber = '233540346875'
  const whatsappUrl = `https://wa.me/${whatsappNumber}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(whatsappUrl)}`

  return (
    <div style={{ padding: '2rem 0' }}>
      <h1 className="section-title">My orders</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>Click an order to view full details.</p>
      {hasPendingOrders && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <img src={qrCodeUrl} alt="WhatsApp contact QR" width={80} height={80} style={{ borderRadius: 6 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Contact support on WhatsApp</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              If your order is delayed, scan the code or message us at <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>+233 54 034 6875</a>.
            </p>
          </div>
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {orders.map((order) => (
          <li key={order.id} style={{ marginBottom: '1rem' }}>
            <Link
              to={`/my-orders/view/${order.refId}`}
              style={{
                display: 'block',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'box-shadow 0.2s, border-color 0.2s',
              }}
              className="order-card-link"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong>{order.orderNumber || `Order ${order.id.slice(0, 8)}…`}</strong>
                <span>{formatDate(order.createdAt)} · {formatTotal(order)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {order.items.filter((i) => i.imageUrl).length > 0 ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {order.items.filter((i) => i.imageUrl).slice(0, 4).map((i, idx) => (
                      <img
                        key={`${i.id}-${idx}`}
                        src={i.imageUrl}
                        alt=""
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                      />
                    ))}
                  </div>
                ) : null}
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', flex: 1 }}>
                  {order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                </p>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>Status: {order.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
