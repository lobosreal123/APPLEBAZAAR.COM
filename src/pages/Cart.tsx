import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { formatCedi } from '../utils/currency'


export default function Cart() {
  const { items, removeItem, updateQuantity, subtotal, totalItems } = useCart()
  const { user } = useAuth()

  if (totalItems === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Your cart is empty.</p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>Continue shopping</Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="section-title">Cart</h1>
      <div className="cart-table-wrap">
        <table className="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.productId}>
                <td>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: 'cover', marginRight: 10, verticalAlign: 'middle', borderRadius: 4 }}
                    />
                  )}
                  {item.name}
                </td>
                <td style={{ textAlign: 'right' }}>{formatCedi(item.price)}</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="number"
                    min={1}
                    max={item.maxStock}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value, 10) || 0)}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>{formatCedi(item.price * item.quantity)}</td>
                <td>
                  <button type="button" className="btn-outline" onClick={() => removeItem(item.productId)} style={{ fontSize: '0.875rem', padding: '0.35rem 0.6rem' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.1rem' }}>Subtotal: {formatCedi(subtotal)}</p>
      {user ? (
        <Link to="/checkout" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Proceed to checkout
        </Link>
      ) : (
        <p>
          <Link to="/login" state={{ from: { pathname: '/checkout' } }}>Log in</Link> to proceed to checkout.
        </p>
      )}
    </>
  )
}
