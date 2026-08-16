// supabase/functions/_shared/relance-email.ts
//
// Relance commerciale : objet et corps sont composés PAR L'AGENT (ou proposés par le
// copilote puis validés par lui), pas par un gabarit.
//
// Sorti de `send-relance-email/index.ts` le 15.08.2026. Ce gabarit-ci échappait déjà
// correctement son contenu — c'est le seul des treize dans ce cas, il faut le dire.
//
// ⚠ CONSÉQUENCE DU TEXTE LIBRE : le corps est rendu en `white-space:pre-line`, donc les
// sauts de ligne de l'agent sont conservés tels quels. C'est ce qui fait qu'une relance
// écrite à la main ressemble à un message écrit à la main, et non à un publipostage.
//
// ⚠ COMME `property-email`, IL PORTE UNE DÉSINSCRIPTION : c'est un envoi commercial. Sa
// mention de pied ne peut donc pas être celle des transactionnels.

import { MUTED, BODY_INK, CARD_BORDER, FONT, escapeHtml, shell } from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'

export interface RelanceEmailInput {
  /** Objet composé par l'agent. Sert aussi de titre : c'est le même propos. */
  subject: string
  /** Corps en texte brut. Les sauts de ligne sont préservés. */
  body: string
  agentName?: string | null
  /** Signature multiligne de l'agent, si elle est configurée. */
  agentSignature?: string | null
  unsubscribeHtml?: string
  /**
   * Langue du CONTACT (`contacts.language`), jamais celle de l'agent.
   *
   * ⚠ ELLE NE GOUVERNE QUE CE QUE MEGGA ÉCRIT — la mention de pied, le pied de
   * désinscription et l'attribut `lang` du document. Le CORPS reste dans la langue où
   * l'agent (ou le copilote) l'a rédigé : le traduire serait réécrire ses mots.
   *
   * ⛔ Un corps français sous un `lang="de"` reste donc possible, et c'est assumé : mieux
   * vaut une mention légale comprise qu'un document qui ment sur les deux.
   */
  locale?: AppLocale
}

/**
 * Mention de pied, par langue. Elle n'affirme PAS l'absence de désinscription : cet envoi
 * est commercial et porte le lien, contrairement aux transactionnels.
 *
 * Première phrase identique à celle de `property-email`, l'autre envoi commercial — les
 * deux disent la même chose au même destinataire, les désaccorder n'aurait aucun sens.
 */
const LEGAL: Record<AppLocale, string> = {
  fr: 'Vous recevez cet e-mail parce que vous êtes en relation avec cette agence via MEGGA.',
  de: 'Sie erhalten diese E-Mail, weil Sie über MEGGA mit dieser Agentur in Kontakt stehen.',
  en: 'You are receiving this email because you are in contact with this agency via MEGGA.',
  it: 'Riceve questa e-mail perché è in contatto con questa agenzia tramite MEGGA.',
}

export function buildRelanceEmail(i: RelanceEmailInput): { subject: string; html: string } {
  const signature = i.agentSignature
    ? `<div style="margin-top:28px;padding-top:18px;border-top:1px solid ${CARD_BORDER};font-family:${FONT};font-size:13px;color:${BODY_INK};white-space:pre-line;">${escapeHtml(i.agentSignature)}</div>`
    : i.agentName
      ? `<div style="margin-top:28px;padding-top:18px;border-top:1px solid ${CARD_BORDER};font-family:${FONT};font-size:13px;color:${BODY_INK};">${escapeHtml(i.agentName)}<br /><span style="font-size:11px;color:${MUTED};">MEGGA</span></div>`
      : ''

  return {
    subject: i.subject,
    html: shell({
      // Le titre EST l'objet : l'agent a écrit un propos, en inventer un second au-dessus
      // le contredirait ou ferait doublon.
      title: i.subject,
      // ⚠ L'aperçu ne peut PAS être écrit d'avance ici : le message est libre. On y met
      // donc le début du corps, ce que le client de messagerie ferait de toute façon,
      // mais nettoyé de ses sauts de ligne.
      preheader: i.body.replace(/\s+/g, ' ').trim().slice(0, 120),
      lang: i.locale ?? 'fr',
      legalNote: LEGAL[i.locale ?? 'fr'],
      unsubscribeHtml: i.unsubscribeHtml,
      headerCta: null,
      bodyHtml: `
     <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_INK};white-space:pre-line;">${escapeHtml(i.body)}</div>
     ${signature}`,
    }),
  }
}
