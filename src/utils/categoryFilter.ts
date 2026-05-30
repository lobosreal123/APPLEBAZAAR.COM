/**
 * Category filtering to match POS tabs: All, Devices, Accessories, Screens, Parts (custom items).
 * Uses category (string), isAccessory (boolean), isCustomItem (boolean) from inventory docs.
 * Sub-categories filter by item name; "others" = items whose name doesn't match any named sub.
 */

export type CategoryTab =
  | 'all'
  | 'devices'
  | 'accessories'
  | 'screens'
  | 'custom'
  | 'iphone-box'

export const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'devices', label: 'DEVICES' },
  { id: 'accessories', label: 'ACCESSORIES' },
  { id: 'screens', label: 'SCREENS' },
  { id: 'custom', label: 'PARTS' },
  { id: 'iphone-box', label: 'IPHONE BOX' },
]

/** Sub-category: id, label, and matcher. "others" matches when name matches no other sub. */
export type SubCategoryDef = { id: string; label: string; match: (name: string) => boolean }

function nameIncludes(name: string, ...terms: string[]): boolean {
  const n = name.toLowerCase()
  return terms.some((t) => n.includes(t.toLowerCase()))
}

function nameMatchesRegex(name: string, regex: RegExp): boolean {
  return regex.test(name)
}

/** iPhone package boxes: product name must include "package box". */
export function isPackageBoxItem(item: CategoryItem | null | undefined): boolean {
  if (!item) return false
  const n = (item.name || '').toLowerCase()
  return n.includes('package box') || n.includes('packagebox')
}

function matchesXrAnd11Series(name: string): boolean {
  const lower = name.toLowerCase()
  if (/\bxr\b|iphone\s*xr/.test(lower)) return true
  if (/\biphone\s*11\b/.test(lower)) return true
  if (/\b11\s*(?:pro\s*)?(?:max|plus|mini)?\b/.test(lower)) return true
  return false
}

function matchesIphoneSeries(name: string, series: 12 | 13 | 14 | 15 | 16 | 17): boolean {
  const lower = name.toLowerCase()
  const d = String(series)
  return (
    new RegExp(`\\biphone\\s*${d}\\b`).test(lower) ||
    new RegExp(`\\b${d}\\s*(?:pro\\s*)?(?:max|plus|mini)?\\b`).test(lower)
  )
}

function matchesAnyIphoneBoxSeries(name: string): boolean {
  return (
    matchesXrAnd11Series(name) ||
    matchesIphoneSeries(name, 12) ||
    matchesIphoneSeries(name, 13) ||
    matchesIphoneSeries(name, 14) ||
    matchesIphoneSeries(name, 15) ||
    matchesIphoneSeries(name, 16) ||
    matchesIphoneSeries(name, 17)
  )
}

/** Sub-categories per main category. First entry "All" shows everything in the category; Others = items not matching any named sub. */
export const SUB_CATEGORIES: Record<Exclude<CategoryTab, 'all'>, SubCategoryDef[]> = {
  devices: [
    { id: 'all', label: 'All', match: () => true },
    { id: 'iphones', label: 'iPhones', match: (n) => nameIncludes(n, 'iphone') },
    { id: 'macbook', label: 'Macbook', match: (n) => nameIncludes(n, 'macbook') },
    { id: 'ipads', label: 'iPads', match: (n) => nameIncludes(n, 'ipad') },
    {
      id: 'others',
      label: 'Others',
      match: (n) =>
        !nameIncludes(n, 'iphone') && !nameIncludes(n, 'macbook') && !nameIncludes(n, 'ipad'),
    },
  ],
  accessories: [
    { id: 'all', label: 'All', match: () => true },
    { id: 'cable', label: 'Cable', match: (n) => nameIncludes(n, 'cable') },
    { id: 'adapter', label: 'Adapter', match: (n) => nameIncludes(n, 'adapter') },
    { id: 'macbook-charger', label: 'Macbook charger', match: (n) => nameIncludes(n, 'macbook charger') || (nameIncludes(n, 'macbook') && nameIncludes(n, 'charger')) },
    { id: 'watch', label: 'Watch', match: (n) => nameIncludes(n, 'watch') },
    { id: 'covers', label: 'Covers', match: (n) => nameIncludes(n, 'cover', 'covers') },
    {
      id: 'others',
      label: 'Others',
      match: (n) => {
        const lower = n.toLowerCase()
        if (lower.includes('cable')) return false
        if (lower.includes('adapter')) return false
        if (lower.includes('macbook charger')) return false
        if (lower.includes('macbook') && lower.includes('charger')) return false
        if (lower.includes('watch')) return false
        if (lower.includes('cover') || lower.includes('covers')) return false
        return true
      },
    },
  ],
  screens: [
    { id: 'all', label: 'All', match: () => true },
    { id: 'xr-11-12', label: 'XR-11-12 series', match: (n) => nameMatchesRegex(n, /xr|1[12]\b|iphone\s*1[12]/i) },
    { id: '13-14-15', label: '13-14-15 series', match: (n) => nameMatchesRegex(n, /1[3-5]\b|iphone\s*1[3-5]/i) },
    { id: '16-17', label: '16-17 series', match: (n) => nameMatchesRegex(n, /1[67]\b|iphone\s*1[67]/i) },
    {
      id: 'others',
      label: 'Others',
      match: (n) => {
        const lower = n.toLowerCase()
        if (/xr|1[12]\b|iphone\s*1[12]/.test(lower)) return false
        if (/1[3-5]\b|iphone\s*1[3-5]/.test(lower)) return false
        if (/1[67]\b|iphone\s*1[67]/.test(lower)) return false
        return true
      },
    },
  ],
  custom: [
    { id: 'all', label: 'All', match: () => true },
    { id: 'battery', label: 'Battery', match: (n) => nameIncludes(n, 'battery') },
    { id: 'camera', label: 'Camera', match: (n) => nameIncludes(n, 'camera') },
    { id: 'housing', label: 'Housing', match: (n) => nameIncludes(n, 'housing') },
    { id: 'charging-unit', label: 'Charging unit', match: (n) => nameIncludes(n, 'charging unit') },
    {
      id: 'others',
      label: 'Others',
      match: (n) => {
        const lower = n.toLowerCase()
        return !lower.includes('battery') && !lower.includes('camera') && !lower.includes('housing') && !lower.includes('charging unit')
      },
    },
  ],
  'iphone-box': [
    { id: 'all', label: 'All', match: () => true },
    { id: 'xr-11', label: 'XR & 11 series', match: (n) => matchesXrAnd11Series(n) },
    { id: '12', label: '12 series', match: (n) => matchesIphoneSeries(n, 12) },
    { id: '13', label: '13 series', match: (n) => matchesIphoneSeries(n, 13) },
    { id: '14', label: '14 series', match: (n) => matchesIphoneSeries(n, 14) },
    { id: '15', label: '15 series', match: (n) => matchesIphoneSeries(n, 15) },
    { id: '16', label: '16 series', match: (n) => matchesIphoneSeries(n, 16) },
    { id: '17', label: '17 series', match: (n) => matchesIphoneSeries(n, 17) },
    {
      id: 'others',
      label: 'Others',
      match: (n) => !matchesAnyIphoneBoxSeries(n),
    },
  ],
}

export interface CategoryItem {
  category?: string
  isAccessory?: boolean
  isCustomItem?: boolean
  name?: string
}

/** Display category for one item (same logic as POS). */
export function getItemDisplayCategory(item: CategoryItem | null): CategoryTab | null {
  if (!item) return null
  if (isPackageBoxItem(item)) return 'iphone-box'
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
    if (activeTab === 'iphone-box') return isPackageBoxItem(item)
    if (activeTab === 'custom') {
      return item.isCustomItem === true || (item.category || '').toLowerCase() === 'custom item'
    }
    if (item.isCustomItem === true) return false
    if (isPackageBoxItem(item)) return false

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

/** Filter by sub-category (name-based). Pass already category-filtered list and main tab + sub id. */
export function filterBySubCategory<T extends CategoryItem>(
  categoryFiltered: T[],
  mainTab: Exclude<CategoryTab, 'all'>,
  subId: string
): T[] {
  const subs = SUB_CATEGORIES[mainTab]
  const sub = subs?.find((s) => s.id === subId)
  if (!sub) return categoryFiltered
  const name = (item: CategoryItem) => (item.name || '').trim()
  return categoryFiltered.filter((item) => sub.match(name(item)))
}

/** True if item has stock > 0 (optional filter for storefront). */
export function inStock(item: { stock?: number }): boolean {
  const stock = typeof item.stock === 'number' ? item.stock : parseInt(String(item.stock), 10) || 0
  return stock > 0
}
