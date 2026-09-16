/**
 * Lecture d'un montant tapé à la main (budget, loyer de la « Fiche express »).
 *
 * Un agent note un budget comme il l'entend au téléphone : « 900k », « 1.2m »,
 * « 1,2 Mio », « CHF 1'250'000.- ». La lecture précédente retirait tout sauf les
 * chiffres et le point — « 900k » partait en base à 900 CHF, « 1.2m » à 1 CHF,
 * sans rien dire.
 *
 * ⚠ Le séparateur est ambigu : « 1.250 » est un groupement (1250), « 1.25m » une
 * décimale. Règle : avec un suffixe, un séparateur unique est décimal ; sans
 * suffixe, il l'est sauf s'il précède exactement trois chiffres. Un séparateur
 * répété (« 1,250,000 ») groupe toujours.
 */

const MULTIPLES: Record<string, number> = {
  k: 1e3,
  m: 1e6, mn: 1e6, mln: 1e6, mio: 1e6, mios: 1e6,
  million: 1e6, millions: 1e6, millionen: 1e6, milione: 1e6, milioni: 1e6,
}

/** Montant entier en CHF, ou `null` si la saisie est vide, nulle ou illisible. */
export function lireMontant(saisie: string): number | null {
  const s = saisie.trim().toLowerCase()
    .replace(/^(chf|fr\.?)\s*/, '')
    .replace(/\s*(chf|fr\.?)$/, '')
    .replace(/[.,]\s*[-–—]$/, '') // « 1'200.- »
    .replace(/[\s'’ʼ]/g, '')
  const m = /^(\d+(?:[.,]\d+)*)([a-z]+)?\.?$/.exec(s)
  if (!m) return null
  const [, chiffres, suffixe] = m
  const multiple = suffixe ? MULTIPLES[suffixe] : 1
  if (!multiple) return null

  const dernier = Math.max(chiffres.lastIndexOf('.'), chiffres.lastIndexOf(','))
  let n: number
  if (dernier < 0) {
    n = Number(chiffres)
  } else {
    const apres = chiffres.slice(dernier + 1)
    const unique = chiffres.indexOf(chiffres[dernier]) === dernier
    const decimal = unique && (!!suffixe || apres.length !== 3)
    n = decimal
      ? Number(`${chiffres.slice(0, dernier).replace(/[.,]/g, '')}.${apres}`)
      : Number(chiffres.replace(/[.,]/g, ''))
  }
  const total = Math.round(n * multiple)
  return Number.isFinite(total) && total > 0 ? total : null
}

/** « 1250000 » → « 1'250'000 » (apostrophe suisse, CLAUDE.md §6). */
export function grouperMilliers(n: number | string): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
