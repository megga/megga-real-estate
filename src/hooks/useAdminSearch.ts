/**
 * Recherche globale admin (palette) sur agences, utilisateurs et biens.
 * Débouncée 300ms, minimum 2 caractères.
 *
 * Les `href` sont préfixés par `ADMIN_CONSOLE_PATH` : la console est montée
 * sous `/dashboard/admin`, une cible à la racine tomberait sur le 404 du CRM.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'

export interface AdminSearchResult {
  type: 'agency' | 'user' | 'property'
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
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      setIsError(false)
      return
    }

    // Une frappe rapide lance plusieurs requêtes ; sans ce drapeau, la plus
    // lente écrase la plus récente et la liste finit désynchronisée de la
    // saisie. Il couvre aussi le démontage pendant une requête en vol.
    let cancelled = false

    const debounce = setTimeout(async () => {
      setLoading(true)
      const q = `%${query}%`

      const [agencies, users, properties] = await Promise.all([
        supabase.from('agencies').select('id, name, email').ilike('name', q).limit(5),
        supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.${q},email.ilike.${q}`).limit(5),
        supabase.from('properties').select('id, title, city, price').or(`title.ilike.${q},city.ilike.${q}`).limit(5),
      ])
      if (cancelled) return

      // Les erreurs étaient ignorées : une requête refusée rendait `data: null`,
      // donc zéro résultat — indiscernable d'une recherche sans correspondance.
      setIsError(!!(agencies.error || users.error || properties.error))

      const mapped: AdminSearchResult[] = [
        ...(agencies.data ?? []).map(a => ({
          type: 'agency' as const,
          id: a.id,
          title: a.name,
          subtitle: a.email ?? 'Agence',
          href: `${ADMIN_CONSOLE_PATH}/agencies/${a.id}`,
        })),
        ...(users.data ?? []).map(u => ({
          type: 'user' as const,
          id: u.id,
          title: u.full_name ?? u.email,
          subtitle: `${u.role} · ${u.email}`,
          href: `${ADMIN_CONSOLE_PATH}/users`,
        })),
        ...(properties.data ?? []).map(p => ({
          type: 'property' as const,
          id: p.id,
          title: p.title ?? 'Bien',
          subtitle: p.city ?? '',
          href: `${ADMIN_CONSOLE_PATH}/marketplace`,
        })),
      ]

      setResults(mapped)
      setLoading(false)
    }, 300)

    return () => { cancelled = true; clearTimeout(debounce) }
  }, [query])

  return { results, loading, isError }
}
