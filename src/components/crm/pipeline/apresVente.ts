/**
 * L'APRÈS-VENTE d'une affaire conclue : trois rappels pour l'agent, à 7, 30 et 365 jours
 * (proposition du 27.09.2026). La valeur longue d'une vente est là : l'acheteur devient un futur
 * vendeur et un apporteur d'affaires. Encore faut-il le rappeler.
 *
 * ⚠ CE SONT DES TÂCHES, JAMAIS DES MESSAGES (`channel = 'task'`) : l'agent appelle, écrit, demande.
 *
 * ⚠ MARQUÉES SANS MIGRATION. Une relance d'après-vente porte `type = 'custom'` ET
 * `trigger_rule = 'days_after_event'`, une règle qui dit exactement ce qu'elle est (N jours après la
 * conclusion, dans `trigger_days`). Personne d'autre n'écrit ce couple : le moteur d'automatisation
 * écrit `days_after_event` avec SES types (`post_visit_feedback`, `missing_document`), et le Pipeline
 * écrit `manual`. C'est ce qui les tient hors de « Solder les relances » à la clôture.
 *
 * Module PUR : ni React ni i18n. Les libellés vivent sous `pipeline:apresVente.etapes.*`.
 */

export type EtapeApresVente = 'nouvelles' | 'recommandation' | 'anniversaire'

export const ETAPES_APRES_VENTE: readonly { cle: EtapeApresVente; jours: number; kind: 'call' | 'note' }[] = [
  { cle: 'nouvelles', jours: 7, kind: 'call' },
  { cle: 'recommandation', jours: 30, kind: 'note' },
  { cle: 'anniversaire', jours: 365, kind: 'call' },
]

export const REGLE_APRES_VENTE = 'days_after_event'

/** Le jour d'une étape : `jours` après `depuis`, à 10 h — l'heure où l'on appelle quelqu'un. */
export function dateEtape(depuis: Date, jours: number): Date {
  const d = new Date(depuis)
  d.setDate(d.getDate() + jours)
  d.setHours(10, 0, 0, 0)
  return d
}

/** Une relance appartient-elle à l'après-vente ? */
export function estApresVente(r: { type?: string | null; trigger_rule?: string | null }): boolean {
  return r.type === 'custom' && r.trigger_rule === REGLE_APRES_VENTE
}

/** L'étape d'une relance, d'après son délai ; `null` pour un délai que la suite ne connaît pas. */
export function etapeDe(jours: number | null | undefined): EtapeApresVente | null {
  return ETAPES_APRES_VENTE.find((e) => e.jours === jours)?.cle ?? null
}
