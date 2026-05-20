import { useEffect, useCallback, useState } from 'react'
import { useSwipe } from '../hooks/useSwipe'

type Props = {
  imageUrls: string[]
  initialIndex?: number
  onClose: () => void
}

/** Full-screen image viewer. Close on backdrop click, Escape, or Close button. Supports prev/next for multiple images. */
export default function ImageLightbox({ imageUrls, initialIndex = 0, onClose }: Props) {
  const maxIdx = Math.max(0, imageUrls.length - 1)
  const [idx, setIdx] = useState(() =>
    Math.min(Math.max(0, initialIndex), maxIdx)
  )
  const url = imageUrls[idx]
  const hasMultiple = imageUrls.length > 1

  const goPrev = useCallback(() => {
    setIdx((i) => (i <= 0 ? maxIdx : i - 1))
  }, [maxIdx])

  const goNext = useCallback(() => {
    setIdx((i) => (i >= maxIdx ? 0 : i + 1))
  }, [maxIdx])

  useEffect(() => {
    setIdx(Math.min(Math.max(0, initialIndex), maxIdx))
  }, [initialIndex, maxIdx])

  const swipe = useSwipe(goNext, goPrev)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    },
    [onClose, goPrev, goNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  if (!url) return null

  return (
    <div
      className="image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="View image full screen"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={swipe.onTouchStart}
      onTouchEnd={swipe.onTouchEnd}
    >
      <button
        type="button"
        className="image-lightbox-close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {hasMultiple && (
        <>
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-prev"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-next"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
          >
            ›
          </button>
        </>
      )}
      <img
        src={url}
        alt=""
        className="image-lightbox-img"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
      {hasMultiple && (
        <span className="image-lightbox-counter" aria-live="polite">
          {idx + 1} / {imageUrls.length}
        </span>
      )}
    </div>
  )
}
