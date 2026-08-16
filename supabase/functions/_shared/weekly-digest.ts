// Digest hebdomadaire — logique PURE (zéro I/O, zéro Deno), testable vitest.
// L'e-mail passe par la coquille commune (`email-shell.ts`), pure elle aussi.
import { escapeHtml, FONT, shell } from './email-shell.ts'

// Le bilan est 100% AGRÉGÉ (compteurs) : aucune donnée nominative, donc aucune
// pseudonymisation nécessaire. Ce module tient : le seuil de silence (pas d'email
// une semaine vide), le snapshot chiffré passé à DeepSeek, et le fallback
// déterministe (bilan brut si DeepSeek échoue).

export interface WeeklyCounts {
  dealsMoved: number       // événements pipeline (deal) sur 7 j
  newContacts: number      // contacts créés sur 7 j
  visitsDone: number       // visites effectuées sur 7 j
  kycEvents: number        // événements KYC sur 7 j
  radarSignals: number     // signaux radar ouverts (rappels deal_stagnant/match_ignored)
  activeDeals: number      // dossiers actifs (instantané)
  activePipelineValue: number // valeur pipeline active (CHF)
}

/** Total d'activité de la semaine (hors instantanés) — sert au seuil de silence. */
export function weekActivityTotal(c: WeeklyCounts): number {
  return c.dealsMoved + c.newContacts + c.visitsDone + c.kycEvents
}

/** Semaine « calme » : aucune activité ET aucun signal ouvert → pas d'email. */
export function isQuietWeek(c: WeeklyCounts): boolean {
  return weekActivityTotal(c) === 0 && c.radarSignals === 0
}

/** Montant CHF au format suisse (apostrophe). */
export function formatCHF(n: number): string {
  const rounded = Math.round(n)
  return 'CHF ' + rounded.toLocaleString('de-CH').replace(/[,.]/g, "'")
}

/** Snapshot chiffré (sans PII) passé à DeepSeek pour la mise en mots. */
export function buildDigestSnapshot(c: WeeklyCounts): string {
  return [
    'BILAN DE LA SEMAINE (chiffres agrégés de ton activité) :',
    `- Dossiers qui ont bougé dans le pipeline : ${c.dealsMoved}`,
    `- Nouveaux contacts : ${c.newContacts}`,
    `- Visites effectuées : ${c.visitsDone}`,
    `- Activité conformité (KYC) : ${c.kycEvents}`,
    `- Signaux à traiter (dossiers qui stagnent, correspondances à envoyer) : ${c.radarSignals}`,
    `- Dossiers actifs : ${c.activeDeals} (valeur pipeline ${formatCHF(c.activePipelineValue)})`,
  ].join('\n')
}

/** Fallback déterministe (aucun LLM) : bilan sobre, prêt à envoyer. */
export function fallbackDigest(c: WeeklyCounts): string {
  const lines = [
    `Cette semaine : ${c.dealsMoved} dossier(s) ont avancé, ${c.newContacts} nouveau(x) contact(s), ${c.visitsDone} visite(s) effectuée(s).`,
  ]
  if (c.radarSignals > 0) lines.push(`${c.radarSignals} signal(aux) attendent ton attention (dossiers qui stagnent ou correspondances à envoyer).`)
  lines.push(`Tu as ${c.activeDeals} dossier(s) actif(s) pour une valeur de pipeline de ${formatCHF(c.activePipelineValue)}.`)
  lines.push('Bon week-end.')
  return lines.join(' ')
}

/** Prompt de synthèse (4-6 phrases). DeepSeek ne voit que des chiffres agrégés. */
export function digestPrompt(snapshot: string): string {
  return `Tu es MEGGA AI. Rédige le BILAN HEBDOMADAIRE de l'agent en 4 à 6 phrases, à partir UNIQUEMENT des chiffres agrégés ci-dessous (n'invente aucun chiffre, aucun nom).
Ton direct et encourageant sans flagornerie, tutoiement de l'agent, format suisse (CHF 720'000). Mets en avant ce qui a avancé, puis ce qui demande son attention la semaine prochaine. Pas de liste à puces, du texte fluide. Termine par une phrase courte de clôture.

${snapshot}`
}

/**
 * Le bilan hebdomadaire, dans la coquille commune.
 *
 * ⛔ IL A ÉTÉ LE QUATORZIÈME DESIGN, ET LA PORTE NE POUVAIT PAS LE VOIR.
 *
 * Jusqu'au 16 août 2026, cette fonction rendait un `<div>` autonome : police
 * système, encre claire `#1c1c1e` en dur, pied écrit à la main, ni logo ni
 * structure MEGGA X. Elle a survécu à la migration des treize gabarits parce que
 * `scripts/check-email-shell.mjs` cherche `<!DOCTYPE` ou `<html>` pour repérer une
 * coquille maison — or un FRAGMENT n'en porte aucun. La porte imprimait donc
 * « Migration terminée » pendant que les agents recevaient, chaque vendredi, le
 * dernier e-mail d'avant la direction.
 *
 * ⚠ Le nom `digestHtml` est conservé : c'est le rôle qui compte pour ses appelants,
 * et le renommer aurait mêlé un geste lexical à une correction de fond.
 *
 * Le texte reçu est déjà en clair (agrégats sans PII), mais il vient d'un modèle :
 * il est échappé comme n'importe quelle entrée, puis structuré (saut simple =
 * retour à la ligne).
 *
 * ⚠ `dashboardUrl` ENTRE PAR PARAMÈTRE, il ne se lit pas ici. Ce module se déclare
 * pur dès sa première ligne — « zéro I/O, zéro Deno » — et cette propriété n'est
 * pas décorative : sa spec tourne sous vitest, donc sous Node, où `Deno.env`
 * n'existe pas. Appeler `appDashboardUrl()` d'ici échangerait une adresse en dur
 * contre une spec qui plante. C'est l'appelant, lui-même Deno, qui la fournit.
 */
export function digestHtml(bodyText: string, weekLabel: string, dashboardUrl: string): string {
  const corps = escapeHtml(bodyText).replace(/\n/g, '<br />')
  return shell({
    title: 'Ton bilan de la semaine',
    // L'aperçu ne répète pas l'objet : il date le bilan, ce que l'objet ne dit pas.
    preheader: weekLabel,
    // Transactionnel : l'agent le reçoit au titre de son compte. La désinscription
    // passe par ses préférences — dite ici, faute d'un jeton par destinataire.
    legalNote: 'Tu reçois ce bilan chaque vendredi. Pour ne plus le recevoir, '
      + 'change tes préférences dans MEGGA ou réponds à cet e-mail.',
    headerCta: { href: dashboardUrl, label: 'Ouvrir mon espace' },
    bodyHtml: `<p style="margin:0 0 16px;font-family:${FONT};font-size:13px;color:#8e8e96;">${escapeHtml(weekLabel)}</p>
     <div style="font-family:${FONT};font-size:15px;line-height:1.6;">${corps}</div>`,
  })
}
