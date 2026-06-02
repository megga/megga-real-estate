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
import { mapCriteria, isSearchable, computeMissing, parseAmount } from './whatsapp-lead.ts'
import { PIPELINE_STAGES, isValidStage, STAGE_LABELS_FR, type PipelineStage } from './whatsapp-agent-router.ts'

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
    // Contrainte activity_events_actor_kind_coherence : actor_id DOIT être NULL si
    // actor_kind != 'user'. Pour une action IA, l'agent déclencheur va en metadata.
    actor_id: null,
    actor_kind: 'ai',
    action,
    entity_type: 'contact',
    entity_id: contactId,
    object_label: objectLabel.slice(0, 500),
    category: 'contact',
    severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId },
  })
  if (error) { console.error('activity_events insert failed'); return false }
  return true
}

// ── Phase 4C / C3 : outils LECTURE (scopés agence au SQL) ───────────────────

/** Fiche synthétique d'un contact : infos + critères + 5 dernières entrées timeline. */
export async function execGetContactBrief(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (obtiens-le via search_contacts).'
  const { data: c } = await ctx.supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, type, score, tags, notes, search_criteria, last_interaction_at')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!c) return 'Contact introuvable dans votre agence.'
  const { data: timeline } = await ctx.supabase
    .from('activity_events').select('action, object_label, created_at')
    .eq('entity_type', 'contact').eq('entity_id', contactId)
    .order('created_at', { ascending: false }).limit(5)
  const { data: searches } = await ctx.supabase
    .from('client_searches').select('label, criteria')
    .eq('contact_id', contactId).eq('is_active', true).limit(3)
  return JSON.stringify({ contact: c, recherches_actives: searches ?? [], timeline: timeline ?? [] })
}

/** Leads à compléter / relancer (marqués par MEGGA). */
export async function execListFollowups(ctx: ActionCtx, _a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const { data, error } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name, type, score, tags')
    .eq('agency_id', ctx.agencyId)
    .contains('tags', ['à_compléter'])
    .order('created_at', { ascending: false })
    .limit(15)
  if (error) return `Erreur: ${error.message}`
  if (!data?.length) return 'Aucun lead à compléter pour le moment.'
  return JSON.stringify(data)
}

/** Biens correspondant à un contact (moteur de matching). */
export async function execGetMatches(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis.'
  const { data, error } = await ctx.supabase
    .from('matches').select('score, status, market_listing_id, property_id')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('score', { ascending: false }).limit(5)
  if (error) return `Erreur: ${error.message}`
  if (!data?.length) return 'Aucun bien correspondant (recherche peut-être pas encore lancée).'
  return JSON.stringify(data)
}

/** Briefing du jour : visites du jour de l'agent + nombre de leads à compléter. */
export async function execGetDailyBrief(ctx: ActionCtx, _a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  const end = new Date(); end.setUTCHours(23, 59, 59, 999)
  const { data: visits } = await ctx.supabase
    .from('visits').select('scheduled_at, status, buyer_name, contact_id')
    .eq('agency_id', ctx.agencyId).eq('agent_id', ctx.profileId)
    .gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true }).limit(20)
  const { data: followups } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name')
    .eq('agency_id', ctx.agencyId).contains('tags', ['à_compléter']).limit(10)
  return JSON.stringify({ visites_du_jour: visits ?? [], leads_a_completer: followups ?? [] })
}

// ── Phase 4C / C4 : outils ACTION (tier 🟢 auto — état CRM interne, réversible) ─
// Aucun envoi client / KYC / argent / signature ici (→ tiers confirm/never).

const frDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Zurich' })

/** Vérifie qu'un contact appartient à l'agence (garde SQL). Renvoie son nom ou null. */
async function contactInAgency(
  ctx: ActionCtx, contactId: string,
): Promise<{ id: string; first_name: string | null; last_name: string | null } | null> {
  const { data } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  return (data as { id: string; first_name: string | null; last_name: string | null } | null) ?? null
}

/** Résout le dossier (transaction) d'un contact : acheteur OU vendeur, le plus récent.
 *  Le lien contact↔dossier est porté par contact_buyer_id / contact_seller_id. */
async function resolveContactDeal(
  ctx: ActionCtx, contactId: string,
): Promise<{ id: string; label: string; stage: string; party: 'buyer' | 'seller' } | null> {
  const { data } = await ctx.supabase
    .from('transactions')
    .select('id, stage, contact_seller_id, properties(title, address, city)')
    .eq('agency_id', ctx.agencyId)
    .or(`contact_buyer_id.eq.${contactId},contact_seller_id.eq.${contactId}`)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (!data) return null
  // L'embed PostgREST est typé en tableau à la compilation mais renvoie un objet
  // (relation to-one via property_id) à l'exécution : on gère les deux formes.
  type PropRow = { title: string | null; address: string | null; city: string | null }
  const row = data as unknown as { id: string; stage: string; contact_seller_id: string | null; properties: PropRow | PropRow[] | null }
  const p = Array.isArray(row.properties) ? (row.properties[0] ?? null) : row.properties
  const party: 'buyer' | 'seller' = row.contact_seller_id === contactId ? 'seller' : 'buyer'
  return { id: row.id, label: p?.title || p?.address || p?.city || 'dossier', stage: row.stage, party }
}

/** Planifie une visite (table visits). property_id ET contact_id obligatoires (NOT NULL). */
export async function execScheduleVisit(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), propertyId = s(a.property_id), when = s(a.scheduled_at)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!propertyId) return 'Erreur: pour quel bien ? (property_id requis, via get_matches ou demande à l’agent).'
  if (!when || !Number.isFinite(Date.parse(when))) return 'Erreur: date/heure (scheduled_at, ISO 8601) requise.'
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const { data: prop } = await ctx.supabase
    .from('properties').select('id, title').eq('id', propertyId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!prop) return 'Erreur: bien introuvable dans votre agence.'
  const propTitle = (prop as { title: string | null }).title ?? 'bien'

  const visitType = s(a.visit_type) === 'video' ? 'video' : 'sur_place'
  const buyerName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || null
  const iso = new Date(when).toISOString()
  const row: Record<string, unknown> = {
    agency_id: ctx.agencyId, agent_id: ctx.profileId,
    property_id: propertyId, contact_id: contactId,
    scheduled_at: iso, status: 'planned', visit_type: visitType, buyer_name: buyerName,
  }
  if (typeof a.duration_minutes === 'number' && a.duration_minutes > 0) row.duration_minutes = Math.min(a.duration_minutes, 480)
  if (visitType === 'video') row.video_platform = 'google_meet'
  const { error } = await ctx.supabase.from('visits').insert(row)
  if (error) return `Erreur planification: ${error.message}`
  await logTimeline(ctx, 'Visite planifiée', `${propTitle} — ${frDateTime(iso)}`, contactId)
  return `Visite planifiée le ${frDateTime(iso)} pour ${buyerName ?? 'le contact'} (bien : ${propTitle}).`
}

/** Crée un rappel/tâche agent (table reminders). type=custom, trigger_rule=manual. */
export async function execCreateReminder(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const body = s(a.body), when = s(a.due_at)
  if (!body) return 'Erreur: objet du rappel (body) requis.'
  if (!when || !Number.isFinite(Date.parse(when))) return 'Erreur: date du rappel (due_at, ISO 8601) requise.'
  const contactId = s(a.contact_id)
  if (contactId && !(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'
  const iso = new Date(when).toISOString()
  const { error } = await ctx.supabase.from('reminders').insert({
    agency_id: ctx.agencyId, contact_id: contactId,
    type: 'custom', trigger_rule: 'manual', status: 'pending', channel: 'task',
    trigger_at: iso, message_template: body.slice(0, 500),
  })
  if (error) return `Erreur rappel: ${error.message}`
  if (contactId) await logTimeline(ctx, 'Rappel créé', `${body.slice(0, 120)} (${frDateTime(iso)})`, contactId)
  return `Rappel noté pour le ${frDateTime(iso)} : « ${body.slice(0, 120)} ».`
}

/** Déplace le dossier (transaction) d'un contact dans le pipeline. */
export async function execUpdatePipeline(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), stage = s(a.stage)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!stage || !isValidStage(stage)) return `Erreur: étape invalide. Valeurs possibles : ${PIPELINE_STAGES.join(', ')}.`
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return "Ce contact n’a pas encore de dossier dans le pipeline (aucune transaction). Le dossier doit d’abord être créé dans le CRM."
  const label = STAGE_LABELS_FR[stage as PipelineStage] ?? stage
  if (deal.stage === stage) return `Le dossier « ${deal.label} » est déjà à l’étape « ${label} ».`
  const { error } = await ctx.supabase.from('transactions')
    .update({ stage }).eq('id', deal.id).eq('agency_id', ctx.agencyId)
  if (error) return `Erreur pipeline: ${error.message}`
  // Audit non bloquant (LBA) : trace le changement d'étape (category 'deal', actor IA).
  const { error: logErr } = await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'stage_change', entity_type: 'transaction', entity_id: deal.id,
    object_label: `${deal.stage} → ${stage}`, category: 'deal', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId, old_stage: deal.stage, new_stage: stage, contact_id: contactId },
  })
  if (logErr) console.error('pipeline audit log failed')
  return `Dossier « ${deal.label} » déplacé en « ${label} ».`
}

/** Qualifie un contact existant : critères structurés → search_criteria + matching auto.
 *  Réutilise la logique pure 4B (mêmes normalisations zones/types que la qualif autonome). */
export async function execQualifyLead(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const { data } = await ctx.supabase
    .from('contacts').select('id, phone, email, tags')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const c = data as { id: string; phone: string | null; email: string | null; tags: string[] | null } | null
  if (!c) return 'Erreur: contact introuvable dans votre agence.'

  let zones: string[] | undefined
  if (Array.isArray(a.zones)) zones = (a.zones as unknown[]).filter((z): z is string => typeof z === 'string' && z.trim().length > 0)
  else if (typeof a.zones === 'string' && a.zones.trim()) zones = a.zones.split(',').map((z) => z.trim()).filter(Boolean)

  const txType = s(a.transaction_type)
  const intent = txType === 'rent' ? 'recherche_location' : txType === 'buy' ? 'recherche_achat' : null
  const criteria = mapCriteria(intent, { type: s(a.property_type) ?? undefined, zones, budget: a.budget_max, pieces: a.rooms_min }, '')

  const existingTags = Array.isArray(c.tags) ? c.tags : []
  const missing = computeMissing(criteria, { phone: c.phone, email: c.email })
  const newTags = Array.from(new Set([...existingTags, 'whatsapp_ai_qualified', ...(missing.length ? ['à_compléter'] : [])]))
  const { error: uErr } = await ctx.supabase.from('contacts')
    .update({ tags: newTags, search_criteria: criteria }).eq('id', contactId).eq('agency_id', ctx.agencyId)
  if (uErr) return `Erreur qualification: ${uErr.message}`

  let searchCreated = false
  if (isSearchable(criteria)) {
    const { data: existing } = await ctx.supabase.from('client_searches')
      .select('id').eq('contact_id', contactId).eq('is_active', true).limit(1).maybeSingle()
    if (!existing) {
      await ctx.supabase.from('client_searches').insert({
        agency_id: ctx.agencyId, contact_id: contactId,
        label: `WhatsApp — ${criteria.transaction_type === 'rent' ? 'location' : 'achat'}`,
        criteria, is_active: true,
      })
      searchCreated = true
    }
  }
  const critTxt = [
    criteria.transaction_type === 'rent' ? 'location' : criteria.transaction_type === 'buy' ? 'achat' : null,
    criteria.type, (criteria.zones ?? []).join('/') || null,
    criteria.budget_max ? `budget ${criteria.budget_max}` : null,
  ].filter(Boolean).join(' · ')
  await logTimeline(ctx, 'Lead qualifié (WhatsApp)',
    `Lead qualifié par l’agent.${critTxt ? ` ${critTxt}.` : ''}${missing.length ? ` À compléter : ${missing.join(', ')}.` : ''}`, contactId)

  const parts = ['Lead qualifié.']
  if (searchCreated) parts.push('Recherche active créée → matching lancé.')
  else if (!isSearchable(criteria)) parts.push('Critères encore insuffisants pour lancer le matching.')
  if (missing.length) parts.push(`À compléter : ${missing.join(', ')}.`)
  return parts.join(' ')
}

// ── Phase 4C / C5 : outils tier 🟡 confirm (envoi client + offre) ────────────
// Modèle « prepare → execute » : on VALIDE et FORMATE avant de demander « oui »,
// puis on exécute le payload figé après confirmation. WYSIWYG : l'agent valide
// exactement ce qui partira (texte envoyé, montant enregistré).

/** Montant en CHF suisse (apostrophe). */
function fmtCHF(n: number): string {
  return `CHF ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Prepared =
  | { ok: true; prompt: string; payload: Record<string, unknown> }
  | { ok: false; error: string }

type ListingRow = {
  title: string | null; transaction_type: string | null; price: number | null
  rent?: number | null; rent_chf?: number | null; rooms: number | null
  surface_m2: number | null; city: string | null; source_url?: string | null
}

function formatListing(l: ListingRow): string {
  const amount = l.transaction_type === 'rent' ? (l.rent_chf ?? l.rent ?? l.price ?? 0) : (l.price ?? 0)
  const price = amount ? (l.transaction_type === 'rent' ? `${fmtCHF(amount)}/mois` : fmtCHF(amount)) : 'prix sur demande'
  const facts = [l.rooms ? `${l.rooms} p.` : null, l.surface_m2 ? `${Math.round(l.surface_m2)} m²` : null, l.city]
    .filter(Boolean).join(' · ')
  let line = `• ${l.title ?? 'Bien'} — ${price}${facts ? ` (${facts})` : ''}`
  if (l.source_url) line += `\n  ${l.source_url}`
  return line
}

/** Prépare le message « sélection de biens » à partir de VRAIES données (jamais halluciné).
 *  Biens = listing_ids fournis, sinon top correspondances du contact. */
export async function prepareSendListings(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: 'Pour quel client veux-tu envoyer des biens ?' }
  const { data: cRow } = await ctx.supabase.from('contacts')
    .select('first_name, phone').eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as { first_name: string | null; phone: string | null } | null
  if (!contact) return { ok: false, error: 'Contact introuvable dans votre agence.' }
  if (!contact.phone) return { ok: false, error: "Ce contact n'a pas de numéro WhatsApp, je ne peux pas lui écrire." }

  let ids: string[] = Array.isArray(a.listing_ids)
    ? (a.listing_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  ids = ids.filter((id) => UUID_RE.test(id))
  if (!ids.length) {
    const { data: ms } = await ctx.supabase.from('matches')
      .select('market_listing_id, property_id, score')
      .eq('agency_id', ctx.agencyId).eq('contact_id', contactId)
      .order('score', { ascending: false }).limit(3)
    ids = ((ms ?? []) as Array<{ market_listing_id: string | null; property_id: string | null }>)
      .map((m) => m.market_listing_id || m.property_id || '').filter((x) => UUID_RE.test(x))
  }
  if (!ids.length) return { ok: false, error: "Aucun bien à envoyer (lance d'abord le matching, ou précise les biens)." }

  const lines: string[] = []
  for (const id of ids.slice(0, 5)) {
    const { data: ml } = await ctx.supabase.from('market_listings')
      .select('title, transaction_type, price, rent, rent_chf, rooms, surface_m2, city, source_url')
      .eq('id', id).maybeSingle()
    if (ml) { lines.push(formatListing(ml as unknown as ListingRow)); continue }
    const { data: pr } = await ctx.supabase.from('properties')
      .select('title, transaction_type, price, rooms, surface_m2, city')
      .eq('id', id).eq('agency_id', ctx.agencyId).maybeSingle()
    if (pr) lines.push(formatListing(pr as unknown as ListingRow))
  }
  if (!lines.length) return { ok: false, error: 'Les biens indiqués sont introuvables.' }

  const hi = contact.first_name ? `Bonjour ${contact.first_name},` : 'Bonjour,'
  const text = `${hi}\n\nVoici une sélection qui pourrait vous intéresser :\n\n${lines.join('\n\n')}\n\nDites-moi si vous souhaitez visiter l'un de ces biens.`
  const prompt = `Voici ce que je propose d'envoyer à ${contact.first_name ?? 'ce client'} :\n\n${text}\n\nJ'envoie ? (« oui » / « non »)`
  return { ok: true, prompt, payload: { contact_id: contactId, phone: contact.phone.replace(/\D/g, ''), text } }
}

/** Valide + prépare l'enregistrement d'une offre (crm_offers). Le montant est figé au « oui ». */
export async function prepareRecordOffer(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: 'Quel contact a fait l’offre ?' }
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return { ok: false, error: 'Contact introuvable dans votre agence.' }
  const amount = parseAmount(a.amount)
  if (!amount || amount <= 0) return { ok: false, error: 'Montant de l’offre manquant ou invalide.' }
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return { ok: false, error: 'Ce contact n’a pas de dossier ouvert. Crée d’abord le dossier pour y rattacher l’offre.' }
  const fromParty = s(a.from_party) === 'seller' ? 'seller' : s(a.from_party) === 'buyer' ? 'buyer' : deal.party
  const days = typeof a.expires_in_days === 'number' && a.expires_in_days > 0 ? Math.min(a.expires_in_days, 365) : 30
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  const byLabel = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Client'
  const partyFr = fromParty === 'seller' ? 'vendeur' : 'acheteur'
  const prompt = `Je note une offre de ${fmtCHF(amount)} de ${byLabel} (${partyFr}) sur le dossier « ${deal.label} ». Tu confirmes ? (« oui » / « non »)`
  return { ok: true, prompt, payload: { deal_id: deal.id, by_label: byLabel, from_party: fromParty, amount, expires_at: expiresAt, created_by: ctx.profileId } }
}

/** Insère l'offre confirmée dans crm_offers (audit auto via trigger DB). */
export async function executeRecordOffer(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const amount = typeof payload.amount === 'number' ? payload.amount : parseAmount(payload.amount)
  if (!amount || amount <= 0) return 'Montant invalide, offre non enregistrée.'
  const { error } = await ctx.supabase.from('crm_offers').insert({
    agency_id: ctx.agencyId,
    deal_id: s(payload.deal_id),
    kind: 'offer',
    from_party: s(payload.from_party) === 'seller' ? 'seller' : 'buyer',
    by_label: s(payload.by_label) ?? 'Client',
    amount,
    currency: 'CHF',
    conditions: {},
    attachments: [],
    expires_at: s(payload.expires_at) ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
    status: 'pending',
    created_by: s(payload.created_by),
  })
  if (error) return `Erreur enregistrement de l’offre: ${error.message}`
  return `Offre de ${fmtCHF(amount)} enregistrée sur le dossier (statut : en attente).`
}
