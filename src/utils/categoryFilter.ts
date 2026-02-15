/**
 * Category filtering to match POS tabs: All, Devices, Accessories, Screens, Others (custom items).
 * Uses category (string), isAccessory (boolean), isCustomItem (boolean) from inventory docs.
 */

export type CategoryTab = 'all' | 'devices' | 'accessories' | 'screens' | 'custom'

export const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'devices', label: 'Devices' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'screens', label: 'Screens' },
  { id: 'custom', label: 'Others' },
]

export interface CategoryItem {
  category?: string
  isAccessory?: boolean
  isCustomItem?: boolean
  name?: string
}

/** Display category for one item (same logic as POS). */
export function getItemDisplayCategory(item: CategoryItem | null): CategoryTab | null {
  if (!item) return null
  const cat = (item.category || '').toLowerCase()
  if (item.isCustomItem === true || cat === 'custom item') return 'custom'
  const isAccessory = item.isAccessory === true || cat === 'accessory'
  const name = (item.name || '').toLowerCase()
  const isScreen =
    cat === 'screen' ||
    cat === 'screens' ||
    name.includes('screen') ||
    name.includes('display')
  if (isScreen) return 'screens'
  if (isAccessory) return 'accessories'
  return 'devices'
}

/** Filter inventory by active tab (same logic as POS). */
export function filterInventoryByCategory<T extends CategoryItem>(
  inventory: T[],
  activeTab: CategoryTab
): T[] {
  if (!Array.isArray(inventory)) return []
  if (activeTab === 'all') return inventory

  return inventory.filter((item) => {
    if (!item) return false
    if (activeTab === 'custom') {
      return item.isCustomItem === true || (item.category || '').toLowerCase() === 'custom item'
    }
    if (item.isCustomItem === true) return false

    const cat = (item.category || '').toLowerCase()
    const isAccessory = item.isAccessory === true || cat === 'accessory'
    const name = (item.name || '').toLowerCase()
    const isScreen =
      cat === 'screen' ||
      cat === 'screens' ||
      name.includes('screen') ||
      name.includes('display')

    if (activeTab === 'devices') return !isAccessory && !isScreen
    if (activeTab === 'accessories') return isAccessory && !isScreen
    if (activeTab === 'screens') return isScreen
    return true
  })
}

/** True if item has stock > 0 (optional filter for storefront). */
export function inStock(item: { stock?: number }): boolean {
  const stock = typeof item.stock === 'number' ? item.stock : parseInt(String(item.stock), 10) || 0
  return stock > 0
}
