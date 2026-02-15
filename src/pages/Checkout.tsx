import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { getPosStoreConfigs, parseProductId } from '../config'
import { formatCedi } from '../utils/currency'

const formStyle: React.CSSProperties = {
  maxWidth: 480,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

const CURRENCY = 'GHS'

const MOBILE_MONEY_NUMBER = '0544874507'
const MOBILE_MONEY_NAME = 'Lobos iOS Unlocking Ventures or Ibrahim Mohammed'

/** Group cart items by store (ownerId, storeId). Returns map keyed by "ownerId|storeId". */
function groupItemsByStore(
  items: { productId: string; name: string; price: number; quantity: number; imageUrl?: string }[]
) {
  const configs = getPosStoreConfigs()
  const firstStore = configs[0]
  const groups = new Map<string, { ownerId: string; storeId: string; items: { id: string; name: string; price: number; quantity: number; imageUrl?: string }[]; total: number }>()

  for (const item of items) {
    const parsed = parseProductId(item.productId)
    const ownerId = parsed ? parsed.ownerId : firstStore?.ownerId ?? ''
    const storeId = parsed ? parsed.storeId : firstStore?.storeId ?? ''
    const docId = parsed ? parsed.docId : item.productId
    const key = `${ownerId}|${storeId}`
    if (!ownerId || !storeId) continue
    const existing = groups.get(key)
    const line = { id: docId, name: item.name, price: item.price, quantity: item.quantity, imageUrl: item.imageUrl }
    const lineTotal = item.price * item.quantity
    if (existing) {
      existing.items.push(line)
      existing.total += lineTotal
    } else {
      groups.set(key, { ownerId, storeId, items: [line], total: lineTotal })
    }
  }
  return Array.from(groups.values())
}

export default function Checkout() {
  const { user } = useAuth()
  const { items, subtotal, clearCart } = useCart()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    country: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'Mobile Money' | 'Cash'>('Mobile Money')
  const [mobileMoney, setMobileMoney] = useState({
    paymentReference: '',
    senderName: '',
    amountSent: '',
  })
  const [confirmPartialPayment, setConfirmPartialPayment] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }
  const handleMobileMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setMobileMoney((prev) => ({ ...prev, [name]: value }))
    setConfirmPartialPayment(false)
  }

  const validateMobileMoneyPayment = (): { ok: boolean; amountSent: number; isPartial: boolean; message: string } => {
    const ref = (mobileMoney.paymentReference || '').trim()
    const name = (mobileMoney.senderName || '').trim()
    const raw = (mobileMoney.amountSent || '').trim().replace(/,/g, '')
    const amountSent = parseFloat(raw)
    if (!ref) return { ok: false, amountSent: 0, isPartial: false, message: 'Payment reference is required.' }
    if (!name) return { ok: false, amountSent: 0, isPartial: false, message: 'Sender name is required.' }
    if (raw === '' || isNaN(amountSent) || amountSent <= 0) return { ok: false, amountSent: 0, isPartial: false, message: 'Please enter a valid amount sent.' }
    const rounded = Math.round(amountSent * 100) / 100
    if (rounded >= subtotal) return { ok: true, amountSent: rounded, isPartial: false, message: 'Full amount entered. Order will be confirmed once payment is verified.' }
    const balance = Math.round((subtotal - rounded) * 100) / 100
    return {
      ok: true,
      amountSent: rounded,
      isPartial: true,
      message: `You have sent a partial amount (${formatCedi(rounded)}). Please pay the balance of ${formatCedi(balance)} at the shop or send the full amount before your order can be delivered.`,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || items.length === 0) return
    setError('')

    if (paymentMethod === 'Mobile Money') {
      const validation = validateMobileMoneyPayment()
      if (!validation.ok) {
        setError(validation.message)
        return
      }
      if (validation.isPartial && !confirmPartialPayment) {
        setError(validation.message + ' Please tick the agreement box below to place order.')
        if (typeof window !== 'undefined') {
          window.alert('Partial payment: please tick the agreement box to confirm you will pay the balance at the shop or send the full amount before your order can be delivered.')
        }
        return
      }
    }

    setSubmitting(true)
    try {
      const baseOrderNumber = `#WW-${Date.now()}`
      const addressParts = [form.address, form.city, form.country].filter(Boolean)
      const addressStr = addressParts.length ? addressParts.join(', ') : ''
      const customerInfo: Record<string, string> = {
        name: form.fullName.trim(),
      }
      const phone = (form.phone || '').trim()
      if (phone) customerInfo.phone = phone
      if (user.email) customerInfo.email = user.email
      if (addressStr) customerInfo.address = addressStr

      const storeOrders = groupItemsByStore(items)
      if (storeOrders.length === 0) {
        setError('Could not assign items to a store. Please try again.')
        setSubmitting(false)
        return
      }

      let amountSentTotal = 0
      if (paymentMethod === 'Mobile Money') {
        const v = validateMobileMoneyPayment()
        amountSentTotal = v.amountSent
      }

      for (let i = 0; i < storeOrders.length; i++) {
        const { ownerId, storeId, items: storeItems, total } = storeOrders[i]
        const orderNumber = storeOrders.length > 1 ? `${baseOrderNumber}-${i + 1}` : baseOrderNumber
        const orderTotal = Math.round(total * 100) / 100
        const orderRatio = storeOrders.length === 1 ? 1 : orderTotal / subtotal
        const paidAmount = storeOrders.length === 1
          ? amountSentTotal
          : Math.round(amountSentTotal * orderRatio * 100) / 100
        const isFullPayment = paidAmount >= orderTotal
        const orderPayload: Record<string, unknown> = {
          status: 'pending',
          items: storeItems.map((it) => ({
            id: it.id,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            ...(it.imageUrl && { imageUrl: it.imageUrl }),
          })),
          total: orderTotal,
          currency: CURRENCY,
          customerInfo,
          orderNumber,
          createdAt: new Date().toISOString(),
          customerId: user.uid,
          paymentMethod,
          paymentStatus: paymentMethod === 'Cash' ? 'unpaid' : (isFullPayment ? 'paid' : 'partial'),
          paidAmount: paymentMethod === 'Cash' ? 0 : paidAmount,
        }
        if (user.email) orderPayload.customerEmail = user.email
        if (paymentMethod === 'Mobile Money') {
          orderPayload.paymentReference = (mobileMoney.paymentReference || '').trim()
          orderPayload.paymentSenderName = (mobileMoney.senderName || '').trim()
        }
        const ordersRef = collection(db, 'users', ownerId, 'stores', storeId, 'websiteOrders')
        const docRef = await addDoc(ordersRef, orderPayload)
        const customerOrderRefs = collection(db, 'users', user.uid, 'orderRefs')
        await addDoc(customerOrderRefs, {
          ownerId,
          storeId,
          orderId: docRef.id,
          orderNumber,
          createdAt: new Date().toISOString(),
        })
      }

      clearCart()
      navigate('/order-confirmation', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0 && !submitting) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Your cart is empty.</p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>Continue shopping</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      <h1 className="section-title">Checkout</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
        <form style={formStyle} onSubmit={handleSubmit}>
          {error && <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>}
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Contact & delivery</h2>
          <label>
            Full name
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Optional"
              style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <label>
            Address
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <label>
            City
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <label>
            Country
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              required
              style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <h2 style={{ fontSize: '1.1rem', margin: '1.25rem 0 0.5rem' }}>Payment</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="paymentMethod"
                value="Mobile Money"
                checked={paymentMethod === 'Mobile Money'}
                onChange={() => setPaymentMethod('Mobile Money')}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>Mobile Money</strong>
                {paymentMethod === 'Mobile Money' && (
                  <>
                    <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Number: <strong style={{ color: 'var(--text)' }}>{MOBILE_MONEY_NUMBER}</strong>
                      <br />
                      Name on account: {MOBILE_MONEY_NAME}
                    </span>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ display: 'block' }}>
                        Payment reference <span style={{ color: 'var(--error)' }}>*</span>
                        <input
                          type="text"
                          name="paymentReference"
                          value={mobileMoney.paymentReference}
                          onChange={handleMobileMoneyChange}
                          placeholder="e.g. transaction ID"
                          required={paymentMethod === 'Mobile Money'}
                          style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                        />
                      </label>
                      <label style={{ display: 'block' }}>
                        Sender name <span style={{ color: 'var(--error)' }}>*</span>
                        <input
                          type="text"
                          name="senderName"
                          value={mobileMoney.senderName}
                          onChange={handleMobileMoneyChange}
                          placeholder="Name on Mobile Money account that sent payment"
                          required={paymentMethod === 'Mobile Money'}
                          style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                        />
                      </label>
                      <label style={{ display: 'block' }}>
                        Amount sent (cedis) <span style={{ color: 'var(--error)' }}>*</span>
                        <input
                          type="number"
                          name="amountSent"
                          value={mobileMoney.amountSent}
                          onChange={handleMobileMoneyChange}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()
                          }}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required={paymentMethod === 'Mobile Money'}
                          className="amount-sent-input"
                          style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                        />
                      </label>
                      {paymentMethod === 'Mobile Money' && mobileMoney.amountSent && (() => {
                        const v = validateMobileMoneyPayment()
                        if (!v.ok) return null
                        const balance = Math.round((subtotal - v.amountSent) * 100) / 100
                        return (
                          <>
                            <p style={{ fontSize: '0.9rem', margin: 0, color: v.isPartial ? 'var(--warning, #b45309)' : 'var(--success, #0a7c42)' }}>
                              {v.isPartial
                                ? `Partial payment (${formatCedi(v.amountSent)}). Balance ${formatCedi(balance)} due at shop or send full amount before delivery.`
                                : 'Full amount entered. Order will be confirmed once payment is verified.'}
                            </p>
                            {v.isPartial && (
                              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                  type="checkbox"
                                  checked={confirmPartialPayment}
                                  onChange={(e) => setConfirmPartialPayment(e.target.checked)}
                                  style={{ marginTop: 4 }}
                                />
                                <span>I understand I will pay the balance at the shop or send the full amount before my order can be delivered.</span>
                              </label>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </>
                )}
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="paymentMethod"
                value="Cash"
                checked={paymentMethod === 'Cash'}
                onChange={() => setPaymentMethod('Cash')}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>Cash</strong>
                {paymentMethod === 'Cash' && (
                  <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Cash payment is available only at the shop. Your order will be confirmed when cash is paid.
                  </span>
                )}
              </span>
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '1rem' }}>
            {submitting ? 'Placing order…' : 'Place order'}
          </button>
        </form>
        <div style={{ minWidth: 260 }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Order summary</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((i) => (
              <li key={i.productId} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                {i.name} × {i.quantity} — {formatCedi(i.price * i.quantity)}
              </li>
            ))}
          </ul>
          <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>Total: {formatCedi(subtotal)}</p>
        </div>
      </div>
    </div>
  )
}
