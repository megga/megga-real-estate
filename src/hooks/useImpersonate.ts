import { useState, useCallback } from 'react'

interface ImpersonatedUser {
  id: string
  full_name: string
  email: string
  role: string
  agency_id: string | null
  agency_name: string | null
}

const STORAGE_KEY = 'megga-impersonate'

export function useImpersonate() {
  const [impersonating, setImpersonating] = useState<ImpersonatedUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const startImpersonate = useCallback((user: ImpersonatedUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setImpersonating(user)
  }, [])

  const stopImpersonate = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setImpersonating(null)
  }, [])

  return { impersonating, startImpersonate, stopImpersonate }
}
