/**
 * L'état de démonstration de la Recherche (la page 1 de Matching) sur le banc `/dev/crm`.
 *
 * Le banc monte la Recherche en démonstration (`mrhDemo.ts`) : il n'a pas de fixtures du marché, et ses requêtes,
 * interceptées, y reviendraient vides. Ses quatre états (`MrhDemoEtat`) se choisissent au menu du banc, sur la surface Matching ; la
 * page de démonstration (`matchingFilBanc`) montre celui qu'on a choisi.
 *
 * ⚠ Un contexte, pas une prop : la table des routes du banc est hissée (`ROUTES_BANC`), elle ne reçoit rien au rendu.
 * Et il vit dans son propre module : `matchingFilBanc` se charge en différé (`lazy`), et le banc qui pose le contexte
 * ne pourrait pas l'importer de là sans l'embarquer.
 */
import { createContext } from 'react'
import type { MrhDemoEtat } from '@/components/matching-recherche/mrhDemo'

/** L'état que montre la Recherche du banc ; `ok` hors de son fournisseur. */
export const RechercheDuBanc = createContext<MrhDemoEtat>('ok')
