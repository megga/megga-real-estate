/**
 * Hooks CRUD des contacts CRM, adossés à Supabase Cache Helpers.
 *
 * Toutes les requêtes sont agency-scopées par RLS. Les clés de cache sont
 * dérivées de la forme de la requête (table + filtres) : les mutations
 * invalident automatiquement les listes/détails qui touchent `contacts`.
 */
// Migrated to @supabase-cache-helpers/postgrest-react-query.
//
// What changed:
//   - useQuery({ queryKey, queryFn }) → useQuery(supabaseQuery) — keys are
//     auto-derived from the query shape (table + filters), so invalidations
//     are matched without us tracking string keys.
//   - useMutation({ mutationFn, onSuccess: invalidateQueries }) →
//     useInsertMutation / useUpdateMutation / useDeleteMutation — these
//     auto-invalidate all queries that hit the same table, so we don't
//     have to remember to invalidate `['contacts']` everywhere.
//
// Reference for future hooks: see PR description on PR #432.
//
// Conditional fetching pattern: pass `null` as the query when the auth
// guard isn't satisfied. Cache Helpers skips the fetch and returns
// `{ data: undefined, isLoading: false }`.

import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
  useDeleteMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Contact, ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'

interface CreateContactInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  type: ContactType
}

interface ContactFilters {
  type?: ContactType
  score?: ContactScore
  search?: string
}

/** Liste des contacts de l'agence, filtrable par type/score/recherche. */
export function useContacts(filters?: ContactFilters) {
  const { user } = useAuth()

  // Build the query — Cache Helpers derives the query key from its shape.
  // SELECT * kept intentionally — Contact type requires all columns and
  // Supabase generated types don't support partial column inference well.
  // RLS agency-scoping ensures only authorized data is returned.
  let baseQuery = supabase.from('contacts').select('*')
  if (filters?.type) baseQuery = baseQuery.eq('type', filters.type)
  if (filters?.score) baseQuery = baseQuery.eq('score', filters.score)
  if (filters?.search) {
    baseQuery = baseQuery.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }
  // Cache Helpers `useQuery` doesn't accept `null` — gate via `enabled`
  // config instead. The query expression is built lazily (no fetch fires
  // until `enabled` is true).
  const contactsQuery = useQuery(
    baseQuery.order('created_at', { ascending: false }),
    { enabled: !!user }
  )


  return {
    contacts: (contactsQuery.data ?? []) as unknown as Contact[],
    isLoading: contactsQuery.isLoading,
  }
}

/** Un contact par id (retourne la shape legacy `Contact`, cf. note ci-dessous). */
export function useContact(id: string | undefined) {
  // Preserve the legacy `Contact` return shape — consumers (e.g.
  // ContactChatPane) still read fields like `ai_seriousness_score` /
  // `budget_announced` that aren't in the generated DB row (separate chip:
  // those fields are either dropped or live on another table).
  const result = useQuery(
    supabase.from('contacts').select('*').eq('id', id ?? '00000000-0000-0000-0000-000000000000').single(),
    { enabled: !!id }
  )
  return {
    ...result,
    data: result.data as unknown as Contact | undefined,
  }
}

/** Création manuelle d'un contact (source `manual` par défaut, score `cold`). */
export function useCreateContact() {
  const { user, profile } = useAuth()
  const insert = useInsertMutation(supabase.from('contacts'), ['id'])

  return {
    mutateAsync: async (
      input: CreateContactInput & {
        agency_id?: string
        source?: string
        score?: ContactScore
        tags?: string[]
        notes?: string
        /** Buyer/tenant search criteria (cantons, budget, types, rooms). */
        search_criteria?: Record<string, unknown> | null
        /** Catch-all for non-mapped UI fields (civility, lang, assigned_to,
         * linked_bien, etc.) — preserved for future migration. */
        form_data?: Record<string, unknown> | null
        /** Identité LBA art. 3 — date ISO `yyyy-mm-dd`, pays en ISO 3166-1 alpha-2. */
        birth_date?: string | null
        nationality?: string | null
        residence_country?: string | null
        home_address?: string | null
      }
    ) => {
      const rows = await insert.mutateAsync([
        {
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          type: input.type,
          source: input.source ?? 'manual',
          score: input.score ?? 'cold',
          tags: input.tags ?? [],
          notes: input.notes ?? null,
          birth_date: input.birth_date ?? null,
          nationality: input.nationality ?? null,
          residence_country: input.residence_country ?? null,
          home_address: input.home_address ?? null,
          agency_id: input.agency_id ?? profile?.agency_id ?? null,
          user_id: user?.id ?? null,
          search_criteria: (input.search_criteria ?? null) as unknown as import('@/types/database').Json | null,
          form_data: (input.form_data ?? null) as unknown as import('@/types/database').Json | null,
        },
      ])
      return (Array.isArray(rows) ? rows[0] : rows) as unknown as Contact
    },
    isPending: insert.isPending,
  }
}

/** Mise à jour partielle d'un contact identifié par `id`. */
export function useUpdateContact() {
  const update = useUpdateMutation(supabase.from('contacts'), ['id'])
  return {
    mutateAsync: async ({ id, ...updates }: { id: string } & Partial<Record<string, unknown>>) => {
      return update.mutateAsync({ id, ...updates } as unknown as Parameters<
        typeof update.mutateAsync
      >[0])
    },
    isPending: update.isPending,
  }
}

/** Suppression d'un contact par id. */
export function useDeleteContact() {
  const del = useDeleteMutation(supabase.from('contacts'), ['id'])
  return {
    mutateAsync: async (id: string) => {
      await del.mutateAsync({ id })
    },
    isPending: del.isPending,
  }
}
