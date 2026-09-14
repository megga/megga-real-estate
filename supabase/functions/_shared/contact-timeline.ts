// supabase/functions/_shared/contact-timeline.ts
// Les derniers FAITS d'un contact pour les outils IA (`get_contact_brief`, `prepare_meeting`),
// datés par le fait — pour un courrier, l'instant du courrier (`metadata.sent_at`), jamais
// l'enregistrement au journal. Import de TYPE seul : chargeable sous Node (tests vitest).
//
// ⛔ Même défaut, même règle que `useContactTimeline` (src/lib/contactTimeline.ts) : après la
// passe initiale d'une boîte, les lignes les plus récemment ENREGISTRÉES sont les courriers les
// plus VIEUX — « Dernière action au dossier » citait à DeepSeek, et à l'agent, le courrier le
// plus ancien des 90 jours. Deux lectures bornées (non-courriers par `created_at`, courriers
// par `sent_at`) dont la réunion contient le vrai top par date du fait.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Miroir de `MailAuditAction` (_shared/mail/ingest.ts) — comparé par tests/unit/messagerie-timeline.spec.ts. */
export const ACTIONS_COURRIER = ['email_received', 'email_sent'] as const

/** Ce qui part au modèle : l'action, le libellé, la date du fait — aucun identifiant de metadata. */
export interface FaitContact { action: string | null; object_label: string | null; occurred_at: string | null }

interface Ligne { action: string | null; object_label: string | null; created_at: string | null; sent_at: string | null; message_id?: string | null }

/** La date du fait : pour un courrier, `sent_at` borné par l'enregistrement ; sinon `created_at`. */
export function dateDuFait(l: Ligne): string | null {
  const enr = l.created_at ? Date.parse(l.created_at) : Number.NaN
  if (!l.action || !(ACTIONS_COURRIER as readonly string[]).includes(l.action) || !Number.isFinite(enr)) return l.created_at
  const t = l.sent_at ? Date.parse(l.sent_at) : Number.NaN
  return Number.isFinite(t) ? new Date(Math.min(t, enr)).toISOString() : l.created_at
}

/**
 * Les courriers de ces lignes signalés comme spam APRÈS avoir été rattachés : leur ligne
 * reste au journal (append-only), mais ils ne sont plus un fait du dossier (20260915080200).
 * Une lecture en échec n'écarte rien — elle ne coupe pas la réunion en deux, elle y laisse
 * au pire un spam.
 */
async function courriersAuSpam(supabase: SupabaseClient, agencyId: string, lignes: Ligne[]): Promise<Set<string>> {
  const ids = [...new Set(lignes.map((l) => l.message_id).filter((v): v is string => !!v))]
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase.from('mail_messages').select('id')
    .in('id', ids).eq('agency_id', agencyId).eq('is_spam', true)
  if (error) {
    console.error('[contact-timeline] spam illisible:', error.message)
    return new Set()
  }
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id))
}

/**
 * Les `limite` derniers faits du contact, bornés à l'agence (défense en profondeur : les
 * appelants valident déjà le contact in-agency). Jamais une erreur — c'était déjà le régime de
 * ces deux outils (brief best-effort) — mais une lecture en échec rend AUCUN fait, pas la
 * moitié : réduite aux courriers ou aux autres actions, la réunion désignerait au modèle une
 * « dernière action » qui n'est pas la dernière.
 */
export async function lireFaitsContact(supabase: SupabaseClient, agencyId: string | null, contactId: string, limite: number): Promise<FaitContact[]> {
  // Jamais de lecture sans agence : le client est service-role, la RLS ne bornerait rien.
  if (!agencyId) return []
  // L'identifiant du message n'est lu que pour écarter le spam : il ne part pas au modèle.
  const base = (select: string) => supabase.from('activity_events').select(select)
    .eq('entity_type', 'contact').eq('entity_id', contactId).eq('agency_id', agencyId)
  const colonnes = 'action, object_label, created_at, sent_at:metadata->>sent_at'
  const [autres, courriers] = await Promise.all([
    base(colonnes).not('action', 'in', `(${ACTIONS_COURRIER.join(',')})`).order('created_at', { ascending: false }).limit(limite),
    base(`${colonnes}, message_id:metadata->>message_id`).in('action', [...ACTIONS_COURRIER]).order('metadata->>sent_at', { ascending: false, nullsFirst: false }).limit(limite),
  ])
  if (autres.error || courriers.error) {
    console.error(`[contact-timeline] faits du contact ${contactId} illisibles:`, (autres.error ?? courriers.error)!.message)
    return []
  }
  const lusCourriers = (courriers.data ?? []) as unknown as Ligne[]
  const spam = await courriersAuSpam(supabase, agencyId, lusCourriers)
  const lignes = [...((autres.data ?? []) as unknown as Ligne[]), ...lusCourriers.filter((l) => !l.message_id || !spam.has(l.message_id))]
  return lignes
    .map((l) => ({ action: l.action, object_label: l.object_label, occurred_at: dateDuFait(l), created_at: l.created_at }))
    .sort((a, b) => (Date.parse(b.occurred_at ?? '') || 0) - (Date.parse(a.occurred_at ?? '') || 0)
      || (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0))
    .slice(0, limite)
    .map(({ action, object_label, occurred_at }) => ({ action, object_label, occurred_at }))
}
