/**
 * Une LISTE lue dans l'i18n (`t(clé, { returnObjects: true })`), garantie tableau de chaînes.
 *
 * ⛔ `returnObjects` rend CE QUE LE FICHIER PORTE. Cinq listes des Réglages avaient été
 * écrites en chaînes JSON (`"[\"Calendar : …\"]"`) par la vague i18n de juin 2026 : le
 * `as string[]` des appelants mentait, et `.map` levait — ouvrir le détail de n'importe
 * quelle intégration, ou afficher la carte WhatsApp liée, faisait tomber tout le CRM sur
 * l'écran « Une erreur est survenue ». Les fichiers portent désormais de vrais tableaux
 * (`i18n-listes.spec.ts` y veille) ; ce garde fait qu'une rechute rend une liste vide,
 * jamais un écran blanc.
 */
export function listeTraduite(valeur: unknown): string[] {
  let v = valeur
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try { v = JSON.parse(v) } catch { return [] }
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
