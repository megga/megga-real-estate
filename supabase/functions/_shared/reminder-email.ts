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

export interface ContactReminderInput {
  /** Objet résolu depuis le gabarit de rappel. Sert aussi de titre : même propos. */
  subject: string
  /** Corps résolu. Les paragraphes (double saut) et les retours simples sont préservés. */
  body: string
  agentName: string
  unsubscribeHtml?: string
}

export function buildContactReminderEmail(i: ContactReminderInput): { subject: string; html: string } {
  // Paragraphes conservés, mais ÉCHAPPÉS d'abord : on ne rend structurants que les sauts
  // de ligne, jamais le balisage que le texte pourrait contenir.
  const corps = i.body
    .split('\n\n')
    .map((par) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BODY_INK};">${escapeHtml(par).replace(/\n/g, '<br />')}</p>`)
    .join('')

  return {
    subject: i.subject,
    html: shell({
      title: i.subject,
      preheader: i.body.replace(/\s+/g, ' ').trim().slice(0, 120),
      legalNote: 'Cet e-mail vous a été envoyé automatiquement par votre agence via MEGGA.',
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
