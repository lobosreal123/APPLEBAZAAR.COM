import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Resolve display name for the store that owns this order (not a generic "main store").
 * Tries stores/{storeId} doc first, then users/{ownerId}.storeName.
 */
export async function resolveStoreDisplayName(
  ownerId: string,
  storeId: string
): Promise<string> {
  try {
    const storeSnap = await getDoc(doc(db, 'users', ownerId, 'stores', storeId))
    if (storeSnap.exists()) {
      const data = storeSnap.data()
      const fromStore =
        (typeof data?.storeName === 'string' && data.storeName.trim()) ||
        (typeof data?.name === 'string' && data.name.trim()) ||
        ''
      if (fromStore) return fromStore
    }
  } catch {
    /* ignore */
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', ownerId))
    if (userSnap.exists()) {
      const name = (userSnap.data()?.storeName as string)?.trim()
      if (name) return name
    }
  } catch {
    /* ignore */
  }

  return `Shop (${storeId.slice(0, 8)})`
}
