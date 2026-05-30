// Exécuteurs des outils WhatsApp (Phase 4A). Reçoivent le client service-role +
// l'identité agent (profileId, agencyId) + les args parsés. Renvoient un texte court
// réinjecté dans la boucle IA (role:'tool'). TOUJOURS scoper par agencyId.
//
// SÉCURITÉ (audit 2026-05-30) :
//  - chaque exécuteur REFUSE si agencyId est null (sinon insert/lookup hors RLS).
//  - le filtre agence se fait au niveau SQL (.eq('agency_id', …)), JAMAIS par une
//    comparaison JS `!==` (qui est permissive sur null === null).
//
// Schéma prod confirmé (2026-05-30) :
//  - agenda  -> table `visits` (agent_id, agency_id, scheduled_at, status, contact_id…)
//  - note    -> `activity_events` (timeline contact : action=titre, object_label=détail,
//               actor_kind='ai' => badge IA). PAS de table contact_notes.
//  - contact -> `contacts` (pas de created_by ; on met source='whatsapp_ai').

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ActionCtx {
  supabase: SupabaseClient
  profileId: string
  agencyId: string | null
}

type Args = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Garde commune : aucune action si l'agent n'a pas d'agence (évite tout accès hors RLS).
const NO_AGENCY = 'Erreur: ton compte n’est rattaché à aucune agence. Contacte un administrateur.'
function hasAgency(ctx: ActionCtx): boolean {
  return typeof ctx.agencyId === 'string' && ctx.agencyId.length > 0
}

export async function execGetMyAgenda(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const from = s(a.from), to = s(a.to)
  if (!from || !to) return 'Erreur: dates from/to requises.'
  const { data, error } = await ctx.supabase
    .from('visits')
    .select('scheduled_at, status, contact_id, property_id, buyer_name')
    .eq('agency_id', ctx.agencyId)
    .eq('agent_id', ctx.profileId)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
    .limit(20)
  if (error) return `Erreur agenda: ${error.message}`
  if (!data?.length) return 'Aucun rendez-vous sur cette période.'
  return JSON.stringify(data)
}

export async function execSearchContacts(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const q = s(a.query)
  if (!q) return 'Erreur: query requise.'
  // Neutralise les caractères qui casseraient le filtre PostgREST .or()
  const safe = q.replace(/[,()%*]/g, ' ').trim()
  if (safe.length < 2) return 'Erreur: recherche trop courte (2 caractères min).'
  // Tokenise : « Vladimir Poutine » doit matcher first_name=Vladimir ET last_name=Poutine.
  // Chaque token doit apparaître dans AU MOINS une colonne (AND de tokens, OR de colonnes).
  // Les .or() chaînés sont combinés en AND par PostgREST. Max 5 tokens (anti-abus).
  const tokens = safe.split(/\s+/).filter(Boolean).slice(0, 5)
  let query = ctx.supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email')
    .eq('agency_id', ctx.agencyId)
  for (const tok of tokens) {
    query = query.or(`first_name.ilike.%${tok}%,last_name.ilike.%${tok}%,email.ilike.%${tok}%,phone.ilike.%${tok}%`)
  }
  const { data, error } = await query.limit(10)
  if (error) return `Erreur recherche: ${error.message}`
  if (!data?.length) return 'Aucun contact trouvé.'
  return JSON.stringify(data)
}

export async function execCreateContact(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const first = s(a.first_name)
  if (!first) return 'Erreur: prénom requis.'
  const phone = s(a.phone), email = s(a.email), last = s(a.last_name)

  // Dédup (anti-doublon sur messages concurrents / répétés) : si un contact de
  // l'agence a déjà ce téléphone ou cet email, on ne recrée pas.
  if (phone || email) {
    let dq = ctx.supabase.from('contacts').select('id, first_name, last_name').eq('agency_id', ctx.agencyId)
    if (phone && email) dq = dq.or(`phone.eq.${phone},email.eq.${email}`)
    else if (phone) dq = dq.eq('phone', phone)
    else if (email) dq = dq.eq('email', email)
    const { data: existing } = await dq.limit(1).maybeSingle()
    if (existing) {
      return `Un contact existe déjà (${existing.first_name ?? ''} ${existing.last_name ?? ''}, id ${existing.id}). Je ne l’ai pas recréé.`
    }
  }

  const { data, error } = await ctx.supabase
    .from('contacts')
    .insert({
      agency_id: ctx.agencyId,
      first_name: first,
      last_name: last,
      phone,
      email,
      notes: s(a.notes),
      source: 'whatsapp_ai',
    })
    .select('id, first_name, last_name')
    .single()
  if (error) return `Erreur création contact: ${error.message}`
  await logTimeline(ctx, 'Contact créé', `${data.first_name ?? ''} ${data.last_name ?? ''} (via WhatsApp)`.trim(), data.id)
  return `Contact créé: ${data.first_name} ${data.last_name ?? ''} (id ${data.id}).`
}

export async function execAddNote(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), body = s(a.body)
  if (!contactId || !body) return 'Erreur: contact_id et body requis.'
  // Garde-fou agence AU NIVEAU SQL : on ne charge la ligne que si elle appartient
  // à l'agence de l'agent. Pas de match (y compris agency_id NULL) => introuvable.
  const { data: c } = await ctx.supabase
    .from('contacts').select('id')
    .eq('id', contactId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  if (!c) return 'Erreur: contact introuvable dans votre agence.'
  const ok = await logTimeline(ctx, 'Note ajoutée', body, contactId)
  if (!ok) return "Erreur: impossible d'enregistrer la note."
  return 'Note ajoutée à la fiche.'
}

// Écrit une entrée dans la timeline du contact (activity_events).
// La timeline lit par entity_id ; `action` = titre affiché, `object_label` = détail,
// `actor_kind='ai'` => badge « IA ». category 'contact' => icône contact.
async function logTimeline(ctx: ActionCtx, action: string, objectLabel: string, contactId: string | null): Promise<boolean> {
  const { error } = await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId,
    actor_id: ctx.profileId,
    actor_kind: 'ai',
    action,
    entity_type: 'contact',
    entity_id: contactId,
    object_label: objectLabel.slice(0, 500),
    category: 'contact',
    severity: 'info',
    metadata: { via: 'whatsapp' },
  })
  if (error) { console.error('activity_events insert failed'); return false }
  return true
}
