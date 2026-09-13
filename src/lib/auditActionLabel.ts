/**
 * Libellé lisible d'une action d'`activity_events` — et du type d'objet qu'elle vise.
 *
 * La colonne `action` porte un identifiant TECHNIQUE (snake_case) et rien
 * d'autre — elle sert à filtrer. Le texte affiché vit ici, traduit dans les
 * quatre langues sous `common:audit.action.*`.
 *
 * Auparavant la colonne faisait les deux : la plupart des producteurs y
 * écrivaient du snake_case, affiché brut à l'agent (« match_suggested »), et
 * quelques-uns du français, joli mais infiltrable par aucun filtre. Une même
 * timeline mélangeait donc les deux registres.
 *
 * Le repli rend l'identifiant lisible plutôt que de laisser un trou : une
 * action non traduite s'affiche « Match suggested » et non « match_suggested ».
 * C'est volontairement imparfait — c'est le signal qu'il manque une clé.
 *
 * ⛔ LA TABLE SE LIT EN OBJET, JAMAIS PAR `t('audit.action.<action>')`. i18next lit
 * le point comme SÉPARATEUR de clés : `contact_scores.recompute` (179 lignes en
 * 120 jours, la deuxième action de la production) devenait le chemin
 * `audit.action → contact_scores → recompute`, introuvable — et la clé, pourtant
 * écrite dans les quatre langues, n'était jamais atteinte. La cloche affichait
 * « Contact scores.recompute ». Même piège pour `signature.created` ou
 * `c2pa.published`.
 */
import i18n from '@/i18n'

/** Dernier recours : `kyc_case_opened` → « Kyc case opened ». */
function humanize(action: string): string {
  const s = (action || '').replace(/[_.]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** L'entrée `id` de la table `common:<table>`, lue en objet (identifiants pointés compris). */
function lireTable(table: string, id: string): string {
  const t = i18n.t(table, { ns: 'common', returnObjects: true }) as unknown
  if (!t || typeof t !== 'object') return ''
  const v = (t as Record<string, unknown>)[id]
  return typeof v === 'string' ? v : ''
}

/** Libellé traduit d'une action, avec repli lisible si la clé manque. */
export function auditActionLabel(action: string): string {
  if (!action) return ''
  return lireTable('audit.action', action) || humanize(action)
}

/**
 * Libellé traduit du TYPE d'objet visé (`activity_events.entity_type`).
 *
 * ⚠ Le journal d'audit l'affichait brut, en anglais technique — « visit »,
 * « contact_scores », « kyc_case » — sous la catégorie traduite.
 */
export function auditEntityLabel(entityType: string | null | undefined): string {
  if (!entityType) return '—'
  return lireTable('audit.entity', entityType) || humanize(entityType)
}
