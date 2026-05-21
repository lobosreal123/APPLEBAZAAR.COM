import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/** POS default branch label — prefer owner business name when branch is only this. */
function isGenericBranchName(name: string): boolean {
  const n = name.trim().toLowerCase()
  return n === 'main store' || n === 'main'
}

/**
 * Resolve display name for the store that owns this order (not a generic "main store").
 * Tries stores/{storeId} doc first, then users/{ownerId}.storeName.
 */
export async function resolveStoreDisplayName(
  ownerId: string,
  storeId: string
): Promise<string> {
  let branchName = ''
  try {
    const storeSnap = await getDoc(doc(db, 'users', ownerId, 'stores', storeId))
    if (storeSnap.exists()) {
      const data = storeSnap.data()
      branchName =
        (typeof data?.storeName === 'string' && data.storeName.trim()) ||
        (typeof data?.name === 'string' && data.name.trim()) ||
        ''
    }
  } catch {
    /* ignore */
  }

  let ownerShopName = ''
  try {
    const userSnap = await getDoc(doc(db, 'users', ownerId))
    if (userSnap.exists()) {
      ownerShopName = (userSnap.data()?.storeName as string)?.trim() || ''
    }
  } catch {
    /* ignore */
  }

  if (branchName && !isGenericBranchName(branchName)) return branchName
  if (ownerShopName && !isGenericBranchName(ownerShopName)) return ownerShopName
  if (branchName) return branchName
  if (ownerShopName) return ownerShopName

  return `Shop (${storeId.slice(0, 8)})`
}
