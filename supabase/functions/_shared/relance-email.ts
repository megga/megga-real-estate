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

export interface RelanceEmailInput {
  /** Objet composé par l'agent. Sert aussi de titre : c'est le même propos. */
  subject: string
  /** Corps en texte brut. Les sauts de ligne sont préservés. */
  body: string
  agentName?: string | null
  /** Signature multiligne de l'agent, si elle est configurée. */
  agentSignature?: string | null
  unsubscribeHtml?: string
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
      legalNote: 'Vous recevez cet e-mail parce que vous êtes en relation avec cette agence via MEGGA.',
      unsubscribeHtml: i.unsubscribeHtml,
      headerCta: null,
      bodyHtml: `
     <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_INK};white-space:pre-line;">${escapeHtml(i.body)}</div>
     ${signature}`,
    }),
  }
}
