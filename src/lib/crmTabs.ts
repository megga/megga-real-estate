/**
 * Modèle des onglets du CRM — ce qu'un onglet EST, sans une ligne de React.
 *
 * ── UN ONGLET N'EST PAS UNE DESTINATION ──────────────────────────────────────
 * La barre latérale porte déjà les dix sections (`crmSidebarNav.ts`). Un onglet
 * porte un CONTEXTE DE TRAVAIL ouvert : cette fiche-ci, ce deal-là, avec la
 * position d'écran qu'on y avait laissée. Deux onglets peuvent donc viser la même
 * section sur deux contacts différents — c'est le sens même du mécanisme, et ce
 * qu'une barre de destinations ne sait pas faire.
 *
 * ── LA TRANCHE D'ÉTAT, ET POURQUOI ELLE N'EST PAS `TAB_KEYS` ─────────────────
 * La maquette d'origine (ERP dentaire) tenait TOUT l'écran dans un état global
 * unique, et listait dans `TAB_KEYS` les 28 clés qui voyagent avec un onglet.
 * Ce dépôt n'a pas d'état global : il a un routeur, et 33 `useState` répartis
 * dans les écrans. La tranche se scinde donc en deux moitiés, et la frontière
 * est mesurée, pas choisie :
 *
 *   • `path` + `search` — ce que le ROUTEUR sait déjà. Rejouable en re-naviguant.
 *   • `ui` — ce que le routeur ne sait pas : le sous-onglet, le filtre, la
 *     recherche, la page du pager. Mesuré le 04.09.2026 : 33 des 38 positions
 *     d'écran du CRM de bureau vivent en `useState` local et sont perdues au
 *     démontage ; seules 3 sont dans l'URL et 2 en `localStorage`. Re-naviguer
 *     restaure donc ~8 % de la position — d'où ce sac.
 *
 * ⚠ RÈGLE DE PARTAGE, la même que la maquette : ce qui décrit OÙ ON EN EST DANS
 * UN ÉCRAN entre dans `ui` ; le thème, la langue, le rôle et l'agence n'y entrent
 * jamais. Ils sont globaux — les recopier par onglet en ferait 24 copies
 * divergentes de la même préférence.
 *
 * ⚠ ET `ui` EST OPAQUE CÔTÉ SERVEUR. Aucun SQL ne l'interprète (cf. le
 * `comment on column` de `crm_open_tabs.tabs`). C'est ce qui permet à un écran
 * d'y ranger ce qu'il veut sans migration.
 *
 * ── L'IDENTITÉ EST L'`id`, JAMAIS L'INDEX ────────────────────────────────────
 * Épingler, dupliquer et réordonner DÉPLACENT les index. Retrouver l'onglet actif
 * par son rang après l'un de ces gestes le fait sauter sur son voisin — c'est le
 * défaut que la maquette signale en capitales. Toutes les opérations d'ici
 * retrouvent donc l'actif par `id`.
 */

import type { CrmSidebarSectionId } from '@/components/crm/crmSidebarNav'
import { CRM_NEW_TAB_PATH, CRM_SIDEBAR_SECTIONS, crmSidebarActiveFor } from '@/components/crm/crmSidebarNav'

/** Une entrée de la pile. Sérialisée telle quelle dans `crm_open_tabs.tabs`. */
export interface CrmTab {
  /** Identité stable — survit au réordonnancement, à l'épinglage, à la duplication. */
  id: string
  /** Épinglé : se range à gauche, perd sa croix, ne se déplace que parmi ses pairs. */
  pinned?: boolean
  /** `location.pathname` de l'onglet. */
  path: string
  /** `location.search`, chaîne vide comprise (jamais `undefined` : simplifie l'égalité). */
  search: string
  /** Section de la barre latérale que cet onglet allume, si elle se déduit. */
  section: CrmSidebarSectionId | null
  /**
   * Dernier libellé connu. Rafraîchi par `crm_tabs_resolve_labels` au chargement
   * et par l'écran lui-même quand il se monte.
   *
   * ⚠ PII : pour une fiche, c'est le NOM d'une personne. C'est ce qui interdit le
   * miroir `localStorage` (cf. `crmTabsMirror`).
   */
  label?: string
  /** La tranche d'écran. Opaque côté serveur — voir l'en-tête. */
  ui?: Record<string, unknown>
}

/** L'état complet de la barre : la pile et le rang de l'actif. */
export interface CrmTabsState {
  tabs: CrmTab[]
  active: number
  /** Jeton de concurrence optimiste rendu par le serveur. `null` = jamais écrit. */
  revision: number | null
}

/**
 * Plafond de pile.
 *
 * La maquette n'en avait aucun (« À trancher » dans le handoff). 24 parce que
 * c'est le double du nombre d'onglets qu'un écran de 1280 px peut montrer avant
 * que le menu « +N » ne devienne la seule voie d'accès — au-delà, la barre n'est
 * plus une barre, c'est une liste qu'on ferait mieux de rendre autrement. Le
 * serveur porte la même borne en CHECK (`crm_open_tabs_taille`), en backstop :
 * ici c'est la règle, là-bas c'est le garde-fou.
 */
export const CRM_TABS_CAP = 24

/**
 * Surfaces qui n'ouvrent PAS d'onglet.
 *
 * La console super-admin porte son propre chrome ; `identite` et
 * `rendez-vous-accueil` sont des entonnoirs plein écran (`IdentityShell` réclame
 * `100dvh` et tout ce qui s'empile au-dessus pousse son pied d'actions hors de la
 * fenêtre — défaut du 04.08.2026). Une de leurs visites ne doit pas déplacer
 * l'onglet actif : l'agent qui revient au CRM doit retrouver la pile qu'il avait.
 */
const HORS_ONGLETS = ['/dashboard/admin', '/dashboard/identite', '/dashboard/rendez-vous-accueil']

/**
 * Un emplacement mérite-t-il un onglet ?
 *
 * ⚠ Ici et non dans `useCrmTabs` : le squelette de chargement le lit aussi, et
 * il doit rester léger — il s'affiche AVANT le chunk du layout.
 */
export function crmTabsEligible(pathname: string): boolean {
  if (!pathname.startsWith('/dashboard')) return false
  return !HORS_ONGLETS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Genre d'enregistrement qu'un onglet peut viser — miroir de `crm_tabs_resolve_labels`. */
export type CrmTabRecordKind = 'contact' | 'property' | 'deal' | 'kyc' | 'visit'

export interface CrmTabRecordRef {
  kind: CrmTabRecordKind
  id: string
}

/**
 * Routes de détail, et la LISTE sur laquelle elles retombent.
 *
 * ⚠ L'ordre compte : `listings/:id/edit` doit être testé avant `listings/:id`,
 * sinon le second capture le premier et un onglet d'édition se relit comme une
 * fiche. Les motifs sont donc rangés du plus spécifique au plus général.
 *
 * ⚠ `/dashboard/market/:id` N'Y EST TOUJOURS PAS, mais la raison a changé le
 * 05.09.2026. Elle n'y était pas parce que la page était morte — elle lisait son bien
 * dans un `location.state` que rien ne posait, et rendait « introuvable » à 100 % des
 * visites. Elle est réparée et lit désormais son uuid dans l'URL : un onglet la
 * restaure donc correctement par son seul chemin.
 *
 * Ce qui manque pour l'inscrire ICI est le LIBELLÉ : la table ne sert qu'à faire
 * résoudre un nom par `crm_tabs_resolve_labels`, et cela demanderait un sixième
 * `CrmTabRecordKind` côté client ET une branche `market_listings` côté SQL. Sans
 * elle, l'onglet porte le nom de sa section (« Matching »), ce qui est exact — juste
 * moins précis que le titre de l'annonce.
 */
const DETAIL_ROUTES: { motif: RegExp; kind: CrmTabRecordKind; liste: string }[] = [
  { motif: /^\/dashboard\/listings\/([^/]+)\/edit$/, kind: 'property', liste: '/dashboard/listings' },
  { motif: /^\/dashboard\/transactions\/([^/]+)\/offre\/[^/]+$/, kind: 'deal', liste: '/dashboard/pipeline' },
  { motif: /^\/dashboard\/contacts\/([^/]+)$/, kind: 'contact', liste: '/dashboard/contacts' },
  { motif: /^\/dashboard\/listings\/([^/]+)$/, kind: 'property', liste: '/dashboard/listings' },
  { motif: /^\/dashboard\/transactions\/([^/]+)$/, kind: 'deal', liste: '/dashboard/pipeline' },
  { motif: /^\/dashboard\/kyc\/([^/]+)$/, kind: 'kyc', liste: '/dashboard/kyc' },
  { motif: /^\/dashboard\/visits\/([^/]+)$/, kind: 'visit', liste: '/dashboard/calendar' },
]

/**
 * Segments qui ressemblent à un id mais n'en sont pas.
 *
 * `/dashboard/contacts/new` et `/dashboard/listings/new` matchent les motifs
 * ci-dessus. Les résoudre côté serveur les ferait ressortir en `missing`, et
 * l'onglet « Nouveau contact » retomberait sur la liste au premier chargement —
 * en pleine saisie.
 */
const SEGMENTS_RESERVES = new Set(['new', 'nouveau', 'bienvenue', 'edit'])

/** L'enregistrement visé par un chemin, ou `null` si le chemin n'en vise aucun. */
export function crmTabRecordRef(path: string): CrmTabRecordRef | null {
  for (const { motif, kind } of DETAIL_ROUTES) {
    const m = motif.exec(path)
    if (m && !SEGMENTS_RESERVES.has(m[1])) return { kind, id: m[1] }
  }
  return null
}

/**
 * La liste sur laquelle un onglet retombe quand son enregistrement a disparu.
 *
 * Règle du handoff (§6) : « `res_id` supprimé entre deux sessions : l'entrée
 * retombe sur la vue liste de son modèle — jamais un écran d'erreur. »
 */
export function crmTabFallbackPath(path: string): string {
  for (const { motif, liste } of DETAIL_ROUTES) {
    if (motif.test(path)) return liste
  }
  return '/dashboard'
}

/** Compteur de session — garantit l'unicité même à deux créations dans la même milliseconde. */
let seq = 0

/**
 * Identité d'un onglet neuf.
 *
 * ⚠ Pas `Date.now()` seul, comme la maquette : deux onglets ouverts dans le même
 * tick (une duplication déclenchée au clavier, un rétablissement de pile)
 * porteraient le MÊME id, et l'actif se retrouverait par le premier des deux.
 * L'horodatage garde l'ordre de création lisible ; le compteur garantit l'unicité.
 */
export function crmTabId(now: number): string {
  seq += 1
  return `t${now.toString(36)}-${seq.toString(36)}`
}

/** Onglet neuf pour un emplacement donné. */
export function crmMakeTab(
  path: string,
  search: string,
  now: number,
  extra?: Partial<Pick<CrmTab, 'label' | 'ui' | 'pinned'>>,
): CrmTab {
  return {
    id: crmTabId(now),
    path,
    search: search || '',
    section: crmSidebarActiveFor(path),
    ...extra,
  }
}

/**
 * Le libellé AFFICHÉ d'un onglet — le nom résolu, sinon celui de sa section,
 * sinon un repli.
 *
 * ⛔ IL VIT ICI PARCE QU'IL A DEUX LECTEURS. La bande d'onglets le calculait
 * chez elle, avec sa propre table `SECTION_LABEL` qui redisait ce que
 * `CRM_SIDEBAR_SECTIONS.labelKey` disait déjà. La palette de recherche en a
 * besoin à son tour pour proposer « aller à l'onglet qui montre déjà ce
 * client » — et un onglet de SECTION n'a pas de `label` du tout : le recopier
 * une troisième fois aurait fait diverger trois tables au premier renommage.
 *
 * @param t le traducteur du namespace `common` — la fonction reste pure, elle
 *          ne va pas chercher i18next elle-même.
 */
export function crmTabLibelle(tb: CrmTab, t: (cle: string) => string): string {
  if (tb.label) return tb.label
  const section = tb.section
    ? CRM_SIDEBAR_SECTIONS.find((s) => s.id === tb.section)
    : undefined
  if (section) return t(section.labelKey)
  // ⚠ Avant le repli : la page d'accueil d'onglet n'a PAS de section (c'est tout
  // son sens), elle tomberait donc sur « Onglet » — un repli fait pour un chemin
  // qu'on ne sait pas nommer, alors qu'on sait nommer celui-ci.
  if (tb.path === CRM_NEW_TAB_PATH) return t('tabs.new')
  return t('tabs.untitled')
}

/** Deux onglets visent le même emplacement ? (chemin ET query — `?tab=` distingue) */
export function crmSameLocation(t: CrmTab, path: string, search: string): boolean {
  return t.path === path && (t.search || '') === (search || '')
}

/** `path` + `search` recollés, prêts pour `navigate()`. */
export function crmTabHref(t: CrmTab): string {
  return `${t.path}${t.search || ''}`
}

/** Fin du bloc épinglé — où atterrit une puce qu'on épingle, et la borne d'insertion. */
export function crmPinnedCount(tabs: CrmTab[]): number {
  return tabs.filter((t) => t.pinned).length
}

/**
 * Rang de l'actif après une opération qui a bougé les index.
 *
 * Trois replis, dans cet ordre — le premier qui rend un rang valide gagne :
 * l'id qu'on suivait, puis l'onglet VISÉ par le geste (fermer l'actif doit
 * laisser le focus sur le voisin qu'on regardait), puis 0.
 */
export function crmResolveActive(tabs: CrmTab[], actifId: string | null, replliId?: string | null): number {
  if (!tabs.length) return 0
  const parId = actifId ? tabs.findIndex((t) => t.id === actifId) : -1
  if (parId >= 0) return parId
  const parRepli = replliId ? tabs.findIndex((t) => t.id === replliId) : -1
  if (parRepli >= 0) return parRepli
  return 0
}

/**
 * Réordonnancement, avec les bornes d'épinglage.
 *
 * ⚠ Une puce épinglée ne se déplace QUE parmi les épinglées, et une détachée que
 * parmi les détachées : sans cette borne, un glisser mélangerait les deux blocs
 * et l'épinglage ne voudrait plus rien dire (le bloc épinglé n'est pas un
 * attribut, c'est une POSITION — les épinglés sont le préfixe de la pile).
 */
export function crmMoveTab(tabs: CrmTab[], from: number, to: number): CrmTab[] {
  if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return tabs
  if (!!tabs[from].pinned !== !!tabs[to].pinned) return tabs
  const copie = tabs.slice()
  copie.splice(to, 0, copie.splice(from, 1)[0])
  return copie
}

/**
 * Bascule l'épinglage ET REPOSITIONNE.
 *
 * Épinglé → fin du bloc épinglé ; détaché → fin de barre. La maquette insiste :
 * l'épingle sans le déplacement laisserait une puce épinglée au milieu des
 * autres, donc un bloc épinglé qui n'est plus un bloc.
 */
export function crmTogglePin(tabs: CrmTab[], i: number): CrmTab[] {
  if (i < 0 || i >= tabs.length) return tabs
  const copie = tabs.slice()
  const tb = { ...copie[i], pinned: !copie[i].pinned }
  copie.splice(i, 1)
  copie.splice(tb.pinned ? crmPinnedCount(copie) : copie.length, 0, tb)
  return copie
}

/**
 * Duplique un onglet — même tranche, identité neuve, jamais épinglé.
 *
 * Inséré juste APRÈS l'original, et jamais avant la fin du bloc épinglé : une
 * copie non épinglée glissée dans le bloc épinglé casserait l'invariant « les
 * épinglés sont le préfixe ».
 */
export function crmDuplicateTab(tabs: CrmTab[], i: number, now: number): CrmTab[] {
  if (i < 0 || i >= tabs.length) return tabs
  const copie = tabs.slice()
  const clone: CrmTab = {
    ...copie[i],
    id: crmTabId(now),
    pinned: false,
    // ⚠ Copie de `ui`, pas partage de référence : deux onglets sur le même écran
    // doivent pouvoir diverger de filtre. Un objet partagé les recollerait.
    ui: copie[i].ui ? { ...copie[i].ui } : undefined,
  }
  copie.splice(Math.max(i + 1, crmPinnedCount(copie)), 0, clone)
  return copie
}

/**
 * Ferme un onglet. Rend `null` si le geste doit être refusé.
 *
 * ⛔ Le DERNIER onglet ne se ferme jamais : une barre vide n'a rien à afficher et
 * l'écran courant n'aurait plus d'onglet qui le représente. Un onglet ÉPINGLÉ ne
 * se ferme pas non plus par la croix (elle n'est pas rendue) — il faut le
 * détacher d'abord, ce qui est le sens de l'épingle.
 */
export function crmCloseTab(tabs: CrmTab[], i: number): CrmTab[] | null {
  if (tabs.length < 2 || i < 0 || i >= tabs.length) return null
  const copie = tabs.slice()
  copie.splice(i, 1)
  return copie
}

/** Ne garde que la puce visée et les épinglées. */
export function crmCloseOthers(tabs: CrmTab[], i: number): CrmTab[] {
  if (i < 0 || i >= tabs.length) return tabs
  return tabs.filter((t, k) => k === i || t.pinned)
}

/**
 * Combien d'onglets fermés on garde sous la main.
 *
 * Dix : de quoi couvrir une fermeture en rafale (« fermer les autres » sur une
 * pile de huit) sans faire de cette liste un historique. Ce n'est pas un
 * journal — c'est un filet pour la croix cliquée par erreur.
 */
export const CRM_FERMES_CAP = 10

/**
 * Empile un onglet fermé, le plus récent en tête.
 *
 * ⚠ DÉDOUBLONNÉ PAR EMPLACEMENT, et pas par id : l'id est neuf à chaque
 * ouverture, donc fermer trois fois la même fiche remplirait trois des dix
 * places avec la même chose. Ce qu'on veut rouvrir, c'est un ENDROIT.
 *
 * ⛔ CETTE PILE NE SORT PAS DE LA MÉMOIRE. Le libellé d'un onglet de fiche est
 * le NOM d'un client — la même PII qui interdit déjà le miroir `localStorage` de
 * la pile ouverte (cf. `CLE_MIROIR`). Un rechargement la perd, et c'est le prix
 * assumé : la persister demanderait de rouvrir la question du stockage des noms,
 * pour un filet qui sert dans la minute qui suit la fermeture.
 */
export function crmPushFerme(pile: CrmTab[], tb: CrmTab, cap = CRM_FERMES_CAP): CrmTab[] {
  const ici = (t: CrmTab) => `${t.path}${t.search || ''}`
  return [tb, ...pile.filter((t) => ici(t) !== ici(tb))].slice(0, cap)
}

/**
 * Les onglets dont l'écran reste VIVANT — monté, mais retiré de la vue.
 *
 * ⛔ DEUX RÈGLES QUI NE SE MÉLANGENT PAS, et les confondre coûte l'état qu'on
 * cherche à garder :
 *
 *  · la RÉCENCE décide de l'APPARTENANCE — on garde l'actif et les derniers
 *    quittés, parce que c'est entre ceux-là qu'on fait l'aller-retour ;
 *  · l'ordre de la PILE décide du RENDU. Trier le rendu par récence remettrait
 *    l'actif en tête à chaque bascule, donc réordonnerait les enfants. Mesuré le
 *    7 septembre 2026 : React déplace bien le nœud clé au lieu de le recréer,
 *    mais un déplacement s'exécute en DOM par un `removeChild` suivi d'un
 *    `insertBefore` — 560 éléments détachés puis réinsérés à chaque clic. L'ordre
 *    de la pile est stable, et c'est en plus celui qu'affiche la bande.
 *
 * @param recents ids par récence décroissante, actif compris ou non
 * @param max     combien d'écrans restent vivants (1 sur mobile)
 */
export function crmEcransVivants(
  tabs: CrmTab[],
  actifId: string | undefined,
  recents: string[],
  max: number,
): CrmTab[] {
  if (!actifId || max < 1) return []
  const gardes = new Set([actifId, ...recents.filter((x) => x !== actifId)].slice(0, max))
  return tabs.filter((t) => gardes.has(t.id))
}

/**
 * Pousse un onglet en tête de la pile de récence, sans doublon, bornée à `cap`.
 *
 * ⚠ Extraite pour que le composant et ses tests appliquent LA MÊME règle : la
 * suite recopiait l'expression, et la copie avait déjà divergé (le composant
 * tronquait au plafond global quand la copie tronquait au plafond du test).
 */
export function crmPousserRecent(recents: string[], id: string, cap: number): string[] {
  return [id, ...recents.filter((x) => x !== id)].slice(0, cap)
}

/**
 * L'onglet que l'écran doit MONTRER, compte tenu de l'URL réelle du routeur.
 *
 * ⛔ C'EST LA PIÈCE QUI MANQUAIT AUX ÉCRANS VIVANTS, ET SANS ELLE ILS NE
 * FONCTIONNAIENT PAS EN PRODUCTION. Mesuré le 12 septembre 2026 : sur six
 * bascules entre quatre écrans vivants, **six** pages d'arrivée étaient
 * détruites puis reconstruites avec le routeur de l'app, **zéro** avec celui du
 * banc. La cause tient en deux lignes de `selectionner` : l'onglet actif change
 * dans une mise à jour SYNCHRONE, puis `navigate` part dans une TRANSITION
 * (`v7_startTransition`). React valide donc d'abord un état où l'onglet
 * d'arrivée est actif mais où le routeur montre encore l'URL de départ ; l'écran
 * d'arrivée, rendu sur cette URL, démontait sa page — et la remontait à neuf au
 * commit suivant. Le banc (`MemoryRouter` sans ce drapeau) validait les deux
 * mises à jour ensemble et ne pouvait pas le voir.
 *
 * La règle qui en sort : **un écran ne se rend JAMAIS sur une URL qui appartient
 * à un autre onglet.** L'écran montré est celui dont l'emplacement est l'URL du
 * routeur (l'actif d'abord) ; à défaut — navigation dans l'onglet vers un
 * endroit neuf — c'est l'actif, qui suit alors le routeur. Les trois chemins
 * s'en trouvent justes sans cas particulier :
 *   • bascule par la bande (actif d'abord, URL ensuite) : l'écran de départ
 *     reste montré le temps de la transition, puis celui d'arrivée — aucun des
 *     deux n'est démonté ;
 *   • barre latérale, lien, Précédent (URL d'abord, actif ensuite) : l'onglet
 *     qui porte déjà cette URL est montré tout de suite ;
 *   • chargement : l'onglet qui porte l'URL d'arrivée est montré dès la
 *     première frame, sans attendre la réconciliation.
 */
export function crmEcranVisible(
  tabs: CrmTab[],
  actifId: string | undefined,
  pathname: string,
  search: string,
): string | undefined {
  const actif = actifId ? tabs.find((t) => t.id === actifId) : undefined
  if (actif && crmSameLocation(actif, pathname, search)) return actif.id
  return tabs.find((t) => crmSameLocation(t, pathname, search))?.id ?? actifId
}

/**
 * Largeur PLANCHER d'une puce, selon le nombre d'onglets.
 *
 * ⛔ ELLE ÉTAIT UNE CONSTANTE — `CHIP_MIN = 100` dans la barre — et c'est ce qui
 * plafonnait la bande à huit puces sur 1440. Au-delà, les onglets ne
 * rétrécissaient pas : ils DISPARAISSAIENT dans le menu « +N », d'où on ne les
 * retrouve qu'en le dépliant. Un navigateur fait l'inverse, et c'est la demande
 * de Julien (7 septembre 2026) : on resserre les puces tant qu'on peut lire, et
 * on ne cache qu'ensuite.
 *
 * Les trois paliers sont accordés au CONTENU d'une puce, pas choisis ronds : la
 * gouttière (12) + le libellé + la croix (16) + sa respiration. À 100 px on lit
 * « Aujourd'hui » en entier ; à 76 on lit « Aujourd… » ; à 60 il reste ~5
 * caractères, ce qui distingue encore « Calen… » de « Contac… » — en dessous,
 * deux fiches de contact deviendraient indiscernables et la puce ne servirait
 * plus à rien.
 */
export function crmChipMinWidth(nTabs: number): number {
  if (nTabs <= 8) return 100
  if (nTabs <= 14) return 76
  return 60
}

/**
 * Fenêtre visible et débordement — une BANDE QUI DÉFILE, pas un préfixe figé.
 *
 * ⛔ CE QU'ELLE FAISAIT, ET POURQUOI C'ÉTAIT FAUX. La fenêtre était « les `vis`
 * premières, et si l'actif n'y est pas il prend le dernier créneau ». Mesuré à
 * l'écran le 7 septembre 2026, 20 onglets, 9 créneaux : les puces affichées
 * étaient `0,1,2,3,4,5,6,7,19`. Trois conséquences, toutes visibles :
 *
 *   1. l'ORDRE AFFICHÉ EST FAUX — la puce 19 se donne pour la voisine de la 7 ;
 *   2. les onglets 8 à 18 ne sont atteignables QUE par le menu, quoi qu'on
 *      fasse : aucun geste ne les ramène dans la bande ;
 *   3. le créneau emprunté a déjà coûté un correctif ailleurs — `crmDragBounds`
 *      existe presque entièrement pour empêcher qu'un glisser d'un cran ne
 *      téléporte une puce de huit rangs.
 *
 * Ici la fenêtre est CONTIGUË et elle se déplace du MINIMUM nécessaire pour
 * contenir l'actif — comme la bande d'onglets d'un navigateur. `debut` est donc
 * un état porté par l'appelant : sans mémoire du cadrage précédent, la fenêtre
 * se recentrerait à chaque bascule et les puces sauteraient sous le curseur.
 *
 * ⚠ LES ÉPINGLÉES NE DÉFILENT PAS. Elles sont le préfixe de la pile et restent
 * à l'écran : une épingle qu'un défilement emporte n'épingle rien. Elles
 * consomment donc des créneaux, et la fenêtre glissante se partage le reste.
 *
 * ⚠ LE CRÉNEAU EMPRUNTÉ SUBSISTE POUR UN SEUL CAS, et il est réellement
 * insoluble : plus d'épinglées que de créneaux. Le handoff exige que l'actif
 * soit visible, huit épingles et un actif ne tiennent pas dans six créneaux, et
 * quelque chose doit céder. Partout ailleurs il a disparu.
 *
 * @param debut premier rang NON ÉPINGLÉ affiché, cadrage précédent
 * @param nPin  nombre d'onglets épinglés (ils occupent le préfixe de la pile)
 */
export function crmVisibleWindow(
  total: number,
  active: number,
  vis: number,
  debut = 0,
  nPin = 0,
): { visibles: number[]; caches: number[]; debut: number } {
  const tous = Array.from({ length: total }, (_, i) => i)
  if (total <= vis) return { visibles: tous, caches: [], debut: nPin }

  // Les épinglées d'abord, autant qu'il y a de place.
  const epingles = tous.slice(0, Math.min(nPin, vis))
  const creneaux = vis - epingles.length

  if (creneaux <= 0) {
    // Plus d'épinglées que de créneaux : le seul cas où l'actif emprunte encore
    // un siège, faute de mieux.
    const visibles = epingles.slice()
    if (!visibles.includes(active) && visibles.length) visibles[visibles.length - 1] = active
    const dedans = new Set(visibles)
    return { visibles, caches: tous.filter((i) => !dedans.has(i)), debut: nPin }
  }

  // La fenêtre glissante ne couvre que la partie NON épinglée.
  const premier = nPin
  const dernierDebut = Math.max(premier, total - creneaux)
  let d = Math.min(Math.max(debut, premier), dernierDebut)
  // Déplacement MINIMAL — c'est ce qui évite que la bande se recentre à chaque clic.
  if (active >= premier) {
    if (active < d) d = active
    else if (active >= d + creneaux) d = active - creneaux + 1
  }
  const fenetre = tous.slice(d, d + creneaux)
  const visibles = [...epingles, ...fenetre]
  const dedans = new Set(visibles)
  return { visibles, caches: tous.filter((i) => !dedans.has(i)), debut: d }
}

/**
 * Bornes d'un glisser : le bloc CONTIGU de rangs réels autour de la puce tirée, de
 * même épinglage.
 *
 * ⛔ LA FENÊTRE VISIBLE N'EST PAS TOUJOURS CONTIGUË. Quand l'onglet actif est hors
 * fenêtre, il EMPRUNTE le dernier créneau : à 15 onglets avec l'actif au rang 12, la
 * barre montre les rangs [0,1,2,3,4,12]. Tirer la puce du créneau 4 vers le créneau 5
 * — UN cran à l'écran — la déplaçait du rang 4 au rang 12 : huit rangs franchis, et la
 * puce SORTAIT du champ visible à l'arrivée. Mesuré le 4 septembre 2026.
 *
 * Le dernier créneau n'est pas « la position 6 de la pile », c'est un siège emprunté :
 * on n'y dépose rien. Le glisser se limite donc aux créneaux dont les rangs réels se
 * suivent. On réordonne ce qu'on voit, et rien ne se téléporte.
 *
 * @param rangs rang RÉEL de chaque créneau visible, dans l'ordre d'affichage
 * @param from  créneau tiré (indice dans `rangs`)
 * @param epingle prédicat « ce rang est épinglé »
 */
export function crmDragBounds(
  rangs: number[],
  from: number,
  epingle: (rang: number) => boolean,
): { lo: number; hi: number } {
  const meme = (k: number) => epingle(rangs[k]) === epingle(rangs[from])
  let lo = from
  let hi = from
  while (lo > 0 && rangs[lo - 1] === rangs[lo] - 1 && meme(lo - 1)) lo -= 1
  while (hi < rangs.length - 1 && rangs[hi + 1] === rangs[hi] + 1 && meme(hi + 1)) hi += 1
  return { lo, hi }
}

/**
 * Largeur maximale d'une puce — elle se resserre avec le nombre d'onglets.
 *
 * Les valeurs de la maquette (240 / 170 / 128, moins 30 quand le dock est ouvert)
 * sont des LARGEURS, pas des espacements : elles ne relèvent d'aucun barreau de
 * l'échelle et se lisent telles quelles. Les puces s'ellipsent, elles ne
 * débordent jamais.
 */
export function crmChipMaxWidth(nTabs: number, dockOuvert: boolean): number {
  const base = nTabs <= 3 ? 240 : nTabs <= 5 ? 170 : 128
  return base - (dockOuvert ? 30 : 0)
}

/**
 * Applique le verdict du serveur sur les libellés et les disparus.
 *
 * ⚠ Un enregistrement disparu ne FERME pas son onglet : il le fait retomber sur
 * sa vue liste, en effaçant le libellé périmé. Fermer effacerait un onglet que
 * l'agent avait délibérément gardé ouvert — et il ne saurait pas pourquoi.
 */
export function crmApplyLabels(
  tabs: CrmTab[],
  labels: Record<string, string>,
  missing: string[],
): CrmTab[] {
  if (!Object.keys(labels).length && !missing.length) return tabs
  const absents = new Set(missing)
  return tabs.map((t) => {
    const ref = crmTabRecordRef(t.path)
    if (!ref) return t
    if (absents.has(ref.id)) {
      const liste = crmTabFallbackPath(t.path)
      return { ...t, path: liste, search: '', section: crmSidebarActiveFor(liste), label: undefined }
    }
    const nom = labels[ref.id]
    return nom && nom !== t.label ? { ...t, label: nom } : t
  })
}

/**
 * Les références à résoudre côté serveur, dédoublonnées.
 *
 * Deux onglets sur la même fiche (une duplication) ne valent qu'UNE résolution :
 * `crm_tabs_resolve_labels` est bornée à 24 entrées, et la pile l'est aussi —
 * sans dédoublonnage, douze duplications sature la borne et les douze autres
 * onglets ressortiraient sans libellé.
 */
export function crmTabRefs(tabs: CrmTab[]): CrmTabRecordRef[] {
  const vus = new Set<string>()
  const refs: CrmTabRecordRef[] = []
  for (const t of tabs) {
    const ref = crmTabRecordRef(t.path)
    if (ref && !vus.has(ref.id)) {
      vus.add(ref.id)
      refs.push(ref)
    }
  }
  return refs
}

/**
 * Applique le plafond en fermant les onglets les plus À GAUCHE, non épinglés.
 *
 * ⚠ « À gauche », et non « les plus anciens » comme le disait cette phrase : un
 * onglet ne porte aucune date de dernier accès, et l'ordre de la pile est celui
 * que l'agent a choisi au glisser — il ne dit rien de l'ancienneté. Le plus à
 * gauche est simplement le plus loin de la zone de travail courante ; c'est un
 * choix de position, pas une mesure de fraîcheur.
 *
 * ⚠ Jamais l'actif, jamais un épinglé. Si tout est épinglé, la pile dépasse le
 * plafond plutôt que de trahir une épingle : le garde-fou serveur est à 32,
 * strictement au-dessus du plafond client (24), donc ce dépassement transitoire
 * ne peut pas faire échouer l'écriture.
 */
export function crmApplyCap(
  tabs: CrmTab[],
  activeId: string | null,
  proteges?: ReadonlySet<string>,
): CrmTab[] {
  if (tabs.length <= CRM_TABS_CAP) return tabs
  const surplus = tabs.length - CRM_TABS_CAP
  const aFermer = new Set<string>()
  for (const t of tabs) {
    if (aFermer.size >= surplus) break
    // ⚠ `proteges` : les onglets dont l'écran porte une saisie non enregistrée. Les
    // évincer en silence la perdait — ils passent désormais leur tour, comme l'actif.
    if (!t.pinned && t.id !== activeId && !proteges?.has(t.id)) aFermer.add(t.id)
  }
  return tabs.filter((t) => !aFermer.has(t.id))
}
