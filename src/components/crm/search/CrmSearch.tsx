// MEGGA CRM Sugar — Recherche immersive (overlay plein écran ⌘/Ctrl+K).
// Port fidèle 1:1 du handoff Claude Design « Barre de recherche immersive Megga »
// (crm-search-immersive.jsx, état « après »). Le seul écart est le retrait du
// vocal (demande explicite ; le proto avait déjà retiré le déclencheur micro).
//
// Câblage prod : window.CRM_CONTACTS/BIENS/DEALS → hooks Supabase réels ;
// window.CRMIcon → SVG inline ; police Manrope (CRM) au lieu d'Inter Tight.

import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useTranslation } from 'react-i18next'
import { crmPalette, CRM_STAGES, crmVoileEncre, type CrmPalette } from '@/components/crm/tokens'
import { useContacts } from '@/hooks/useContacts'
import { useListingsScreen } from '@/hooks/useListingsScreen'
import { usePipelineScreen } from '@/hooks/usePipelineScreen'
import { crmBienById, crmContactById } from '@/components/crm/mockData'
import { formatCHF } from '@/lib/utils'
import { useConversationHistory } from '@/hooks/useConversationHistory'
import { filterConversationsByTitle, type ConversationSummary } from '@/lib/conversation-history'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import { useCrmDark } from '@/lib/crmDark'
import { declarerPaletteEnPlace } from './openSearch'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { crmTabLibelle } from '@/lib/crmTabs'

// ⛔ LES CINQ PASTILLES DE PORTÉE ONT ÉTÉ RETIRÉES (7 septembre 2026, décision
// Julien). Deux raisons, la première mesurée :
//
//  1. « Documents » ne pouvait RIEN rendre — aucune source ne l'alimentait, la
//     pastille ne produisait que « Aucun résultat », quelle que soit la requête.
//     Vérifié à l'écran sur quatre requêtes avant de la retirer.
//  2. Elles demandaient de CHOISIR AVANT DE SAVOIR. Dans un CRM on tape un nom
//     et on veut qu'il soit trouvé ; pré-filtrer est un geste d'expert posé en
//     tête du parcours de tout le monde.
//
// À la place : une seule liste, groupée par nature, quatre par groupe, et une
// ligne « voir les N » qui déplie SUR PLACE. On filtre après avoir vu.


// ─── Icônes inline (stroke linéaire — remplacent window.CRMIcon) ─────────────
function IconSpark({ size = 15, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
    </svg>
  )
}
function IconArrowR({ size = 14, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
function IconSearch({ size = 22, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
    </svg>
  )
}
/** Deux rectangles décalés : la forme d'un onglet — le CONTENANT, pas l'entité. */
function IconOnglet({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="13" height="13" rx="2" /><path d="M8 4h11a2 2 0 0 1 2 2v11" />
    </svg>
  )
}
function IconPipeline({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 10h8M8 14h5" />
    </svg>
  )
}

// ─── Highlight de la correspondance ──────────────────────────────────────────
function Hi({ text, q, sp }: { text: string; q: string; sp: CrmPalette }) {
  if (!q || !text) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'transparent', color: sp.ink, fontWeight: 600, padding: 0 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}

// ─── Vignette placeholder pour un bien (proto) ───────────────────────────────
function BienThumb({ id }: { id: string }) {
  const hue = ((id.charCodeAt(2) || 0) * 7) % 360
  return (
    <div
      style={{
        width: 56, height: 56, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue} 30% 78%), hsl(${(hue + 40) % 360} 25% 65%))`,
        position: 'relative', overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <path d="M10 32 L28 16 L46 32 L46 46 L10 46 Z" fill="white" />
        <rect x="22" y="36" width="12" height="10" fill={`hsl(${hue} 30% 50%)`} />
      </svg>
    </div>
  )
}

function activeRowStyle(active: boolean, dark: boolean): CSSProperties {
  return active
    ? { background: crmVoileEncre(dark, dark ? 0.06 : 0.04) }
    : { background: 'transparent' }
}

const ROW_BASE: CSSProperties = {
  width: '100%', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
  border: 0, borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer', textAlign: 'left',
  fontFamily: 'inherit', transition: 'background .14s ease',
}

// ─── Section title (avec accent + badge sémantique) ──────────────────────────
function Section({ title, count, children, sp, accent, badge }: {
  title: string; count?: number; children: ReactNode; sp: CrmPalette; accent?: string; badge?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          padding: 'var(--crm-space-lg) var(--crm-space-2xl) var(--crm-space-sm)', color: accent || sp.sub,
          fontSize: 'var(--crm-text-sm)', fontWeight: 500,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{title}</span>
        {typeof count === 'number' && (
          <span
            style={{
              background: accent ? accent + '18' : sp.cardSubBg, color: accent || sp.sub,
              padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
        {badge && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', marginLeft: 'auto',
              padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
              background: 'linear-gradient(135deg, rgba(0,65,217,0.10) 0%, rgba(139,92,246,0.10) 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
              fontSize: 'var(--crm-text-xs)', fontWeight: 500,
              color: accent || sp.sub,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
            </svg>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Temps relatif localisé (il y a 2 h / 2 hours ago) ───────────────────────
function relTime(iso: string, lang: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang || 'fr', { numeric: 'auto' })
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return rtf.format(-h, 'hour')
  return rtf.format(-Math.round(h / 24), 'day')
}

// ─── Ligne de conversation copilote (titre + temps relatif) ──────────────────
function MeggaConvoRow({ convo, q, sp, dark, lang, active, onHover, onSelect }: {
  convo: ConversationSummary; q: string; sp: CrmPalette; dark: boolean; lang: string
  active: boolean; onHover: () => void; onSelect: () => void
}) {
  return (
    <button onMouseEnter={onHover} onClick={onSelect} style={{ ...ROW_BASE, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', gap: 'var(--crm-space-2xl)', color: sp.ink, ...activeRowStyle(active, dark) }}>
      <div style={{ width: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <IconSpark stroke={active ? sp.ink : sp.sub} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Hi text={convo.title} q={q} sp={sp} />
        </div>
      </div>
      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 500, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {relTime(convo.lastMessageAt, lang)}
      </span>
    </button>
  )
}

// ─── Item plat pour la navigation clavier ─────────────────────────────────────
type FlatItem =
  | { kind: 'megga-convo'; id: string }
  | { kind: 'ai' }
  | { kind: 'ai-query' }
  | { kind: 'contact'; id: string }
  | { kind: 'bien'; id: string }
  | { kind: 'deal'; id: string }
  | { kind: 'admin' }
  /** Un onglet DÉJÀ ouvert : on y bascule au lieu d'en ouvrir une copie. */
  | { kind: 'onglet'; id: string }
  /** Un onglet récemment FERMÉ : on le rouvre. */
  | { kind: 'ferme'; id: string }
  /** « voir les N » — déplie son groupe SUR PLACE, sans quitter la liste. */
  | { kind: 'plus'; cle: string }

// Raccourci super-admin : la console n'apparaît QUE sur une requête explicite
// (et QUE pour un super-admin confirmé par la DB). Aucune trace le reste du
// temps — la recherche reste le port 1:1 du handoff pour tout le monde.
/** Un bloc de résultats : son titre, son compte réel, et ce qu'il montre. */
interface Groupe {
  cle: string
  titre: string
  /** Le compte RÉEL, avant plafond — c'est lui qu'affiche le titre. */
  total: number
  items: FlatItem[]
}

const ADMIN_KEYWORDS = ['admin', 'console', 'plateforme', 'platform']

/**
 * Combien d'entrées un groupe montre avant de proposer le reste.
 *
 * Quatre : c'est ce qui tient sous le pli avec trois groupes remplis, et c'est
 * assez pour que la bonne réponse soit visible sans dérouler dans la grande
 * majorité des cas. Au-delà, « voir les N » déplie le groupe sur place — le
 * geste remplace les anciennes pastilles de portée, mais APRÈS avoir vu ce qu'il
 * y a, pas avant.
 */
const PAR_GROUPE = 4
const PAR_GROUPE_DEPLIE = 20

/**
 * Le nom de la touche de commande, selon le clavier qu'on a sous les mains.
 *
 * ⚠ Lu UNE FOIS au chargement du module : la plateforme ne change pas en cours
 * de session, et le recalculer à chaque rendu ferait dépendre un affichage d'un
 * `navigator` qui n'existe pas partout.
 */
const TOUCHE_COMMANDE = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  ? '⌘'
  : 'Ctrl'

interface Props {
  open: boolean
  onClose: () => void
  /**
   * Texte déjà tapé par l'appelant, repris dans le champ à l'ouverture.
   *
   * Sert le relais du nouvel onglet (`openCrmSearch(q)`) : la frappe qui a
   * DÉCLENCHÉ l'ouverture doit s'y retrouver, sinon l'agent la retape. Lu une
   * seule fois, à l'initialisation de l'état — c'est suffisant parce que
   * `CrmSearchHost` démonte ce composant à chaque fermeture.
   */
  amorce?: string
  /**
   * `overlay` (défaut) : le ⌘K historique, panneau flottant sur un voile.
   * `inline` : rendu DANS la page, sans voile ni panneau — voir `corps`.
   */
  variante?: 'overlay' | 'inline'
  /** Prévient la page de ce qui est tapé, pour qu'elle sache quoi montrer autour. */
  onQueryChange?: (q: string) => void
}

export default function CrmSearch({ open, onClose, amorce, variante = 'overlay', onQueryChange }: Props) {
  const navigate = useNavigate()
  const ai = useAiPanel()
  // Collision : la variable `t` ci-dessous = tokens de thème. Le traducteur = `tr`.
  const { t: tr, i18n } = useTranslation('common')

  // Thème : le magasin partagé — il suit une bascule faite pendant que la palette
  // est ouverte (en place, dans la page d'onglet neuf, elle reste montée longtemps).
  const dark = useCrmDark()
  const sp = crmPalette(dark)
  const accentBlue = dark ? '#A5C0FF' : '#0041D9'

  const [q, setQ] = useState(amorce ?? '')
  /** Les groupes dépliés — remis à zéro dès que la requête change. */
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(new Set())
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce de la requête pour la recherche contacts (server-side).
  const [debouncedQ, setDebouncedQ] = useState(amorce ?? '')
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 200)
    return () => window.clearTimeout(id)
  }, [q])

  // ── Données réelles ──
  const { contacts } = useContacts(debouncedQ.trim().length >= 2 ? { search: debouncedQ.trim() } : undefined)
  const { biens } = useListingsScreen()
  const { deals } = usePipelineScreen()
  // Conversations copilote persistées (chantier B). Vide tant que le writer n'est
  // pas activé (flag OFF) → les sections ci-dessous ne s'affichent simplement pas.
  const { data: conversations } = useConversationHistory(30)
  const convList = useMemo(() => conversations ?? [], [conversations])
  const { allowed: isSuperAdmin } = useSuperAdminGate()
  const tabsApi = useCrmTabsOptionnel()
  const fermes = useMemo(() => tabsApi?.fermes ?? [], [tabsApi])


  const ecranActif = useEcranActif()
  const enPlace = variante === 'inline'
  const ql = q.trim().toLowerCase()

  /**
   * Les onglets DÉJÀ ouverts qui répondent à la requête.
   *
   * ⛔ POURQUOI ILS PASSENT DEVANT TOUT LE RESTE. Sans eux, taper le nom d'un
   * client sur une pile de vingt onglets propose « ouvrir sa fiche » — et en
   * ouvre une SECONDE, à côté de celle qu'on avait déjà. C'est ce que l'omnibox
   * d'un navigateur évite depuis toujours avec son « passer à cet onglet ».
   *
   * ⚠ L'ACTIF est exclu : y « basculer » ne fait rien, et proposer un geste sans
   * effet en tête de liste est pire que ne rien proposer.
   *
   * ⚠ Seulement en portée « Tout ». Les autres portées nomment des ENTITÉS
   * (contacts, biens, affaires) ; un onglet n'en est pas une, et le glisser dans
   * « Contacts » ferait mentir le filtre.
   *
   * ⚠ `null` hors fournisseur d'onglets — mobile, console, bancs. La palette y
   * fonctionne comme avant.
   */
  const ongletResults = useMemo(() => {
    // ⚠ Sans requête, ils forment l'état VIDE : « ce qu'on vient de quitter ».
    if (!tabsApi) return []
    return tabsApi.tabs
      .map((t, i) => ({ t, i }))
      // ⚠ Sur le libellé AFFICHÉ, pas sur `label` : un onglet de SECTION n'a pas
      // de `label` du tout — son nom vient d'une clé i18n. Filtrer sur le champ
      // brut ne trouvait donc jamais « Calendrier » ni « Pipeline ».
      .map((x) => ({ ...x, nom: crmTabLibelle(x.t, tr) }))
      .filter(({ i, nom }) => i !== tabsApi.active && (!ql || nom.toLowerCase().includes(ql)))
  }, [tabsApi, ql, tr])

  // ⚠ Deux caractères : la recherche de contacts part au SERVEUR, et une lettre
  // ramènerait le carnet entier.
  const contactResults = useMemo(() => (ql.length < 2 ? [] : contacts), [contacts, ql])

  const bienResults = useMemo(() => {
    if (!ql) return []
    return biens.filter(b => `${b.title} ${b.ref} ${b.addr} ${b.canton} ${b.type}`.toLowerCase().includes(ql))
  }, [biens, ql])

  const dealResults = useMemo(() => {
    if (!ql) return []
    const withLabel = deals.map(d => {
      const bien = d.bienId ? crmBienById(d.bienId) : undefined
      const contact = crmContactById(d.contactId)
      const title = bien?.title || (contact ? `${contact.firstName} ${contact.lastName}` : tr('search.command.deal.untitled'))
      const stageLabel = CRM_STAGES[d.stage]?.label ?? d.stage
      return { id: d.id, title, stageLabel }
    })
    return withLabel.filter(d => `${d.title} ${d.stageLabel}`.toLowerCase().includes(ql))
  }, [deals, ql, tr])

  // ⚠ L'état vide ne montre PLUS les conversations du copilote : il montre ce
  // qu'on vient de quitter (onglets ouverts et récemment fermés). Sur requête,
  // elles restent un groupe de résultats comme un autre.
  const meggaResults = useMemo(() => filterConversationsByTitle(convList, q, 5), [convList, q])

  const showEmpty = !q.trim()
  const showAdmin = isSuperAdmin && ql.length >= 2 && ADMIN_KEYWORDS.some(k => k.startsWith(ql))
  const adminCount = showAdmin ? 1 : 0
  const totalResults = ongletResults.length + adminCount + meggaResults.length + contactResults.length + bienResults.length + dealResults.length

  /**
   * LES GROUPES — le modèle unique dont découlent l'affichage ET le clavier.
   *
   * ⛔ IL REMPLACE UNE ARITHMÉTIQUE D'INDEX TENUE À LA MAIN. Chaque section
   * calculait son décalage en additionnant les longueurs des précédentes
   * (`offConvos = adminCount`, `offContacts = adminCount + meggaResults.length`,
   * …). Six lignes à garder d'accord avec l'ordre du rendu, et un groupe inséré
   * décalait tout ce qui suivait sans qu'aucune porte ne le voie : la flèche du
   * bas visait alors une ligne, et Entrée en ouvrait une autre. Ici l'ordre du
   * rendu EST l'ordre de la liste plate, parce que c'est la même donnée.
   *
   * ⚠ L'ORDRE DES GROUPES N'EST PAS ESTHÉTIQUE. Les onglets ouverts passent
   * devant tout : aller là où c'est déjà ouvert précède en ouvrir une copie. La
   * console admin suit, parce qu'elle ne paraît que sur un mot-clé explicite —
   * c'est une correspondance exacte, pas une suggestion.
   */
  const groupes = useMemo<Groupe[]>(() => {
    const out: Groupe[] = []
    const pousser = (cle: string, titre: string, tous: FlatItem[]) => {
      if (!tous.length) return
      const plafond = deplies.has(cle) ? PAR_GROUPE_DEPLIE : PAR_GROUPE
      const items = tous.slice(0, plafond)
      const reste = tous.length - items.length
      if (reste > 0) items.push({ kind: 'plus', cle })
      out.push({ cle, titre, total: tous.length, items })
    }

    if (showEmpty) {
      // L'état vide, c'est CE QU'ON VIENT DE QUITTER — pas des suggestions.
      pousser('onglets', tr('search.command.section.openTabs'),
        ongletResults.map(({ t }) => ({ kind: 'onglet', id: t.id } as FlatItem)))
      pousser('fermes', tr('search.command.section.closedTabs'),
        fermes.map((t) => ({ kind: 'ferme', id: t.id } as FlatItem)))
      return out
    }

    pousser('onglets', tr('search.command.section.openTabs'),
      ongletResults.map(({ t }) => ({ kind: 'onglet', id: t.id } as FlatItem)))
    if (showAdmin) pousser('admin', tr('search.command.section.platform'), [{ kind: 'admin' }])
    pousser('contacts', tr('nav.contacts'),
      contactResults.map((c) => ({ kind: 'contact', id: c.id } as FlatItem)))
    pousser('biens', tr('search.command.section.biens'),
      bienResults.map((b) => ({ kind: 'bien', id: b.id } as FlatItem)))
    pousser('deals', tr('search.command.section.deals'),
      dealResults.map((d) => ({ kind: 'deal', id: d.id } as FlatItem)))
    pousser('convos', tr('search.command.section.resumeMegga'),
      meggaResults.map((c) => ({ kind: 'megga-convo', id: c.id } as FlatItem)))
    out.push({ cle: 'ai', titre: '', total: 1, items: [{ kind: 'ai-query' }] })
    return out
  }, [showEmpty, showAdmin, deplies, tr, ongletResults, fermes, contactResults, bienResults, dealResults, meggaResults])

  /** La liste plate — DÉRIVÉE des groupes, jamais tenue en parallèle. */
  const flatItems = useMemo<FlatItem[]>(() => groupes.flatMap((g) => g.items), [groupes])

  /**
   * ⛔ LA PAGE « Julien » A ÉTÉ SUPPRIMÉE (17 août 2026) : ces deux gestes
   * ouvrent désormais le DOCK MEGGA AI, seule surface du copilote.
   *
   * ⚠ Ils restent DEUX, et les fondre serait perdre la distinction : `goMegga`
   * ouvre un fil NEUF, `resumeConversation` rouvre un fil ÉCRIT — bulles et
   * historique du copilote réamorcés, pour que la suite s'écrive dans la même
   * conversation côté serveur.
   */
  const goMegga = useCallback(() => {
    onClose()
    ai.open()
  }, [ai, onClose])

  const resumeConversation = useCallback((id: string) => {
    onClose()
    ai.openConversation(id)
  }, [ai, onClose])

  /** L'emplacement visé par un résultat, quand il en a un. */
  const hrefDe = useCallback((item: FlatItem): string | null => {
    switch (item.kind) {
      case 'contact': return `/dashboard/contacts/${item.id}`
      case 'bien': return `/dashboard/listings/${item.id}`
      case 'deal': return `/dashboard/transactions/${item.id}`
      case 'admin': return ADMIN_CONSOLE_PATH
      default: return null
    }
  }, [])

  /**
   * LA porte d'activation — clavier et souris passent par elle.
   *
   * `nouvelOnglet` (⌘/Ctrl + Entrée, ⌘/Ctrl + clic) ouvre le résultat À CÔTÉ au
   * lieu de remplacer l'écran courant. C'est le geste du navigateur, et il ne
   * demandait rien de neuf : `ouvrirDans` existe depuis la barre d'onglets.
   *
   * ⚠ Sans fournisseur d'onglets (mobile, console, bancs), il retombe sur la
   * navigation ordinaire — mieux vaut ouvrir au même endroit que ne rien faire.
   */
  const activer = useCallback((item: FlatItem | undefined, nouvelOnglet = false) => {
    if (!item) return
    if (item.kind === 'plus') {
      // ⚠ Déplier ne QUITTE pas la liste : on reste au même endroit, avec plus à
      // voir. C'est ce qui remplace le choix de portée d'avant.
      setDeplies((p) => new Set(p).add(item.cle))
      return
    }
    if (item.kind === 'ferme') { tabsApi?.rouvrirFerme(item.id); return }
    if (item.kind === 'onglet') {
      const i = tabsApi?.tabs.findIndex((t) => t.id === item.id) ?? -1
      if (i >= 0) { onClose(); tabsApi?.selectionner(i) }
      return
    }
    if (item.kind === 'megga-convo') { resumeConversation(item.id); return }
    if (item.kind === 'ai' || item.kind === 'ai-query') { goMegga(); return }
    const href = hrefDe(item)
    if (!href) return
    onClose()
    if (nouvelOnglet && tabsApi) tabsApi.ouvrirDans(href)
    else navigate(href)
  }, [goMegga, resumeConversation, navigate, onClose, hrefDe, tabsApi, setDeplies])

  /**
   * Déclare la palette en place, et reprend le focus sur `⌘K`.
   *
   * ⚠ Le raccourci reste GLOBAL : le host ne l'ouvre simplement pas quand une
   * palette est déjà dans la page (`paletteEnPlaceMontee`). Ici on lui donne sa
   * destination — le champ, sélectionné, prêt à être remplacé.
   */
  useEffect(() => {
    // ⛔ ET SEULEMENT SI SON ÉCRAN EST CELUI QU'ON REGARDE. Mesuré le 7 septembre
    // 2026 : l'écran « nouvel onglet » reste VIVANT en arrière-plan (jusqu'à six
    // écrans le sont), donc sa palette restait déclarée — et `⌘K` ne faisait plus rien
    // nulle part, puisque le host croyait qu'un champ était déjà à l'écran. Un
    // raccourci confisqué par un écran qu'on ne voit pas est pire qu'absent : il
    // n'a aucun symptôme lisible.
    if (variante !== 'inline' || !ecranActif) return
    const retirer = declarerPaletteEnPlace()
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); retirer() }
  }, [variante, ecranActif])

  // Focus auto à l'ouverture.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [])

  // Raccourcis clavier (⌘K géré par le host).
  useEffect(() => {
    // ⛔ UNE PALETTE DANS UN ÉCRAN CACHÉ N'ÉCOUTE PAS LE CLAVIER — et son voisin ⌘K
    // le faisait déjà, pas celui-ci. Une page « Nouvel onglet » restée vivante
    // derrière l'écran montré avalait Entrée, ↑, ↓ et Échap dans TOUTE l'app :
    // reproduit le 12 septembre 2026, Entrée dans un champ de texte n'insérait plus
    // de retour à la ligne et faisait basculer l'onglet visible. Le parcours normal
    // de ⌘K (onglet neuf, recherche, Entrée sur un onglet ouvert) laissait
    // précisément une telle page derrière lui.
    if (!open || !ecranActif) return
    const onKey = (e: KeyboardEvent) => {
      // ⚠ En place, Échap EFFACE : il n'y a pas de voile à fermer, et fermer la
      // page d'accueil d'un onglet neuf n'aurait aucun sens.
      if (e.key === 'Escape') {
        e.preventDefault()
        if (variante === 'inline') { setQ(''); setActiveIdx(0); onQueryChange?.('') }
        else onClose()
      }
      // ⚠ `Tab` ne fait plus tourner les portées : il n'y en a plus. Il est rendu
      // au navigateur, qui sait déjà quoi en faire.
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(flatItems.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); activer(flatItems[activeIdx], e.metaKey || e.ctrlKey) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, ecranActif, flatItems, activeIdx, onClose, activer, variante, onQueryChange])

  useEffect(() => {
    if (activeIdx >= flatItems.length) setActiveIdx(Math.max(0, flatItems.length - 1))
  }, [flatItems.length, activeIdx])

  if (!open) return null

  // Couleurs adaptées light / dark (§7 — neutralisé, zéro bleu sur la chrome).
  // Voile de fond : en SOMBRE c'est le canvas MEGGA X voilé, en CLAIR un gris
  // pâle assumé — ce n'est pas une encre, donc pas `crmVoileEncre`.
  const overlayColor = dark ? `rgba(3,3,3,0.55)` : 'rgba(238,240,242,0.55)'
  const panelBg = dark ? 'rgba(24,25,28,0.80)' : 'rgba(255,255,255,0.78)'
  const panelBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'
  const panelShadow = dark
    ? '0 30px 80px -20px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset'
    : '0 30px 80px -20px rgba(30,32,38,0.30), 0 1px 0 rgba(255,255,255,0.6) inset'

  // Offsets de la liste plate (ordre des sections rendues).
  // (Les décalages n'existent plus : l'index d'une ligne est son rang dans `flatItems`.)

  /**
   * Le CORPS de la palette — champ, portées, résultats, pied.
   *
   * ⛔ IL EST EXTRAIT PARCE QU'IL A DEUX ENVELOPPES, et une seule
   * implémentation. En `overlay` il vit dans un panneau flottant au-dessus d'un
   * voile ; en `inline` il se rend DANS la page, sans voile, sans panneau, sans
   * animation d'entrée. Retour de Julien, 7 septembre 2026 : « quand je tape,
   * j'ai un pop-up — il faudrait construire complètement dedans ». Il a raison,
   * et c'est la même objection que pour le 404 : ce qui sort du cadre fait
   * perdre le contexte.
   *
   * ⚠ Écrire un second moteur pour la page aurait donné DEUX recherches à tenir
   * d'accord — c'est précisément ce que le relais vers ⌘K évitait. Deux
   * enveloppes autour d'un corps unique le tient encore.
   */
  /**
   * UNE ligne, pour tous les types de résultat.
   *
   * ⛔ IL Y EN AVAIT SIX, chacune recopiant l'état actif, son décalage d'index et
   * son `onMouseEnter`. C'est dans ces copies que les rangs divergeaient — et un
   * rang faux ne se voit pas : la flèche du bas surligne une ligne, Entrée en
   * ouvre une autre. Ici le rang vient du rendu lui-même, il ne peut plus mentir.
   *
   * ⚠ Chaque type garde son ALLURE (l'avatar d'un contact, la vignette d'un bien,
   * le prix aligné à droite) : unifier la mécanique n'est pas uniformiser ce
   * qu'on regarde. Un bien qui ressemblerait à un contact serait plus lisible à
   * écrire et moins à lire.
   *
   * ⛔ ELLE REND DU JSX, ELLE N'EST PAS UN COMPOSANT — et la nuance n'est pas
   * théorique. Écrite `<Ligne …/>`, elle était un TYPE créé à chaque rendu :
   * React voyait un type neuf à chaque frappe et REMONTAIT toutes les lignes,
   * une par caractère tapé. `react-hooks/static-components` l'a signalé en
   * ERREUR, et il avait raison. Appelée `ligne(item, rang)`, elle s'inline dans
   * le rendu du parent et rien ne se remonte.
   */
  const ligne = (item: FlatItem, idx: number) => {
    const actif = activeIdx === idx
    const commun = {
      onMouseEnter: () => setActiveIdx(idx),
      style: { ...ROW_BASE, color: sp.ink, ...activeRowStyle(actif, dark) } as CSSProperties,
    }
    const fleche = <IconArrowR stroke={actif ? accentBlue : sp.sub} />
    const vignette = (contenu: ReactNode, rond = false) => (
      <div style={{
        width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center',
        borderRadius: rond ? 'var(--crm-radius-pill)' : 'var(--crm-radius-lg)',
        background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
      }}>{contenu}</div>
    )
    const titre = (texte: string) => (
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Hi text={texte} q={q} sp={sp} />
      </div>
    )
    const sousTitre = (texte: ReactNode) => (
      <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, marginTop: 'var(--crm-space-2xs)' }}>{texte}</div>
    )

    switch (item.kind) {
      case 'plus': {
        const groupe = groupes.find((g) => g.cle === item.cle)
        const reste = (groupe?.total ?? 0) - PAR_GROUPE
        return (
          <button {...commun} onClick={() => activer(item)} style={{ ...commun.style, color: sp.sub }}>
            <div style={{ width: 38, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: actif ? sp.ink : sp.sub }}>
              {tr('search.command.showAll', { count: reste })}
            </div>
          </button>
        )
      }
      case 'onglet': {
        const trouve = ongletResults.find(({ t }) => t.id === item.id)
        if (!trouve) return null
        return (
          <button {...commun} onClick={() => activer(item)}>
            {vignette(<IconOnglet stroke={sp.ink} />)}
            <div style={{ flex: 1, minWidth: 0 }}>
              {titre(trouve.nom)}
              {sousTitre(tr('search.command.switchToTab', { rang: trouve.i + 1 }))}
            </div>
            {fleche}
          </button>
        )
      }
      case 'ferme': {
        const tb = fermes.find((t) => t.id === item.id)
        if (!tb) return null
        return (
          <button {...commun} onClick={() => activer(item)}>
            {vignette(<IconOnglet stroke={sp.sub} />)}
            <div style={{ flex: 1, minWidth: 0 }}>
              {titre(crmTabLibelle(tb, tr))}
              {sousTitre(tr('search.command.reopenTab'))}
            </div>
            {fleche}
          </button>
        )
      }
      case 'contact': {
        const c = contactResults.find((x) => x.id === item.id)
        if (!c) return null
        const score = c.ai_seriousness_score
        const initiales = `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
        return (
          <button {...commun} onClick={(e) => activer(item, e.metaKey || e.ctrlKey)}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: '#0041D9', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>
              {initiales}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>{titre(`${c.first_name} ${c.last_name}`)}</div>
            {typeof score === 'number' && (
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: score >= 80 ? '#0E9F6E' : score >= 60 ? '#0041D9' : sp.sub, padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}` }}>
                {score}
              </div>
            )}
            {fleche}
          </button>
        )
      }
      case 'bien': {
        const b = bienResults.find((x) => x.id === item.id)
        if (!b) return null
        const prix = b.transaction === 'location' ? b.rent ?? b.price : b.price
        return (
          <button {...commun} onClick={(e) => activer(item, e.metaKey || e.ctrlKey)}>
            <BienThumb id={b.id} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {titre(b.title)}
              {sousTitre(
                <span style={{ display: 'flex', gap: 'var(--crm-space-md)', alignItems: 'center' }}>
                  <span>{b.addr || b.canton || '—'}</span>
                  {b.rooms ? <span>{tr('search.command.roomsShort', { count: b.rooms })}</span> : null}
                  {b.area ? <span>· {b.area} m²</span> : null}
                </span>,
              )}
            </div>
            {prix ? (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCHF(prix)}{b.transaction === 'location' ? tr('search.perMonth') : ''}
                </div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 500 }}>{b.transaction}</div>
              </div>
            ) : null}
          </button>
        )
      }
      case 'deal': {
        const d = dealResults.find((x) => x.id === item.id)
        if (!d) return null
        return (
          <button {...commun} onClick={(e) => activer(item, e.metaKey || e.ctrlKey)}>
            {vignette(<IconPipeline stroke={sp.ink} />)}
            <div style={{ flex: 1, minWidth: 0 }}>
              {titre(d.title)}
              {sousTitre(d.stageLabel)}
            </div>
            {fleche}
          </button>
        )
      }
      case 'megga-convo': {
        const c = meggaResults.find((x) => x.id === item.id)
        if (!c) return null
        return (
          <MeggaConvoRow
            convo={c} q={q} sp={sp} dark={dark} lang={i18n.language}
            active={actif}
            onHover={() => setActiveIdx(idx)}
            onSelect={() => activer(item)}
          />
        )
      }
      case 'admin':
        return (
          <button {...commun} onClick={(e) => activer(item, e.metaKey || e.ctrlKey)}>
            {vignette(
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={sp.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" />
                <path d="M7 7.5h.01M7 16.5h.01" />
              </svg>,
            )}
            <div style={{ flex: 1, minWidth: 0 }}>{titre(tr('profile.adminConsole'))}</div>
            {fleche}
          </button>
        )
      default:
        // `ai` / `ai-query` — la porte vers le copilote. Une ACTION, pas un
        // résultat : glyphe à l'accent sans tuile, graisse 500, ligne basse.
        return (
          <button {...commun} onClick={() => activer(item)} style={{ ...commun.style, padding: 'var(--crm-space-md) var(--crm-space-2xl)' }}>
            {/* ⚠ UNE TUILE, ET PAS UN GLYPHE NU. Premier jet : une étoile de 16 px
                sans fond — retour de Julien, « l'étoile est toute petite, c'est
                vraiment un tout petit truc ». En retirant le dégradé j'avais
                retiré la présence avec lui : la ligne n'avait plus d'ancre à
                gauche et se lisait comme une note de bas de page.
                32 px et non 38 : elle garde de l'aplomb sans se ranger au même
                rang que les avatars des résultats — c'est une action, pas une
                entité. Aplat d'accent + encre d'accent : l'idiome MEGGA X, et la
                couleur que porte le dock MEGGA AI (`sp.accent`, onze fois). */}
            <span style={{
              width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center',
              borderRadius: 'var(--crm-radius-md)', background: sp.accent,
            }}>
              <IconSpark size={17} stroke={sp.accentInk} />
            </span>
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tr('search.command.askMeggaQuery', { query: q })}
            </div>
            {fleche}
          </button>
        )
    }
  }

  const corps = (
    <>
        {/* Le champ.
            ⚠ DEUX HABILLAGES, un seul `<input>`. Flottant, il est nu et énorme
            (24 px) : le panneau lui sert de cadre. En place, il porte le cadre
            lui-même — pilule, filet, ombre, glyphe de loupe — parce qu'il n'a
            plus de panneau autour et qu'un champ sans limite visible ne se
            distingue pas du texte de la page. Sa taille redescend à 15 px, celle
            du CRM ; 24 px au milieu d'une page en ferait une bannière. */}
        <div style={enPlace ? {
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
          background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
          borderRadius: 'var(--crm-radius-pill)', boxShadow: sp.shadow,
          padding: '0 var(--crm-space-6xl)', height: 52,
        } : { padding: '26px 28px 18px', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          {enPlace && (
            <span style={{ display: 'flex', color: sp.sub, flexShrink: 0 }}>
              <IconSearch size={18} stroke={sp.sub} />
            </span>
          )}
          <input
            ref={inputRef}
            className="crmSearchField"
            value={q}
            onChange={e => { setQ(e.target.value); setActiveIdx(0); setDeplies(new Set()); onQueryChange?.(e.target.value) }}
            placeholder={tr('search.command.placeholder')}
            autoFocus
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
              color: sp.ink,
              fontSize: enPlace ? 'var(--crm-text-xl)' : 'var(--crm-text-5xl)',
              fontWeight: enPlace ? 400 : 500,
              fontFamily: 'inherit',
              letterSpacing: enPlace ? undefined : -0.5,
              caretColor: sp.ink,
              ['--ph-color' as string]: sp.sub,
            }}
          />
          {enPlace && !q && (
            /* ⚠ L'indice du raccourci, là où le geste se pose. Il s'efface dès
               qu'on tape : à ce moment-là il ne dit plus rien d'utile et vole la
               place du bouton « effacer ». */
            <kbd aria-hidden style={{
              flexShrink: 0, fontFamily: 'inherit',
              fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.soft,
              background: sp.kbdBg, border: `1px solid ${sp.cardBorder}`,
              borderRadius: 'var(--crm-radius-xs)',
              padding: '0 var(--crm-space-sm)', lineHeight: '18px',
            }}>{`${TOUCHE_COMMANDE}K`}</kbd>
          )}
          {q && (
            <button
              onClick={() => { setQ(''); setActiveIdx(0); onQueryChange?.(''); inputRef.current?.focus() }}
              onMouseEnter={e => (e.currentTarget.style.color = sp.ink)}
              onMouseLeave={e => (e.currentTarget.style.color = sp.sub)}
              title={tr('search.clearSearch')}
              style={{
                flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer',
                color: sp.sub, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                letterSpacing: -0.1, padding: 'var(--crm-space-xs) var(--crm-space-2xs)', transition: 'color .15s ease',
              }}
            >
              {tr('search.command.clear')}
            </button>
          )}
        </div>

        {/* Corps.
            ⚠ En place, ni défilement propre ni gouttière horizontale : la page
            possède déjà sa colonne et son ascenseur. Lui en donner un second
            ferait défiler les résultats DANS un cadre au milieu d'une page qui
            défile elle-même. */}
        {(!enPlace || !showEmpty) && (
        <div style={enPlace
          // ⚠ La même respiration qu'entre le champ et les destinations : sur une
          // page, les résultats ne doivent pas non plus toucher le champ.
          ? { padding: 'calc(var(--crm-space-7xl) * 2) 0 var(--crm-space-sm)' }
          : { flex: 1, overflowY: 'auto', padding: 'var(--crm-space-lg) var(--crm-space-xl) var(--crm-space-sm)', scrollbarWidth: 'thin' }}>

          {/* ── Rien à montrer ── */}
          {!showEmpty && totalResults === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: sp.sub }}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-2xl)', margin: '0 auto 14px', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`, display: 'grid', placeItems: 'center' }}>
                <IconSearch stroke={sp.sub} />
              </div>
              {/* ⚠ Le titre SEUL. La seconde ligne — « Demandez plutôt à Megga, il
                  connaît tout votre CRM » — a été retirée le 7 septembre 2026
                  (Julien). Elle poussait vers le copilote au moment précis où
                  l'agent constate un échec, et la porte vers Megga est déjà là,
                  juste en dessous, comme dernière ligne de la liste. Le dire deux
                  fois n'aide pas : ça remplit un vide par de l'insistance. */}
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{tr('search.command.empty.title', { query: q })}</div>
            </div>
          )}

          {/* ── L'état vide sans rien à reprendre ── */}
          {showEmpty && !flatItems.length && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: sp.sub, fontSize: 'var(--crm-text-lg)' }}>
              {tr('search.command.startTyping')}
            </div>
          )}

          {/* ── Les groupes ──────────────────────────────────────────────────
              ⚠ UN SEUL rendu pour tous. Il y en avait six, chacun avec sa copie
              de la ligne active, de son décalage et de son `onMouseEnter` — et
              c'est dans ces copies que les index divergeaient. Le rang d'une
              ligne est ici son rang dans `flatItems`, compté au fil du rendu :
              il ne PEUT plus être faux. */}
          {/* ⚠ Le groupe `ai` est RETIRÉ d'ici : il n'est pas un résultat, c'est
              une action de repli, et il se rend dans le pied (voir plus bas). Il
              reste dernier dans `flatItems`, donc son rang est connu sans compter. */}
          {(() => {
            let rang = -1
            return groupes.filter((g) => g.cle !== 'ai').map((groupe) => (
              <Section
                key={groupe.cle}
                title={groupe.titre}
                count={groupe.total}
                sp={sp}
              >
                {groupe.items.map((item) => {
                  rang += 1
                  const r = rang
                  return <Fragment key={`${groupe.cle}-${r}`}>{ligne(item, r)}</Fragment>
                })}
              </Section>
            ))
          })()}
        </div>
        )}

        {/* ── LE PIED — ce qu'on peut faire d'AUTRE ─────────────────────────
            ⛔ LA LIGNE « DEMANDER À MEGGA » ÉTAIT RENDUE COMME UN RÉSULTAT, et
            elle n'en est pas un : c'est une ACTION de repli, celle qui reste
            quand la liste ne suffit pas. Rendue au milieu des contacts, elle se
            lisait comme un contact de plus — même hauteur, même tuile de 38 px,
            même graisse de titre.

            ⛔ ET SA TUILE PORTAIT UN DÉGRADÉ BLEU→VIOLET qui n'existe NULLE PART
            ailleurs dans `src/` — mesuré : une seule occurrence, celle-ci. Ce
            n'est pas l'identité de MEGGA AI : le dock, lui, porte `sp.accent`
            onze fois et aucun dégradé. C'était un reliquat du proto, et il
            faisait de la ligne la chose la plus colorée de la palette — donc la
            plus importante, ce qu'elle n'est pas.

            Elle descend dans le pied, sous UN filet : le filet dit « autre
            registre », là où un écart de 34 px ne disait que « loin ».

            ⚠ L'INDICE CLAVIER « ⌘↵ Ouvrir dans un nouvel onglet » A ÉTÉ RETIRÉ
            (Julien, 7 septembre 2026 : « c'est inutile »). Je l'avais posé pour
            rendre le geste découvrable, et c'est le coût assumé de son retrait :
            ⌘/Ctrl + Entrée et ⌘/Ctrl + clic FONCTIONNENT toujours, mais plus rien
            ne les annonce. Ne pas les croire disparus en relisant l'écran. */}
        {!showEmpty && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${sp.cardBorder}`, padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
            {ligne({ kind: 'ai-query' }, flatItems.length - 1)}
          </div>
        )}
    </>
  )

  // ── Variante EN PLACE : dans la page, sans rien qui flotte ──────────────────
  if (variante === 'inline') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
        fontFamily: 'var(--crm-font)',
      }}>
        <style>{`.crmSearchField::placeholder { color: var(--ph-color); opacity: 1; }`}</style>
        {corps}
      </div>
    )
  }

  // ── Variante FLOTTANTE : le ⌘K historique ──────────────────────────────────
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: overlayColor,
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        display: 'grid', placeItems: 'start center', paddingTop: '11vh',
        fontFamily: 'var(--crm-font)',
      }}
    >
      <style>{`
        @keyframes crmSearchIn {
          from { transform: translateY(-12px) scale(.97); opacity: 0; }
          to   { transform: translateY(0)     scale(1);   opacity: 1; }
        }
        @keyframes crmSearchHaloPulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%      { opacity: .55; transform: scale(1.03); }
        }
        .crmSearchField::placeholder { color: var(--ph-color); opacity: 1; }
      `}</style>

      {/* Halo neutre (zéro bleu) */}
      <div
        style={{
          position: 'absolute', top: '8vh', width: 720, height: 360,
          background: dark
            ? 'radial-gradient(closest-side, rgba(255,255,255,0.05), transparent 70%)'
            : 'radial-gradient(closest-side, rgba(255,255,255,0.55), transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
          animation: 'crmSearchHaloPulse 4s ease-in-out infinite',
        }}
      />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '92vw', maxHeight: '78vh',
          background: panelBg,
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: `1px solid ${panelBorder}`,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: panelShadow,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'crmSearchIn 280ms cubic-bezier(.2,.9,.25,1.1)',
        }}
      >
        {corps}
      </div>
    </div>
  )
}
