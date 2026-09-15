/**
 * Les ÉVÉNEMENTS du Calendrier (15.09.2026, Julien : « on ne peut pas créer d'événements »).
 * Pur : aucun appel réseau ici — `useCalendarEvents` écrit, `useCalendarScreen` lit.
 */
import type { CalEvent } from '@/components/crm/calendar/data'
import type { Database, Json } from '@/types/database'

type LigneEvenement = Database['public']['Tables']['calendar_events']['Insert']

/**
 * Le brouillon du calendrier en colonnes `calendar_events` — la même forme à la création et
 * à la modification. ⚠ Le titre est déjà normalisé par `calNormalizeDraft` (repli sur le
 * libellé du type) ; les bornes sont celles de la table (200 caractères, fin ≥ début,
 * couleur hexadécimale réservée au type « autre »).
 */
export function versLigneEvenement(d: CalEvent): Omit<LigneEvenement, 'agency_id'> {
  return {
    type: d.type,
    title: d.title.trim().slice(0, 200),
    starts_at: d.start.toISOString(),
    ends_at: (d.end.getTime() >= d.start.getTime() ? d.end : d.start).toISOString(),
    all_day: !!d.allDay,
    location: d.location?.trim() || null,
    notes: d.notes?.trim() || null,
    color: d.type === 'autre' && d.color && /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : null,
    recurrence: d.recurrence ? (d.recurrence as unknown as Json) : null,
    status: d.status ?? null,
    contact_id: d.contactId ?? null,
    property_id: d.bienId ?? null,
    mail_thread_id: d.mailThreadId ?? null,
  }
}

/**
 * `createReminder` range le titre saisi dans le calendrier EN TÊTE du message —
 * « [Titre] notes » — et le Calendrier ne le relisait pas : une tâche revenait « Tâche » au
 * rechargement. On le relit ; un message sans crochets (une relance du système) reste tel
 * quel.
 */
export function titreDeRelance(message: string | null): { titre: string | null; reste: string | null } {
  const m = message?.match(/^\[([^\]\n]{1,200})\]\s*([\s\S]*)$/)
  if (!m) return { titre: null, reste: message }
  return { titre: m[1].trim() || null, reste: m[2].trim() || null }
}
