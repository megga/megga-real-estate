/**
 * « Recherché » et « Ce bien », écrits dans la langue de l'agent — partagés par le panneau d'un bien en
 * mandat (la grille) et la sélection du marché (le résumé d'une recherche en une ligne).
 */
import type { TFunction } from 'i18next'
import { formatCHF } from '@/lib/utils'
import { cleEquipement, lignesCriteres, type FilMatch, type LigneCritere } from './filModele'

/** Les deux cellules d'une ligne de critère : ce que l'acheteur cherche, ce que le bien offre. */
export function valeursCritere(l: LigneCritere, t: TFunction, nombre: (n: number) => string): [string, string] {
  const inconnu = t('fil.valeurs.inconnu')
  switch (l.cle) {
    case 'budget': {
      const montant = (n: number): string => (l.location ? t('fil.valeurs.parMois', { valeur: formatCHF(n) }) : formatCHF(n))
      const recherche = l.min != null && l.max != null ? t('fil.valeurs.entre', { min: formatCHF(l.min), max: montant(l.max) })
        : l.max != null ? t('fil.valeurs.jusqua', { valeur: montant(l.max) })
          : t('fil.valeurs.desDe', { valeur: montant(l.min as number) })
      return [recherche, l.prix == null ? inconnu : montant(l.prix)]
    }
    case 'zone': {
      // Villes puis cantons : un match au canton (« Canton GE correspond ») doit se LIRE.
      const recherche = [l.villes.join(', '), l.cantons.join(', ')].filter(Boolean).join(' · ')
      return [recherche, [l.ville, l.canton].filter(Boolean).join(' · ') || inconnu]
    }
    case 'type':
      return [t(`fil.types.${l.voulu}`, { defaultValue: l.voulu }), l.propose ? t(`fil.types.${l.propose}`, { defaultValue: l.propose }) : inconnu]
    case 'pieces': {
      const recherche = l.min != null && l.max != null
        ? (l.min === l.max ? nombre(l.min) : t('fil.valeurs.entre', { min: nombre(l.min), max: nombre(l.max) }))
        : l.min != null ? t('fil.valeurs.auMoins', { valeur: nombre(l.min) })
          : t('fil.valeurs.auPlus', { valeur: nombre(l.max as number) })
      return [recherche, l.pieces == null ? inconnu : nombre(l.pieces)]
    }
    case 'surface':
      return [
        t('fil.valeurs.auMoins', { valeur: t('fil.valeurs.m2', { valeur: nombre(l.min) }) }),
        l.surface == null ? inconnu : t('fil.valeurs.m2', { valeur: nombre(l.surface) }),
      ]
    case 'equipements':
      return [
        l.voulus.map((f) => t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })).join(', '),
        t('fil.valeurs.presents', { n: l.presents.length, total: l.voulus.length }),
      ]
  }
}

/**
 * Les pièces recherchées AVEC leur unité. Dans la grille du panneau, la colonne « Pièces » la porte ; dans
 * une phrase, « 4 et plus » ne dit pas de quoi. Le pluriel suit la borne haute (« 3 à 5 pièces »).
 */
function piecesVoulues(l: Extract<LigneCritere, { cle: 'pieces' }>, t: TFunction, nombre: (n: number) => string): string {
  if (l.min != null && l.max != null) {
    return l.min === l.max
      ? t('fil.selection.pieces', { count: l.min, valeur: nombre(l.min) })
      : t('fil.selection.piecesEntre', { count: l.max, min: nombre(l.min), max: nombre(l.max) })
  }
  if (l.min != null) return t('fil.selection.piecesAuMoins', { count: l.min, valeur: nombre(l.min) })
  const max = l.max as number
  return t('fil.selection.piecesAuPlus', { count: max, valeur: nombre(max) })
}

/** La recherche d'un acheteur en une ligne (§5) : les valeurs « Recherché » de ses critères, dans l'ordre. */
export function resumeRecherche(m: FilMatch, t: TFunction, nombre: (n: number) => string): string {
  return lignesCriteres(m)
    .map((l) => (l.cle === 'pieces' ? piecesVoulues(l, t, nombre) : valeursCritere(l, t, nombre)[0]))
    .join(' · ')
}
