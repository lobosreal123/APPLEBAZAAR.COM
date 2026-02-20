import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useProducts } from '../hooks/useProducts'
import { getImageUrls } from '../utils/productMapping'

type TransferItem = {
  inventoryDocId: string
  name: string
  quantity: number
  imageUrl?: string
  price?: number
}

type Transfer = {
  id: string
  fromUid: string
  fromStoreId: string
  toUid: string
  toEmail?: string
  toStoreId: string
  items: TransferItem[]
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: unknown
  respondedAt?: unknown
  respondedBy?: string
}

type StoreInfo = { id: string; name?: string }
type InventoryItem = { id: string; name: string; stock: number; price: number; imageUrl?: string }

const TAB_INCOMING = 'incoming'
const TAB_SENT = 'sent'
const TAB_NEW = 'new'
const TAB_HOT = 'hot'

const HOT_ITEMS_ADMIN_EMAIL = 'brains494@icloud.com'

export default function Admin() {
  const { user } = useAuth()
  const { products } = useProducts()
  const [activeTab, setActiveTab] = useState<'incoming' | 'sent' | 'new' | 'hot'>(TAB_INCOMING)
  const [incoming, setIncoming] = useState<Transfer[]>([])
  const [sent, setSent] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [myStores, setMyStores] = useState<StoreInfo[]>([])
  const [fromStoreId, setFromStoreId] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [toUid, setToUid] = useState<string | null>(null)
  const [toStores, setToStores] = useState<StoreInfo[]>([])
  const [toStoreId, setToStoreId] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const [hotItemIds, setHotItemIds] = useState<string[]>([])
  const [hotItemsLoading, setHotItemsLoading] = useState(false)
  const [hotItemsSaving, setHotItemsSaving] = useState(false)

  const canEditHotItems = user?.email?.toLowerCase() === HOT_ITEMS_ADMIN_EMAIL.toLowerCase()

  const loadTransfers = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    const transfersRef = collection(db, 'inventoryTransfers')
    Promise.all([
      getDocs(query(transfersRef, where('toUid', '==', user.uid), orderBy('createdAt', 'desc'))),
      getDocs(query(transfersRef, where('fromUid', '==', user.uid), orderBy('createdAt', 'desc'))),
    ])
      .then(([inSnap, outSnap]) => {
        const toList = inSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transfer))
        const fromList = outSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transfer))
        setIncoming(toList)
        setSent(fromList)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  useEffect(() => {
    if (!canEditHotItems || activeTab !== TAB_HOT) return
    setHotItemsLoading(true)
    getDoc(doc(db, 'publicStore', 'publicStorewebsite'))
      .then((snap) => {
        const ids = (snap.data()?.hotItemIds as string[] | undefined) ?? []
        setHotItemIds(Array.isArray(ids) ? ids.slice(0, 6) : [])
      })
      .catch(() => setHotItemIds([]))
      .finally(() => setHotItemsLoading(false))
  }, [canEditHotItems, activeTab])

  const toggleHotItem = (productId: string) => {
    setHotItemIds((prev) => {
      const idx = prev.indexOf(productId)
      if (idx >= 0) return prev.filter((id) => id !== productId)
      if (prev.length >= 6) return prev
      return [...prev, productId]
    })
  }

  const saveHotItems = async () => {
    setHotItemsSaving(true)
    setError(null)
    try {
      const docRef = doc(db, 'publicStore', 'publicStorewebsite')
      const snap = await getDoc(docRef)
      const existing = snap.exists() ? snap.data() : {}
      await setDoc(docRef, { ...existing, hotItemIds }, { merge: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save hot items')
    } finally {
      setHotItemsSaving(false)
    }
  }

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'users', user.uid, 'stores'))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id }))
        setMyStores(list)
        if (list.length && !fromStoreId) setFromStoreId(list[0].id)
      })
      .catch(() => {})
  }, [user, fromStoreId])

  useEffect(() => {
    if (!fromStoreId || !user) return
    setInventory([])
    getDocs(collection(db, 'users', user.uid, 'stores', fromStoreId, 'inventory'))
      .then((snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data()
          const urls = getImageUrls(data)
          return {
            id: d.id,
            name: (data.name as string) || (data.model as string) || '',
            stock: typeof data.stock === 'number' ? data.stock : Number(data.stock) || 0,
            price: typeof data.price === 'number' ? data.price : Number(data.price) || 0,
            imageUrl: urls[0] || undefined,
          }
        })
        setInventory(list)
        setSelectedItems({})
      })
      .catch(() => {})
  }, [fromStoreId, user])

  const lookupUserByEmail = useCallback(() => {
    const email = toEmail.trim().toLowerCase()
    if (!email) {
      setToUid(null)
      setToStores([])
      setToStoreId('')
      return
    }
    getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)))
      .then((snap) => {
        if (snap.empty) {
          setToUid(null)
          setToStores([])
          setToStoreId('')
          return
        }
        const uid = snap.docs[0].id
        setToUid(uid)
        return getDocs(collection(db, 'users', uid, 'stores'))
      })
      .then((snap) => {
        if (!snap) return
        const list = snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id }))
        setToStores(list)
        setToStoreId(list[0]?.id || '')
      })
      .catch(() => {
        setToUid(null)
        setToStores([])
      })
  }, [toEmail])

  const handleAccept = async (t: Transfer) => {
    if (!user || t.status !== 'pending') return
    setAcceptingId(t.id)
    try {
      const batch = writeBatch(db)
      for (const item of t.items) {
        const invRef = doc(collection(db, 'users', user.uid, 'stores', t.toStoreId, 'inventory'))
        const payload: Record<string, unknown> = {
          name: item.name,
          stock: item.quantity,
          price: item.price ?? 0,
        }
        if (item.imageUrl) payload.imageUrl = item.imageUrl
        batch.set(invRef, payload, { merge: true })
      }
      await batch.commit()
      await updateDoc(doc(db, 'inventoryTransfers', t.id), {
        status: 'accepted',
        respondedAt: serverTimestamp(),
        respondedBy: user.uid,
      })
      loadTransfers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleReject = async (t: Transfer) => {
    if (!user || t.status !== 'pending') return
    setRejectingId(t.id)
    try {
      await updateDoc(doc(db, 'inventoryTransfers', t.id), {
        status: 'rejected',
        respondedAt: serverTimestamp(),
        respondedBy: user.uid,
      })
      loadTransfers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setRejectingId(null)
    }
  }

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !toUid || !toStoreId || !fromStoreId) return
    const items: TransferItem[] = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => {
        const inv = inventory.find((i) => i.id === id)
        return {
          inventoryDocId: id,
          name: inv?.name ?? '',
          quantity,
          imageUrl: inv?.imageUrl,
          price: inv?.price,
        }
      })
    if (items.length === 0) {
      setError('Select at least one item with quantity > 0')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await addDoc(collection(db, 'inventoryTransfers'), {
        fromUid: user.uid,
        fromStoreId,
        toUid,
        toEmail: toEmail.trim() || null,
        toStoreId,
        items,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setToEmail('')
      setToUid(null)
      setToStores([])
      setToStoreId('')
      setSelectedItems({})
      setActiveTab(TAB_SENT)
      loadTransfers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSubmitting(false)
    }
  }

  const setItemQty = (id: string, qty: number) => {
    if (qty <= 0) {
      const next = { ...selectedItems }
      delete next[id]
      setSelectedItems(next)
    } else {
      setSelectedItems((prev) => ({ ...prev, [id]: qty }))
    }
  }

  const formatDate = (v: unknown) => {
    if (!v) return '—'
    const d = (v as { toDate?: () => Date }).toDate?.() ?? new Date(v as string)
    return d.toLocaleString()
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to shop</Link>
      </p>
      <h1 className="section-title">Admin</h1>

      <section aria-label="Inventory transfers" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-heading)' }}>
          Inventory transfers
        </h2>
        <div
          className="admin-tabs"
          role="tablist"
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            padding: '0.5rem 0',
            borderBottom: '2px solid var(--border)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_INCOMING}
            className={`tab-button ${activeTab === TAB_INCOMING ? 'active' : ''}`}
            onClick={() => setActiveTab(TAB_INCOMING)}
            style={{ minWidth: '6rem' }}
          >
            Incoming
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_SENT}
            className={`tab-button ${activeTab === TAB_SENT ? 'active' : ''}`}
            onClick={() => setActiveTab(TAB_SENT)}
            style={{ minWidth: '6rem' }}
          >
            Sent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_NEW}
            className={`tab-button ${activeTab === TAB_NEW ? 'active' : ''}`}
            onClick={() => setActiveTab(TAB_NEW)}
            style={{ minWidth: '6rem' }}
          >
            New transfer
          </button>
          {canEditHotItems && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === TAB_HOT}
              className={`tab-button ${activeTab === TAB_HOT ? 'active' : ''}`}
              onClick={() => setActiveTab(TAB_HOT)}
              style={{ minWidth: '6rem' }}
            >
              Hot items
            </button>
          )}
        </div>

        {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}

        {activeTab === TAB_INCOMING && (
          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Incoming transfers</h2>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : incoming.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No incoming transfers.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {incoming.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      From store {t.fromStoreId} · {formatDate(t.createdAt)} · <strong>{t.status}</strong>
                    </p>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                      To your store: <strong>{t.toStoreId}</strong>
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(t.items || []).map((item, idx) => (
                        <li
                          key={`${item.inventoryDocId}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.5rem',
                            background: 'var(--bg-subtle)',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                          }}
                        >
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                          )}
                          <span>{item.name} × {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    {t.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={acceptingId === t.id}
                          onClick={() => handleAccept(t)}
                        >
                          {acceptingId === t.id ? 'Accepting…' : 'Accept & receive'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          disabled={rejectingId === t.id}
                          onClick={() => handleReject(t)}
                        >
                          {rejectingId === t.id ? '…' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === TAB_SENT && (
          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Sent transfers</h2>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : sent.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No sent transfers.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sent.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      To {t.toEmail || t.toUid} · Store {t.toStoreId} · {formatDate(t.createdAt)} · <strong>{t.status}</strong>
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(t.items || []).map((item, idx) => (
                        <li
                          key={`${item.inventoryDocId}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.5rem',
                            background: 'var(--bg-subtle)',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                          }}
                        >
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                          )}
                          <span>{item.name} × {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === TAB_NEW && (
          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>New transfer</h2>
            <form onSubmit={handleSubmitTransfer} style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label>
                From store
                <select
                  value={fromStoreId}
                  onChange={(e) => setFromStoreId(e.target.value)}
                  style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                >
                  {myStores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || s.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Receiver email (admin)
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  onBlur={lookupUserByEmail}
                  placeholder="admin@example.com"
                  style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
              {toStores.length > 0 && (
                <label>
                  To store
                  <select
                    value={toStoreId}
                    onChange={(e) => setToStoreId(e.target.value)}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: 4 }}
                  >
                    {toStores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.id}</option>
                    ))}
                  </select>
                </label>
              )}
              <div>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Items (from your store)</p>
                {inventory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No inventory in this store.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {inventory.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                        }}
                      >
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                        )}
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>{item.name}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock: {item.stock}</span>
                        <input
                          type="number"
                          min={0}
                          max={item.stock}
                          value={selectedItems[item.id] ?? 0}
                          onChange={(e) => setItemQty(item.id, parseInt(e.target.value, 10) || 0)}
                          style={{ width: 64, padding: '0.35rem' }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={submitting || !toUid || !toStoreId}>
                {submitting ? 'Sending…' : 'Send transfer'}
              </button>
            </form>
          </section>
        )}

        {activeTab === TAB_HOT && canEditHotItems && (
          <section>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Hot items (6 featured on homepage)</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Select up to 6 products to feature in the Hot items grid. These appear at the top of the homepage.
            </p>
            {hotItemsLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : (
              <>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  Selected: {hotItemIds.length} / 6
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {products.filter((p) => p.stock >= 1).map((p) => {
                    const selected = hotItemIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleHotItem(p.id)}
                        style={{
                          padding: '0.75rem',
                          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          borderRadius: 8,
                          background: selected ? 'var(--accent-light)' : 'var(--bg-subtle)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                        )}
                        <span style={{ flex: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        {selected && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveHotItems}
                  disabled={hotItemsSaving}
                >
                  {hotItemsSaving ? 'Saving…' : 'Save hot items'}
                </button>
              </>
            )}
          </section>
        )}
      </section>
    </div>
  )
}
