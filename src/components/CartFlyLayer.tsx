import { createPortal } from 'react-dom'

export type CartFlyParticle = {
  id: string
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  imageUrl?: string
}

type Props = {
  flies: CartFlyParticle[]
  onFlyEnd: (id: string) => void
}

export default function CartFlyLayer({ flies, onFlyEnd }: Props) {
  if (flies.length === 0) return null

  return createPortal(
    <div className="cart-fly-layer" aria-hidden="true">
      {flies.map((fly) => (
        <div
          key={fly.id}
          className="cart-fly-particle"
          style={
            {
              left: fly.startX,
              top: fly.startY,
              '--fly-dx': `${fly.deltaX}px`,
              '--fly-dy': `${fly.deltaY}px`,
              ...(fly.imageUrl ? { backgroundImage: `url("${fly.imageUrl}")` } : {}),
            } as React.CSSProperties
          }
          onAnimationEnd={() => onFlyEnd(fly.id)}
        />
      ))}
    </div>,
    document.body
  )
}
