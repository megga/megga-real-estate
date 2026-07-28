/**
 * Libellé lisible d'une action d'`activity_events`.
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
 */
import i18n from '@/i18n'

/** Dernier recours : `kyc_case_opened` → « Kyc case opened ». */
function humanize(action: string): string {
  const s = (action || '').replace(/[_.]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** Libellé traduit d'une action, avec repli lisible si la clé manque. */
export function auditActionLabel(action: string): string {
  if (!action) return ''
  const key = `audit.action.${action}`
  const label = i18n.t(key, { ns: 'common', defaultValue: '' })
  return label || humanize(action)
}
