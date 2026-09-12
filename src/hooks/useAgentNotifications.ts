// MEGGA — Centre de notifications agent (réel).
// Remplace le mock SUGAR_NOTIFS : dérive les notifications des `activity_events`
// non-utilisateur (système/IA) de l'agence — « ce que le système a fait que vous
// devez savoir » : décisions vendeur, screening KYC, relances IA, etc.
//
// - RLS : `events_select` scope déjà à l'agence (agency_id = get_my_agency_id()).
// - Filtre `actor_kind <> 'user'` → couvert par l'index partiel
//   idx_activity_events_actor_kind (agency_id, actor_kind, created_at DESC).
// - Realtime : UN abonnement pour toute la coquille (`useAgentNotificationsRealtime`,
//   monté une fois dans AgentLayout), pattern useId() obligatoire — sinon crash au re-mount.
// - État « non lu » : activity_events est immuable (audit nLPD) → on suit un
//   last-seen + un set d'ids lus en localStorage (le point rouge, pas l'audit),
//   PARTAGÉS par toutes les cloches montées (voir `etatLu`).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import type { CrmNotif, NotifKind, NotifPriority, NotifGroup } from '@/components/crm/notifications/data'

const LAST_SEEN_KEY = 'megga-agent-notif-lastseen'
const READ_IDS_KEY = 'megga-agent-notif-read'

interface RawEvent {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  category: string | null
  severity: string | null
  object_label: string | null
}

/** Classe une action/catégorie d'événement en `NotifKind` (kyc, visite, offre…). */
function toKind(action: string, category: string | null): NotifKind {
  const a = (action || '').toLowerCase()
  if (/kyc|screening|pep|sanction/.test(a) || category === 'kyc') return 'kyc'
  if (/visit|visite/.test(a)) return 'visite'
  if (/offer|offre/.test(a)) return 'offre'
  if (/mandate|mandat|sign|compromis/.test(a)) return 'mandat'
  if (/document|\bdoc\b/.test(a) || category === 'doc') return 'doc'
  if (/team|invite|member|équipe|equipe/.test(a)) return 'team'
  if (/prospect|lead/.test(a)) return 'ai'
  if (/\bai\b|copilot|relance/.test(a) || category === 'ai') return 'ai'
  if (category === 'deal') return 'offre'
  return 'system'
}

/** Mappe la sévérité de l'événement en priorité d'affichage (high / med / low). */
function toPriority(severity: string | null): NotifPriority {
  if (severity === 'critical' || severity === 'error') return 'high'
  if (severity === 'warning' || severity === 'warn') return 'med'
  return 'low'
}

/** Range un horodatage ISO dans le bucket temporel : aujourd'hui / hier / plus ancien. */
function toGroup(iso: string): NotifGroup {
  const t = new Date(iso).getTime()
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startToday) return 'today'
  if (t >= startToday - 86_400_000) return 'yesterday'
  return 'older'
}

/** Libellé relatif français (« Il y a 3 min ») depuis un ISO. */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

const ACTION_TITLES: Record<string, string> = {
  seller_offer_decision: 'Décision du vendeur sur une offre',
  whatsapp_inbound_lead_created: 'Nouveau prospect WhatsApp',
  // Seul l'appairage par code arrive ici (acteur 'system', webhook) : la confirmation OTP est
  // un geste de l'agent, que le filtre `actor_kind <> 'user'` écarte. Titre neutre, parce que
  // toute l'agence le voit ; « lié » est le mot de la carte des réglages (« Numéro lié »).
  whatsapp_number_verified: 'Numéro WhatsApp lié',
}

/** Titre lisible d'un événement : label serveur, sinon mapping connu, sinon action humanisée. */
export function titleFor(ev: Pick<RawEvent, 'action' | 'object_label'>): string {
  if (ev.object_label) return ev.object_label
  if (ACTION_TITLES[ev.action]) return ACTION_TITLES[ev.action]
  return ev.action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

// Navigation deep-link non câblée (onNavigate = écran top-level) → clic = marquer lu.
// `ctaTo` vide ⇒ pas de navigation hasardeuse. Polish ultérieur possible.
function ctaFor(): { cta: string; ctaTo: string } {
  return { cta: '', ctaTo: '' }
}

/** Set des ids marqués lus, restauré depuis localStorage (le point rouge, pas l'audit). */
function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

/** Timestamp last-seen restauré depuis localStorage (0 si absent). */
function loadLastSeen(): number {
  try {
    return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * L'état « lu » — UN pour toutes les cloches montées.
 *
 * ⛔ IL VIVAIT EN `useState` DANS CHAQUE INSTANCE, lu une fois au montage, et la
 * cloche est rendue par chaque bande d'onglets — donc par chaque écran vivant.
 * Mesuré le 12 septembre 2026 (rejeu jsdom) : « tout marquer lu » dans une bande
 * laissait le badge des autres intact, et un `markRead` fait dans une bande restée
 * montée réécrivait la clé depuis SON ensemble périmé — effaçant les lectures
 * faites ailleurs entre-temps. Un magasin de module lu par `useSyncExternalStore`
 * n'a pas de copie à laisser périmer ; l'événement `storage` y fait entrer les
 * lectures faites dans un autre onglet du navigateur.
 */
let etatLu: { readIds: Set<string>; lastSeen: number } | null = null
const abonnesLu = new Set<() => void>()

function lireEtatLu(): { readIds: Set<string>; lastSeen: number } {
  if (!etatLu) etatLu = { readIds: loadReadIds(), lastSeen: loadLastSeen() }
  return etatLu
}

function poserEtatLu(suivant: { readIds: Set<string>; lastSeen: number }): void {
  etatLu = suivant
  for (const notifier of abonnesLu) notifier()
}

function abonnerEtatLu(notifier: () => void): () => void {
  abonnesLu.add(notifier)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== READ_IDS_KEY && e.key !== LAST_SEEN_KEY) return
    poserEtatLu({ readIds: loadReadIds(), lastSeen: loadLastSeen() })
  }
  window.addEventListener('storage', onStorage)
  return () => {
    abonnesLu.delete(notifier)
    window.removeEventListener('storage', onStorage)
  }
}

export interface AgentNotifications {
  items: CrmNotif[]
  unreadCount: number
  isLoading: boolean
  markRead: (id: string) => void
  markAllRead: () => void
}

/**
 * Centre de notifications agent : dérive des `CrmNotif` depuis les
 * `activity_events` non-utilisateur, avec compteur non-lu (last-seen + set
 * localStorage). `limit` borne la lecture. Le rafraîchissement temps réel est
 * porté UNE fois par la coquille — voir `useAgentNotificationsRealtime`.
 */
export function useAgentNotifications(limit = 30): AgentNotifications {
  const { readIds, lastSeen } = useSyncExternalStore(abonnerEtatLu, lireEtatLu, lireEtatLu)

  const query = useQuery({
    queryKey: ['agent-notifications', limit],
    queryFn: async (): Promise<RawEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, category, severity, object_label')
        .neq('actor_kind', 'user')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as RawEvent[]
    },
    staleTime: 30_000,
  })

  const items = useMemo<CrmNotif[]>(() => {
    return (query.data ?? []).map((ev) => {
      const read = readIds.has(ev.id) || new Date(ev.created_at).getTime() <= lastSeen
      const { cta, ctaTo } = ctaFor()
      return {
        id: ev.id,
        kind: toKind(ev.action, ev.category),
        priority: toPriority(ev.severity),
        read,
        title: titleFor(ev),
        body: '',
        time: relTime(ev.created_at),
        group: toGroup(ev.created_at),
        cta,
        ctaTo,
      }
    })
  }, [query.data, readIds, lastSeen])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const markRead = useCallback((id: string) => {
    // ⚠ Depuis le magasin COURANT, jamais depuis une copie : c'est ce qui empêche
    // une cloche d'effacer une lecture faite par une autre.
    const courant = lireEtatLu()
    if (courant.readIds.has(id)) return
    const next = new Set(courant.readIds)
    next.add(id)
    try {
      localStorage.setItem(READ_IDS_KEY, JSON.stringify([...next]))
    } catch {
      /* no-op */
    }
    poserEtatLu({ ...courant, readIds: next })
  }, [])

  // Tout marquer lu = avancer le last-seen à maintenant + purger le set (audit immuable).
  const markAllRead = useCallback(() => {
    const now = Date.now()
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(now))
      localStorage.removeItem(READ_IDS_KEY)
    } catch {
      /* no-op */
    }
    poserEtatLu({ readIds: new Set<string>(), lastSeen: now })
  }, [])

  return { items, unreadCount, isLoading: query.isLoading, markRead, markAllRead }
}

/**
 * Le canal Realtime des notifications — UN pour toute la coquille.
 *
 * ⛔ IL VIVAIT DANS `useAgentNotifications`, donc dans chaque cloche, donc dans
 * chaque bande d'onglets de chaque écran vivant. Le premier correctif (un
 * paramètre `abonne` réservé à la bande visible) laissait trois trous : aucun
 * canal quand l'écran montré n'a pas de bande (import de leads, planification de
 * visite, offre) ; un canal qui changeait de main à chaque bascule, dont les
 * INSERT tombés pendant la poignée de main étaient perdus ; et un aller-retour
 * plus rapide que l'accusé de fermeture. Monté une fois dans `AgentLayout`, il ne
 * change jamais de main.
 */
export function useAgentNotificationsRealtime(): void {
  const queryClient = useQueryClient()
  const channelId = useId()
  useEffect(() => {
    const channel = supabase
      .channel(`agent-notifs-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-notifications'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, channelId])
}
