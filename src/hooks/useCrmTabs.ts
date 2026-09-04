/**
 * La pile d'onglets du CRM — état, persistance, et le pont avec le routeur.
 *
 * ── OÙ CE FOURNISSEUR VIT, ET POURQUOI PAS LÀ OÙ VIT LA BARRE ────────────────
 * Le fournisseur est monté dans `AgentLayout`, qui NE SE REMONTE PLUS à la
 * navigation depuis que les routes ne sont plus keyées par `pathname`. La BARRE,
 * elle, est rendue par chaque surface, comme la barre latérale. Ce n'est pas une
 * incohérence, c'est la seule répartition qui marche :
 *
 *   • hisser la BARRE la poserait sur la console super-admin, sur `IdentityShell`
 *     et sur quatre routes qui n'en veulent pas, et la retirerait des bancs
 *     `/dev/*` — l'argument déjà écrit dans `CrmSidebar.tsx` pour la barre latérale ;
 *   • ne PAS hisser le FOURNISSEUR le ferait se démonter à chaque navigation,
 *     donc perdre la pile à chaque clic. Un fournisseur ne peint rien : le poser
 *     sur une route qui n'affiche pas de barre ne coûte rien.
 *
 * ── LE GEL DE LA TRANCHE EST CONTINU, PAS AU MOMENT DE QUITTER ───────────────
 * La maquette gèle la tranche de l'onglet qu'on quitte au moment de la bascule
 * (« trois gestes indissociables »). Ici l'URL est la moitié de la tranche, et
 * elle change SANS passer par la barre — un clic dans une liste, un bouton
 * « retour », un lien profond. Le gel est donc un effet qui suit `location` :
 * l'onglet actif porte en permanence l'emplacement courant.
 *
 * ⛔ ET C'EST LÀ QU'EST LA COURSE. Basculer d'onglet, c'est poser l'actif PUIS
 * naviguer. Entre les deux, `location` est encore celle de l'onglet qu'on quitte,
 * et l'effet de gel l'écrirait dans l'onglet d'ARRIVÉE — qui perdrait son
 * emplacement à l'instant où on l'ouvre. D'où `attenduRef` : tant que la
 * navigation demandée n'est pas arrivée, le gel se tait. C'est l'équivalent de la
 * fenêtre `_tabSup` de la maquette, transposée du clic vers la route.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  CRM_TABS_CAP, crmApplyCap, crmApplyLabels, crmCloseOthers, crmCloseTab,
  crmDuplicateTab, crmMakeTab, crmMoveTab, crmResolveActive, crmSameLocation,
  crmTabHref, crmTabRefs, crmTogglePin, type CrmTab, type CrmTabsState,
} from '@/lib/crmTabs'
import { crmSidebarActiveFor } from '@/components/crm/crmSidebarNav'

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

/** Un emplacement mérite-t-il un onglet ? */
export function crmTabsEligible(pathname: string): boolean {
  if (!pathname.startsWith('/dashboard')) return false
  return !HORS_ONGLETS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Miroir de démarrage — `sessionStorage`, JAMAIS `localStorage`.
 *
 * Le libellé d'un onglet de fiche est le NOM d'un client : c'est de la PII, et
 * CLAUDE.md l'interdit en `localStorage`. Le dépôt a déjà tranché ce cas au même
 * motif (`ImportLeadPage` : « SessionStorage uniquement — la donnée contient des
 * PII »). `sessionStorage` meurt avec l'onglet du navigateur ; le serveur, lui,
 * garde la pile et la rend au prochain démarrage.
 *
 * Le miroir n'existe que pour la première frame : sans lui la barre affiche un
 * seul onglet puis se repeuple ~200 ms plus tard, et le contenu saute.
 */
const CLE_MIROIR = 'megga.crm.tabs'

function lireMiroir(): CrmTabsState | null {
  if (typeof window === 'undefined') return null
  try {
    const brut = window.sessionStorage?.getItem(CLE_MIROIR)
    if (!brut) return null
    const v = JSON.parse(brut) as CrmTabsState
    return Array.isArray(v?.tabs) && v.tabs.length ? v : null
  } catch {
    // Stockage refusé (navigation privée, cookies bloqués) : on démarre sans miroir.
    return null
  }
}

function ecrireMiroir(etat: CrmTabsState): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(CLE_MIROIR, JSON.stringify(etat))
  } catch {
    // Le miroir est un confort de démarrage : son échec ne doit rien casser.
  }
}

export interface CrmTabsApi extends CrmTabsState {
  /** `true` tant que la pile serveur n'a pas répondu — la barre rend un état d'attente. */
  chargement: boolean
  selectionner: (i: number) => void
  ouvrirNouvel: () => void
  /** Ouvre un emplacement dans un onglet NEUF (⌘-clic, « dupliquer », lien tiers). */
  ouvrirDans: (href: string, label?: string) => void
  fermer: (i: number) => void
  fermerAutres: (i: number) => void
  basculerEpingle: (i: number) => void
  dupliquer: (i: number) => void
  deplacer: (from: number, to: number) => void
  /** Pose le libellé de l'onglet actif — appelé par l'écran qui connaît son titre. */
  poserLibelle: (label: string) => void
  /** Lecture/écriture de la tranche d'écran de l'onglet actif. */
  lireUi: (cle: string) => unknown
  ecrireUi: (cle: string, valeur: unknown) => void
  /** Déclare que l'écran actif porte du travail non enregistré. */
  marquerSale: (sale: boolean) => void
}

/**
 * Le contexte lui-même. Exporté parce que le composant fournisseur vit dans un
 * AUTRE fichier (voir `useCrmTabsMachine`) — il n'a pas d'autre consommateur.
 */
export const CrmTabsCtx = createContext<CrmTabsApi | null>(null)
const Ctx = CrmTabsCtx

/** L'API des onglets, ou `null` hors fournisseur (mobile, console admin, bancs). */
export function useCrmTabsOptionnel(): CrmTabsApi | null {
  return useContext(Ctx)
}

/**
 * L'API des onglets. Jette hors fournisseur — à n'appeler que depuis la barre.
 * Les écrans passent par `useTabScopedState`, qui se dégrade tout seul.
 */
export function useCrmTabs(): CrmTabsApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useCrmTabs() hors <CrmTabsProvider>')
  return api
}

/**
 * Accorde une pile avec l'emplacement COURANT du routeur.
 *
 * ⛔ CE CHEMIN EST PARTAGÉ PAR LA NAVIGATION **ET** PAR L'HYDRATATION, et c'est
 * un défaut mesuré qui l'a imposé. La pile restaurée porte son propre onglet
 * actif ; le routeur, lui, est sur l'URL par laquelle on vient d'arriver. Tant
 * que l'hydratation posait la pile telle quelle, la barre annonçait « Analytics »
 * pendant que l'écran montrait « Aujourd'hui » — vu à l'écran le 4 septembre
 * 2026, invisible à la lecture du code.
 *
 * La règle : L'URL D'ARRIVÉE GAGNE. Elle est ce que l'agent a demandé — un lien
 * profond, un signet, un rechargement — et une pile mémorisée ne doit pas la
 * détourner. La pile fournit le CONTEXTE (les autres onglets, leur ordre, leurs
 * tranches), jamais la destination.
 */
function reconcilier(prev: CrmTabsState, pathname: string, search: string): CrmTabsState {
  // Un onglet vise déjà cet emplacement ? On l'active au lieu d'en créer un
  // second — sinon un aller-retour entre deux écrans empilerait des doublons.
  const dejaLa = prev.tabs.findIndex((t) => crmSameLocation(t, pathname, search))
  if (dejaLa >= 0) return dejaLa === prev.active ? prev : { ...prev, active: dejaLa }

  const section = crmSidebarActiveFor(pathname)
  if (!prev.tabs.length) {
    return { ...prev, tabs: [crmMakeTab(pathname, search, Date.now())], active: 0 }
  }
  // Navigation ORDINAIRE : l'onglet actif suit, comme un onglet de navigateur
  // suit ses liens. Ouvrir un onglet neuf à chaque clic ferait de la barre un
  // historique, pas un plan de travail.
  const tabs = prev.tabs.slice()
  const i = Math.min(prev.active, tabs.length - 1)
  tabs[i] = { ...tabs[i], path: pathname, search, section, label: undefined }
  return { ...prev, tabs, active: i }
}

/**
 * La MACHINE des onglets : tout l'état, la persistance et les gestes.
 *
 * ⚠ Séparée du composant fournisseur (`CrmTabsProvider`, dans
 * `src/components/crm/`) parce qu'un module qui exporte un composant ne peut
 * rien exporter d'autre sans casser le rafraîchissement à chaud
 * (`react-refresh/only-export-components`, en ERREUR dans ce dépôt). Le
 * découpage suit donc la règle de l'outil, pas un goût : ici la logique et les
 * hooks, là-bas les dix lignes qui rendent le contexte.
 */
export function useCrmTabsMachine(): CrmTabsApi {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { t } = useTranslation('common')
  const messageSale = t('tabs.confirmClose')

  /**
   * L'écran actif porte-t-il du travail non enregistré ?
   *
   * ⚠ Une REF, pas un état : ce drapeau change à chaque frappe dans un
   * formulaire, et le passer par `useState` re-rendrait la barre d'onglets
   * entière à chaque caractère saisi.
   */
  const saleRef = useRef(false)

  const [etat, setEtat] = useState<CrmTabsState>(() => lireMiroir() ?? { tabs: [], active: 0, revision: null })
  const [chargement, setChargement] = useState(true)

  /**
   * Emplacement demandé par une bascule d'onglet, tant qu'il n'est pas arrivé.
   * Voir l'en-tête : c'est ce qui empêche le gel d'écrire l'ancienne URL dans
   * l'onglet d'arrivée.
   */
  const attenduRef = useRef<string | null>(null)
  // ⚠ L'emplacement LU DANS UNE REF par l'effet de chargement : le mettre dans
  // ses dépendances relancerait la lecture serveur à chaque navigation.
  const locationRef = useRef(location)
  locationRef.current = location
  const etatRef = useRef(etat)
  etatRef.current = etat

  // ── Chargement de la pile ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      // Pas de session : la barre vit en mémoire pour la durée de l'écran.
      setChargement(false)
      return
    }
    let vivant = true
    void (async () => {
      const { data, error } = await supabase
        .from('crm_open_tabs')
        .select('tabs, active_index, revision')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!vivant) return
      if (error || !data) {
        // ⚠ `data` déstructuré de son `error` : une lecture en échec ne doit pas
        // se lire comme une pile vide, sinon la barre efface silencieusement les
        // onglets de l'agent. On garde le miroir et on laisse la pile se
        // reconstruire depuis l'emplacement courant.
        setChargement(false)
        return
      }
      const tabs = Array.isArray(data.tabs) ? (data.tabs as unknown as CrmTab[]) : []
      // ⚠ RÉCONCILIÉE avec l'emplacement courant, jamais posée telle quelle :
      // voir l'en-tête de `reconcilier`. Sans ça la barre désigne un onglet que
      // l'écran ne montre pas.
      setEtat(reconcilier({
        tabs,
        active: Math.min(Math.max(data.active_index ?? 0, 0), Math.max(tabs.length - 1, 0)),
        revision: typeof data.revision === 'number' ? data.revision : null,
      }, locationRef.current.pathname, locationRef.current.search))
      setChargement(false)

      // Libellés et disparus, en une passe. Le résultat n'est pas bloquant : la
      // barre affiche déjà ses onglets avec leur dernier libellé connu.
      const refs = crmTabRefs(tabs)
      if (!refs.length) return
      const { data: res } = await supabase.rpc('crm_tabs_resolve_labels', {
        p_refs: refs as unknown as never,
      })
      if (!vivant || !res) return
      const paquet = res as unknown as { labels?: Record<string, string>; missing?: string[] }
      setEtat((prev) => ({
        ...prev,
        tabs: crmApplyLabels(prev.tabs, paquet.labels ?? {}, paquet.missing ?? []),
      }))
    })()
    return () => { vivant = false }
  }, [user?.id])

  // ── Gel continu : l'onglet actif porte l'emplacement courant ───────────────
  useEffect(() => {
    if (isMobile) return
    const href = `${location.pathname}${location.search}`
    if (attenduRef.current) {
      // Une bascule est en vol : on ne gèle rien tant qu'elle n'a pas atterri.
      if (attenduRef.current === href) attenduRef.current = null
      return
    }
    if (!crmTabsEligible(location.pathname)) return
    setEtat((prev) => reconcilier(prev, location.pathname, location.search))
  }, [location.pathname, location.search, isMobile])

  // ── Persistance différée ───────────────────────────────────────────────────
  // 800 ms : la cadence que le handoff prescrit, et elle se justifie ici — un
  // glisser de réordonnancement produit un état final, pas trente ; une bascule
  // d'onglet ne doit pas coûter un POST. Le `pagehide` ferme le dernier trou.
  const sauverRef = useRef<number | undefined>(undefined)
  const enVolRef = useRef(false)

  const sauver = useCallback(async (immediat = false) => {
    const { tabs, active, revision } = etatRef.current
    if (!user?.id || !tabs.length) return
    if (enVolRef.current && !immediat) return
    enVolRef.current = true
    try {
      const { data, error } = await supabase.rpc('crm_tabs_save', {
        p_tabs: tabs as unknown as never,
        p_active: active,
        // ⚠ `?? undefined` et non `?? null` : le paramètre est OPTIONNEL côté SQL
        // (`default null`), et l'omettre vaut « je ne sais pas », ce qui laisse
        // passer la première écriture. Un `null` explicite dirait la même chose,
        // mais le type généré ne l'accepte pas.
        p_revision: revision ?? undefined,
      })
      if (error || !data) return
      const paquet = data as unknown as {
        tabs?: CrmTab[]; active_index?: number; revision?: number; stale?: boolean
      }
      if (paquet.stale) {
        // Une autre fenêtre a écrit entre-temps. On ADOPTE son état plutôt que de
        // l'écraser : sinon l'agent voit ses onglets disparaître dans une fenêtre
        // sans avoir rien fermé.
        setEtat({
          tabs: Array.isArray(paquet.tabs) ? paquet.tabs : tabs,
          active: paquet.active_index ?? 0,
          revision: paquet.revision ?? null,
        })
      } else if (typeof paquet.revision === 'number') {
        setEtat((prev) => (prev.revision === paquet.revision ? prev : { ...prev, revision: paquet.revision! }))
      }
    } catch {
      // Écriture best-effort : la pile vaut pour la session même si le réseau tombe.
    } finally {
      enVolRef.current = false
    }
  }, [user?.id])

  useEffect(() => {
    ecrireMiroir(etat)
    if (chargement || !user?.id) return
    if (sauverRef.current) window.clearTimeout(sauverRef.current)
    sauverRef.current = window.setTimeout(() => { void sauver() }, 800)
    return () => { if (sauverRef.current) window.clearTimeout(sauverRef.current) }
  }, [etat, chargement, user?.id, sauver])

  useEffect(() => {
    // ⚠ `pagehide`, pas `beforeunload` : le second ne part pas sur iOS et sur les
    // fermetures d'onglet mobiles, et il est le seul des deux à pouvoir bloquer.
    const partir = () => { void sauver(true) }
    window.addEventListener('pagehide', partir)
    return () => window.removeEventListener('pagehide', partir)
  }, [sauver])

  // ── Gestes ─────────────────────────────────────────────────────────────────
  /** Bascule : pose l'actif, puis navigue — et arme la fenêtre de silence du gel. */
  const selectionner = useCallback((i: number) => {
    const { tabs, active } = etatRef.current
    if (i < 0 || i >= tabs.length || i === active) return
    const cible = tabs[i]
    const href = crmTabHref(cible)
    attenduRef.current = href
    setEtat((prev) => ({ ...prev, active: i }))
    navigate(href)
  }, [navigate])

  const ouvrirDans = useCallback((href: string, label?: string) => {
    const [path, q] = href.split('?')
    const search = q ? `?${q}` : ''
    attenduRef.current = href
    setEtat((prev) => {
      const tabs = crmApplyCap([...prev.tabs, crmMakeTab(path, search, Date.now(), { label })], null)
      return { ...prev, tabs, active: tabs.length - 1 }
    })
    navigate(href)
  }, [navigate])

  const ouvrirNouvel = useCallback(() => { ouvrirDans('/dashboard') }, [ouvrirDans])

  /**
   * Fermeture — le SEUL endroit qui sait fermer un onglet.
   *
   * La croix, la ligne du menu de débordement et l'action « Fermer » du clic droit
   * passent toutes par ici. La maquette insiste, et pour une raison qui se voit à
   * l'usage : trois chemins de fermeture, ce sont trois recalages d'index à tenir
   * d'accord.
   */
  const fermer = useCallback((i: number) => {
    const prev = etatRef.current
    const restants = crmCloseTab(prev.tabs, i)
    if (!restants) return
    // ⛔ LE FILET DU TRAVAIL NON ENREGISTRÉ. Le dépôt n'en avait AUCUN — zéro
    // `beforeunload` dans tout `src/` — alors que quatre brouillons d'édition
    // vivent dans la fiche contact, un dans la fiche bien, et que le wizard de
    // création écrit avec 30 s de retard. Poser une croix à côté de tout ça sans
    // rien demander serait la régression la plus visible de ce chantier.
    //
    // ⚠ Il ne vaut QUE pour l'onglet actif, et c'est une limite honnête : les
    // écrans des autres onglets sont démontés, leur saisie est déjà perdue par
    // construction (elle l'était avant les onglets aussi). Prétendre les protéger
    // demanderait de les garder montés — un autre chantier.
    if (i === prev.active && saleRef.current) {
      if (!window.confirm(messageSale)) return
      saleRef.current = false
    }
    const actifId = prev.tabs[prev.active]?.id ?? null
    const voisinId = restants[Math.min(i, restants.length - 1)]?.id ?? null
    const active = crmResolveActive(restants, i === prev.active ? null : actifId, voisinId)
    setEtat({ ...prev, tabs: restants, active })
    const cible = crmTabHref(restants[active])
    if (cible !== `${location.pathname}${location.search}`) {
      attenduRef.current = cible
      navigate(cible)
    }
  }, [navigate, location.pathname, location.search, messageSale])

  /** Les gestes qui bougent les index et gardent l'actif PAR SON id. */
  const parId = useCallback((calcul: (tabs: CrmTab[]) => CrmTab[], viseId?: string) => {
    const prev = etatRef.current
    const actifId = prev.tabs[prev.active]?.id ?? null
    const tabs = calcul(prev.tabs)
    if (tabs === prev.tabs) return
    setEtat({ ...prev, tabs, active: crmResolveActive(tabs, actifId, viseId ?? null) })
  }, [])

  const fermerAutres = useCallback((i: number) => {
    const vise = etatRef.current.tabs[i]?.id
    parId((tabs) => crmCloseOthers(tabs, i), vise)
    const prev = etatRef.current
    const cible = prev.tabs[i] ? crmTabHref(prev.tabs[i]) : null
    if (cible && cible !== `${location.pathname}${location.search}`) {
      attenduRef.current = cible
      navigate(cible)
    }
  }, [parId, navigate, location.pathname, location.search])

  const basculerEpingle = useCallback((i: number) => { parId((tabs) => crmTogglePin(tabs, i)) }, [parId])
  const dupliquer = useCallback((i: number) => { parId((tabs) => crmDuplicateTab(tabs, i, Date.now())) }, [parId])
  const deplacer = useCallback((from: number, to: number) => { parId((tabs) => crmMoveTab(tabs, from, to)) }, [parId])

  const poserLibelle = useCallback((label: string) => {
    setEtat((prev) => {
      const t = prev.tabs[prev.active]
      if (!t || t.label === label || !label) return prev
      const tabs = prev.tabs.slice()
      tabs[prev.active] = { ...t, label }
      return { ...prev, tabs }
    })
  }, [])

  const lireUi = useCallback((cle: string) => etatRef.current.tabs[etatRef.current.active]?.ui?.[cle], [])

  const ecrireUi = useCallback((cle: string, valeur: unknown) => {
    setEtat((prev) => {
      const t = prev.tabs[prev.active]
      if (!t) return prev
      if (t.ui?.[cle] === valeur) return prev
      const tabs = prev.tabs.slice()
      tabs[prev.active] = { ...t, ui: { ...(t.ui ?? {}), [cle]: valeur } }
      return { ...prev, tabs }
    })
  }, [])

  const marquerSale = useCallback((sale: boolean) => { saleRef.current = sale }, [])

  /**
   * Le filet du NAVIGATEUR — fermer la fenêtre, pas l'onglet du CRM.
   *
   * ⚠ `beforeunload` ici et `pagehide` pour la sauvegarde : ce ne sont pas des
   * doublons. `pagehide` ne peut PAS retenir la fermeture (c'est ce qui le rend
   * fiable pour écrire) ; `beforeunload` le peut, et c'est tout ce qu'on lui
   * demande. Il n'est armé QUE lorsqu'un écran s'est déclaré sale — un
   * `beforeunload` permanent ferait apparaître la boîte du navigateur à chaque
   * fermeture, y compris sur un écran sans saisie.
   */
  useEffect(() => {
    const onQuitter = (e: BeforeUnloadEvent) => {
      if (!saleRef.current) return
      e.preventDefault()
      // Les navigateurs modernes ignorent le texte et affichent le leur ; poser
      // `returnValue` reste ce qui DÉCLENCHE la boîte.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onQuitter)
    return () => window.removeEventListener('beforeunload', onQuitter)
  }, [])

  const api = useMemo<CrmTabsApi>(() => ({
    ...etat, chargement,
    selectionner, ouvrirNouvel, ouvrirDans, fermer, fermerAutres,
    basculerEpingle, dupliquer, deplacer, poserLibelle, lireUi, ecrireUi, marquerSale,
  }), [etat, chargement, selectionner, ouvrirNouvel, ouvrirDans, fermer, fermerAutres,
    basculerEpingle, dupliquer, deplacer, poserLibelle, lireUi, ecrireUi, marquerSale])

  return api
}

/**
 * `useState`, mais rangé DANS l'onglet actif.
 *
 * C'est le port de `TAB_KEYS` : au lieu d'une liste globale de 28 clés, chaque
 * écran déclare la sienne à l'endroit où il l'utilise. Un écran passe de
 * `useState(x)` à `useTabScopedState('cle', x)` et sa position suit l'onglet.
 *
 * ⛔ IL SE DÉGRADE, ET C'EST OBLIGATOIRE. Les mêmes écrans se montent sous le CRM
 * mobile, la console super-admin et les bancs `/dev/*`, où il n'y a pas de
 * fournisseur. Sans repli, `useTabScopedState` y jetterait — un écran qui plante
 * hors onglets serait un prix absurde pour une position d'écran.
 *
 * ⚠ La clé est PRÉFIXÉE par la section de l'onglet : `pager` sur Contacts et
 * `pager` sur Pipeline sont deux choses. Sans préfixe, ouvrir Pipeline dans un
 * onglet qui revenait de Contacts hériterait de sa page.
 */
export function useTabScopedState<T>(
  cle: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const api = useContext(Ctx)
  const location = useLocation()
  const scope = crmSidebarActiveFor(location.pathname) ?? 'x'
  const cleComplete = `${scope}:${cle}`

  // Repli hors fournisseur — et aussi le magasin de première frame pendant que la
  // pile serveur charge (un écran ne doit pas attendre le réseau pour rendre).
  const [local, setLocal] = useState<T>(initial)

  const stocke = api ? api.lireUi(cleComplete) : undefined
  const valeur = (stocke === undefined ? local : stocke) as T

  // ⚠ Il accepte la forme FONCTION (`setPage(p => p + 1)`) autant que la valeur.
  // C'est ce qui en fait un remplaçant de `useState` sans relire l'appelant : sur
  // les six pagers du CRM, la moitié incrémente par fonction. Sans ça, la
  // fonction elle-même serait écrite dans la tranche, et l'onglet rouvrirait sur
  // une closure sérialisée en `null`.
  //
  // ⛔ La valeur courante est LUE DANS LA CLOSURE, pas dans une ref. Une ref
  // affectée au rendu (`ref.current = valeur`) est refusée par la règle
  // `react-hooks` de ce dépôt (« Cannot access refs during render »), et le
  // dépôt a déjà payé ce piège. `poser` change donc d'identité quand la valeur
  // change — c'est sans conséquence : les appelants l'inscrivent dans leurs
  // tableaux de dépendances, et les deux écritures sont idempotentes
  // (`ecrireUi` rend `prev` à valeur égale, `setLocal` fait un bail-out React).
  const poser = useCallback((v: T | ((prev: T) => T)) => {
    const suivant = typeof v === 'function'
      ? (v as (prev: T) => T)(valeur)
      : v
    setLocal(suivant)
    api?.ecrireUi(cleComplete, suivant)
  }, [api, cleComplete, valeur])

  return [valeur, poser]
}

/** Ce qu'une section porte sur sa puce. Absente = pas de badge. */
export type CrmTabBadges = Record<string, { n: number; urgent?: boolean }>

/**
 * Compteurs de badge, par section.
 *
 * ⚠ Les badges ne sont PAS une donnée d'onglet : ils se recalculent depuis la
 * SECTION affichée, donc deux onglets sur la même section portent le même compte.
 * C'est pour ça qu'ils vivent ici et non dans la pile.
 *
 * ⚠ `staleTime` long et `refetchOnMount: false` : la barre se remonte à CHAQUE
 * navigation (elle est rendue par chacune des vingt surfaces). Sans ces deux
 * réglages, visiter cinq écrans coûterait cinq appels pour un chiffre qui bouge
 * à l'heure. Le précédent est écrit dans `useRelanceLeads` — une clé de requête
 * instable y avait produit une boucle de refetch.
 */
export function useCrmTabBadges(): CrmTabBadges {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['crm-tab-badges', user?.id ?? 'anon'],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<CrmTabBadges> => {
      const { data: res, error } = await supabase.rpc('crm_tab_badges')
      // ⛔ `data` déstructuré de son `error` : une lecture en échec doit rendre
      // « pas de badge », jamais un objet vide qu'on prendrait pour « rien à
      // traiter ». Les deux se ressemblent à l'écran, mais l'un est une panne.
      if (error || !res) return {}
      return res as unknown as CrmTabBadges
    },
  })
  return data ?? {}
}

/**
 * Déclare que l'écran porte du travail non enregistré.
 *
 * Fermer son onglet demandera confirmation, et fermer la FENÊTRE aussi. Se
 * dégrade en silence hors fournisseur, comme `useTabScopedState`.
 *
 * ⚠ Le drapeau se lève ET se baisse : appeler le hook avec `false` après un
 * enregistrement est ce qui évite une confirmation sur un formulaire déjà écrit.
 */
export function useTabDirty(sale: boolean): void {
  const api = useContext(Ctx)
  const marquer = api?.marquerSale
  useEffect(() => {
    marquer?.(sale)
    // Au démontage, l'écran ne porte plus rien : laisser le drapeau levé
    // ferait confirmer la fermeture d'un onglet propre.
    return () => marquer?.(false)
  }, [sale, marquer])
}

/**
 * Déclare le libellé de l'onglet actif depuis l'écran qui le connaît.
 *
 * Le serveur sait résoudre un nom depuis un id (`crm_tabs_resolve_labels`), mais
 * il ne sait pas ce qu'un écran a choisi d'afficher en titre. Un écran qui a déjà
 * sa donnée en main donne le libellé exact, tout de suite, sans aller-retour.
 */
export function useTabLabel(label: string | null | undefined): void {
  const api = useContext(Ctx)
  const poser = api?.poserLibelle
  useEffect(() => {
    if (label && poser) poser(label)
  }, [label, poser])
}

export { CRM_TABS_CAP }
