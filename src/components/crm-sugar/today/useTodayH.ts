// MEGGA CRM — Today V2 « concept H » · LOT 0 · hydratation des blocs qui ont
// déjà une source Supabase. AUCUNE table nouvelle, AUCUNE RPC nouvelle.
// ----------------------------------------------------------------------------
// Décision d'architecture (validée le 3 août 2026) : PAS de `today_payload`
// monolithique. Le dépôt a déjà des RPC gatées, cappées et testées ; un agrégat
// unique les dupliquerait, concentrerait la page sur une requête lourde (cf.
// CLAUDE.md §7, statement timeout) et ferait tomber tout l'écran si un seul bloc
// échoue. On compose donc bloc par bloc, et on ne monte côté serveur que ce qui
// est vraiment de la logique métier (classement, regroupement) — plus tard.
//
// Ce que ce hook sert VRAIMENT (le reste de la page est encore en démo, et le
// signale à l'écran) :
//   - `day.blocks` ← useCalendarSugar (visites ∪ rappels ∪ RDV de vérification)
//   - `day.free`   ← dérivé des blocs du jour (trou ≥ 45 min)
//   - `news`       ← get_agent_changelog (RPC livrée le 01.08.2026, sans appelant)
//   - `pipelineTotal` ← usePipelineSugar
//
// ⛔ AUCUN repli sur les données de démonstration. Une journée vide s'affiche
// vide (« Journée dégagée ») : un repli silencieux ferait passer de la démo pour
// des données de l'agent, ce qui est pire qu'un écran vide.

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import type { CalEvent } from '@/components/crm-sugar/calendar/data'
import type { HlBlockData, HlNewsData } from './dataH'

/** Trou minimal pour proposer une session de relances (handoff §2.3). */
const FREE_WINDOW_MIN = 45

/** Une nouveauté publiée dans les N derniers jours porte la pilule « Nouveau ».
 *  ⚠ Ce n'est PAS un état lu/non-lu : `admin_changelog` n'en a pas, et la
 *  migration 20260801380000 a explicitement REFUSÉ d'en emprunter un. La pilule
 *  dit donc « récent », ce qui est vrai et dérivable. */
const NEWS_FRESH_DAYS = 30

// Palette d'avatars du prototype, choisie de façon DÉTERMINISTE sur le nom :
// deux rendus successifs donnent la même couleur, et aucune donnée n'est
// inventée (c'est une couleur d'affichage, pas un attribut du contact).
const AV_PALETTE = ['#5b6cff', '#9b7cf0', '#39B7C9', '#E08A45', '#34C796', '#8B5CF6', '#2370ff', '#c0566b']

function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length]
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// Types du Calendrier → familles fonctionnelles du concept H (HL_KIND_TYPE).
// `notary` (acte) n'a pas de teinte propre dans la maquette : il prend celle du
// compromis, la plus proche dans la chaîne de signature.
const CAL_TO_HL_KIND: Record<string, string> = {
  visite: 'home',
  kyc: 'shield',
  mandate: 'doc',
  notary: 'offer',
  task: 'call',
  publish: 'call',
  autre: 'call',
}

/** CTA contextuel d'un bloc : libellé, icône, route et référence RÉELLE.
 *  Sans référence routable, on retombe sur la liste correspondante plutôt que
 *  sur un bouton mort. */
function ctaFor(e: CalEvent, tKey: (k: string) => string): Pick<HlBlockData, 'cta' | 'ctaIcon'> & { route: string; ref?: string } {
  if (e.type === 'kyc') return { cta: tKey('today.h.cta.openKyc'), ctaIcon: 'shield', route: 'kyc' }
  if (e.type === 'visite') {
    return e.origin === 'visit'
      ? { cta: tKey('today.h.cta.openVisit'), ctaIcon: 'home', route: 'visite-detail', ref: e.id }
      : { cta: tKey('today.h.cta.openCalendar'), ctaIcon: 'cal', route: 'calendar' }
  }
  if (e.contactId) return { cta: tKey('today.h.cta.openContact'), ctaIcon: 'user', route: 'contact-detail', ref: e.contactId }
  if (e.bienId) return { cta: tKey('today.h.cta.openListing'), ctaIcon: 'doc', route: 'biens-detail', ref: e.bienId }
  return { cta: tKey('today.h.cta.openCalendar'), ctaIcon: 'cal', route: 'calendar' }
}

export interface TodayHBlock extends HlBlockData {
  /** Route de deep-link (contrat `useTodayNav().navigate`). */
  route: string
  /** Référence réelle passée à la route (uuid), quand elle existe. */
  navRef?: string
  /** Table d'origine — décide du chemin d'écriture du geste « fait ». */
  origin?: 'visit' | 'reminder' | 'appointment'
}

/**
 * Le bloc peut-il être coché sur cet écran ?
 *
 * ⛔ NON pour un `appointment` : c'est un rendez-vous de vérification RÉSERVÉ PAR
 * LE CLIENT. Le dépôt refuse déjà de le modifier depuis le Calendrier — « déplacer
 * un rendez-vous confirmé sans prévenir le client serait pire que de ne rien
 * faire » — et son report passe par des RPC qui envoient un courriel. On n'ouvre
 * pas ici une porte que le Calendrier ferme.
 */
export function canMarkDone(b: TodayHBlock): boolean {
  return b.origin === 'visit' || b.origin === 'reminder'
}

export interface TodayHDay {
  blocks: TodayHBlock[]
  /** Fenêtre horaire ADAPTATIVE, arrondie à l'heure pleine. */
  startMin: number
  endMin: number
  /** « maintenant », en minutes depuis minuit, heure locale. */
  nowMin: number
  nowLabel: string
  /** Plus grand trou ≥ 45 min de la journée, sinon null. */
  free: { from: number; to: number } | null
}

/**
 * Traduit les événements du Calendrier en blocs de la ligne du temps.
 *
 * Exportée pure (hors React) pour être éprouvée : c'est ici que se jouent la
 * durée réelle, le type fonctionnel, le CTA routable et le prix formaté.
 */
export function mapEventsToBlocks(
  events: CalEvent[],
  photos: Record<string, string>,
  tKey: (k: string) => string,
): TodayHBlock[] {
  return events.map((e) => {
    const name = e.contact?.name?.trim() || e.title
    const durMin = Math.max(15, Math.round((e.end.getTime() - e.start.getTime()) / 60_000))
    const cta = ctaFor(e, tKey)
    const photo = e.property?.id ? photos[e.property.id] : undefined
    return {
      id: e.id,
      from: minutesOf(e.start),
      dur: durMin,
      time: hhmm(e.start),
      kind: CAL_TO_HL_KIND[e.type] ?? 'call',
      contact: name,
      initials: initialsOf(name),
      av: avatarColor(e.contactId || e.id),
      role: e.contact?.role ?? '',
      // ⛔ Pas de note MEGGA AI : aucune table d'insight par événement n'existe,
      // et en fabriquer une supposerait un appel LLM par bloc affiché — ce que
      // l'archi Focus refuse (« DÉTERMINISTE + EXPLICABLE … 0 LLM »).
      line: e.notes ?? '',
      cta: cta.cta,
      ctaIcon: cta.ctaIcon,
      route: cta.route,
      navRef: cta.ref,
      origin: e.origin,
      done: e.status === 'done',
      // ⛔ Pas de `risk` : `transactions` n'a pas de colonne de risque, et le
      // risque du CRM est au niveau DEAL, jamais au niveau ÉVÉNEMENT.
      photo,
      // Apostrophe suisse posée ICI, comme le veut le handoff (« CHF entiers
      // côté serveur, formatage côté client »).
      price: e.property?.price != null ? formatCHF(e.property.price) : undefined,
      place: e.property ? [e.property.title, e.location].filter(Boolean).join(' · ') : undefined,
    }
  })
}

/**
 * Cadre la journée : fenêtre horaire ADAPTATIVE (1er→dernier créneau arrondi à
 * l'heure) et plus grand trou libre d'au moins 45 min.
 *
 * Exportée pure pour être éprouvée — c'est le calcul le plus facile à casser
 * sans que ça se voie.
 */
export function deriveDay(blocks: TodayHBlock[], nowTs: number): TodayHDay {
  const now = new Date(nowTs)
  const nowMin = minutesOf(now)

  // Plus grand trou ≥ 45 min entre deux blocs consécutifs du jour.
  let free: { from: number; to: number } | null = null
  for (let i = 0; i < blocks.length - 1; i++) {
    const gapFrom = blocks[i].from + blocks[i].dur
    const gapTo = blocks[i + 1].from
    if (gapTo - gapFrom >= FREE_WINDOW_MIN && (!free || gapTo - gapFrom > free.to - free.from)) {
      free = { from: gapFrom, to: gapTo }
    }
  }

  if (!blocks.length) {
    // Journée dégagée : on cadre autour de « maintenant » pour que la ligne du
    // temps reste lisible plutôt que de figer une plage arbitraire.
    const start = Math.max(0, Math.floor((nowMin - 120) / 60) * 60)
    return { blocks, startMin: start, endMin: Math.min(24 * 60, start + 480), nowMin, nowLabel: hhmm(now), free: null }
  }

  const edges = blocks.reduce(
    (a, b) => ({ min: Math.min(a.min, b.from), max: Math.max(a.max, b.from + b.dur) }),
    { min: blocks[0].from, max: blocks[0].from + blocks[0].dur },
  )
  return {
    blocks,
    startMin: Math.floor(edges.min / 60) * 60,
    endMin: Math.ceil(edges.max / 60) * 60,
    nowMin,
    nowLabel: hhmm(now),
    free,
  }
}

/**
 * Marque un bloc de la journée comme fait.
 *
 * ⚠️ ROUTE, n'aplatit pas : chaque source a son chemin d'écriture, et ce sont
 * les chemins DÉJÀ empruntés par le popover du Calendrier — aucune RPC nouvelle,
 * aucune quatrième porte. Un `appointment` est refusé en amont (`canMarkDone`).
 */
export async function markBlockDone(b: TodayHBlock, done: boolean): Promise<boolean> {
  if (!canMarkDone(b)) return false
  const now = new Date().toISOString()
  if (b.origin === 'reminder') {
    const { error } = await supabase
      .from('reminders')
      .update(done ? { status: 'done', completed_at: now } : { status: 'pending', completed_at: null })
      .eq('id', b.id)
    return !error
  }
  // `visits` : le trigger `trg_visit_completed_at` POSE `completed_at` quand le
  // statut passe à 'done' — inutile de le devancer. Mais il ne l'efface JAMAIS :
  // à la réouverture, on le remet à null nous-mêmes, sinon la visite garderait
  // une date d'achèvement qui ne correspond à rien.
  const { error } = await supabase
    .from('visits')
    .update(done ? { status: 'done' } : { status: 'planned', completed_at: null })
    .eq('id', b.id)
  return !error
}

export interface UseTodayHReturn {
  day: TodayHDay
  news: HlNewsData[]
  pipelineTotal: number
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

interface ChangelogRow {
  id: string
  title: string
  content: string | null
  version: string | null
  published_at: string
}

export function useTodayH(): UseTodayHReturn {
  const { i18n } = useTranslation('dashboard')
  const { t } = useTranslation('dashboard')
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const { events, isLoading: calLoading, isError: calError, refetch: refetchCal } = useCalendarSugar()
  const { deals, isLoading: pipeLoading } = usePipelineSugar()

  // « Maintenant » vit dans un état, pas dans le rendu : lire l'horloge pendant
  // le rendu est impur (deux rendus successifs donnent deux résultats) — et la
  // ligne « maintenant » resterait figée là où elle est née. Le tic d'une minute
  // la fait avancer pour de vrai.
  const [nowTs, setNowTs] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ─── Blocs du jour ────────────────────────────────────────────────────
  // Journée CIVILE locale : la borne se calcule sur minuit local, jamais sur un
  // décalage depuis `Date.now()` (cf. bascule de journée suisse).
  const todayEvents = useMemo(() => {
    const start = new Date(nowTs); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    return events
      .filter((e) => e.start >= start && e.start < end && e.status !== 'cancelled')
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events, nowTs])

  // Photos des biens concernés — requête SÉPARÉE et bornée aux biens du jour.
  // `properties.photos` n'est pas dans le select du Calendrier, et l'y ajouter
  // alourdirait une fenêtre de ±60 jours pour le seul besoin d'aujourd'hui.
  const propertyIds = useMemo(
    () => [...new Set(todayEvents.map((e) => e.property?.id).filter((x): x is string => !!x))].sort(),
    [todayEvents],
  )

  const { data: photos = {} } = useQuery({
    queryKey: ['today-h-photos', agencyId, propertyIds],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!propertyIds.length) return {}
      const { data, error } = await supabase
        .from('properties')
        .select('id, photos')
        .in('id', propertyIds)
      if (error) throw error
      const out: Record<string, string> = {}
      for (const row of data ?? []) {
        const first = Array.isArray(row.photos) ? row.photos[0] : null
        if (first) out[row.id] = first
      }
      return out
    },
    enabled: !!agencyId && propertyIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const blocks = useMemo(() => mapEventsToBlocks(todayEvents, photos, t), [todayEvents, photos, t])

  // ─── Fenêtre horaire adaptative + trou libre ──────────────────────────
  const day = useMemo(() => deriveDay(blocks, nowTs), [blocks, nowTs])

  // ─── What's new — get_agent_changelog (RPC déjà livrée) ───────────────
  // ⚠ Ne JAMAIS relire `admin_changelog` en direct : la RPC ampute volontairement
  // sa projection (author_id / status / scheduled_for = calendrier éditorial
  // interne), et cette fermeture corrigeait une fuite réelle.
  const { data: newsRows = [], isLoading: newsLoading } = useQuery({
    queryKey: ['today-h-changelog'],
    queryFn: async (): Promise<ChangelogRow[]> => {
      const { data, error } = await supabase.rpc('get_agent_changelog', { p_limit: 20 })
      if (error) throw error
      return (data ?? []) as ChangelogRow[]
    },
    staleTime: 10 * 60_000,
  })

  const news = useMemo<HlNewsData[]>(() => {
    const dayMonth = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' })
    const freshBefore = nowTs - NEWS_FRESH_DAYS * 24 * 60 * 60 * 1000
    return newsRows.map((r) => {
      const d = new Date(r.published_at)
      return {
        id: r.id,
        date: dayMonth.format(d),
        year: String(d.getFullYear()),
        fresh: d.getTime() >= freshBefore,
        title: r.title,
        desc: r.content ?? '',
      }
    })
  }, [newsRows, i18n.language, nowTs])

  // Total de dossiers du Pipeline (« Voir les N dossiers dans le Pipeline »).
  const pipelineTotal = deals.length

  return {
    day,
    news,
    pipelineTotal,
    isLoading: calLoading || pipeLoading || newsLoading,
    isError: calError,
    refetch: refetchCal,
  }
}
