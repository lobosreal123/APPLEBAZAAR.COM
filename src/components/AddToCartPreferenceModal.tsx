import { useState, useEffect, useId } from 'react'

type Props = {
  open: boolean
  productName: string
  listedSpecs?: string
  onConfirm: (cashierNote: string | null) => void
  onClose: () => void
}

export default function AddToCartPreferenceModal({
  open,
  productName,
  listedSpecs,
  onConfirm,
  onClose,
}: Props) {
  const [note, setNote] = useState('')
  const titleId = useId()

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  if (!open) return null

  return (
    <div
      className="add-cart-pref-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="add-cart-pref-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="add-cart-pref-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id={titleId} className="add-cart-pref-title">
          Preference for cashier
        </h2>
        <p className="add-cart-pref-product">{productName}</p>
        {listedSpecs && (
          <p className="add-cart-pref-listed">
            Listed: <strong>{listedSpecs}</strong>
          </p>
        )}
        <p className="add-cart-pref-hint">
          Add a note for the cashier (e.g. color, size). This will appear on your order for staff to see.
        </p>
        <label className="add-cart-pref-label" htmlFor="add-cart-pref-input">
          Your preference
        </label>
        <textarea
          id="add-cart-pref-input"
          className="add-cart-pref-input"
          rows={3}
          placeholder="e.g. Color: Midnight black"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
        <div className="add-cart-pref-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => onConfirm(null)}
          >
            Ignore
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(note.trim() || null)}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  )
}
