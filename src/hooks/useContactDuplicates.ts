import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Sprint 3 — Recherche de doublons potentiels avant création de contact.
 *
 * Appelle la RPC `find_contact_duplicates` (migration 20260517_004) qui
 * retourne 0..5 contacts existants dans l'agence courante matchant sur
 * email exact, téléphone normalisé, ou prénom+nom exact.
 *
 * Usage :
 *   const { data: duplicates } = useFindContactDuplicates({
 *     email: 'sophie@example.com',
 *     phone: '+41 79 555 12 34',
 *     firstName: 'Sophie',
 *     lastName: 'Marchand',
 *   })
 *
 * Si `data.length > 0`, afficher la modal de fusion avant `useCreateContact`.
 * Le scope est l'agence (red-team F2) : un homonyme chez un autre agent de
 * la même agence remonte aussi.
 *
 * Spec : RED_TEAM_SPRINT_3.md §B.B3.
 */

export type DuplicateMatchKind = 'email' | 'phone' | 'name'

export interface DuplicateCandidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  type: string
  created_at: string
  user_id: string | null
  match_kind: DuplicateMatchKind
  match_priority: number
}

interface FindDuplicatesInput {
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
}

function hasAnySignal(input: FindDuplicatesInput): boolean {
  return Boolean(
    (input.email && input.email.trim()) ||
    (input.phone && input.phone.trim()) ||
    (input.firstName && input.lastName && input.firstName.trim() && input.lastName.trim())
  )
}

export function useFindContactDuplicates(input: FindDuplicatesInput) {
  return useQuery({
    queryKey: ['contact-duplicates', input.email, input.phone, input.firstName, input.lastName],
    queryFn: async (): Promise<DuplicateCandidate[]> => {
      const { data, error } = await supabase.rpc('find_contact_duplicates', {
        p_email: input.email?.trim() || undefined,
        p_phone: input.phone?.trim() || undefined,
        p_first_name: input.firstName?.trim() || undefined,
        p_last_name: input.lastName?.trim() || undefined,
      })
      if (error) throw error
      return (data ?? []) as DuplicateCandidate[]
    },
    enabled: hasAnySignal(input),
    staleTime: 30_000,
  })
}
