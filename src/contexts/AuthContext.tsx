import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { SignUpProfileInput, UserProfile } from '../types/userProfile'

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  profileLoading: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signUp: (email: string, password: string, profileInput: SignUpProfileInput) => Promise<void>
  updateProfile: (updates: Partial<Pick<UserProfile, 'username' | 'phone'>>) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  const username = String(data.username ?? '').trim()
  const phone = String(data.phone ?? '').trim()
  const email = String(data.email ?? '').trim()
  if (!username && !phone && !email) return null
  return {
    username,
    phone,
    email,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    source: data.source ? String(data.source) : undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    fetchUserProfile(user.uid)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    try {
      setProfile(await fetchUserProfile(user.uid))
    } finally {
      setProfileLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const resetPassword = async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) throw new Error('Please enter your email address.')
    await sendPasswordResetEmail(auth, trimmed)
  }

  const signUp = async (
    email: string,
    password: string,
    profileInput: SignUpProfileInput
  ) => {
    const username = profileInput.username.trim()
    const phone = profileInput.phone.trim()
    if (!username) throw new Error('Username is required.')
    if (!phone) throw new Error('Phone number is required.')

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    const now = new Date().toISOString()
    await setDoc(doc(db, 'users', cred.user.uid), {
      username,
      phone,
      email: email.trim().toLowerCase(),
      createdAt: now,
      source: 'applebazaar',
    })
    setProfile({
      username,
      phone,
      email: email.trim().toLowerCase(),
      createdAt: now,
      source: 'applebazaar',
    })
  }

  const updateProfile = async (
    updates: Partial<Pick<UserProfile, 'username' | 'phone'>>
  ) => {
    if (!user) throw new Error('Not signed in')
    const now = new Date().toISOString()
    const payload: Record<string, string> = { updatedAt: now }
    if (updates.username !== undefined) {
      const username = updates.username.trim()
      if (!username) throw new Error('Username is required.')
      payload.username = username
    }
    if (updates.phone !== undefined) {
      const phone = updates.phone.trim()
      if (!phone) throw new Error('Phone number is required.')
      payload.phone = phone
    }
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await updateDoc(ref, payload)
    } else {
      await setDoc(ref, {
        username: payload.username ?? '',
        phone: payload.phone ?? '',
        email: (user.email ?? '').toLowerCase(),
        createdAt: now,
        source: 'applebazaar',
        ...payload,
      })
    }
    await refreshProfile()
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
  }

  const value: AuthContextValue = {
    user,
    profile,
    profileLoading,
    loading,
    signIn,
    resetPassword,
    signUp,
    updateProfile,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
