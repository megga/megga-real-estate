/**
 * Modèle de navigation de la barre latérale du CRM — les sections GROUPÉES,
 * l'unique table « clé → route », et la lecture inverse (route → clé active).
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Avant la barre, chaque page portait SA propre
 * fonction `onNavigate` : vingt et un `switch` recopiés, aux cas divergents
 * (huit branches sur `AuditPage`, seize sur `TodayPage`, `settings` qui pointait
 * vers `?tab=integrations` sur le seul calendrier). Tant que le chrome n'affichait
 * que sept onglets, un cas manquant ne se voyait pas. Une barre unique rend
 * TOUTES les entrées sur TOUS les écrans : un `switch` incomplet devient un clic
 * mort, silencieux, reproductible seulement en cliquant chaque ligne de chaque
 * page. La barre ne délègue donc plus la navigation — elle la porte.
 *
 * Les pages gardent leur `onNavigate` : il sert leur CORPS (ouvrir une fiche,
 * viser un contact du matching), pas le chrome.
 *
 * ⛔ ET POURQUOI LES GROUPES. La référence de design prescrivait « aucune
 * séparation visuelle entre les groupes, seul l'ordre les signale ». Tenu à onze
 * entrées, l'ordre seul ne signale plus rien — retour de Julien, 4 septembre
 * 2026 : « c'est un petit peu désordonné ». La liste est donc découpée en quatre
 * sections libellées, sur le MÊME idiome que la console super-admin
 * (`AdminShell.NAV_SECTIONS`, cinq sections depuis juillet 2026) : un sur-titre
 * en 12 px / 600 / `sp.sub`, pas de filet, pas de capitale.
 *
 * Le découpage suit ce que les pages FONT, pas leur ordre d'arrivée :
 *   • Mon jour       — ce qu'on ouvre le matin : le cockpit, l'agenda et la
 *                      boîte mail.
 *   • Clients & biens — les deux entités du portefeuille, et le geste qui les
 *                      apparie (Matching lit les deux, il vit avec elles).
 *   • Transactions   — le cycle d'une affaire : le tableau, le parcours par
 *                      dossier, et la conformité qui le conditionne. KYC y est
 *                      plutôt qu'à part parce que le produit est un
 *                      « Compliance-First Transaction OS » : la conformité est
 *                      une étape de la transaction, pas une annexe.
 *   • Pilotage       — ce qui regarde l'agence plutôt qu'une affaire : le
 *                      cockpit commission et les réglages. La configuration
 *                      reste en dernier, comme le prescrivait la référence.
 */

/** Clé de section — ce que la barre compare à l'actif. */
export type CrmSidebarSectionId =
  | 'today' | 'pipeline' | 'matching' | 'parcours' | 'contacts'
  | 'biens' | 'calendar' | 'kyc' | 'dashboard' | 'settings' | 'messagerie'

/** Une entrée de navigation : clé, glyphe, clé de libellé, route. */
export interface CrmSidebarSection {
  id: CrmSidebarSectionId
  /** Nom de glyphe de `RAIL_ICONS` (LiquidGlassRail) — tracé, jamais une icône pleine. */
  icon: string
  /** Clé i18n du namespace `common`. */
  labelKey: string
  route: string
}

/** Un groupe libellé. */
export interface CrmSidebarGroup {
  /** Clé i18n du sur-titre, namespace `common`. */
  labelKey: string
  items: CrmSidebarSection[]
}

export const CRM_SIDEBAR_GROUPS: CrmSidebarGroup[] = [
  {
    labelKey: 'nav.sectionDay',
    items: [
      { id: 'today',    icon: 'home',     labelKey: 'nav.today',    route: '/dashboard' },
      { id: 'calendar', icon: 'calendar', labelKey: 'nav.calendar', route: '/dashboard/calendar' },
      // ⚠ Ici et non dans un groupe à elle : la boîte fait partie de ce qu'on
      // ouvre le matin, au même titre que le cockpit et l'agenda. Le découpage
      // suit ce que les pages FONT, pas leur ordre d'arrivée.
      { id: 'messagerie', icon: 'inbox', labelKey: 'nav.messagerie', route: '/dashboard/messagerie' },
    ],
  },
  {
    labelKey: 'nav.sectionPortfolio',
    items: [
      { id: 'contacts', icon: 'users',    labelKey: 'nav.contacts', route: '/dashboard/contacts' },
      { id: 'biens',    icon: 'building', labelKey: 'nav.listings', route: '/dashboard/listings' },
      { id: 'matching', icon: 'compass',  labelKey: 'nav.matching', route: '/dashboard/matching' },
    ],
  },
  {
    labelKey: 'nav.sectionDeals',
    items: [
      { id: 'pipeline', icon: 'pipeline', labelKey: 'nav.pipeline', route: '/dashboard/pipeline' },
      { id: 'parcours', icon: 'journey',  labelKey: 'nav.journey',  route: '/dashboard/journey' },
      { id: 'kyc',      icon: 'shield',   labelKey: 'nav.kyc',      route: '/dashboard/kyc' },
    ],
  },
  {
    labelKey: 'nav.sectionSteering',
    items: [
      { id: 'dashboard', icon: 'target',   labelKey: 'nav.dashboard', route: '/dashboard/analytics' },
      { id: 'settings',  icon: 'settings', labelKey: 'nav.settings',  route: '/dashboard/settings' },
    ],
  },
]

/** Les onze sections à plat — pour tout ce qui cherche par clé, pas par groupe. */
export const CRM_SIDEBAR_SECTIONS: CrmSidebarSection[] =
  CRM_SIDEBAR_GROUPS.flatMap(g => g.items)

/** Route d'une section — `null` si la clé n'est pas une section de la barre. */
export function crmSidebarRouteOf(id: string): string | null {
  return CRM_SIDEBAR_SECTIONS.find(s => s.id === id)?.route ?? null
}

/**
 * Section active déduite du chemin courant.
 *
 * ⚠ Le plus SPÉCIFIQUE gagne, et `/dashboard` doit être testé en dernier :
 * toute route du CRM commence par lui, donc un simple `startsWith` en ordre de
 * déclaration allumerait « Aujourd'hui » partout.
 *
 * ⚠ Les routes de détail n'ont pas d'entrée à elles : une fiche contact allume
 * « Contacts », un deal allume « Pipeline ». D'où les préfixes ci-dessous, qui
 * ne se déduisent pas de `route` (`/dashboard/transactions/:id` n'est pas sous
 * `/dashboard/pipeline`).
 */
const DETAIL_PREFIXES: [string, CrmSidebarSectionId][] = [
  ['/dashboard/transactions', 'pipeline'],
  ['/dashboard/visits', 'calendar'],
  // ⚠ 'matching' et NON 'biens' (05.09.2026). Une annonce de marché n'appartient PAS
  // au portefeuille — la fiche propose justement de l'y IMPORTER. Allumer « Mes biens »
  // (`properties`, scopée agence) annoncerait qu'elle y est déjà. Et c'est de Matching
  // qu'on y arrive : c'est le seul écran qui montre des lignes `market_listings`.
  //
  // ⚠ Cette ligne est désormais la SOURCE UNIQUE : la page passait `active="matching"`
  // en dur pendant que la barre d'onglets déduisait « Biens » d'ici — les deux chromes
  // annonçaient deux sections différentes pour le même écran. La prop a été retirée.
  ['/dashboard/market', 'matching'],
  ['/dashboard/import-lead', 'contacts'],
  ['/dashboard/audit', 'dashboard'],
]

export function crmSidebarActiveFor(pathname: string): CrmSidebarSectionId | null {
  for (const [prefix, id] of DETAIL_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return id
  }
  const ranked = [...CRM_SIDEBAR_SECTIONS].sort((a, b) => b.route.length - a.route.length)
  for (const s of ranked) {
    if (pathname === s.route || pathname.startsWith(`${s.route}/`)) return s.id
  }
  return null
}
