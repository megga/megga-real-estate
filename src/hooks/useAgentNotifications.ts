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

/**
 * Le TECHNIQUE n'entre pas dans la cloche non plus (14.09.2026). Mesuré en production :
 * dans les 30 dernières notifications de chaque agence, 32 étaient des « Scores de contacts
 * recalculés » — la passe nocturne, une ligne par agence et par nuit — qui ne demandent rien
 * à l'agent et poussaient hors de la liste ce qui, lui, demande quelque chose. Tenue À PART
 * de `HORS_CLOCHE`, que `messagerie-journal.spec.ts` confronte aux seules actions du courrier.
 * ⚠ Filtrée AUSSI côté client : le banc ne rejoue pas `not.in`.
 */
const TECHNIQUE = ['contact_scores.recompute', 'property_scores.recompute', 'agency_verification_recomputed', 'rls_hardening_applied']
const HORS_CLOCHE_TECHNIQUE = `(${TECHNIQUE.join(',')})`

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

/**
 * Le type de chaque action CONNUE — les 100 de la table du journal (`common:audit.action`)
 * et celles que la production écrit sans y figurer. Explicite plutôt que deviné : l'ancien
 * classement par motifs rangeait `match_suggested` en « Système », et `lead` en « IA ».
 */
const KIND_PAR_ACTION: Record<string, NotifKind> = {
  // Contacts et leads entrants
  contact_created: 'contact', contact_deleted: 'contact', note_added: 'contact',
  lead_created_whatsapp: 'contact', lead_qualified_whatsapp: 'contact',
  whatsapp_inbound_lead_created: 'contact', seller_lead_received: 'contact',
  // Messages — reçus, et envoyés au client par MEGGA AI
  whatsapp_message_received: 'message', contact_message_received: 'message',
  whatsapp_agent_copilot_reply: 'message', whatsapp_ai_send_client_message: 'message',
  whatsapp_ai_send_client_email: 'message', whatsapp_ai_send_template: 'message',
  whatsapp_delivery_failed: 'message', whatsapp_send_blocked: 'message',
  whatsapp_optin_invited: 'message', auto_email_sent: 'message', wa_undo: 'message',
  // Matching : correspondances et sélections envoyées
  match_suggested: 'matching', whatsapp_ai_send_listings: 'matching', reception_link_created: 'matching',
  // Agenda
  visit_scheduled: 'visite', onboarding_call_booked: 'visite', onboarding_call_cancelled: 'visite',
  onboarding_call_rescheduled: 'visite', calendar_connected: 'visite',
  reminder_created: 'rappel', reminder_resumed: 'rappel', relance: 'rappel', relance_sent: 'rappel',
  // Affaires
  stage_change: 'pipeline', status_change: 'pipeline', deal_lost: 'pipeline', dossier_envoye: 'pipeline',
  offer_created: 'pipeline', offer_accepted: 'pipeline', offer_countered: 'pipeline', offer_expired: 'pipeline',
  offer_rejected: 'pipeline', offer_withdrawn: 'pipeline', seller_offer_decision: 'pipeline',
  'signature.created': 'mandat', 'signature.withdrawn': 'mandat',
  'signature.provider_connected': 'mandat', 'signature.provider_disconnected': 'mandat',
  // Pièces et biens
  document_filed_from_email: 'doc', data_exported: 'doc',
  bien_created: 'bien', bien_updated: 'bien', bien_published: 'bien', bien_sold: 'bien',
  bien_soft_deleted: 'bien', bien_hard_deleted: 'bien', property_created: 'bien', property_updated: 'bien',
  property_photo_added: 'bien', property_published_to_portal: 'bien', property_withdrawn_from_portal: 'bien',
  idx_feed_pushed: 'bien', extract_property_pdf: 'bien', extract_property_url: 'bien',
  // Conformité : KYC des clients, KYB de l'agence
  kyc_case_opened: 'kyc', kyc_document_attached: 'kyc', kyc_link_sent: 'kyc', kyc_report_import: 'kyc',
  kyc_report_sent: 'kyc', kyc_screening: 'kyc', kyc_screening_match: 'kyc',
  agency_identity_submitted: 'kyc', agency_legal_identity_updated: 'kyc',
  agency_person_identity_verdict_invalidated: 'kyc', agency_verification_notice_sent: 'kyc',
  agency_verification_notice_undeliverable: 'kyc', agency_verification_run: 'kyc', agency_verification_validated: 'kyc',
  // Ce que MEGGA AI produit pour l'agent
  whatsapp_morning_brief_sent: 'ai', weekly_report_sent: 'ai', virtual_staging: 'ai',
  // Équipe et compte
  role_changed: 'team', team_invite_sent: 'team', team_invite_accepted: 'team',
  team_invite_cancelled: 'team', team_invite_resent: 'team', account_deleted: 'team',
  subscription_activated: 'facturation', subscription_changed: 'facturation',
  subscription_cancelled: 'facturation', payment_failed: 'facturation',
  // Plateforme
  agency_created: 'system', admin_console_entered: 'system', edge_function_error: 'system',
  solo_agency_released: 'system', solo_agency_retained: 'system', whatsapp_number_verified: 'system',
}

/** Repli pour une action pas encore inscrite : ses mots, puis sa catégorie. */
const KIND_PAR_MOTIF: [RegExp, NotifKind][] = [
  [/match/, 'matching'],
  [/kyc|screening|pep|sanction|kyb|agency_verification|agency_identity/, 'kyc'],
  [/lead|prospect|contact_|fiche|note_/, 'contact'],
  [/whatsapp|message|sms|email/, 'message'],
  [/visit|visite|appointment|booking|onboarding_call/, 'visite'],
  [/reminder|rappel|relance/, 'rappel'],
  [/signature|esign|mandat|mandate|compromis/, 'mandat'],
  [/offer|offre|stage|deal|transaction/, 'pipeline'],
  [/document|\bdoc\b|file|export/, 'doc'],
  [/property|bien|listing|annonce|portal/, 'bien'],
  [/subscription|payment|invoice|billing|stripe/, 'facturation'],
  [/team|invite|member|role/, 'team'],
  [/\bai\b|copilot|brief|staging/, 'ai'],
]
const KIND_PAR_CATEGORIE: Record<string, NotifKind> = {
  contact: 'contact', kyc: 'kyc', deal: 'pipeline', bien: 'bien', ai: 'ai',
  auth: 'team', onboarding: 'visite', messaging: 'message', doc: 'doc',
}

/** Classe une action d'événement en `NotifKind` : table explicite, puis motif, puis catégorie. */
export function toKind(action: string, category: string | null): NotifKind {
  const connu = KIND_PAR_ACTION[action]
  if (connu) return connu
  const a = (action || '').toLowerCase()
  for (const [motif, kind] of KIND_PAR_MOTIF) if (motif.test(a)) return kind
  return (category && KIND_PAR_CATEGORIE[category]) || 'system'
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
 * Titre d'un événement : ce qui s'est passé — le libellé traduit de l'action
 * (`common:audit.action.*`, la table du journal d'audit), sinon l'action humanisée.
 *
 * ⚠ La cloche avait sa propre table, en français, et humanisait le reste en ne
 * remplaçant que `_` : « Contact scores.recompute », « Relance drafted ». Elle lit
 * désormais la même table que le journal — l'appairage WhatsApp (acteur 'system',
 * webhook) y porte le mot de la carte des réglages, « Numéro WhatsApp lié ».
 * ⛔ Le libellé serveur (`object_label`) REMPLAÇAIT ce titre : un dossier KYC ouvert
 * s'intitulait « via WhatsApp », un changement d'étape « lead → new_lead ». Il est
 * désormais le SUJET, sous le titre (`detailFor`).
 */
export function titleFor(ev: Pick<RawEvent, 'action'>): string {
  return auditActionLabel(ev.action)
}

/**
 * Le sujet d'un événement, sous son titre : le libellé serveur, dont les codes d'étape
 * d'un changement de pipeline (« visit_planned → offer ») sont traduits. Vide si aucun.
 */
export function detailFor(ev: Pick<RawEvent, 'action' | 'object_label'>): string {
  const label = ev.object_label?.trim() ?? ''
  if (!label || (ev.action !== 'stage_change' && ev.action !== 'status_change')) return label
  return label.split(/\s*→\s*/)
    .map((code) => i18n.t(`dashboard:pipeline.stages.${code}`, { defaultValue: code }))
    .join(' → ')
}

/** Une ligne de la cloche : un événement, ou une rafale anonyme de la même action. */
interface GroupeCloche {
  ev: RawEvent
  ids: string[]
}

/**
 * Regroupe les RAFALES : des événements consécutifs de la même action, le même jour, sans
 * sujet. Mesuré en production : `match_suggested` arrive par lots (une passe du moteur, à la
 * même seconde) et `whatsapp_agent_copilot_reply` par dizaines — trente lignes identiques
 * qui ne disent rien de plus qu'une seule, « ×30 ». Un événement qui A un sujet (un contact
 * nommé, un bien) reste seul : le regrouper effacerait l'information qu'il porte.
 */
export function regrouper(events: RawEvent[]): GroupeCloche[] {
  const groupes: GroupeCloche[] = []
  for (const ev of events) {
    const precedent = groupes[groupes.length - 1]
    if (precedent && !ev.object_label && !precedent.ev.object_label
      && precedent.ev.action === ev.action && toGroup(precedent.ev.created_at) === toGroup(ev.created_at)) {
      precedent.ids.push(ev.id)
    } else {
      groupes.push({ ev, ids: [ev.id] })
    }
  }
  return groupes
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
export function useAgentNotifications(limit = 60): AgentNotifications {
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
        .not('action', 'in', HORS_CLOCHE_TECHNIQUE)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as RawEvent[]
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  const items = useMemo<CrmNotif[]>(() => {
    const lu = (ev: RawEvent) => readIds.has(ev.id) || new Date(ev.created_at).getTime() <= lastSeen
    const pertinents = (query.data ?? []).filter((ev) => !TECHNIQUE.includes(ev.action))
    return regrouper(pertinents).map(({ ev, ids }) => {
      const { cta, ctaTo } = ctaFor()
      const membres = pertinents.filter((e) => ids.includes(e.id))
      return {
        id: ev.id,
        kind: toKind(ev.action, ev.category),
        priority: toPriority(ev.severity),
        // Une rafale est lue quand TOUS ses événements le sont.
        read: membres.every(lu),
        title: titleFor(ev),
        body: detailFor(ev),
        time: relTime(ev.created_at),
        group: toGroup(ev.created_at),
        count: ids.length,
        ids,
        cta,
        ctaTo,
      }
    })
  }, [query.data, readIds, lastSeen])

  // Le badge compte les ÉVÉNEMENTS non lus, pas les lignes : trois matchs regroupés en
  // attendent trois.
  const unreadCount = useMemo(() => items.filter((n) => !n.read).reduce((s, n) => s + n.count, 0), [items])

  const markRead = useCallback((id: string) => {
    if (!uid) return
    // Une ligne regroupée se lit d'un geste : tous ses événements passent lus.
    const cibles = items.find((n) => n.id === id)?.ids ?? [id]
    // ⚠ Depuis le magasin COURANT, jamais depuis une copie : c'est ce qui empêche
    // une cloche d'effacer une lecture faite par une autre.
    const courant = lireEtatLu(uid)
    if (cibles.every((c) => courant.readIds.has(c))) return
    const next = new Set(courant.readIds)
    for (const c of cibles) next.add(c)
    try {
      localStorage.setItem(cleDuCompte(READ_IDS_KEY, uid), JSON.stringify([...next]))
    } catch {
      /* no-op */
    }
    poserEtatLu(uid, { ...courant, readIds: next })
  }, [uid, items])

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
