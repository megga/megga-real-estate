// MEGGA X — Input. Transcription fidèle de la classe la vitrine MEGGA `.input`
// (états :hover / :focus dans la feuille). Aucun style nouveau.
//
// ⚠ `w-input` EN PLUS de `input`, comme la vitrine — elle écrit toujours les deux
// (Webflow émet sa classe de base à côté de la classe de style). Ce port ne posait
// que `input`, et `width: 100%` vit dans `w-input`, PAS dans `input` : les champs
// gardaient donc la largeur intrinsèque d'un `<input>` (238,5 px, le `size=20` par
// défaut) au lieu de remplir leur colonne. Invisible tant que les colonnes étaient
// plus larges que ça — sauf un bord droit irrégulier — mais dès qu'une colonne
// descend en dessous, le champ DÉBORDE sur son voisin : constaté le 03.08.2026 sur
// la rangée NPA / Ville / Canton, dont les trois pilules se chevauchaient.
// Aucun style de `w-input` ne prend le dessus : `.input` est déclarée plus bas dans
// la feuille, donc à spécificité égale c'est elle qui gagne partout où les deux
// parlent.

import { cn } from '@/lib/utils'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function MxInput({ className, ...rest }: Props) {
  return <input className={cn('input w-input', className)} {...rest} />
}
