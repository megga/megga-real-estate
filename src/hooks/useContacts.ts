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

export interface CreateContactInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  type: ContactType
  entityType?: 'pp' | 'pm'
  formData?: Record<string, unknown>
}

interface ContactFilters {
  type?: ContactType
  score?: ContactScore
  search?: string
}

export function useContacts(filters?: ContactFilters) {
  const { user, profile } = useAuth()

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

  // INSERT — auto-invalidates any cached query against `contacts`, including
  // the list above and the per-id useContact() below. Primary key needed so
  // Cache Helpers knows how to identify the row.
  const createFromOnboarding = useInsertMutation(
    supabase.from('contacts'),
    ['id'],
    null, // no result selection
    {
      onSuccess: () => {
        // Cache Helpers handles invalidation; nothing extra to do here.
      },
    }
  )

  async function callCreateFromOnboarding(input: CreateContactInput): Promise<Contact> {
    const row = await createFromOnboarding.mutateAsync([
      {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        type: input.type,
        source: 'onboarding',
        user_id: user?.id ?? null,
        agency_id: profile?.agency_id ?? null,
        form_data: (input.formData ?? null) as unknown as import('@/types/database').Json | null,
      },
    ])
    // useInsertMutation returns an array (because insert can accept many);
    // we only inserted one row.
    return (Array.isArray(row) ? row[0] : row) as unknown as Contact
  }

  return {
    contacts: (contactsQuery.data ?? []) as unknown as Contact[],
    isLoading: contactsQuery.isLoading,
    createFromOnboarding: callCreateFromOnboarding,
    isCreating: createFromOnboarding.isPending,
  }
}

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

export function useCreateContact() {
  const { user, profile } = useAuth()
  const insert = useInsertMutation(supabase.from('contacts'), ['id'])

  return {
    mutateAsync: async (
      input: Omit<CreateContactInput, 'entityType' | 'formData'> & {
        agency_id?: string
        source?: string
        score?: ContactScore
        tags?: string[]
        notes?: string
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
          agency_id: input.agency_id ?? profile?.agency_id ?? null,
          user_id: user?.id ?? null,
        },
      ])
      return (Array.isArray(rows) ? rows[0] : rows) as unknown as Contact
    },
    isPending: insert.isPending,
  }
}

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

export function useDeleteContact() {
  const del = useDeleteMutation(supabase.from('contacts'), ['id'])
  return {
    mutateAsync: async (id: string) => {
      await del.mutateAsync({ id })
    },
    isPending: del.isPending,
  }
}
