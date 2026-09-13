/**
 * Stockage de la session d'auth — l'adaptateur passé à supabase-js, et pourquoi
 * il RETIRE les jetons de fournisseur avant toute écriture.
 *
 * auth-js (2.102.1) range la session ENTIÈRE dans le stockage (`_saveSession`),
 * `provider_token` et `provider_refresh_token` compris — le jeton d'accès Google
 * ou Microsoft, et surtout son jeton de RAFRAÎCHISSEMENT, valable des mois. C'est
 * vrai dans le flux implicite comme dans le flux PKCE (`_exchangeCodeForSession`).
 * En localStorage, tout script de l'origine (extension, XSS, dépendance
 * compromise) les lit, et ils survivent à la fermeture de l'onglet.
 *
 * Or UN SEUL lecteur en a besoin : la page de retour d'une liaison d'agenda,
 * pour les confier une fois à l'edge qui les garde côté serveur. D'où :
 *   1. toute écriture d'une clé `sb-*-auth-token` est réécrite SANS ces deux
 *      champs (la clé `-code-verifier` et les valeurs non JSON passent intactes) ;
 *   2. si la page est `/auth/callback?gcal=1|outlook=1`, les champs retirés sont
 *      confiés à un dépôt EN MÉMOIRE, lu une seule fois et périmé après deux
 *      minutes (`takeCalendarProviderTokens`) ;
 *   3. au démarrage, `scrubStoredProviderTokens` nettoie ce qu'une version
 *      antérieure du CRM a pu laisser dans le stockage.
 *
 * Aucune course avec la sonde `getSession()` de la page de retour : auth-js
 * appelle `_saveSession` AVANT que `initialize()` ne se résolve, et toute lecture
 * de session attend `initialize()`.
 *
 * Résiduel assumé : l'objet de l'événement SIGNED_IN porte encore les deux
 * champs EN MÉMOIRE (auth-js le diffuse aussi aux autres onglets par
 * BroadcastChannel). `sessionSansJetonsFournisseur` les retire avant que
 * useAuth ne range la session dans son état, où elle vivrait une heure.
 */
import type { Session } from '@supabase/supabase-js'
import { calendarProviderFromParams, type CalendarAuthProvider } from '@/lib/calendarOauth'

/** Drapeau « Se souvenir de moi » : `'false'` ⇒ la session ne vit qu'en sessionStorage. */
export const REMEMBER_KEY = 'megga_remember'

/** Clé de session d'auth-js — PAS `-code-verifier` ni `-user`, qui ne portent aucun jeton de fournisseur. */
const CLE_SESSION = /^sb-.+-auth-token$/
const CHAMPS_FOURNISSEUR = ['provider_token', 'provider_refresh_token'] as const
/** Assez pour un aller-retour réseau de la page de retour, trop court pour qu'un oubli dure. */
const DUREE_DEPOT_MS = 2 * 60 * 1000

/** Jetons de fournisseur d'agenda rendus par une liaison, tels qu'auth-js les a reçus. */
export interface CalendarProviderTokens {
  providerToken: string | null
  providerRefreshToken: string | null
}

let depot: { provider: CalendarAuthProvider; jetons: CalendarProviderTokens; depuis: number } | null = null

/** La valeur sérialisée sans les champs fournisseur, et ce qui a été retiré ; null si rien à retirer. */
function retirerChamps(valeur: string): { propre: string; retires: CalendarProviderTokens } | null {
  let lu: unknown
  try {
    lu = JSON.parse(valeur)
  } catch {
    return null
  }
  if (typeof lu !== 'object' || lu === null || Array.isArray(lu)) return null
  const objet = lu as Record<string, unknown>
  if (!CHAMPS_FOURNISSEUR.some((c) => c in objet)) return null
  const texte = (c: string): string | null => {
    const v = objet[c]
    return typeof v === 'string' && v !== '' ? v : null
  }
  const retires = { providerToken: texte('provider_token'), providerRefreshToken: texte('provider_refresh_token') }
  for (const c of CHAMPS_FOURNISSEUR) delete objet[c]
  return { propre: JSON.stringify(objet), retires }
}

/** Confie les jetons retirés au dépôt — seulement au retour d'une liaison d'agenda. */
function deposer(retires: CalendarProviderTokens, ou: Pick<Location, 'pathname' | 'search'> | null): void {
  if (!ou || ou.pathname !== '/auth/callback') return
  const provider = calendarProviderFromParams(new URLSearchParams(ou.search))
  if (!provider) return
  // Une écriture SANS jeton (rafraîchissement, réécriture) ne vide jamais un dépôt :
  // seule la lecture de la page de retour le consomme.
  if (!retires.providerToken && !retires.providerRefreshToken) return
  depot = { provider, jetons: retires, depuis: Date.now() }
}

/**
 * Rend, UNE fois, les jetons que la dernière liaison d'agenda `provider` a
 * confiés ; null s'il n'y en a pas, s'ils visent l'autre fournisseur, ou s'ils
 * ont plus de deux minutes (un dépôt périmé est effacé, quel que soit le
 * fournisseur demandé).
 */
export function takeCalendarProviderTokens(provider: CalendarAuthProvider, now: number = Date.now()): CalendarProviderTokens | null {
  if (!depot) return null
  if (now - depot.depuis > DUREE_DEPOT_MS) {
    depot = null
    return null
  }
  if (depot.provider !== provider) return null
  const { jetons } = depot
  depot = null
  return jetons
}

/** Dépendances de l'adaptateur — des accesseurs, parce que lire `window.localStorage` peut jeter. */
export interface AuthStorageDeps {
  local: () => Storage | null
  session: () => Storage | null
  location: () => Pick<Location, 'pathname' | 'search'> | null
}

/** L'adaptateur de stockage passé à supabase-js (forme `SupportedStorage`). */
export interface AuthStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/**
 * Adaptateur « Se souvenir de moi » (local ou session, lu à chaque opération :
 * supabase-js n'accepte qu'un stockage à la création du client) qui retire les
 * jetons de fournisseur de toute session écrite.
 */
export function createAuthStorage(deps: AuthStorageDeps): AuthStorage {
  const sessionSeule = (local: Storage): boolean => local.getItem(REMEMBER_KEY) === 'false'
  return {
    getItem: (key) => {
      try {
        const local = deps.local()
        if (!local) return null
        // Mode session seule : sessionStorage d'abord, localStorage en repli (la
        // toute première lecture qui suit la connexion, avant la bascule).
        if (sessionSeule(local)) return deps.session()?.getItem(key) ?? local.getItem(key)
        return local.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      let valeur = value
      if (CLE_SESSION.test(key)) {
        const nettoye = retirerChamps(value)
        if (nettoye) {
          valeur = nettoye.propre
          try {
            deposer(nettoye.retires, deps.location())
          } catch { /* sans emplacement lisible, rien n'est déposé : la liaison échouera bruyamment */ }
        }
      }
      try {
        const local = deps.local()
        if (!local) return
        if (sessionSeule(local)) {
          deps.session()?.setItem(key, valeur)
          local.removeItem(key) // rien ne doit survivre à la fermeture du navigateur
        } else {
          local.setItem(key, valeur)
        }
      } catch { /* quota ou navigation privée stricte — silencieux */ }
    },
    removeItem: (key) => {
      try {
        deps.local()?.removeItem(key)
        deps.session()?.removeItem(key)
      } catch { /* silencieux */ }
    },
  }
}

/**
 * Réécrit sans jetons de fournisseur chaque session déjà présente dans `store` —
 * le nettoyage de ce qu'une version antérieure du CRM y a laissé. Rend le nombre
 * de clés réécrites. Ne dépose rien : ces jetons-là n'ont plus de destinataire.
 */
export function scrubStoredProviderTokens(store: Storage | null): number {
  if (!store) return 0
  let reecrites = 0
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i)
      if (!key || !CLE_SESSION.test(key)) continue
      const valeur = store.getItem(key)
      if (!valeur) continue
      const nettoye = retirerChamps(valeur)
      if (!nettoye) continue
      store.setItem(key, nettoye.propre)
      reecrites++
    }
  } catch { /* stockage refusé : jamais bloquer le démarrage pour un nettoyage */ }
  return reecrites
}

/**
 * La session sans ses jetons de fournisseur — ce que useAuth range dans son
 * état. Même référence si elle n'en porte pas.
 */
export function sessionSansJetonsFournisseur(s: Session | null): Session | null {
  if (!s || (!('provider_token' in s) && !('provider_refresh_token' in s))) return s
  const copie: Session = { ...s }
  delete copie.provider_token
  delete copie.provider_refresh_token
  return copie
}
