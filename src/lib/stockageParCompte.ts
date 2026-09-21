/**
 * Stockage PAR COMPTE — le registre unique de ce que le navigateur garde au nom
 * d'un utilisateur, et les purges qui le vident.
 *
 * POURQUOI UN REGISTRE. Une clé que personne ne liste est une clé que personne ne
 * purge. Audit S11 (13.09.2026) : la pile d'onglets (noms de clients), le brouillon
 * d'import de lead, la vue impersonée, les notes sur annonces externes et la photo
 * de l'agent survivaient à la déconnexion — et s'affichaient au compte SUIVANT sur
 * le même navigateur, parfois d'une autre agence. Chaque lecteur lisait sa clé
 * sans savoir à qui elle appartenait.
 *
 * Deux règles, et ce module les porte :
 *   1. une donnée d'utilisateur se range sous `base:<uid>` (`forme: 'par-compte'`)
 *      — son propriétaire se lit dans la clé ; une clé EXACTE n'est tolérée que
 *      pour un lecteur qu'on ne peut pas re-clé (ImportLeadPage, hors périmètre) ;
 *   2. un seul compte par vie de page (cf. useAuth) : la purge « démarrage »
 *      retire les données des AUTRES comptes, « changement » part vers un compte
 *      neuf, « déconnexion » retire tout ce qui est sensible.
 *
 * `purgerStockageDesComptes` est pure (les stockages sont injectés) : les effets de
 * bord de fin de session — Intercom, PostHog, rechargement — vivent dans useAuth.
 */

/** Aire de stockage du navigateur. */
export type AireStockage = 'local' | 'session'

/** Une entrée du registre. */
export interface EntreeParCompte {
  /** Nom de la clé, ou son préfixe pour une clé `par-compte` (`base:<uid>[:…]`). */
  base: string
  aire: AireStockage
  /** `par-compte` : le propriétaire est dans la clé. `exacte` : clé fixe, propriétaire inconnu. */
  forme: 'par-compte' | 'exacte'
  /** Donnée nominative ou métier : purgée à la déconnexion et au changement de compte. */
  sensible: boolean
  /** Clé de passage (OAuth) : survit au changement de compte, qu'elle sert. */
  transitoire?: boolean
  /** Pourquoi elle appartient à un compte — ce qu'on perdrait à l'oublier. */
  motif: string
}

/** LE registre. Toute clé de stockage qui appartient à un utilisateur doit y figurer (stockage-inventaire.spec.ts). */
export const STOCKAGE_PAR_COMPTE: readonly EntreeParCompte[] = [
  { base: 'megga.crm.tabs', aire: 'session', forme: 'par-compte', sensible: true, motif: "pile d'onglets du CRM : ses libellés sont des noms de clients (clé uid:agence)" },
  { base: 'megga.import-lead.state.v1', aire: 'session', forme: 'exacte', sensible: true, motif: "brouillon d'import de lead : texte collé d'un message de prospect (ImportLeadPage)" },
  { base: 'megga-impersonate', aire: 'local', forme: 'par-compte', sensible: true, motif: "vue impersonée du super-admin : nom de l'utilisateur ciblé" },
  { base: 'megga_external_listing_actions', aire: 'local', forme: 'par-compte', sensible: true, motif: "notes de l'agent sur des annonces externes (et, écrit avant le 21.09.2026, nom du contact destinataire)" },
  { base: 'megga-avatar-url', aire: 'local', forme: 'par-compte', sensible: true, motif: "photo de l'agent — parfois une data URL de son visage" },
  { base: 'megga-agent-notif-lastseen', aire: 'local', forme: 'par-compte', sensible: false, motif: 'dernière ouverture de la cloche : aucun nom, gardée à la déconnexion' },
  { base: 'megga-agent-notif-read', aire: 'local', forme: 'par-compte', sensible: false, motif: 'identifiants de notifications lues : aucun nom, gardés à la déconnexion' },
  { base: 'megga_oauth_role', aire: 'local', forme: 'exacte', sensible: false, transitoire: true, motif: "rôle choisi avant un OAuth, relu par AuthCallbackPage au retour" },
]

/** Marqueur (sessionStorage) du dernier compte que CET onglet a servi — par onglet, donc sans va-et-vient entre onglets. */
export const CLE_COMPTE_ONGLET = 'megga.stockage.compte'

/** Clé d'une donnée de compte : `base:<uid>` ou `base:<uid>:<agence>`. */
export function cleDuCompte(base: string, uid: string, ...precisions: string[]): string {
  return [base, uid, ...precisions].join(':')
}

/** Mode de purge. */
export type ModePurge =
  | { mode: 'deconnexion' }
  | { mode: 'changement'; garder: string }
  | { mode: 'demarrage'; garder: string; compteOnglet: string | null }

/** Stockages du navigateur ; null si inaccessibles (navigation privée stricte de Safari : l'accès même jette). */
export interface Stockages {
  local: Storage | null
  session: Storage | null
}

/**
 * Purge le stockage des comptes selon le mode ; rend les clés retirées (le
 * contrôle positif des tests). Ne jette jamais : un stockage refusé ne doit ni
 * bloquer une déconnexion, ni un démarrage.
 *
 *   • déconnexion : tout ce qui est sensible, pour tous les comptes, plus les
 *     anciennes clés non indexées et la clé de passage OAuth ;
 *   • changement (vers `garder`) : idem, sauf les clés de `garder` et la clé de
 *     passage — AuthCallbackPage la relit juste après ;
 *   • démarrage (compte `garder`) : les clés sensibles des AUTRES comptes et les
 *     anciennes clés non indexées sensibles. Les anciennes clés NON sensibles
 *     (notifications) sont MIGRÉES vers `garder` au lieu d'être perdues. Une clé
 *     exacte sensible n'est retirée que si le marqueur de l'onglet nomme un autre
 *     compte : c'est ce qui garde le brouillon de l'agent à travers un rechargement.
 */
export function purgerStockageDesComptes(stores: Stockages, m: ModePurge): string[] {
  const retirees: string[] = []
  const aires: Array<[AireStockage, Storage | null]> = [['local', stores.local], ['session', stores.session]]
  for (const [aire, store] of aires) {
    if (!store) continue
    let cles: string[]
    try {
      cles = []
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i)
        if (k !== null) cles.push(k)
      }
    } catch {
      continue
    }
    for (const cle of cles) {
      const decision = decider(aire, cle, m)
      if (decision === 'garder') continue
      try {
        if (decision === 'migrer' && m.mode === 'demarrage') {
          const cible = cleDuCompte(cle, m.garder)
          const valeur = store.getItem(cle)
          if (valeur !== null && store.getItem(cible) === null) store.setItem(cible, valeur)
        }
        store.removeItem(cle)
        if (decision === 'retirer') retirees.push(cle)
      } catch { /* clé indéplaçable : on continue avec les autres */ }
    }
  }
  return retirees
}

function decider(aire: AireStockage, cle: string, m: ModePurge): 'garder' | 'retirer' | 'migrer' {
  for (const e of STOCKAGE_PAR_COMPTE) {
    if (e.aire !== aire) continue
    if (e.forme === 'exacte') {
      if (cle !== e.base) continue
      if (e.transitoire) return m.mode === 'deconnexion' ? 'retirer' : 'garder'
      if (!e.sensible) return 'garder'
      if (m.mode !== 'demarrage') return 'retirer'
      return m.compteOnglet !== null && m.compteOnglet !== m.garder ? 'retirer' : 'garder'
    }
    if (cle === e.base) {
      // Ancienne clé NON indexée : son propriétaire est inconnu.
      if (e.sensible) return 'retirer'
      return m.mode === 'demarrage' ? 'migrer' : 'garder'
    }
    // Le séparateur `:` est exigé : `megga.crm.tabsX` n'est pas une clé de cette entrée.
    if (!cle.startsWith(`${e.base}:`)) continue
    if (!e.sensible) return 'garder'
    if (m.mode === 'deconnexion') return 'retirer'
    const uid = cle.slice(e.base.length + 1).split(':')[0]
    return uid === m.garder ? 'garder' : 'retirer'
  }
  return 'garder'
}

/** Les deux stockages du navigateur, chacun lu dans un try (Safari privé jette à l'accès). */
export function stockagesNavigateur(): Stockages {
  const lire = (f: () => Storage): Storage | null => {
    try {
      return typeof window === 'undefined' ? null : f()
    } catch {
      return null
    }
  }
  return { local: lire(() => window.localStorage), session: lire(() => window.sessionStorage) }
}

/** Le compte que cet onglet a servi en dernier (marqueur de sessionStorage). */
export function lireCompteOnglet(): string | null {
  try {
    return stockagesNavigateur().session?.getItem(CLE_COMPTE_ONGLET) ?? null
  } catch {
    return null
  }
}

/** Pose le marqueur de compte de cet onglet. */
export function ecrireCompteOnglet(uid: string): void {
  try {
    stockagesNavigateur().session?.setItem(CLE_COMPTE_ONGLET, uid)
  } catch { /* sans marqueur, le démarrage suivant garde les brouillons : repli prudent */ }
}

/** Lit la valeur JSON d'une clé de compte ; null si absente, illisible ou sans compte. */
export function lireJsonDuCompte<T>(aire: AireStockage, base: string, uid: string | null | undefined): T | null {
  if (!uid) return null
  try {
    const store = stockagesNavigateur()[aire]
    const brut = store?.getItem(cleDuCompte(base, uid))
    return brut ? (JSON.parse(brut) as T) : null
  } catch {
    return null
  }
}

// ── Fin de session et compte de la page ──────────────────────────────────────

let finDeSession = false
let compteDeLaPage: string | null = null

/**
 * Déclare la session finissante : les écrivains tardifs (miroir d'onglets,
 * sauvegarde différée, `pagehide`, invite « quitter la page ? ») se taisent
 * jusqu'au rechargement qui suit. Sans ce silence, la pile de A se réécrirait
 * après sa propre purge.
 */
export function marquerFinDeSession(): void {
  finDeSession = true
}

/** Vrai quand la session de la page se termine (déconnexion ou changement de compte). */
export function sessionEnFin(): boolean {
  return finDeSession
}

/** Lie la page à un compte : c'est l'identité que la garde de `fetch` exige (cf. @/lib/supabase). */
export function lierComptePage(uid: string): void {
  compteDeLaPage = uid
}

/** Le compte auquel la page est liée, ou null avant la première session. */
export function comptePage(): string | null {
  return compteDeLaPage
}

/**
 * Quitte la page pour le compte qui vient d'arriver — rechargement DUR : aucun
 * cache, aucune pile, aucun formulaire du compte précédent ne survit. Isolé pour
 * que les tests le remplacent.
 */
export function quitterPourNouveauCompte(): void {
  window.location.replace('/dashboard')
}
