/**
 * L'arrivée d'une navigation, appliquée UNE fois dans l'onglet du CRM (lot E1, conception
 * `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 ; la règle vit dans `src/lib/jetonArrivee.ts`). Lue par le fil de
 * matchs, le pager de Matching et les deux fiches de bien (`?qui=1`).
 *
 * L'écran lit `neuve` au RENDU — une arrivée neuve l'emporte sur ce que l'onglet avait retenu, sans image
 * intermédiaire —, l'applique dans un EFFET quand `aAppliquer` est vrai, puis appelle `marquerAppliquee`.
 *
 * ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, RIEN NE S'APPLIQUE. L'hydratation de `CrmTabsProvider` REMPLACE la tranche de
 * l'onglet une fois la pile serveur arrivée (`reconcilier`) : ce qu'on y écrirait avant serait effacé aussitôt — l'effet
 * de l'arrivée, et la trace de son application avec : elle se rejouerait.
 * ⛔ UN ÉCRAN CACHÉ N'APPLIQUE RIEN (`useEcranActif`) : il attend d'être montré.
 * ⛔ NI UN ÉCRAN DONT L'ONGLET NE PORTE PAS L'ADRESSE (`crmSameLocation`). Fermer l'onglet actif pose le suivant comme
 * actif tout de suite et navigue dans une transition : le temps d'un rendu, l'écran de l'onglet qui prend la main rend
 * l'adresse de l'onglet fermé, AVEC son état de navigation. L'arrivée y paraît neuve ; appliquée, elle s'écrirait dans
 * la tranche d'un onglet qui ne l'a jamais demandée. Elle attend donc que l'onglet porte l'adresse : un lien suivi dans
 * l'onglet s'applique au rendu où le gel continu de la pile (`useCrmTabs`) l'y range, et l'adresse d'un onglet fermé ne
 * rejoint jamais celui qui prend la main.
 * ⚠ `neuve`, lui, n'attend pas : un lien suivi dans l'onglet se montre dès son premier rendu, avant que la pile ait
 * rangé l'adresse — l'attendre ferait naître le pager sur la Recherche, puis glisser vers la page 0. Un lecteur n'en
 * tire qu'une image, jamais une écriture dans l'onglet.
 * ⚠ Sans onglet d'écran (`OngletEcranCtx` : hors coquille, bancs, pile vide) ni sur mobile, où la pile ne suit pas
 * l'adresse (le gel s'y tait), il n'y a pas d'adresse d'onglet à attendre.
 * ⚠ Chaque lecteur a SA clé dans la tranche : le pager et le fil appliquent la même navigation, chacun sa part.
 * Hors fournisseur d'onglets (bancs sans onglets), la tranche est un état local : l'arrivée s'applique à chaque montage.
 */
import { useCallback, useContext, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { OngletEcranCtx, useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { crmSameLocation } from '@/lib/crmTabs'
import { arriveeDe, arriveeNeuve, type Arrivee } from '@/lib/jetonArrivee'

/** Ce qu'un écran sait de l'arrivée que porte sa page. */
export interface ArriveeEcran {
  /** La page porte une arrivée que l'onglet n'a pas encore appliquée : l'écran la montre déjà. */
  neuve: boolean
  /** Le moment de l'appliquer : neuve, la pile d'onglets chargée, l'écran montré, son onglet sur son adresse. */
  aAppliquer: boolean
  /** Son identité (son jeton, sinon son adresse), `null` sans arrivée : de quoi repartir d'un état local neuf. */
  id: string | null
  /** La range, appliquée, dans la tranche de l'onglet — tant que l'onglet ne porte pas son adresse, ne fait rien. */
  marquerAppliquee: () => void
}

/**
 * L'arrivée que porte la page, rapportée à la dernière appliquée dans l'onglet.
 *
 * @param cle la clé de la tranche — une par lecteur
 * @param presente la page porte une arrivée pour ce lecteur : ses paramètres sont dans l'adresse
 */
export function useArrivee(cle: string, presente: boolean): ArriveeEcran {
  const location = useLocation()
  const [derniere, ranger] = useTabScopedState<unknown>(cle, null)
  const onglets = useCrmTabsOptionnel()
  const ongletId = useContext(OngletEcranCtx)
  // Le même critère que le gel continu de la pile (`useCrmTabsMachine`) : sur mobile, l'onglet ne suit pas l'adresse.
  const mobile = useIsMobile()
  const chargement = onglets?.chargement ?? false
  const ecranActif = useEcranActif()
  const { jeton, adresse } = arriveeDe(location)
  const demandee = useMemo<Arrivee | null>(() => (presente ? { jeton, adresse } : null), [presente, jeton, adresse])
  const neuve = demandee != null && arriveeNeuve(demandee, derniere)
  // L'onglet de l'écran porte-t-il l'adresse que l'écran rend ? Un onglet introuvable — fermé — ne la porte pas.
  const sien = onglets && ongletId && !mobile ? onglets.tabs.find((t) => t.id === ongletId) : undefined
  const chezSoi = !onglets || !ongletId || mobile
    || (sien !== undefined && crmSameLocation(sien, location.pathname, location.search))
  const marquerAppliquee = useCallback(() => { if (demandee && chezSoi) ranger(demandee) }, [demandee, chezSoi, ranger])
  return {
    neuve,
    aAppliquer: neuve && !chargement && ecranActif && chezSoi,
    id: demandee ? demandee.jeton ?? demandee.adresse : null,
    marquerAppliquee,
  }
}
