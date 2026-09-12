/**
 * Le client React Query de l'app — UN SEUL, et son identité ne bouge jamais.
 *
 * ⛔ IL Y EN A EU DEUX, DU 7 AU 12 SEPTEMBRE 2026. Un jumeau partageant le cache,
 * réglé `refetchOnWindowFocus: false`, servait les écrans vivants mais cachés,
 * pour qu'au retour sur la page ils ne relancent pas tout d'un coup. Trois
 * défauts l'ont fait retirer, chacun mesuré :
 *   • il ne rafraîchissait RIEN quand l'écran redevenait visible — repasser sous
 *     l'autre client ne fait qu'un `observer.setOptions`, qui ne relance que sur
 *     un changement de requête ou d'`enabled` ;
 *   • il copiait `refetchOnReconnect: true` : au réveil du portable, la rafale
 *     partait quand même, par la reconnexion au lieu du focus ;
 *   • changer de client à chaque bascule rejouait tous les effets qui portent le
 *     client en dépendance — un `phx_leave` + `phx_join` Realtime par bascule,
 *     et l'invalidation regroupée de la messagerie jetée au passage.
 * La garde vit désormais dans `EcranVivant` (`IsRestoringProvider`), qui retire
 * de React Query les requêtes d'un écran caché sans toucher au client.
 */

import { QueryClient, type DefaultOptions } from '@tanstack/react-query'

/**
 * Les défauts de l'app.
 *
 * - `networkMode: 'always'`
 *     Chrome rapporte parfois `navigator.onLine = false` après une veille, une
 *     bascule WiFi↔4G ou un VPN. En mode `'online'`, TanStack met les requêtes
 *     en pause jusqu'au retour du drapeau — qui peut rester coincé, laissant la
 *     page sur des squelettes éternels, sans requête ni erreur en console.
 * - `refetchOnWindowFocus: true`
 *     L'agent réveille son portable ou revient sur l'onglet après un quart
 *     d'heure : Chrome a purgé une partie de l'état en mémoire. Sans ce
 *     rafraîchissement, il regarde des squelettes vides. Combiné au `staleTime`
 *     de 2 min, il ne part que si la donnée est réellement périmée — pas de
 *     tempête quand on alt-tabbe toutes les trente secondes. ⚠ Il ne vaut que pour
 *     l'écran MONTRÉ : les écrans vivants mais cachés sont désabonnés (voir
 *     `EcranVivant`).
 * - `refetchOnReconnect: true` — le pendant réseau du précédent.
 * - `staleTime: 2 min` — accordé à la vitesse à laquelle une annonce bouge.
 * - `gcTime: 30 min` — ⛔ PORTÉ DE 5 À 30 MIN LE 12 SEPTEMBRE 2026, et ce n'est pas
 *     un confort. Un écran vivant mais caché est désabonné de ses requêtes ; celles
 *     que lui seul observait deviennent inactives, et le ramasse-miettes les jette
 *     au bout de `gcTime`. À 5 min, un onglet laissé de côté le temps d'un appel
 *     réapparaissait sur des squelettes : sa donnée avait été ramassée pendant qu'il
 *     attendait. 30 min couvre une absence ordinaire ; au-delà, l'écran recharge sa
 *     donnée comme au premier montage — son état d'écran, lui, est intact.
 * - `retry: 1` avec un repli court — échouer vite fait remonter un état
 *     d'erreur actionnable, plutôt que de tourner indéfiniment.
 */
const DEFAUTS: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 4000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: 'always',
  },
  mutations: {
    networkMode: 'always',
    retry: 0,
  },
}

/** Le client de l'app. */
export const queryClient = new QueryClient({ defaultOptions: DEFAUTS })
