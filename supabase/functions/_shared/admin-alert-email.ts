// supabase/functions/_shared/admin-alert-email.ts
//
// L'alerte plateforme envoyée aux super-admins MEGGA.
//
// ⛔ ELLE N'AVAIT AUCUN HTML. `admin-alerts.ts` postait un `text:` seul à Resend, ce qui
// donnait, dans une boîte de réception, un pavé sans marque, sans lien cliquable et
// horodaté en ISO brut (« 2026-08-14T17:00:00.549114+00:00 »). C'est le message que
// l'équipe reçoit quand la plateforme va mal : celui qui doit se lire le plus vite.
//
// INTERNE, donc dépouillé, comme le rapport hebdomadaire : aucune mention légale (le
// destinataire est l'équipe, pas un client) et une pilule qui mène droit à la console.
//
// ⚠ LE TEXTE BRUT EST CONSERVÉ, et ce n'est pas une politesse : une alerte doit rester
// lisible dans un client qui bloque le HTML, dans une notification de téléphone et dans
// une passerelle d'astreinte. On envoie les deux parts, pas l'une à la place de l'autre.

import {
  MUTED,
  escapeHtml, shell, p, note, button,
} from './email-shell.ts'
import { appDashboardUrl } from './app-url.ts'
import type { Alert } from './admin-alerts.ts'

/** ⚠ app.megga.ch, jamais megga.ch : la vitrine est derrière un mot de passe (401). */
const URL_MONITORING = appDashboardUrl('/dashboard/admin/monitoring')

/**
 * Horodatage lisible, dans le fuseau où travaille l'équipe.
 *
 * `2026-08-14T17:00:00.549114+00:00` demande une conversion mentale à qui lit son
 * téléphone à 23 h. `14.08.2026 19:00` se compare d'un coup d'oeil avec « maintenant »,
 * ce qui est toute la question quand on juge si un cron est vraiment en retard.
 *
 * Une entrée illisible ressort telle quelle : perdre l'information brute serait pire
 * que l'afficher mal.
 */
export function formatCH(value: string | Date | null | undefined): string {
  if (!value) return 'jamais'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const f = new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  // `fr-CH` rend « 14.08.2026, 19:00 » : la virgule n'apporte rien sur une seule ligne.
  return f.format(d).replace(', ', ' ')
}

/**
 * L'e-mail d'alerte, dans ses deux parts.
 *
 * `due` porte les alertes qui ont passé le refroidissement de 24 h ; l'appelant a déjà
 * décidé de quoi parler, ce module décide seulement comment le dire.
 */
export function buildAdminAlertEmail(
  due: Alert[],
  now: Date,
): { subject: string; html: string; text: string } {
  const quand = formatCH(now)
  // L'objet nomme l'alerte quand il n'y en a qu'une : dans une boîte, « Cron
  // weekly-digest-friday en retard » se trie, « 1 alerte plateforme » non.
  const subject = `[MEGGA Admin] ${due.length === 1 ? due[0].subject : `${due.length} alertes plateforme`}`

  const html = shell({
    title: due.length === 1 ? 'Alerte plateforme' : `${due.length} alertes plateforme`,
    // L'aperçu porte la PREMIÈRE alerte, pas un décompte : c'est ce qui décide d'ouvrir
    // maintenant ou plus tard.
    preheader: due[0]?.subject ?? 'Alerte plateforme MEGGA',
    // Interne à l'équipe : aucune mention légale, comme l'avis à l'hôte et le rapport.
    legalNote: null,
    headerCta: { href: URL_MONITORING, label: 'Ouvrir le monitoring' },
    bodyHtml: `
     ${p(`<span style="color:${MUTED};">Relevé du ${escapeHtml(quand)}</span>`, 24)}
     ${due.map((a) => note(a.subject, escapeHtml(a.body))).join('')}
     <div style="margin:4px 0 8px;">${button(URL_MONITORING, 'Ouvrir le monitoring')}</div>`,
  })

  // La part texte reste proche de l'ancien message : elle servait, et un opérateur qui
  // la connaît ne doit pas avoir à réapprendre à la lire.
  const text = `Alertes plateforme MEGGA · ${quand}\n\n`
    + due.map((a) => `• ${a.subject}\n  ${a.body}`).join('\n\n')
    + `\n\nDétails : ${URL_MONITORING}`

  return { subject, html, text }
}
