import { Link } from 'react-router-dom'

export default function OrderConfirmation() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--success, #0a7c42)' }} aria-hidden="true">✓</div>
      <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>Order placed successfully</h1>
      <p style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: 'var(--text)' }}>Thank you. Your order has been received.</p>
      <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>The shop will contact you soon.</p>
      <Link to="/" className="btn-primary" style={{ display: 'inline-block', marginRight: '0.75rem', textDecoration: 'none' }}>
        Continue shopping
      </Link>
      <Link to="/my-orders" className="btn-outline" style={{ display: 'inline-block', textDecoration: 'none' }}>View my orders</Link>
    </div>
  )
}
