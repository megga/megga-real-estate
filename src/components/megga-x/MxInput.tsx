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

// `ComponentPropsWithRef` et non `InputHTMLAttributes` : sous React 19 `ref` est une
// prop ordinaire d'un composant fonction et traverse le `...rest` jusqu'à l'<input>
// sans `forwardRef` — mais le type, lui, ne la connaît pas. Sans cet élargissement,
// poser un `ref` (OcBooking, pour amener le focus sur le premier champ vide) ne
// compile pas alors que le rendu, lui, marcherait.
type Props = React.ComponentPropsWithRef<'input'>

export default function MxInput({ className, ...rest }: Props) {
  return <input className={cn('input w-input', className)} {...rest} />
}
