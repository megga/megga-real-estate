import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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
  const { user } = useAuth()

  const [impersonating, setImpersonating] = useState<ImpersonatedUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const startImpersonate = useCallback((target: ImpersonatedUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(target))
    setImpersonating(target)

    // Audit trail — log impersonation start to activity_events so it
    // appears on AdminSecurityAuditPage. Fire-and-forget (don't block UI).
    supabase.from('activity_events').insert({
      actor_id: user?.id ?? null,
      action: 'impersonate_start',
      entity_type: 'profile',
      entity_id: target.id,
      metadata: {
        target_name: target.full_name,
        target_email: target.email,
        target_role: target.role,
        target_agency: target.agency_name,
      },
    }).then(() => { /* fire-and-forget */ })
  }, [user?.id])

  const stopImpersonate = useCallback(() => {
    const prev = impersonating
    localStorage.removeItem(STORAGE_KEY)
    setImpersonating(null)

    if (prev) {
      supabase.from('activity_events').insert({
        actor_id: user?.id ?? null,
        action: 'impersonate_stop',
        entity_type: 'profile',
        entity_id: prev.id,
        metadata: {
          target_name: prev.full_name,
          target_email: prev.email,
        },
      }).then(() => { /* fire-and-forget */ })
    }
  }, [user?.id, impersonating])

  return { impersonating, startImpersonate, stopImpersonate }
}
