// Garde d'envoi E-MAIL — le pendant de `whatsapp-outbound-guard.ts` pour l'autre canal.
//
// POURQUOI ELLE EXISTE. Six expéditeurs Resend écrivaient à des personnes sans jamais lire
// le registre : quelqu'un qui disait STOP sur WhatsApp continuait de recevoir des relances
// par e-mail. Le refus était enregistré, opposable — et ignoré par la moitié des canaux.
//
// ⛔ ET LA PROMESSE ÉTAIT FAUSSE. `send-relance-email` écrivait « Si vous ne souhaitez plus
// recevoir de messages, répondez avec STOP » depuis `noreply@megga.ch`, SANS `reply_to`, et
// aucune réception d'e-mail n'existe dans le dépôt. Cette phrase ne pouvait
// structurellement pas être tenue — c'est pire que l'absence de mécanisme, parce qu'elle
// fait croire que le refus a été pris en compte. Elle est remplacée par un lien réel et par
// les en-têtes `List-Unsubscribe` que les clients de messagerie savent afficher.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signMagicLinkToken, expiryFromDays } from './magic-link-token.ts'

/**
 * `transactional` = réponse à un geste de la personne (confirmation de visite, lien qu'elle
 * a demandé). Les autres sont des envois que NOUS initions.
 */
export type EmailPurpose = 'transactional' | 'relance' | 'digest'

export type EmailGuardVerdict =
  | { allowed: true; reason: 'ok' | 'ok_transactional' }
  | { allowed: false; reason: 'unsubscribed' | 'invalid_email' | 'guard_unavailable' }

/**
 * Le destinataire peut-il recevoir cet e-mail ?
 *
 * ⛔ FAIL CLOSED sur un verdict indisponible — sauf en transactionnel, où refuser
 * priverait la personne d'une réponse qu'elle attend et qu'aucune loi n'interdit.
 */
export async function emailSendAllowed(
  admin: SupabaseClient,
  a: { to: string; purpose: EmailPurpose; contactId?: string | null },
): Promise<EmailGuardVerdict> {
  try {
    const { data, error } = await admin.rpc('email_send_allowed', {
      p_email: a.to, p_purpose: a.purpose, p_contact_id: a.contactId ?? null,
    })
    if (error) throw new Error(error.message)
    const v = (data as Array<{ allowed: boolean; reason: string }> | null)?.[0]
    if (!v) throw new Error('verdict absent')
    return v.allowed
      ? { allowed: true, reason: v.reason as 'ok' | 'ok_transactional' }
      : { allowed: false, reason: v.reason as 'unsubscribed' | 'invalid_email' }
  } catch (e) {
    console.error('email guard: verdict indisponible:', String((e as Error)?.message ?? 'error').slice(0, 120))
    return a.purpose === 'transactional'
      ? { allowed: true, reason: 'ok_transactional' }
      : { allowed: false, reason: 'guard_unavailable' }
  }
}

/** Durée de validité du lien de désinscription. Long : un e-mail se relit des mois après. */
const UNSUB_DAYS = 365

/**
 * Lien + en-têtes de désinscription.
 *
 * `List-Unsubscribe-Post` implémente le « one-click » (RFC 8058) : Gmail et Outlook
 * affichent alors leur propre bouton « Se désinscrire », et le clic part en POST sans que
 * la personne ait à ouvrir quoi que ce soit. C'est le mécanisme que les fournisseurs
 * ATTENDENT — son absence pèse sur la délivrabilité de tout le domaine, pas seulement de
 * ce message.
 *
 * ⚠ Le jeton porte l'ADRESSE, pas un identifiant de ligne : la personne qui se désinscrit
 * n'existe pas forcément dans nos contacts (destinataire transféré, adresse de suivi).
 */
export async function unsubscribeHeaders(
  to: string, contactId?: string | null,
): Promise<{ url: string; headers: Record<string, string> } | null> {
  try {
    const { unix } = expiryFromDays(UNSUB_DAYS)
    const token = await signMagicLinkToken({
      id: contactId ?? '-', exp: unix, k: 'unsub', e: to.trim().toLowerCase(),
    })
    // ⛔ LE HÔTE DES EDGE FUNCTIONS, jamais `app.megga.ch`. Cloudflare Pages y sert un
    // fallback SPA : mesuré le 15.08.2026, le GET du pied de page rend la coquille de l'app
    // en `200 text/html` et le POST one-click de Gmail rend `405`. Le lien affichait donc
    // « c'est fait » sans écrire une seule ligne dans `contact_suppressions` — un mécanisme
    // légalement exigé qui échoue en signalant le succès. Le hôte Supabase, lui, rend du
    // `application/json` : c'est le `content-type` qui distingue, jamais le code HTTP.
    const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
    if (!base) throw new Error('SUPABASE_URL absent')
    const url = `${base}/functions/v1/email-unsubscribe?t=${encodeURIComponent(token)}`
    return {
      url,
      headers: {
        'List-Unsubscribe': `<${url}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  } catch (e) {
    // Sans secret HMAC, pas de lien signé — mais un e-mail transactionnel doit pouvoir
    // partir quand même. On le dit fort plutôt que d'échouer en silence.
    console.error('email guard: lien de désinscription indisponible:', String((e as Error)?.message ?? 'error').slice(0, 120))
    return null
  }
}

/** Pied de page honnête : un lien qui marche, à la place d'une promesse qui ne pouvait pas. */
export function unsubscribeFooterHtml(url: string, lang = 'fr'): string {
  const T: Record<string, string> = {
    fr: `Vous recevez cet e-mail parce que vous êtes en relation avec notre agence. <a href="${url}" style="color:#9ca3af;">Se désinscrire</a>.`,
    en: `You are receiving this because you are in touch with our agency. <a href="${url}" style="color:#9ca3af;">Unsubscribe</a>.`,
    de: `Sie erhalten diese E-Mail, weil Sie mit unserer Agentur in Kontakt stehen. <a href="${url}" style="color:#9ca3af;">Abmelden</a>.`,
    it: `Riceve questa e-mail perché è in contatto con la nostra agenzia. <a href="${url}" style="color:#9ca3af;">Cancellarsi</a>.`,
  }
  return `<p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:20px;line-height:1.5;">${T[lang] ?? T.fr}</p>`
}
