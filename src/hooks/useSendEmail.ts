/**
 * Hook d'envoi d'un email « fiche bien » à un contact via l'edge function
 * `send-property-email`. Sert à transmettre une annonce marché (photo, prix,
 * lien source) avec un message optionnel de l'agent.
 *
 * ⚠ Passe par `supabase.functions.invoke`, qui attache le JWT de SESSION. Ce hook
 * envoyait la clé anon en `Authorization: Bearer` — que `requireAgentAuth` refuse
 * par construction (une clé d'API n'est pas un utilisateur) : l'envoi depuis la
 * fiche d'annonce externe répondait 401 à tous les coups (audit du 13.09.2026).
 */
import { useMutation } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface PropertyEmailPayload {
  title: string
  price: number
  address: string
  city: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  source_url: string
  source_agency: string | null
  source_portal: string
}

/**
 * ⚠ Aucun nom ni téléphone d'agent : l'Edge Function signe avec le PROFIL de
 * l'appelant. Ce hook comblait leur absence par « Gregory Lyonnet · +41 22 000 00 00 »,
 * et toute agence envoyait donc ses fiches sous ce nom.
 */
export interface SendPropertyEmailParams {
  to: string
  contactFirstName: string
  property: PropertyEmailPayload
  message?: string
}

interface SendEmailResult {
  success: boolean
  emailId?: string
  to: string
  error?: string
}

/** POST vers `send-property-email` ; la signature est posée côté serveur. */
async function sendPropertyEmail(params: SendPropertyEmailParams): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke<SendEmailResult>('send-property-email', {
    body: params,
  })
  if (error) {
    // Le corps de refus porte un `message` lisible (destinataire hors périmètre, quota) ;
    // à défaut, le code d'erreur.
    let detail = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const b = await error.context.json()
        detail = (b?.message as string | undefined) ?? (b?.error as string | undefined) ?? detail
      } catch {
        /* garde le message générique */
      }
    }
    throw new Error(detail)
  }
  return data ?? { success: true, to: params.to }
}

/** Mutation React Query enveloppant {@link sendPropertyEmail}. */
export function useSendPropertyEmail() {
  return useMutation({
    mutationFn: sendPropertyEmail,
  })
}
