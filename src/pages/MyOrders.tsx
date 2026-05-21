import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { isValidImageUrl } from '../utils/productMapping'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { getFirebaseErrorCode, getFriendlyErrorMessage } from '../utils/friendlyErrors'
import {
  resolveCustomerOrder,
  type CustomerOrderSummary,
  type OrderRefData,
} from '../utils/orderRefs'

async function fetchOrderRefs(uid: string) {
  const refsCol = collection(db, 'users', uid, 'orderRefs')
  try {
    return await getDocs(refsCol)
  } catch (err) {
    if (getFirebaseErrorCode(err) === 'permission-denied' && auth.currentUser) {
      await auth.currentUser.getIdToken(true)
      return await getDocs(refsCol)
    }
    throw err
  }
}

function sortRefsNewestFirst(refs: { refId: string; refData: OrderRefData }[]) {
  return [...refs].sort((a, b) => {
    const ta = new Date(a.refData.createdAt || 0).getTime()
    const tb = new Date(b.refData.createdAt || 0).getTime()
    return tb - ta
  })
}

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      setOrders([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken()
        }

        const snap = await fetchOrderRefs(user.uid)
        if (cancelled) return

        const refs = sortRefsNewestFirst(
          snap.docs.map((refDoc) => ({
            refId: refDoc.id,
            refData: refDoc.data() as OrderRefData,
          }))
        )

        const settled = await Promise.allSettled(
          refs.map(({ refId, refData }) => resolveCustomerOrder(user.uid, refId, refData))
        )
        if (cancelled) return

        const list: CustomerOrderSummary[] = []
        for (const result of settled) {
          if (result.status === 'fulfilled' && result.value) {
            list.push(result.value.summary)
          }
        }

        setOrders(list)
        setError(null)
      } catch (err) {
        if (cancelled) return
        const code = getFirebaseErrorCode(err)
        if (code === 'permission-denied') {
          setOrders([])
          setError(null)
        } else {
          setOrders([])
          setError(getFriendlyErrorMessage(err, 'orders'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  if (loading) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading orders…</p>

  if (!user) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 className="section-title">My orders</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Please <Link to="/login">log in</Link> to view your orders.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 className="section-title">My orders</h1>
        <p style={{ color: 'var(--error)' }}>{error}</p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/">Back to shop</Link>
        </p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 className="section-title">My orders</h1>
        <p style={{ color: 'var(--text-muted)' }}>You haven’t placed any orders yet.</p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Start shopping
          </Link>
        </p>
      </div>
    )
  }

  const formatDate = (raw: string) => {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
  }

  const formatTotal = (order: CustomerOrderSummary) => {
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
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
        Click an order to view full details.
      </p>
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
              If your order is delayed, scan the code or message us at{' '}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary)', textDecoration: 'none' }}
              >
                +233 54 034 6875
              </a>
              .
            </p>
          </div>
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {orders.map((order) => (
          <li key={order.refId} style={{ marginBottom: '1rem' }}>
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
                <span>
                  {formatDate(order.createdAt)} · {formatTotal(order)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                {order.items.filter((i) => i.imageUrl && isValidImageUrl(i.imageUrl)).length > 0 ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {order.items
                      .filter((i) => i.imageUrl && isValidImageUrl(i.imageUrl))
                      .slice(0, 4)
                      .map((i, idx) => (
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
                  {order.items.length > 0
                    ? order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')
                    : 'Tap to view order details'}
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
