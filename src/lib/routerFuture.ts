/**
 * Les drapeaux `future` de React Router — UNE valeur pour le routeur de l'app ET
 * pour celui du banc `/dev/crm`.
 *
 * ⛔ ILS DIVERGEAIENT, et c'est ce qui a caché le défaut principal des onglets
 * (12 septembre 2026). `v7_startTransition` fait passer chaque `navigate()` dans
 * une transition : la bascule d'onglet pose l'actif tout de suite, l'URL suit
 * plus tard, et un rendu intermédiaire montrait l'onglet d'arrivée sur l'URL de
 * départ — son écran se remontait. Le banc, en `MemoryRouter` SANS ce drapeau,
 * naviguait de façon synchrone : 0 remontage sur 6 au banc, 6 sur 6 avec le
 * drapeau. Un banc qui ne court pas sur le même moteur que la production ne
 * prouve rien sur elle.
 */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const
