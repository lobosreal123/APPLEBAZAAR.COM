import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type ImeiPricingConfig = {
  services: Record<string, number>
  visibility: Record<string, boolean>
  freeCheckVisibility: Record<string, boolean>
  enabled?: boolean
}

export async function getImeiPricing(): Promise<ImeiPricingConfig> {
  try {
    const snap = await getDoc(doc(db, 'imeiPricing', 'config'))
    if (!snap.exists()) {
      return { services: {}, visibility: {}, freeCheckVisibility: {}, enabled: true }
    }
    const data = snap.data()
    return {
      services: (data.services as Record<string, number>) || {},
      visibility: (data.visibility as Record<string, boolean>) || {},
      freeCheckVisibility: (data.freeCheckVisibility as Record<string, boolean>) || {},
      enabled: data.enabled !== false,
    }
  } catch {
    return { services: {}, visibility: {}, freeCheckVisibility: {}, enabled: true }
  }
}

export async function getUserImeiBalance(userId: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) return 0
  const data = snap.data()
  const balance = data.imeiBalance ?? data.imeibalance
  return typeof balance === 'number' ? balance : Number(balance) || 0
}

export async function deductUserImeiBalance(
  userId: string,
  amount: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const current = await getUserImeiBalance(userId)
    if (current < amount) return { success: false, error: 'Insufficient balance' }
    const newBalance = Math.round((current - amount) * 100) / 100
    await updateDoc(doc(db, 'users', userId), {
      imeiBalance: newBalance,
      imeibalance: newBalance,
      balanceUpdatedAt: new Date().toISOString(),
    })
    return { success: true, newBalance }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deduct balance',
    }
  }
}
