import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatCedi } from '../utils/currency'
import type { NamedPrice } from '../utils/namedPrices'

type Props = {
  open: boolean
  productName: string
  options: NamedPrice[]
  selectedName?: string | null
  confirmLabel?: string
  onConfirm: (option: NamedPrice) => void
  onClose: () => void
}

export default function PriceOptionsModal({
  open,
  productName,
  options,
  selectedName,
  confirmLabel = 'Continue',
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId()
  const [picked, setPicked] = useState(selectedName || options[0]?.name || '')

  useEffect(() => {
    if (!open) return
    setPicked(selectedName || options[0]?.name || '')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, selectedName, options, onClose])

  if (!open || options.length === 0) return null

  const selected = options.find((o) => o.name === picked) ?? options[0]

  return createPortal(
    <div
      className="price-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="price-modal" onClick={(e) => e.stopPropagation()}>
        <div className="price-modal-glow" aria-hidden />
        <button type="button" className="price-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <p className="price-modal-eyebrow">Choose a price</p>
        <h2 id={titleId} className="price-modal-title">
          {productName}
        </h2>
        <p className="price-modal-hint">Pick the option that matches how you want to buy.</p>

        <div className="price-modal-list" role="radiogroup" aria-label="Price options">
          {options.map((tier, index) => {
            const isSelected = selected.name === tier.name
            return (
              <div key={tier.name} className="price-modal-option-wrap">
                {index > 0 && <div className="price-modal-separator" aria-hidden />}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`price-modal-option ${isSelected ? 'selected' : ''}`}
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => setPicked(tier.name)}
                >
                  <span className="price-modal-option-radio" aria-hidden />
                  <span className="price-modal-option-main">
                    <span className="price-modal-option-name">{tier.name}</span>
                    {tier.moq != null && tier.moq > 0 && (
                      <span className="price-modal-option-moq">Min. order {tier.moq}</span>
                    )}
                  </span>
                  <span className="price-modal-option-price">{formatCedi(tier.price)}</span>
                </button>
              </div>
            )
          })}
        </div>

        <div className="price-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => selected && onConfirm(selected)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
