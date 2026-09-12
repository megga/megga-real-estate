// supabase/functions/_shared/reminder-email.ts
//
// Rappel de rendez-vous ou de tâche, envoye au CONTACT par l'automation-engine.
//
// ⚠ Nomme `buildContactReminderEmail` et non `buildReminderEmail` : ce dernier existe deja
// dans `onboarding-email.ts`, pour le rappel J-1 de l'appel d'accueil MEGGA<->agence. Deux
// rappels, deux destinataires, deux gabarits — un nom partage les aurait fait confondre.
//
// Sorti de `send-reminder-email/index.ts` le 15.08.2026.
//
// ⛔ LE CORPS N'ÉTAIT PAS ÉCHAPPÉ. Il était découpé sur les doubles sauts de ligne puis
// injecté tel quel, `<br/>` compris — de même que l'objet, posé brut dans le `<title>`,
// et le nom de l'agent. Le texte vient de gabarits de rappel que l'agent édite : c'est
// une saisie, pas du gabarit figé.
//
// ⚠ PORTE UNE DÉSINSCRIPTION, comme les commerciaux : c'est un envoi automatique, et la
// garde `email-guard` ne dit que qui NE peut PAS recevoir. Le lien est la seule sortie
// offerte depuis le message lui-même — l'unique canal par lequel cette personne nous
// parle. Sa mention de pied ne peut donc pas affirmer l'absence d'un tel lien.

import { INK, MUTED, BODY_INK, CARD_BORDER, FONT, escapeHtml, shell } from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'

export interface ContactReminderInput {
  /** Objet résolu depuis le gabarit de rappel. Sert aussi de titre : même propos. */
  subject: string
  /** Corps résolu. Les paragraphes (double saut) et les retours simples sont préservés. */
  body: string
  agentName: string
  unsubscribeHtml?: string
  /** Langue du CONTACT (`contacts.language`), jamais celle de l'agent. Défaut : français. */
  locale?: AppLocale
}

/**
 * Mention de pied, par langue.
 *
 * ⛔ ELLE NE PEUT PAS ÊTRE UNE CONSTANTE. Elle l'était, en français, et le corps du message
 * pouvait déjà partir en allemand : le pied restait français dans le même document. C'est le
 * défaut déjà fermé sur `buildOptinInviteEmail`, que le test d'alors n'avait pas vu parce
 * qu'il ne regardait que l'attribut `lang`, lequel était juste.
 *
 * ⚠ Elle n'affirme PAS « ceci n'est pas une communication marketing », contrairement aux
 * gabarits transactionnels : ce rappel porte un lien de désinscription, et les deux
 * énoncés se contrediraient.
 */
const LEGAL: Record<AppLocale, string> = {
  fr: 'Cet e-mail vous a été envoyé automatiquement par votre agence via MEGGA.',
  de: 'Diese E-Mail wurde Ihnen automatisch von Ihrer Agentur über MEGGA gesendet.',
  en: 'This email was sent to you automatically by your agency via MEGGA.',
  it: 'Questa e-mail Le è stata inviata automaticamente dalla Sua agenzia tramite MEGGA.',
}

export function buildContactReminderEmail(i: ContactReminderInput): { subject: string; html: string } {
  const l = i.locale ?? 'fr'
  // Paragraphes conservés, mais ÉCHAPPÉS d'abord : on ne rend structurants que les sauts
  // de ligne, jamais le balisage que le texte pourrait contenir.
  const corps = i.body
    .split('\n\n')
    .map((par) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BODY_INK};">${escapeHtml(par).replace(/\n/g, '<br />')}</p>`)
    .join('')

  return {
    subject: i.subject,
    html: shell({
      // Le document se DÉCLARE dans sa langue : un e-mail allemand annoncé `lang="fr"`
      // casse la césure, la synthèse vocale et WCAG 3.1.1.
      lang: l,
      title: i.subject,
      preheader: i.body.replace(/\s+/g, ' ').trim().slice(0, 120),
      legalNote: LEGAL[l],
      unsubscribeHtml: i.unsubscribeHtml,
      headerCta: null,
      bodyHtml: `
     ${corps}
     ${i.agentName
        ? `<div style="margin-top:28px;padding-top:18px;border-top:1px solid ${CARD_BORDER};">
       <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:600;color:${INK};">${escapeHtml(i.agentName)}</p>
       <p style="margin:4px 0 0;font-family:${FONT};font-size:12px;color:${MUTED};">MEGGA</p>
     </div>`
        : ''}`,
    }),
  }
}
