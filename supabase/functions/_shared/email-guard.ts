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
import { emailPreferencesUrl } from './app-url.ts'

/**
 * `transactional` = réponse à un geste de la personne (confirmation de visite, lien qu'elle
 * a demandé). Les autres sont des envois que NOUS initions.
 *
 * ⚠ LES TROIS NATURES REFUSABLES SONT DISTINCTES DEPUIS LE 16.08.2026, et elles ne le
 * pouvaient pas avant : les trois expéditeurs commerciaux passaient tous `'relance'`, donc
 * une préférence par nature n'aurait rien pu distinguer. `bien` = une fiche de bien envoyée
 * par l'agent, `rappel` = un suivi automatique, `relance` = un message que l'agent écrit.
 * Elles doivent rester alignées sur le CHECK de `contact_suppressions.purpose`.
 *
 * `digest` reste hors registre : il va au STAFF, jamais à un client, et porte son propre
 * `weekly_digest_opt_out`.
 */
export type EmailPurpose = 'transactional' | 'relance' | 'bien' | 'rappel' | 'digest'

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

    // ⛔ DEUX URL, ET C'EST LE POINT — elles n'ont ni le même appelant ni le même besoin.
    //
    // LA MACHINE (`headers`) reste sur l'EDGE. Le POST « one-click » (RFC 8058) est ce que
    // Gmail et Outlook appellent depuis leur propre bouton, et il exige un point d'entrée qui
    // répond à un POST sans navigateur. Cloudflare Pages y rend `405` : mesuré le 15.08.2026,
    // c'est ce qui avait cassé ce mécanisme quand les deux URL n'en faisaient qu'une.
    //
    // L'HUMAIN (`url`) va sur la PAGE de l'app. L'edge ne peut pas servir de HTML : sur le
    // domaine `<ref>.supabase.co`, la passerelle réécrit tout `text/html` en `text/plain` et
    // ajoute une CSP `sandbox` (documenté). La personne recevait donc une page légalement
    // exigée en texte brut. `app.megga.ch/desinscription` sert du vrai HTML, en quatre langues.
    //
    // ⚠ L'ANCIEN PIÈGE N'EST PAS REVENU, et la différence tient à un mot : la route
    // `/desinscription` EXISTE désormais (App.tsx). C'est son absence qui faisait rendre la
    // coquille de l'app en 200 sans rien écrire, pas le fait de viser la SPA.
    const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
    if (!base) throw new Error('SUPABASE_URL absent')
    const t = encodeURIComponent(token)
    const urlMachine = `${base}/functions/v1/email-unsubscribe?t=${t}`
    const urlHumain = emailPreferencesUrl(token)
    return {
      url: urlHumain,
      headers: {
        'List-Unsubscribe': `<${urlMachine}>`,
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
