import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * useDeleteAccount — nLPD art. 32 (right to erasure).
 *
 * Calls the `delete-account` Edge Function which:
 * - Refuses if KYC cases are in progress or the user is the sole admin.
 * - Anonymises profile, contacts, activity_events (audit trail preserved).
 * - Keeps KYC cases + KYC documents untouched (LBA art. 7 al. 3 — 10y).
 * - Deletes the Supabase Auth user.
 *
 * On success, the caller should `supabase.auth.signOut()` and redirect.
 * On error, read `error.code` to display a localised message:
 *   - 'KYC_PENDING' -> dossiers KYC en cours
 *   - 'SOLE_ADMIN'  -> seul admin de l'agence
 *   - any other     -> generic error
 */

export interface DeleteAccountError extends Error {
  code?: 'KYC_PENDING' | 'SOLE_ADMIN' | 'UNKNOWN'
  count?: number
  agencyId?: string
}

export function useDeleteAccount() {
  return useMutation<{ success: true; message: string }, DeleteAccountError, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean
        message?: string
        error?: string
        count?: number
        agency_id?: string
      }>('delete-account', { method: 'POST' })

      if (error) {
        // Try to extract structured error from the response body
        let body: Record<string, unknown> | null = null
        try {
          const ctx = (error as unknown as { context?: { response?: Response } }).context
          const resp = ctx?.response
          if (resp) body = (await resp.clone().json()) as Record<string, unknown>
        } catch {
          body = null
        }
        const code =
          (body?.error as string | undefined) === 'KYC_PENDING'
            ? 'KYC_PENDING'
            : (body?.error as string | undefined) === 'SOLE_ADMIN'
              ? 'SOLE_ADMIN'
              : 'UNKNOWN'
        const message =
          (body?.message as string | undefined) ||
          (body?.error as string | undefined) ||
          error.message
        const err = new Error(message) as DeleteAccountError
        err.code = code
        if (body?.count) err.count = body.count as number
        if (body?.agency_id) err.agencyId = body.agency_id as string
        throw err
      }

      if (!data?.success) {
        const err = new Error(data?.error || data?.message || 'Unknown error') as DeleteAccountError
        err.code =
          data?.error === 'KYC_PENDING'
            ? 'KYC_PENDING'
            : data?.error === 'SOLE_ADMIN'
              ? 'SOLE_ADMIN'
              : 'UNKNOWN'
        if (data?.count) err.count = data.count
        if (data?.agency_id) err.agencyId = data.agency_id
        throw err
      }

      return { success: true as const, message: data.message || '' }
    },
  })
}
