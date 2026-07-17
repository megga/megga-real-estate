// Digest hebdomadaire — logique PURE (zéro I/O, zéro Deno), testable vitest.
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

/** Rendu HTML minimal (email sobre). Le texte est déjà en clair (pas de PII). */
export function digestHtml(bodyText: string, weekLabel: string): string {
  const safe = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1e">
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e96;margin:0 0 4px">MEGGA AI · Bilan de la semaine</p>
  <p style="font-size:13px;color:#8e8e96;margin:0 0 16px">${weekLabel}</p>
  <div style="font-size:15px;line-height:1.6">${safe}</div>
  <p style="font-size:12px;color:#b0b0b6;margin-top:24px">Tu reçois ce bilan chaque vendredi. Pour te désabonner, réponds à cet email ou change tes préférences dans MEGGA.</p>
</div>`
}
