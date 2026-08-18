/**
 * Free Check system account — uses a secondary Firebase Auth app so website
 * shoppers stay signed in while we check/deduct the POS free-check balance.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import { getUserImeiBalance, deductUserImeiBalance } from './imeiPricingService'

function getFreeCheckCredentials() {
  const email = (import.meta.env.VITE_FREE_CHECK_EMAIL as string | undefined)?.trim()
  const password = (import.meta.env.VITE_FREE_CHECK_PASSWORD as string | undefined)?.trim()
  const userId = (import.meta.env.VITE_FREE_CHECK_USER_ID as string | undefined)?.trim() || null
  if (!email || !password) {
    throw new Error('Free Check account is not configured.')
  }
  return { email, password, userId }
}

function getFreeCheckAuth(): Auth {
  const name = 'applebazaar-free-check'
  const existing = getApps().find((a) => a.name === name)
  let app: FirebaseApp
  if (existing) {
    app = existing
  } else {
    app = initializeApp(
      {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
      name
    )
  }
  return getAuth(app)
}

async function withFreeCheckUser<T>(fn: (uid: string) => Promise<T>): Promise<T> {
  const account = getFreeCheckCredentials()
  const auth = getFreeCheckAuth()
  const cred = await signInWithEmailAndPassword(auth, account.email, account.password)
  try {
    return await fn(account.userId || cred.user.uid)
  } finally {
    try {
      await signOut(auth)
    } catch {
      /* ignore */
    }
  }
}

export async function hasFreeCheckBalance(
  amount: number
): Promise<{ hasBalance: boolean; currentBalance?: number; error?: string }> {
  if (!amount || amount <= 0) return { hasBalance: true, currentBalance: 0 }
  try {
    return await withFreeCheckUser(async (uid) => {
      const currentBalance = await getUserImeiBalance(uid)
      return {
        hasBalance: currentBalance >= amount,
        currentBalance,
        error:
          currentBalance >= amount
            ? undefined
            : `Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`,
      }
    })
  } catch (err) {
    return {
      hasBalance: false,
      error: err instanceof Error ? err.message : 'Could not verify Free Check balance',
    }
  }
}

export async function deductFreeCheckBalance(
  amount: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (!amount || amount <= 0) return { success: true }
  try {
    return await withFreeCheckUser((uid) => deductUserImeiBalance(uid, amount))
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deduct Free Check balance',
    }
  }
}

export function isFreeCheckConfigured(): boolean {
  try {
    getFreeCheckCredentials()
    return true
  } catch {
    return false
  }
}
