// MEGGA — Centre de notifications agent (réel).
// Remplace le mock SUGAR_NOTIFS : dérive les notifications des `activity_events`
// non-utilisateur (système/IA) de l'agence — « ce que le système a fait que vous
// devez savoir » : décisions vendeur, screening KYC, relances IA, etc.
//
// - PÉRIMÈTRE : l'agence du profil, posée EN CLAIR (`.eq('agency_id', …)`), et AUCUNE
//   requête ni aucun canal sans agence (13.09.2026). La RLS ne le garantit pas seule :
//   deux policies SELECT permissives s'additionnent — `events_select` (agency_id =
//   get_my_agency_id()) ET `super_admin_read_all_events` (toutes agences). Le super-admin
//   de prod n'a pas d'agence : sa cloche rendait les 30 derniers événements système de la
//   PLATEFORME, titrés par des libellés d'agences qui ne sont pas les siennes, et le canal
//   poussait chaque insertion de la plateforme dans son navigateur. Sa vue plateforme vit
//   dans la console (flux d'activité, file de modération).
// - Index : c'est ce filtre explicite qui en rend un utilisable. Sans lui, la RLS arrivait
//   en OR (`is_super_admin() OR agency_id = …`) — un simple Filter sur l'index de
//   `created_at` (prod : 6 514 lignes parcourues, 255 ms). L'ancien commentaire promettait
//   idx_activity_events_actor_kind : aucun des deux plans ne le choisissait.
// - Realtime : UN abonnement pour toute la coquille (`useAgentNotificationsRealtime`,
//   monté une fois dans AgentLayout), pattern useId() obligatoire — sinon crash au re-mount.
// - État « non lu » : activity_events est immuable (audit nLPD) → on suit un
//   last-seen + un set d'ids lus en localStorage (le point rouge, pas l'audit),
//   PARTAGÉS par toutes les cloches montées (voir `etatLu`).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cleDuCompte } from '@/lib/stockageParCompte'
import { auditActionLabel } from '@/lib/auditActionLabel'
import i18n from '@/i18n'
import type { CrmNotif, NotifKind, NotifPriority, NotifGroup } from '@/components/crm/notifications/data'

const LAST_SEEN_KEY = 'megga-agent-notif-lastseen'
const READ_IDS_KEY = 'megga-agent-notif-read'

/**
 * Le courrier des boîtes n'entre pas dans la cloche (13.09.2026). La synchronisation
 * écrit un `email_received` / `email_sent` (acteur 'system') pour CHAQUE message rattaché
 * à un contact — 90 jours d'un coup à la connexion d'une boîte — et cette cloche est celle
 * de TOUTE l'agence : chaque collègue voyait défiler le courrier d'une boîte qui n'est pas
 * la sienne, titré par son objet. L'objet n'est plus écrit (`mailAuditEvent`), mais la
 * ligne resterait là, sous un titre humanisé en anglais (« Email received »). Le
 * propriétaire de la boîte a les compteurs de la Messagerie.
 */
const HORS_CLOCHE = '(email_received,email_sent)'

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

/**
 * Âge d'un événement (« il y a 3 min ») dans la langue de l'interface.
 *
 * ⚠ Était écrit en français en dur : un agent en allemand lisait « Il y a 9 h ».
 * `Intl.RelativeTimeFormat` porte les quatre langues ; la majuscule initiale reste
 * celle de la cloche.
 */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto', style: 'short' })
  const s = m < 1 ? rtf.format(0, 'second')
    : m < 60 ? rtf.format(-m, 'minute')
      : m < 24 * 60 ? rtf.format(-Math.floor(m / 60), 'hour')
        : rtf.format(-Math.floor(m / (24 * 60)), 'day')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Titre lisible d'un événement : label serveur, sinon le libellé traduit de l'action
 * (`common:audit.action.*`, la table du journal d'audit), sinon l'action humanisée.
 *
 * ⚠ La cloche avait sa propre table, en français, et humanisait le reste en ne
 * remplaçant que `_` : « Contact scores.recompute », « Relance drafted ». Elle lit
 * désormais la même table que le journal — l'appairage WhatsApp (acteur 'system',
 * webhook) y porte le mot de la carte des réglages, « Numéro WhatsApp lié ».
 */
export function titleFor(ev: Pick<RawEvent, 'action' | 'object_label'>): string {
  if (ev.object_label) return ev.object_label
  return auditActionLabel(ev.action)
}

// Navigation deep-link non câblée (onNavigate = écran top-level) → clic = marquer lu.
// `ctaTo` vide ⇒ pas de navigation hasardeuse. Polish ultérieur possible.
function ctaFor(): { cta: string; ctaTo: string } {
  return { cta: '', ctaTo: '' }
}

/** Set des ids marqués lus du compte, restauré depuis localStorage (le point rouge, pas l'audit). */
function loadReadIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(cleDuCompte(READ_IDS_KEY, uid))
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

/** Timestamp last-seen du compte restauré depuis localStorage (0 si absent). */
function loadLastSeen(uid: string): number {
  try {
    return Number(localStorage.getItem(cleDuCompte(LAST_SEEN_KEY, uid))) || 0
  } catch {
    return 0
  }
}

type EtatLu = { readIds: Set<string>; lastSeen: number }

/** Cliché stable quand aucun compte n'est connecté — un objet neuf à chaque lecture bouclerait. */
const ETAT_VIDE: EtatLu = { readIds: new Set<string>(), lastSeen: 0 }

/**
 * L'état « lu » — UN par compte, pour toutes les cloches montées.
 *
 * ⛔ IL VIVAIT EN `useState` DANS CHAQUE INSTANCE, lu une fois au montage, et la
 * cloche est rendue par chaque bande d'onglets — donc par chaque écran vivant.
 * Mesuré le 12 septembre 2026 (rejeu jsdom) : « tout marquer lu » dans une bande
 * laissait le badge des autres intact, et un `markRead` fait dans une bande restée
 * montée réécrivait la clé depuis SON ensemble périmé — effaçant les lectures
 * faites ailleurs entre-temps. Un magasin de module lu par `useSyncExternalStore`
 * n'a pas de copie à laisser périmer ; l'événement `storage` y fait entrer les
 * lectures faites dans un autre onglet du navigateur.
 *
 * ⚠ Rangé PAR COMPTE (`…:<uid>`, audit S11) : sous une clé fixe, le compte suivant
 * du navigateur héritait des lectures du précédent. Pas de nom dedans, donc gardé à
 * la déconnexion ; l'ancienne clé non indexée est MIGRÉE vers le premier compte qui
 * démarre (@/lib/stockageParCompte), pas effacée — sinon chaque agent retrouverait
 * ses trente notifications en non lu au lendemain du déploiement.
 */
const etatsLus = new Map<string, EtatLu>()
const abonnesLu = new Set<() => void>()

function lireEtatLu(uid: string | null): EtatLu {
  if (!uid) return ETAT_VIDE
  let etat = etatsLus.get(uid)
  if (!etat) {
    etat = { readIds: loadReadIds(uid), lastSeen: loadLastSeen(uid) }
    etatsLus.set(uid, etat)
  }
  return etat
}

function poserEtatLu(uid: string, suivant: EtatLu): void {
  etatsLus.set(uid, suivant)
  for (const notifier of abonnesLu) notifier()
}

function abonnerEtatLu(notifier: () => void): () => void {
  abonnesLu.add(notifier)
  const onStorage = (e: StorageEvent) => {
    const k = e.key
    if (k === null) etatsLus.clear()
    else if (k.startsWith(`${READ_IDS_KEY}:`) || k.startsWith(`${LAST_SEEN_KEY}:`)) etatsLus.delete(k.slice(k.indexOf(':') + 1))
    else return
    for (const n of abonnesLu) n()
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
  const { profile, user } = useAuth()
  const uid = user?.id ?? null
  const cliche = useCallback(() => lireEtatLu(uid), [uid])
  const { readIds, lastSeen } = useSyncExternalStore(abonnerEtatLu, cliche, cliche)
  const agencyId = profile?.agency_id ?? null

  const query = useQuery({
    // L'agence dans la clé : le cache ne se partage jamais entre deux comptes.
    queryKey: ['agent-notifications', agencyId, limit],
    queryFn: async (): Promise<RawEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, category, severity, object_label')
        .eq('agency_id', agencyId as string)
        .neq('actor_kind', 'user')
        .not('action', 'in', HORS_CLOCHE)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as RawEvent[]
    },
    enabled: !!agencyId,
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
    if (!uid) return
    // ⚠ Depuis le magasin COURANT, jamais depuis une copie : c'est ce qui empêche
    // une cloche d'effacer une lecture faite par une autre.
    const courant = lireEtatLu(uid)
    if (courant.readIds.has(id)) return
    const next = new Set(courant.readIds)
    next.add(id)
    try {
      localStorage.setItem(cleDuCompte(READ_IDS_KEY, uid), JSON.stringify([...next]))
    } catch {
      /* no-op */
    }
    poserEtatLu(uid, { ...courant, readIds: next })
  }, [uid])

  // Tout marquer lu = avancer le last-seen à maintenant + purger le set (audit immuable).
  const markAllRead = useCallback(() => {
    if (!uid) return
    const now = Date.now()
    try {
      localStorage.setItem(cleDuCompte(LAST_SEEN_KEY, uid), String(now))
      localStorage.removeItem(cleDuCompte(READ_IDS_KEY, uid))
    } catch {
      /* no-op */
    }
    poserEtatLu(uid, { readIds: new Set<string>(), lastSeen: now })
  }, [uid])

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
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  useEffect(() => {
    // Aucun canal sans agence, et un canal filtré sur l'agence : sans ce filtre, le serveur
    // poussait le contenu de CHAQUE insertion que la RLS laisse lire — pour un super-admin,
    // toute la plateforme — à une cloche qui ne l'affiche pas.
    if (!agencyId) return
    const channel = supabase
      .channel(`agent-notifs-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events', filter: `agency_id=eq.${agencyId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-notifications'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, channelId, agencyId])
}
