import { useFavorites } from '../contexts/FavoritesContext'

type Props = {
  productId: string
  className?: string
  size?: 'sm' | 'md'
}

export default function FavoriteToggle({ productId, className = '', size = 'md' }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(productId)

  return (
    <button
      type="button"
      className={`favorite-toggle favorite-toggle--${size} ${active ? 'favorite-toggle--active' : ''} ${className}`.trim()}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(productId)
      }}
    >
      <span className="favorite-toggle-icon" aria-hidden>
        {active ? '♥' : '♡'}
      </span>
    </button>
  )
}
