// Reconnaissance et consommation d'un jeton d'opt-in `click_to_wa` reçu dans un message.
//
// Le jeton voyage dans le CORPS d'un message WhatsApp, pré-rempli par le lien `wa.me?text=`.
// Deux conséquences qui n'existent pas pour un jeton d'URL :
//   · il est VISIBLE et recopiable par la personne comme par quiconque lit la conversation.
//     C'est pourquoi la sécurité ne tient PAS au secret du jeton mais à l'égalité entre
//     l'expéditeur et le numéro invité, vérifiée en SQL (`consume_wa_optin_invite`) ;
//   · il atterrit dans `whatsapp_messages.body`. On ne l'y recopie pas : le fil de
//     conversation garde un marqueur, pas un porteur d'autorisation.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from './magic-link-token.ts'

/**
 * Préfixe du message pré-rempli.
 *
 * Il rend le message LISIBLE par la personne qui l'envoie — elle voit ce qu'elle accepte,
 * pas une chaîne opaque — et il donne au webhook un discriminant sûr, qui ne dépend pas
 * d'une heuristique sur la forme d'un base64.
 */
export const OPTIN_PREFIX = 'MEGGA-OUI'

/** Ce qu'on enregistre à la place du jeton dans le fil. */
export const OPTIN_BODY_PLACEHOLDER = '[consentement WhatsApp]'

/** Extrait le jeton d'un corps de message, ou null si ce n'en est pas un. */
export function extractOptinToken(body: string | null | undefined): string | null {
  const s = (body ?? '').trim()
  if (!s.toUpperCase().startsWith(OPTIN_PREFIX)) return null
  const reste = s.slice(OPTIN_PREFIX.length).trim()
  // Un jeton est `<base64url>.<base64url>` — on ne prend que le premier mot, la personne
  // pouvant avoir ajouté du texte avant d'envoyer.
  const jeton = reste.split(/\s+/)[0] ?? ''
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jeton) ? jeton : null
}

export type OptinOutcome =
  | 'ok' | 'expired' | 'already_consumed' | 'phone_mismatch' | 'unknown'
  | 'invalid_token' | 'wrong_kind' | 'error'

/**
 * Vérifie la signature, puis délègue la DÉCISION au SQL.
 *
 * ⛔ Ne jette jamais : appelé depuis le webhook, qui ne doit pas rendre 500 sur une erreur
 * métier — un jeton mal formé suffirait sinon à déclencher une tempête de rejeux Meta.
 */
export async function consumeOptinToken(
  admin: SupabaseClient,
  a: { token: string; fromPhone: string; messageId: string | null },
): Promise<OptinOutcome> {
  try {
    const v = await verifyMagicLinkToken(a.token)
    if (!v.valid || !v.payload) {
      return v.reason === 'expired' ? 'expired' : 'invalid_token'
    }
    // ⛔ Le `k` n'est pas décoratif : le MÊME secret signe les liens magiques KYC et les
    // jetons de rendez-vous. Sans ce contrôle, un jeton d'une autre famille collé dans
    // WhatsApp serait formellement recevable comme consentement.
    if (v.payload.k !== 'wa_optin') return 'wrong_kind'

    const { data, error } = await admin.rpc('consume_wa_optin_invite', {
      p_invite_id: v.payload.id,
      p_wa_phone: a.fromPhone,
      p_message_id: a.messageId,
    })
    if (error) {
      console.error('whatsapp optin: consommation refusée:', error.message.slice(0, 120))
      return 'error'
    }
    return (String(data ?? 'error') as OptinOutcome)
  } catch (e) {
    console.error('whatsapp optin: échec:', String((e as Error)?.message ?? 'error').slice(0, 120))
    return 'error'
  }
}
