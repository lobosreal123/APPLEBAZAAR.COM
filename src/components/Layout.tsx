import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import type { ReactNode } from 'react'

const SEARCH_DEBOUNCE_MS = 280
const WHATSAPP_NUMBER = '233540346875'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`
const WHATSAPP_QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(WHATSAPP_URL)}`

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const { totalItems } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const qFromUrl = location.pathname === '/' ? searchParams.get('q') ?? '' : ''
  const [searchInput, setSearchInput] = useState(qFromUrl)
  const [supportPopupOpen, setSupportPopupOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchInput(qFromUrl)
  }, [qFromUrl])

  useEffect(() => {
    if (qFromUrl) {
      try {
        sessionStorage.setItem('applebazaar_search', qFromUrl)
      } catch {
        /* ignore */
      }
    }
  }, [qFromUrl])

  // Live filter on Home: sync input to URL. Clear immediately when empty so it doesn't reappear; debounce when typing.
  useEffect(() => {
    if (location.pathname !== '/') return
    const value = searchInput.trim()
    if (value === '') {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('q')
          return next
        },
        { replace: true }
      )
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('q', value)
          return next
        },
        { replace: true }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput, location.pathname, setSearchParams])

  const savedSearch = location.pathname !== '/' ? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('applebazaar_search') ?? '' : '') : ''
  const shopTo =
    location.pathname === '/'
      ? (searchParams.get('q') ? `/?q=${encodeURIComponent(searchParams.get('q'))}` : '/')
      : (savedSearch ? `/?q=${encodeURIComponent(savedSearch)}` : '/')

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const value = (form.elements.namedItem('q') as HTMLInputElement | null)?.value?.trim() ?? ''
    if (value) {
      navigate(`/?q=${encodeURIComponent(value)}`)
    } else {
      navigate('/')
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to={shopTo} className="app-logo">
            Applebazaar
          </Link>
          <form className="app-search-form" role="search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              name="q"
              className="app-search"
              placeholder="What are you looking for..."
              aria-label="Search products"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <nav className="app-nav">
            <Link to={shopTo}>Shop</Link>
            {user && (
              <Link to="/my-orders">My orders</Link>
            )}
            <button
              type="button"
              className="btn-outline"
              title="Contact support on WhatsApp: +233 54 034 6875"
              aria-label="Contact support on WhatsApp, +233 54 034 6875"
              onClick={() => setSupportPopupOpen(true)}
              style={{ fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
            >
              Contact support <span style={{ opacity: 0.9, fontWeight: 'normal', fontSize: '0.85em' }}>(WhatsApp)</span>
            </button>
            <Link to="/cart" className="btn-cart">
              Cart {totalItems > 0 ? `(${totalItems})` : ''}
            </Link>
            {!loading && (
              user ? (
                <button type="button" className="btn-outline" onClick={() => signOut()}>
                  Sign out
                </button>
              ) : (
                <>
                  <Link to="/login" className="btn-outline">Log in</Link>
                  <Link to="/signup" className="btn-primary" style={{ padding: '0.5rem 0.9rem' }}>Sign up</Link>
                </>
              )
            )}
          </nav>
        </div>
      </header>

      {supportPopupOpen && (
        <div
          className="support-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-popup-title"
          onClick={(e) => e.target === e.currentTarget && setSupportPopupOpen(false)}
        >
          <div className="support-popup">
            <button
              type="button"
              className="support-popup-close"
              aria-label="Close"
              onClick={() => setSupportPopupOpen(false)}
            >
              ×
            </button>
            <h2 id="support-popup-title" className="support-popup-title">Contact support</h2>
            <p className="support-popup-hint">Scan the code with your phone or use the link below.</p>
            <img src={WHATSAPP_QR_URL} alt="WhatsApp QR code: scan to chat" width={200} height={200} className="support-popup-qr" />
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary support-popup-link"
              onClick={() => setSupportPopupOpen(false)}
            >
              Open WhatsApp to chat
            </a>
            <p className="support-popup-number">+233 54 034 6875</p>
          </div>
        </div>
      )}

      <main className="app-main">
        {children}
      </main>
      <footer className="app-footer">
        <div className="app-footer-inner">
          <p><strong>APPLE BAZAAR</strong>—quality devices you can trust</p>
          <p>
            <Link to={shopTo}>Shop</Link>
            {' · '}
            <Link to="/cart">Cart</Link>
            {user && <> · <Link to="/my-orders">My orders</Link></>}
          </p>
          <p style={{ marginTop: '1rem', opacity: 0.8 }}>© {new Date().getFullYear()} Applebazaar</p>
        </div>
      </footer>
    </>
  )
}
