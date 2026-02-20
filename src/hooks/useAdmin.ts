import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      setIsAdmin(false)
      setRoleLoading(false)
      return
    }
    if (!user) return
    let cancelled = false
    setRoleLoading(true)
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return
        const role = snap.exists() ? (snap.data()?.role as string) : ''
        setIsAdmin(role === 'admin')
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return {
    isAdmin,
    loading: authLoading || roleLoading,
  }
}
