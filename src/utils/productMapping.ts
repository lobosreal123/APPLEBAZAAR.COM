/**
 * Matches POS inventory image storage:
 * - imageUrls: array of full HTTPS URLs (up to 10), from Firebase Storage
 * - imageUrl: single URL, set to first image for backward compatibility
 */
const MAX_IMAGES = 10

/** True if the string looks like a valid image URL (http/https). Filters out product IDs (ownerId|storeId|docId) or other non-URLs. */
export function isValidImageUrl(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed.length === 0) return false
  if (trimmed.includes('|')) return false // product ID format, not a URL
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

/** Normalize to array of image URLs (capped at 10). Reads imageUrls array or single imageUrl/imageURL. */
export function getImageUrls(data: Record<string, unknown>): string[] {
  const arr = data.imageUrls as string[] | undefined
  if (Array.isArray(arr) && arr.length) {
    return arr
      .filter((u): u is string => typeof u === 'string' && isValidImageUrl(u))
      .map((u) => u.trim())
      .slice(0, MAX_IMAGES)
  }
  const single = ((data.imageUrl as string) || (data.imageURL as string) || '').trim()
  return isValidImageUrl(single) ? [single] : []
}
