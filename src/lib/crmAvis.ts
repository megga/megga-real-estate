/**
 * Le magasin de l'avis du CRM (« Brouillon enregistré ») — lu par `CrmAvis`.
 *
 * ⚠ Au niveau du MODULE, pas dans un contexte : l'avis part souvent d'un écran qui disparaît
 * (« Nouveau bien » annonce son brouillon au moment où on le quitte). C'est la coquille de
 * l'écran d'ARRIVÉE qui l'affiche ; un seul avis à la fois, le suivant remplace le précédent.
 */

export interface AvisCrm { id: number; texte: string; alerte: boolean }

let courant: AvisCrm | null = null
let suivant = 1
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

/** Affiche un avis en bas de l'écran actif. `alerte` : rien n'a été fait, la coche le dirait réussi. */
export function annoncerAvis(texte: string, opts?: { alerte?: boolean }): void {
  courant = { id: suivant++, texte, alerte: !!opts?.alerte }
  prevenir()
}

/** Retire l'avis `id` s'il est toujours celui affiché (un avis plus récent ne s'efface pas à sa place). */
export function retirerAvis(id: number): void {
  if (courant?.id !== id) return
  courant = null
  prevenir()
}

export function abonnerAvis(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

export function lireAvis(): AvisCrm | null {
  return courant
}
