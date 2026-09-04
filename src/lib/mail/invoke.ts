/**
 * Un seul point d'appel des edges de la Messagerie.
 *
 * ⛔ `functions.invoke` range TOUTE réponse non-2xx dans `error`, dont le message
 * est « Edge Function returned a non-2xx status code » — le motif du serveur est
 * dans le CORPS. On le dépaquette ici (comme `useSendAgentEmail`), sans quoi
 * l'écran ne pourrait pas distinguer `provider_not_configured` (un état à
 * montrer) d'une vraie panne.
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type MailEdge = 'mail-oauth' | 'mail-sync' | 'mail-actions' | 'mail-send' | 'mail-attachment'
export interface MailInvokeResult<T> { data: T | null; error: string | null; detail?: string; status: number }

/** Appelle une edge de la Messagerie et rend le motif du serveur, jamais « non-2xx ». */
export async function invokeMail<T = Record<string, unknown>>(name: MailEdge, body: Record<string, unknown>): Promise<MailInvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (!error) return { data: data ?? null, error: null, status: 200 }
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? 500
    try {
      const j = (await error.context.json()) as { error?: string; detail?: string }
      return { data: null, error: j.error ?? `http_${status}`, detail: j.detail, status }
    } catch {
      return { data: null, error: `http_${status}`, status }
    }
  }
  return { data: null, error: error.message, status: 0 }
}
