/**
 * POS store(s) used for the website catalog.
 * Inventory is read from: users/{ownerId}/stores/{storeId}/inventory
 *
 * Options (first matching wins):
 * 1) Multiple owners/stores: VITE_POS_STORES=ownerId1:storeId1,ownerId2:storeId2,ownerId1:storeId2
 * 2) One owner, multiple stores: VITE_POS_OWNER_UID + VITE_POS_STORE_IDS=id1,id2
 * 3) Single store: VITE_POS_OWNER_UID + VITE_POS_STORE_ID
 */
export const POS_OWNER_UID = (import.meta.env.VITE_POS_OWNER_UID as string)?.trim() || ''
export const POS_STORE_ID = (import.meta.env.VITE_POS_STORE_ID as string)?.trim() || ''

/** Comma-separated store IDs for multi-store (same owner). */
const POS_STORE_IDS_RAW = (import.meta.env.VITE_POS_STORE_IDS as string)?.trim() || ''

/** Comma-separated "ownerId:storeId" pairs for multiple owners and/or stores. */
const POS_STORES_RAW = (import.meta.env.VITE_POS_STORES as string)?.trim() || ''

export type StoreConfig = { ownerId: string; storeId: string }

/**
 * Returns the list of (ownerId, storeId) to fetch inventory from.
 * - If VITE_POS_STORES is set: parse "ownerId:storeId" pairs (multiple owners and stores).
 * - Else if VITE_POS_STORE_IDS is set: one owner, multiple stores.
 * - Else if VITE_POS_OWNER_UID and VITE_POS_STORE_ID: single store.
 */
export function getPosStoreConfigs(): StoreConfig[] {
  if (POS_STORES_RAW) {
    const pairs = POS_STORES_RAW.split(',').map((s) => s.trim()).filter(Boolean)
    const configs: StoreConfig[] = []
    for (const pair of pairs) {
      const idx = pair.indexOf(':')
      if (idx > 0) {
        const ownerId = pair.slice(0, idx).trim()
        const storeId = pair.slice(idx + 1).trim()
        if (ownerId && storeId) configs.push({ ownerId, storeId })
      }
    }
    return configs
  }
  if (!POS_OWNER_UID) return []
  if (POS_STORE_IDS_RAW) {
    const ids = POS_STORE_IDS_RAW.split(',').map((s) => s.trim()).filter(Boolean)
    return ids.map((storeId) => ({ ownerId: POS_OWNER_UID, storeId }))
  }
  if (POS_STORE_ID) return [{ ownerId: POS_OWNER_UID, storeId: POS_STORE_ID }]
  return []
}

/** Single-store path for backward compat (first store only). */
export function getPosInventoryPath(): string[] {
  const configs = getPosStoreConfigs()
  if (!configs.length) return []
  const { ownerId, storeId } = configs[0]
  return ['users', ownerId, 'stores', storeId, 'inventory']
}

export function isPosInventoryConfigured(): boolean {
  return getPosStoreConfigs().length > 0
}

/** Composite id for multi-store: ownerId|storeId|docId (used in product list and detail route). */
export const COMPOSITE_ID_SEP = '|'

export function parseProductId(encodedId: string): { ownerId: string; storeId: string; docId: string } | null {
  const parts = encodedId.split(COMPOSITE_ID_SEP)
  if (parts.length === 3) return { ownerId: parts[0], storeId: parts[1], docId: parts[2] }
  return null
}

export function toCompositeId(ownerId: string, storeId: string, docId: string): string {
  return `${ownerId}${COMPOSITE_ID_SEP}${storeId}${COMPOSITE_ID_SEP}${docId}`
}
