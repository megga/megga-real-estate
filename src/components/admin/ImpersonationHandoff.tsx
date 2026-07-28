/**
 * Réception d'une impersonation démarrée depuis la console admin.
 *
 * La console ouvre `/dashboard?impersonate=<id>` dans un nouvel onglet ; c'est
 * ce composant qui finit le travail, côté CRM — résolution du profil cible,
 * puis `startImpersonate`, qui
 * n'active la vue QUE si la RPC d'audit `admin_log_impersonation` (gardée
 * `is_super_admin`) a bien écrit. Un id passé à la main dans l'URL par un agent
 * ne donne donc rien : la RPC refuse et le paramètre est simplement effacé.
 */
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useImpersonate } from '@/hooks/useImpersonate'
import { useAuth } from '@/hooks/useAuth'

export default function ImpersonationHandoff() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { startImpersonate } = useImpersonate()
  const { user, loading } = useAuth()
  const handledRef = useRef(false)
  const targetId = searchParams.get('impersonate')

  useEffect(() => {
    if (!targetId || loading || !user || handledRef.current) return
    handledRef.current = true

    // Le paramètre part tout de suite : il ne doit rester ni dans la barre
    // d'adresse, ni dans l'historique, quel que soit le sort de la demande.
    const next = new URLSearchParams(searchParams)
    next.delete('impersonate')
    setSearchParams(next, { replace: true })

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, agency_id, agencies(name)')
        .eq('id', targetId)
        .maybeSingle()
      if (error || !data) return

      const agency = data.agencies as { name: string } | { name: string }[] | null
      const agencyName = Array.isArray(agency) ? agency[0]?.name ?? null : agency?.name ?? null

      await startImpersonate({
        id: data.id,
        full_name: data.full_name ?? 'Utilisateur',
        email: data.email ?? '',
        role: data.role ?? 'agent',
        agency_id: data.agency_id,
        agency_name: agencyName,
      })
    })()
  }, [targetId, loading, user, searchParams, setSearchParams, startImpersonate])

  return null
}
