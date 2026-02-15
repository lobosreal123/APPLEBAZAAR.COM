/**
 * Client-side search: filter products by query (name and description).
 */

export interface SearchableProduct {
  name?: string
  description?: string
}

export function filterProductsBySearch<T extends SearchableProduct>(
  products: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter((p) => {
    const name = (p.name ?? '').toLowerCase()
    const desc = (p.description ?? '').toLowerCase()
    return name.includes(q) || desc.includes(q)
  })
}
