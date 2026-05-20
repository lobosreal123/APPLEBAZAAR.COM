import { useRef, useCallback } from 'react'

type SwipeHandlers = {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  /** Call from click handler to block ghost clicks after a swipe. */
  consumeClick: () => boolean
}

/** Swipe left → onSwipeLeft, swipe right → onSwipeRight. Ignores mostly vertical gestures. */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  minDistance = 48
): SwipeHandlers {
  const start = useRef({ x: 0, y: 0 })
  const didSwipe = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    didSwipe.current = false
    start.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy)) return
      didSwipe.current = true
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    },
    [onSwipeLeft, onSwipeRight, minDistance]
  )

  const consumeClick = useCallback(() => {
    if (!didSwipe.current) return false
    didSwipe.current = false
    return true
  }, [])

  return { onTouchStart, onTouchEnd, consumeClick }
}
