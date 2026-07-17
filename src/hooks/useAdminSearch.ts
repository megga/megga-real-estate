/**
 * Recherche globale admin (palette) sur agences, utilisateurs, biens et tickets
 * de support. Débouncée 300ms, minimum 2 caractères ; la requête tickets est
 * tolérante à l'absence de la table.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminSearchResult {
  type: 'agency' | 'user' | 'property' | 'ticket'
  id: string
  title: string
  subtitle: string
  href: string
}

/**
 * Recherche multi-entités déclenchée par `query`, retourne { results, loading }.
 */
export function useAdminSearch(query: string) {
  'use no memo' // opt-out de la mémoïsation du compilateur React pour ce hook
  const [results, setResults] = useState<AdminSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    const debounce = setTimeout(async () => {
      setLoading(true)
      const q = `%${query}%`

      const [agencies, users, properties] = await Promise.all([
        supabase.from('agencies').select('id, name, email').ilike('name', q).limit(5),
        supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.${q},email.ilike.${q}`).limit(5),
        supabase.from('properties').select('id, title, city, price').or(`title.ilike.${q},city.ilike.${q}`).limit(5),
      ])

      // Tickets query is optional — table may not exist yet
      let ticketResults: AdminSearchResult[] = []
      try {
        const { data } = await supabase
          .from('support_tickets')
          .select('id, subject, status')
          .ilike('subject', q)
          .limit(5)
        ticketResults = (data ?? []).map(t => ({
          type: 'ticket' as const,
          id: t.id,
          title: t.subject ?? 'Ticket',
          subtitle: t.status ?? '',
          href: '/dashboard/admin/support',
        }))
      } catch {
        /* table may not exist — silently ignore */
      }

      const mapped: AdminSearchResult[] = [
        ...(agencies.data ?? []).map(a => ({
          type: 'agency' as const,
          id: a.id,
          title: a.name,
          subtitle: a.email ?? 'Agence',
          href: `/dashboard/admin/agencies/${a.id}`,
        })),
        ...(users.data ?? []).map(u => ({
          type: 'user' as const,
          id: u.id,
          title: u.full_name ?? u.email,
          subtitle: `${u.role} · ${u.email}`,
          href: '/dashboard/admin/users',
        })),
        ...(properties.data ?? []).map(p => ({
          type: 'property' as const,
          id: p.id,
          title: p.title ?? 'Bien',
          subtitle: p.city ?? '',
          href: '/dashboard/admin/marketplace',
        })),
        ...ticketResults,
      ]

      setResults(mapped)
      setLoading(false)
    }, 300)

    return () => clearTimeout(debounce)
  }, [query])

  return { results, loading }
}
