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
import { mapCriteria, isSearchable, computeMissing, parseAmount, canonicalPropertyType, normalizeZone } from './whatsapp-lead.ts'
import { PIPELINE_STAGES, isValidStage, stageLabel, deriveDealParty, dealStageDefault, kycScreenLabel, kycDateShort, projectMatchListing, stripExactAddress, portalLabel, normalizePortal, type MatchListingInput, type ResolvedMatchView } from './whatsapp-agent-router.ts'
import { validateIdxProperty, toNum, type IdxProperty } from './idx-mapper.ts'
import { signMagicLinkToken, expiryFromDays } from './magic-link-token.ts'
import { deriveKycType, kycTypeToEntityType, KYC_DOC_PROMPT, parseKycOcr, kycCategoryMaps, type KycPersonType } from './kyc-extract.ts'
import { type WaLang, confirmOpenKyc, openKycResult, pipelineMoved, pipelineAlreadyAt, pipelineNoDeal, pipelineAutoMoved, undoHint } from './whatsapp-i18n.ts'
import { fetchMetaMedia, extFromMime } from './whatsapp-media.ts'
import { meggaProse } from './megga-prose.ts'
import { readDocument, isReadableDocMime } from './vision.ts'
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle } from './agent-style.ts'

export interface ActionCtx {
  supabase: SupabaseClient
  profileId: string
  agencyId: string | null
  // ocrText : texte du document DÉJÀ extrait par le webhook (OCR Gemini fait à la réception).
  // Présent quand l'agent envoie une image/PDF → évite un re-fetch Meta + un 2e OCR côté outil.
  inboundMedia?: { mediaId: string; messageId: string; ocrText?: string | null } | null
  lang?: WaLang
  agentPhone?: string  // numéro WhatsApp de l'agent (pour lui renvoyer un document)
}

type Args = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Garde commune : aucune action si l'agent n'a pas d'agence (évite tout accès hors RLS).
const NO_AGENCY = 'Erreur: ton compte n’est rattaché à aucune agence. Contacte un administrateur.'
function hasAgency(ctx: ActionCtx): boolean {
  return typeof ctx.agencyId === 'string' && ctx.agencyId.length > 0
}

// Embed PostgREST d'une visite : noms de contact + bien RÉSOLUS (FK visits_contact_id_fkey /
// visits_property_id_fkey). On ne renvoie JAMAIS d'UUID brut ni buyer_name (souvent NULL →
// le modèle inventait le client/le bien). Anti-fabrication : ce qui n'est pas résolu = null assumé.
type VisitEmbedRow = {
  scheduled_at: string | null; status: string | null
  contacts: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null
  properties: { title: string | null; address: string | null; city: string | null } | Array<{ title: string | null; address: string | null; city: string | null }> | null
}
function formatAgendaVisit(v: VisitEmbedRow): { quand: string | null; statut: string | null; client: string | null; bien: string | null } {
  // L'embed PostgREST est typé tableau à la compilation mais renvoie un objet (relation to-one).
  const c = Array.isArray(v.contacts) ? (v.contacts[0] ?? null) : v.contacts
  const p = Array.isArray(v.properties) ? (v.properties[0] ?? null) : v.properties
  const client = c ? (`${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim() || null) : null
  const bien = p ? (p.title || [p.address, p.city].filter(Boolean).join(', ') || null) : null
  return { quand: v.scheduled_at, statut: v.status, client, bien }
}
const VISIT_EMBED_SELECT =
  'scheduled_at, status, contacts!visits_contact_id_fkey(first_name, last_name), properties!visits_property_id_fkey(title, address, city)'

export async function execGetMyAgenda(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const from = s(a.from), to = s(a.to)
  if (!from || !to) return 'Erreur: dates from/to requises.'
  const { data, error } = await ctx.supabase
    .from('visits')
    .select(VISIT_EMBED_SELECT)
    .eq('agency_id', ctx.agencyId)
    .eq('agent_id', ctx.profileId)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
    .limit(20)
  if (error) return `Erreur agenda: ${error.message}`
  if (!data?.length) return 'Aucun rendez-vous sur cette période.'
  return JSON.stringify((data as unknown as VisitEmbedRow[]).map(formatAgendaVisit))
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
  const undoOk = await recordAutoUndo(ctx, 'create_contact', { contact_id: data.id })
  const base = `Contact créé: ${data.first_name ?? ''} ${data.last_name ?? ''} (id ${data.id}).`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
}

export async function execAddNote(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), body = s(a.body)
  if (!contactId || !body) return 'Erreur: contact_id et body requis.'
  // Garde-fou agence AU NIVEAU SQL : on ne charge la ligne que si elle appartient
  // à l'agence de l'agent. Pas de match (y compris agency_id NULL) => introuvable.
  const { data: c } = await ctx.supabase
    .from('contacts').select('id, first_name')
    .eq('id', contactId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  if (!c) return 'Erreur: contact introuvable dans votre agence.'
  const ok = await logTimeline(ctx, 'Note ajoutée', body, contactId)
  if (!ok) return "Erreur: impossible d'enregistrer la note."
  // Écho du contact + extrait du body : le modèle a les faits exacts sous la main et n'a plus
  // à deviner le destinataire ni reformuler/inventer le contenu noté (anti-fabrication).
  const who = (c.first_name ?? '').trim() || 'ce contact'
  const extrait = body.length > 80 ? `${body.slice(0, 80)}…` : body
  return `Note ajoutée à la fiche de ${who} : « ${extrait} ».`
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
  const { data: insight } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, intent, sentiment, next_action, commitments, source_message_count, generated_at')
    .eq('contact_id', c.id).eq('agency_id', ctx.agencyId).maybeSingle()
  return JSON.stringify({ contact: c, recherches_actives: searches ?? [], timeline: timeline ?? [], comprehension: insight ?? null })
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

// Résout titre/montant/ville/pièces d'une liste de matches en 2 requêtes BATCH (pas de N+1),
// via le projecteur PUR projectMatchListing (champ absent → omis, jamais inventé). Property
// prioritaire sur market_listing. Partagé par execGetMatches ET execPrepareMeeting.
async function resolveMatchListings(ctx: ActionCtx, matches: MatchListingInput[]): Promise<ResolvedMatchView[]> {
  const propIds = [...new Set(matches.map((m) => m.property_id).filter((x): x is string => !!x))]
  const mlIds = [...new Set(matches.map((m) => m.market_listing_id).filter((x): x is string => !!x))]

  type PropRow = { id: string; title: string | null; price: number | null; city: string | null; rooms: number | null }
  type MlRow = { id: string; title: string | null; transaction_type: string | null; price: number | null; rent: number | null; rent_chf: number | null; city: string | null; rooms: number | null }
  const propMap = new Map<string, PropRow>()
  const mlMap = new Map<string, MlRow>()

  if (propIds.length) {
    const { data } = await ctx.supabase.from('properties')
      .select('id, title, price, city, rooms').in('id', propIds).eq('agency_id', ctx.agencyId)
    for (const p of (data ?? []) as PropRow[]) propMap.set(p.id, p)
  }
  if (mlIds.length) {
    const { data } = await ctx.supabase.from('market_listings')
      .select('id, title, transaction_type, price, rent, rent_chf, city, rooms').in('id', mlIds)
    for (const l of (data ?? []) as MlRow[]) mlMap.set(l.id, l)
  }

  return matches.map((m) =>
    projectMatchListing(
      m,
      m.property_id ? propMap.get(m.property_id) ?? null : null,
      m.market_listing_id ? mlMap.get(m.market_listing_id) ?? null : null,
    ),
  )
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
  // Enrichi (titre/montant/ville/pièces réels) : l'id reste l'UUID du bien (clé pour send_listings),
  // mais il n'est plus SEUL — accompagné des vraies données, le modèle n'a plus à inventer un bien.
  // Un bien non résolu ne porte que id/score/statut (jamais de titre/ville inventés).
  const biens = await resolveMatchListings(ctx, data as MatchListingInput[])
  return JSON.stringify({ biens })
}

/** Briefing du jour : visites du jour de l'agent + nombre de leads à compléter. */
export async function execGetDailyBrief(ctx: ActionCtx, _a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  const end = new Date(); end.setUTCHours(23, 59, 59, 999)
  const { data: visits } = await ctx.supabase
    .from('visits').select(VISIT_EMBED_SELECT)
    .eq('agency_id', ctx.agencyId).eq('agent_id', ctx.profileId)
    .gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true }).limit(20)
  const { data: followups } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name')
    .eq('agency_id', ctx.agencyId).contains('tags', ['à_compléter']).limit(10)
  return JSON.stringify({
    visites_du_jour: ((visits ?? []) as unknown as VisitEmbedRow[]).map(formatAgendaVisit),
    leads_a_completer: followups ?? [],
  })
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
  const { data: visit, error } = await ctx.supabase.from('visits').insert(row).select('id').single()
  if (error) return `Erreur planification: ${error.message}`
  await logTimeline(ctx, 'Visite planifiée', `${propTitle} — ${frDateTime(iso)}`, contactId)
  const undoOk = await recordAutoUndo(ctx, 'schedule_visit', { visit_id: visit.id })
  const base = `Visite planifiée le ${frDateTime(iso)} pour ${buyerName ?? 'le contact'} (bien : ${propTitle}).`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
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
  const { data: reminder, error } = await ctx.supabase.from('reminders').insert({
    agency_id: ctx.agencyId, contact_id: contactId,
    type: 'custom', trigger_rule: 'manual', status: 'pending', channel: 'task',
    trigger_at: iso, message_template: body.slice(0, 500),
  }).select('id').single()
  if (error) return `Erreur rappel: ${error.message}`
  if (contactId) await logTimeline(ctx, 'Rappel créé', `${body.slice(0, 120)} (${frDateTime(iso)})`, contactId)
  const undoOk = await recordAutoUndo(ctx, 'create_reminder', { reminder_id: reminder.id })
  const base = `Rappel noté pour le ${frDateTime(iso)} : « ${body.slice(0, 120)} ».`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
}

/** Déplace le dossier (transaction) d'un contact dans le pipeline. */
export async function execUpdatePipeline(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), stage = s(a.stage)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!stage || !isValidStage(stage)) return `Erreur: étape invalide. Valeurs possibles : ${PIPELINE_STAGES.join(', ')}.`
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return pipelineNoDeal(ctx.lang ?? 'fr')
  const label = stageLabel(stage, ctx.lang ?? 'fr')
  if (deal.stage === stage) return pipelineAlreadyAt(ctx.lang ?? 'fr', deal.label, label)
  // Mouvement via la RPC qui pose le GUC d'attribution (actor 'ai' + via='whatsapp')
  // dans la MÊME transaction que l'UPDATE → le trigger DB trg_transaction_lifecycle
  // émet l'event 'stage_change' en préservant l'attribution MEGGA AI (source unique,
  // plus de double écriture). Audit non bloquant (LBA).
  const { error } = await ctx.supabase.rpc('wa_move_transaction_stage', {
    p_transaction_id: deal.id, p_stage: stage, p_agency_id: ctx.agencyId, p_profile_id: ctx.profileId ?? null,
  })
  if (error) return `Erreur pipeline: ${error.message}`
  return pipelineMoved(ctx.lang ?? 'fr', deal.label, label)
}

const PIPELINE_UNDO_SEC = 60

/** L3 : déplace le pipeline en AUTO et enregistre de quoi défaire (undo 60 s). Renvoie le
 *  message « /annuler ». N'est appelé QUE quand canLeaveConfirm + can_auto_send l'autorisent. */
export async function execUpdatePipelineWithUndo(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), stage = s(a.stage)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!stage || !isValidStage(stage)) return `Erreur: étape invalide. Valeurs possibles : ${PIPELINE_STAGES.join(', ')}.`
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return pipelineNoDeal(ctx.lang ?? 'fr')
  const label = stageLabel(stage, ctx.lang ?? 'fr')
  if (deal.stage === stage) return pipelineAlreadyAt(ctx.lang ?? 'fr', deal.label, label)

  const oldStage = deal.stage // capté AVANT l'update pour le rollback
  // Mouvement via la RPC (GUC actor 'ai' + via='whatsapp') → le trigger DB émet
  // 'stage_change' en préservant l'attribution MEGGA AI (source unique). Le
  // caractère 'auto' (L3 réversible) reste tracé par whatsapp_recent_auto_actions ci-dessous.
  const { error } = await ctx.supabase.rpc('wa_move_transaction_stage', {
    p_transaction_id: deal.id, p_stage: stage, p_agency_id: ctx.agencyId, p_profile_id: ctx.profileId ?? null,
  })
  if (error) return `Erreur pipeline: ${error.message}`

  // Enregistre l'undo (payload = quoi défaire + jusqu'à quand).
  const { error: undoErr } = await ctx.supabase.from('whatsapp_recent_auto_actions').insert({
    profile_id: ctx.profileId, agency_id: ctx.agencyId, tool: 'update_pipeline',
    payload_undo: { transaction_id: deal.id, old_stage: oldStage },
    undo_until: new Date(Date.now() + PIPELINE_UNDO_SEC * 1000).toISOString(),
  })
  // Promesse honnête : si l'undo n'a pas pu être enregistré, ne pas annoncer « /annuler ».
  if (undoErr) {
    console.error('pipeline undo record failed')
    return pipelineMoved(ctx.lang ?? 'fr', deal.label, label)
  }
  return pipelineAutoMoved(ctx.lang ?? 'fr', deal.label, label)
}

const AUTO_UNDO_SEC = 30

/** L3b : enregistre de quoi DÉFAIRE une action auto réversible (fenêtre 30 s). Renvoie true
 *  si l'undo est bien enregistré (→ on peut promettre /annuler honnêtement), false sinon. */
export async function recordAutoUndo(
  ctx: ActionCtx, tool: string, payloadUndo: Record<string, unknown>, seconds = AUTO_UNDO_SEC,
): Promise<boolean> {
  if (!ctx.agencyId) return false
  const { error } = await ctx.supabase.from('whatsapp_recent_auto_actions').insert({
    profile_id: ctx.profileId, agency_id: ctx.agencyId, tool,
    payload_undo: payloadUndo,
    undo_until: new Date(Date.now() + seconds * 1000).toISOString(),
  })
  if (error) { console.error('recordAutoUndo failed:', (error.message ?? 'error').slice(0, 120)); return false }
  return true
}

/** Qualifie un contact existant : critères structurés → search_criteria + matching auto.
 *  Réutilise la logique pure 4B (mêmes normalisations zones/types que la qualif autonome). */
export async function execQualifyLead(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const { data } = await ctx.supabase
    .from('contacts').select('id, phone, email, tags, search_criteria')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const c = data as { id: string; phone: string | null; email: string | null; tags: string[] | null; search_criteria: unknown } | null
  if (!c) return 'Erreur: contact introuvable dans votre agence.'
  const oldTags = Array.isArray(c.tags) ? c.tags : []      // capté AVANT l'update
  const oldCriteria = c.search_criteria ?? null             // capté AVANT l'update

  let zones: string[] | undefined
  if (Array.isArray(a.zones)) zones = (a.zones as unknown[]).filter((z): z is string => typeof z === 'string' && z.trim().length > 0)
  else if (typeof a.zones === 'string' && a.zones.trim()) zones = a.zones.split(',').map((z) => z.trim()).filter(Boolean)

  const txType = s(a.transaction_type)
  const intent = txType === 'rent' ? 'recherche_location' : txType === 'buy' ? 'recherche_achat' : null
  const criteria = mapCriteria(intent, { type: s(a.property_type) ?? undefined, zones, budget: a.budget_max, pieces: a.rooms_min }, '')

  const missing = computeMissing(criteria, { phone: c.phone, email: c.email })
  const newTags = Array.from(new Set([...oldTags, 'whatsapp_ai_qualified', ...(missing.length ? ['à_compléter'] : [])]))
  const { error: uErr } = await ctx.supabase.from('contacts')
    .update({ tags: newTags, search_criteria: criteria }).eq('id', contactId).eq('agency_id', ctx.agencyId)
  if (uErr) return `Erreur qualification: ${uErr.message}`

  let searchCreated = false
  let createdSearchId: string | null = null
  if (isSearchable(criteria)) {
    const { data: existing } = await ctx.supabase.from('client_searches')
      .select('id').eq('contact_id', contactId).eq('is_active', true).limit(1).maybeSingle()
    if (!existing) {
      const { data: cs } = await ctx.supabase.from('client_searches').insert({
        agency_id: ctx.agencyId, contact_id: contactId,
        label: `WhatsApp — ${criteria.transaction_type === 'rent' ? 'location' : 'achat'}`,
        criteria, is_active: true,
      }).select('id').single()
      createdSearchId = cs?.id ?? null
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
  const undoOk = await recordAutoUndo(ctx, 'qualify_lead', {
    contact_id: contactId, old_tags: oldTags, old_search_criteria: oldCriteria, created_search_id: createdSearchId,
  })
  if (undoOk) parts.push(undoHint(ctx.lang ?? 'fr').trim())
  return parts.join(' ')
}

/** Ouvre un dossier (transaction) pour un contact, à une étape de départ.
 *  Tier auto : état CRM interne réversible (status annulable). Débloque record_offer /
 *  update_pipeline qui exigent un dossier. Dédup : refuse si un dossier ACTIF existe déjà. */
export async function execCreateDeal(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const { data: cRow } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name, type')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as { id: string; first_name: string | null; last_name: string | null; type: string | null } | null
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  // Dédup : un dossier ACTIF déjà ouvert pour ce contact (acheteur OU vendeur) ?
  const { data: existing } = await ctx.supabase
    .from('transactions').select('id, stage')
    .eq('agency_id', ctx.agencyId).eq('status', 'active')
    .or(`contact_buyer_id.eq.${contactId},contact_seller_id.eq.${contactId}`)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) {
    const st = stageLabel((existing as { stage: string }).stage, ctx.lang ?? 'fr')
    return `${name} a déjà un dossier ouvert (${st}). Je n'en crée pas un second.`
  }

  const party = deriveDealParty(contact.type, s(a.party))
  const wanted = s(a.stage)
  const stage = wanted && isValidStage(wanted) ? wanted : dealStageDefault(party)

  // property_id optionnel : si fourni, doit appartenir à l'agence (garde SQL).
  let propertyId: string | null = null
  const pid = s(a.property_id)
  if (pid) {
    const { data: prop } = await ctx.supabase
      .from('properties').select('id').eq('id', pid).eq('agency_id', ctx.agencyId).maybeSingle()
    if (!prop) return 'Erreur: bien introuvable dans votre agence.'
    propertyId = pid
  }

  const row: Record<string, unknown> = {
    agency_id: ctx.agencyId, assigned_to: ctx.profileId, stage, status: 'active',
    [party === 'seller' ? 'contact_seller_id' : 'contact_buyer_id']: contactId,
  }
  if (propertyId) row.property_id = propertyId
  const { error } = await ctx.supabase.from('transactions').insert(row)
  if (error) return `Erreur ouverture du dossier: ${error.message}`

  const label = stageLabel(stage, ctx.lang ?? 'fr')
  const partyFr = party === 'seller' ? 'vendeur' : 'acheteur'
  await logTimeline(ctx, 'Dossier ouvert', `${partyFr === 'vendeur' ? 'Vendeur' : 'Acheteur'} — ${label} (via WhatsApp)`, contactId)
  return `Dossier ouvert pour ${name} (${partyFr}, étape ${label}). Tu peux maintenant enregistrer une offre ou faire avancer le pipeline.`
}

// ── search_listings (tier read) : recherche d'annonces sur le marché ─────────
type SearchListingRow = {
  id: string; title: string | null; transaction_type: string | null
  price: number | null; rent: number | null; rent_chf: number | null
  rooms: number | null; surface_m2: number | null; city: string | null; canton: string | null; source_url: string | null
}

/** Montant pertinent d'une annonce : loyer si location, prix sinon. */
function listingAmount(l: { transaction_type: string | null; price: number | null; rent?: number | null; rent_chf?: number | null }): number {
  return l.transaction_type === 'rent' ? (l.rent_chf ?? l.rent ?? l.price ?? 0) : (l.price ?? 0)
}

/** Recherche d'annonces (market_listings). Perf-safe : eq(status)+eq(transaction_type) sur
 *  index, tri quality_score (indexé, pas de sort full table). Renvoie le total ESTIMÉ
 *  (count: 'estimated', sans scan complet — conforme CLAUDE.md §7, jamais 'exact') reflétant
 *  les filtres et ignorant le .limit, plus un échantillon de 6 biens. Budget filtré EN SQL
 *  sur `price` (loyer réel des actifs rent ; rent/rent_chf sont NULL en base). */
export async function execSearchListings(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const txType = s(a.transaction_type) === 'buy' ? 'buy' : 'rent'

  let q = ctx.supabase
    .from('market_listings')
    .select('id, title, transaction_type, price, rent, rent_chf, rooms, surface_m2, city, canton, source_url', { count: 'estimated' })
    .eq('status', 'active')
    .eq('transaction_type', txType)

  const type = canonicalPropertyType(s(a.property_type))
  if (type) q = q.eq('type', type)

  const roomsMin = typeof a.rooms_min === 'number' ? a.rooms_min : parseFloat(String(a.rooms_min ?? ''))
  if (Number.isFinite(roomsMin) && roomsMin > 0) q = q.gte('rooms', roomsMin)

  // Budget EN SQL sur `price` : pour les actifs rent, le loyer mensuel est stocké dans `price`
  // (rent/rent_chf NULL en base) ; pour buy c'est le prix de vente. Filtre indexé, pas en mémoire.
  const budget = parseAmount(a.budget_max)
  // .gt('price', 0) : un budget exclut les biens « loyer sur demande » (price=0) — sinon ils
  // gonfleraient le total et sortiraient avec un montant null (préserve l'ancienne sémantique amt>0).
  if (budget && budget > 0) q = q.lte('price', budget).gt('price', 0)

  // Zones : OR d'ilike sur city/canton (matche n'importe laquelle). Neutralise les
  // caractères qui casseraient le filtre PostgREST .or(). Max 5 zones (anti-abus).
  let zones: string[] = []
  if (Array.isArray(a.zones)) zones = (a.zones as unknown[]).filter((z): z is string => typeof z === 'string' && z.trim().length > 0)
  else if (typeof a.zones === 'string' && a.zones.trim()) zones = a.zones.split(',').map((z) => z.trim()).filter(Boolean)
  const safeZones = zones.map((z) => normalizeZone(z).replace(/[,()%*]/g, ' ').trim()).filter(Boolean).slice(0, 5)
  if (safeZones.length) {
    q = q.or(safeZones.flatMap((z) => [`city.ilike.%${z}%`, `canton.ilike.%${z}%`]).join(','))
  }

  q = q.order('quality_score', { ascending: false, nullsFirst: false }).limit(24)
  const { data, count, error } = await q
  if (error) return `Erreur recherche de biens: ${error.message}`
  const rows = (data ?? []) as SearchListingRow[]
  if (!rows.length) return 'Aucun bien ne correspond à ces critères pour le moment.'

  const biens = rows.slice(0, 6).map((r) => ({
    id: r.id, titre: r.title, type: txType === 'rent' ? 'location' : 'achat',
    montant: listingAmount(r) || null, pieces: r.rooms,
    m2: r.surface_m2 ? Math.round(r.surface_m2) : null, ville: r.city, canton: r.canton, url: r.source_url,
  }))
  // total = count estimé (reflète les filtres, ignore le .limit) ; garde-fou : au moins l'échantillon affiché.
  const total = (typeof count === 'number' && count >= biens.length) ? count : biens.length
  return JSON.stringify({ total, shown: biens.length, biens })
}

/** État du dossier KYC d'un contact (lecture). KYC FACULTATIF : aucun dossier ≠ blocage. */
export async function execGetKycStatus(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const { data: kcRow } = await ctx.supabase
    .from('kyc_cases')
    .select('id, dossier_status, vigilance, risk_level, completion_pct, pep_status, sanctions_status, last_screening_at, validated_at')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!kcRow) return `Pas de dossier KYC pour ${name}. Le KYC est facultatif — dis-moi si tu veux en ouvrir un.`
  const k = kcRow as {
    id: string; dossier_status: string | null; vigilance: string | null; risk_level: string | null
    completion_pct: number | null; pep_status: string | null; sanctions_status: string | null
    last_screening_at: string | null; validated_at: string | null
  }

  const { data: items } = await ctx.supabase
    .from('kyc_checklist_items').select('is_required, is_completed, document_id').eq('kyc_case_id', k.id)
  const list = (items ?? []) as Array<{ is_required: boolean; is_completed: boolean; document_id: string | null }>
  const pieces = {
    requises: list.filter((i) => i.is_required).length,
    fournies: list.filter((i) => i.document_id).length,
    validees: list.filter((i) => i.is_completed).length,
  }
  return JSON.stringify({
    contact: name,
    statut_dossier: k.dossier_status, vigilance: k.vigilance, risque: k.risk_level,
    avancement_pct: k.completion_pct,
    // Libellés HUMAINS, jamais l'enum brut : 'not_checked' devient « non vérifié », distinct de
    // 'clear' (« rien à signaler ») → le modèle ne peut plus confondre absence de contrôle et RAS (LBA).
    screening: {
      pep: kycScreenLabel(k.pep_status, k.last_screening_at),
      sanctions: kycScreenLabel(k.sanctions_status, k.last_screening_at),
      dernier: kycDateShort(k.last_screening_at) || 'aucun',
    },
    validation: k.validated_at ? 'validé' : 'non validé (validation manuelle par le responsable conformité)',
    pieces,
    note: 'KYC facultatif ; la validation des pièces reste manuelle (jamais par l’IA).',
  })
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

function formatListing(l: ListingRow, lang: WaLang = 'fr'): string {
  const amount = l.transaction_type === 'rent' ? (l.rent_chf ?? l.rent ?? l.price ?? 0) : (l.price ?? 0)
  const perMonth = lang === 'en' ? '/mo' : '/mois'
  const onReq = lang === 'en' ? 'price on request' : 'prix sur demande'
  const price = amount ? (l.transaction_type === 'rent' ? `${fmtCHF(amount)}${perMonth}` : fmtCHF(amount)) : onReq
  const roomsU = lang === 'en' ? 'rm' : 'p.'
  const facts = [l.rooms ? `${l.rooms} ${roomsU}` : null, l.surface_m2 ? `${Math.round(l.surface_m2)} m²` : null, l.city]
    .filter(Boolean).join(' · ')
  let line = `• ${l.title ?? (lang === 'en' ? 'Property' : 'Bien')} — ${price}${facts ? ` (${facts})` : ''}`
  if (l.source_url) line += `\n  ${l.source_url}`
  return line
}

/** Prépare le message « sélection de biens » à partir de VRAIES données (jamais halluciné).
 *  Biens = listing_ids fournis, sinon top correspondances du contact. */
export async function prepareSendListings(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: lang === 'en' ? 'Which client should I send listings to?' : 'Pour quel client veux-tu envoyer des biens ?' }
  const { data: cRow } = await ctx.supabase.from('contacts')
    .select('first_name, phone').eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as { first_name: string | null; phone: string | null } | null
  if (!contact) return { ok: false, error: lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.' }
  if (!contact.phone) return { ok: false, error: lang === 'en' ? "This contact has no WhatsApp number, I can't message them." : "Ce contact n'a pas de numéro WhatsApp, je ne peux pas lui écrire." }

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
  if (!ids.length) return { ok: false, error: lang === 'en' ? 'No listing to send (run matching first, or specify the listings).' : "Aucun bien à envoyer (lance d'abord le matching, ou précise les biens)." }

  const lines: string[] = []
  for (const id of ids.slice(0, 5)) {
    const { data: ml } = await ctx.supabase.from('market_listings')
      .select('title, transaction_type, price, rent, rent_chf, rooms, surface_m2, city, source_url')
      .eq('id', id).maybeSingle()
    if (ml) { lines.push(formatListing(ml as unknown as ListingRow, lang)); continue }
    const { data: pr } = await ctx.supabase.from('properties')
      .select('title, transaction_type, price, rooms, surface_m2, city')
      .eq('id', id).eq('agency_id', ctx.agencyId).maybeSingle()
    if (pr) lines.push(formatListing(pr as unknown as ListingRow, lang))
  }
  if (!lines.length) return { ok: false, error: lang === 'en' ? 'The specified listings were not found.' : 'Les biens indiqués sont introuvables.' }

  // Message destiné au CLIENT (WYSIWYG) : rédigé dans la langue de travail de l'agent.
  const hi = contact.first_name
    ? (lang === 'en' ? `Hello ${contact.first_name},` : `Bonjour ${contact.first_name},`)
    : (lang === 'en' ? 'Hello,' : 'Bonjour,')
  const text = lang === 'en'
    ? `${hi}\n\nHere is a selection that might interest you:\n\n${lines.join('\n\n')}\n\nLet me know if you'd like to visit any of these.`
    : `${hi}\n\nVoici une sélection qui pourrait vous intéresser :\n\n${lines.join('\n\n')}\n\nDites-moi si vous souhaitez visiter l'un de ces biens.`
  const who = contact.first_name ?? (lang === 'en' ? 'this client' : 'ce client')
  const prompt = lang === 'en'
    ? `Here's what I'd send to ${who}:\n\n${text}\n\nSend it? ("yes" / "no")`
    : `Voici ce que je propose d'envoyer à ${who} :\n\n${text}\n\nJ'envoie ? (« oui » / « non »)`
  // listing_ids figés dans le payload → permettent, à l'envoi confirmé, de marquer
  // les matches correspondants comme 'sent' (capture de sent_at, instrumentation).
  return { ok: true, prompt, payload: { contact_id: contactId, phone: contact.phone.replace(/\D/g, ''), text, listing_ids: ids.slice(0, 5) } }
}

/** Valide + prépare l'enregistrement d'une offre (crm_offers). Le montant est figé au « oui ». */
export async function prepareRecordOffer(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: lang === 'en' ? 'Which contact made the offer?' : 'Quel contact a fait l’offre ?' }
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return { ok: false, error: lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.' }
  const amount = parseAmount(a.amount)
  if (!amount || amount <= 0) return { ok: false, error: lang === 'en' ? 'Offer amount missing or invalid.' : 'Montant de l’offre manquant ou invalide.' }
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return { ok: false, error: lang === 'en' ? 'This contact has no open deal. Open a deal first to attach the offer.' : 'Ce contact n’a pas de dossier ouvert. Crée d’abord le dossier pour y rattacher l’offre.' }
  const fromParty = s(a.from_party) === 'seller' ? 'seller' : s(a.from_party) === 'buyer' ? 'buyer' : deal.party
  const days = typeof a.expires_in_days === 'number' && a.expires_in_days > 0 ? Math.min(a.expires_in_days, 365) : 30
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  const byLabel = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Client'
  const partyLabel = fromParty === 'seller' ? (lang === 'en' ? 'seller' : 'vendeur') : (lang === 'en' ? 'buyer' : 'acheteur')
  const prompt = lang === 'en'
    ? `I'll record an offer of ${fmtCHF(amount)} from ${byLabel} (${partyLabel}) on the deal "${deal.label}". Confirm? ("yes" / "no")`
    : `Je note une offre de ${fmtCHF(amount)} de ${byLabel} (${partyLabel}) sur le dossier « ${deal.label} ». Tu confirmes ? (« oui » / « non »)`
  return { ok: true, prompt, payload: { deal_id: deal.id, by_label: byLabel, from_party: fromParty, amount, expires_at: expiresAt, created_by: ctx.profileId } }
}

/** Insère l'offre confirmée dans crm_offers (audit auto via trigger DB). */
export async function executeRecordOffer(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const amount = typeof payload.amount === 'number' ? payload.amount : parseAmount(payload.amount)
  if (!amount || amount <= 0) return lang === 'en' ? 'Invalid amount, offer not recorded.' : 'Montant invalide, offre non enregistrée.'
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
  if (error) return (lang === 'en' ? 'Error recording the offer: ' : 'Erreur enregistrement de l’offre: ') + error.message
  return lang === 'en'
    ? `Offer of ${fmtCHF(amount)} recorded on the deal (status: pending).`
    : `Offre de ${fmtCHF(amount)} enregistrée sur le dossier (statut : en attente).`
}

// -- KYC par WhatsApp (Task 4) : open_kyc_case (tier confirm) -----------------

/** Confirm-tier : valide le contact + dérive le typage, construit le prompt + payload figé. */
export async function prepareOpenKycCase(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: 'Erreur: contact_id requis (via search_contacts).' }
  const { data: contact } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name, type, entity_type')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!contact) return { ok: false, error: 'Erreur: contact introuvable dans votre agence.' }

  const vigilance = a.vigilance === 'renforced' ? 'renforced' : 'standard'
  const entity = a.entity === 'pm' ? 'pm' : a.entity === 'pp' ? 'pp' : (contact.entity_type ?? 'pp')
  const type = deriveKycType(contact.type, entity)
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  // Dédup : si un dossier KYC ACTIF (none/pending) existe déjà pour ce contact, on n'en
  // ouvre pas un second (évite les doublons côté MLRO). On laisse rouvrir si le dernier
  // dossier est verified/stale/failed (renouvellement légitime).
  const existing = await findOpenKycCase(ctx, contactId)
  if (existing && (existing.dossier_status === 'none' || existing.dossier_status === 'pending')) {
    return {
      ok: false,
      error: ctx.lang === 'en'
        ? `${name} already has an open KYC file — no need to open another.`
        : `${name} a déjà un dossier KYC ouvert — inutile d'en ouvrir un second.`,
    }
  }

  return {
    ok: true,
    prompt: confirmOpenKyc(ctx.lang ?? 'fr', name, type, vigilance),
    payload: { contact_id: contactId, type, vigilance },
  }
}

/** Post-« oui » : INSERT kyc_cases (le trigger seed_kyc_lba_checks crée les 5 checks). */
export async function executeOpenKycCase(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), type = s(a.type), vigilance = s(a.vigilance) ?? 'standard'
  if (!contactId || !type) return 'Action incomplète, dossier non créé.'
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'

  const { error } = await ctx.supabase.from('kyc_cases').insert({
    agency_id: ctx.agencyId,
    contact_id: contactId,
    type,
    vigilance,
    risk_level: vigilance === 'renforced' ? 'medium' : 'low',
  })
  if (error) return `Erreur ouverture KYC: ${error.message}`

  await logTimeline(ctx, 'Dossier KYC ouvert', 'via WhatsApp', contactId)
  return openKycResult(ctx.lang ?? 'fr', vigilance)
}

// -- KYC par WhatsApp (Task 5) : run_kyc_screening (tier auto) -----------------

/** Dernier dossier KYC d'un contact dans l'agence (ou null). */
async function findOpenKycCase(
  ctx: ActionCtx, contactId: string,
): Promise<{ id: string; type: KycPersonType; dossier_status: string } | null> {
  const { data } = await ctx.supabase
    .from('kyc_cases').select('id, type, dossier_status')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as { id: string; type: KycPersonType; dossier_status: string } | null) ?? null
}

export async function execRunKycScreening(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Tu veux que j'en ouvre un ?`

  // Verrou anti-double-screening : claim atomique sur screening_started_at (PAS
  // last_screening_at — l'edge kyc-screening renvoie 429 si last_screening_at < 60s,
  // donc le réutiliser ici auto-bloquerait chaque screening). 0 ligne = déjà en cours.
  const staleIso = new Date(Date.now() - 120_000).toISOString()
  const { data: lock } = await ctx.supabase
    .from('kyc_cases')
    .update({ screening_status: 'running', screening_started_at: new Date().toISOString() })
    .eq('id', kc.id)
    .or(`screening_status.is.null,screening_status.eq.failed,screening_started_at.lt.${staleIso}`)
    .select('id')
    .maybeSingle()
  if (!lock) {
    return `Le screening de ${name} tourne déjà, je te donne le résultat dès qu'il est prêt.`
  }

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kyc-screening`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        kyc_case_id: kc.id,
        entity_type: kycTypeToEntityType(kc.type),
        agency_id: ctx.agencyId,
      }),
      signal: AbortSignal.timeout(50_000),
    })
  } catch (e) {
    await ctx.supabase.from('kyc_cases').update({ screening_status: 'failed' }).eq('id', kc.id)
    const n = (e as Error)?.name
    if (n === 'TimeoutError' || n === 'AbortError') {
      // §2.4 : message DÉTERMINISTE — ne plus dire "il a peut-être abouti" (incitait à relancer = double crédit).
      return 'Le screening tourne, je te donne le résultat dès qu\'il est prêt.'
    }
    return 'Le screening a échoué (réseau). Réessaie dans un instant.'
  }
  if (res.status === 429) {
    await ctx.supabase.from('kyc_cases').update({ screening_status: 'failed' }).eq('id', kc.id)
    return 'Screening déjà lancé il y a quelques secondes — patiente un instant avant de relancer.'
  }
  if (!res.ok) {
    await ctx.supabase.from('kyc_cases').update({ screening_status: 'failed' }).eq('id', kc.id)
    return `Le screening n'a pas pu aboutir (code ${res.status}).`
  }
  const r = (await res.json().catch(() => ({}))) as {
    pep_status?: string; sanctions_status?: string; risk_level?: string
  }
  const pep = r.pep_status === 'match' ? 'PEP détecté ⚠️' : 'pas de PEP'
  const sanc = r.sanctions_status === 'match' ? 'correspondance sanctions ⚠️' : 'pas de sanction'
  const riskFr: Record<string, string> = { low: 'faible', medium: 'moyen', high: 'élevé' }
  const risk = riskFr[r.risk_level ?? ''] ?? r.risk_level ?? '—'
  await ctx.supabase.from('kyc_cases').update({ screening_status: 'done' }).eq('id', kc.id)
  return `Screening de ${name} : ${pep}, ${sanc}, risque ${risk}. Le dossier est prêt à valider dans le CRM (à toi de cocher les pièces et valider — je ne valide jamais à ta place).`
}

// -- KYC par WhatsApp : send_kyc_report (tier auto) ---------------------------
// Génère le PDF officiel du dossier (via l'edge kyc-report-pdf : CF Browser
// Rendering du template CRM) et l'envoie en DOCUMENT à l'agent lui-même.
// Lecture seule du dossier (règle d'or). Générable à TOUT stade (décision Q6).

export async function execSendKycReport(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const toPhone = (ctx.agentPhone ?? '').replace(/\D/g, '')
  if (!toPhone) return "Erreur: je n'ai pas ton numéro WhatsApp pour t'envoyer le PDF."

  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Tu veux que j'en ouvre un ?`

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kyc-report-pdf`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        kyc_case_id: kc.id,
        agency_id: ctx.agencyId,
        profile_id: ctx.profileId,
        to_phone: toPhone,
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    const n = (e as Error)?.name
    if (n === 'TimeoutError' || n === 'AbortError') {
      return 'La génération du rapport prend plus de temps que prévu — réessaie dans un instant.'
    }
    return "L'envoi du rapport a échoué (réseau). Réessaie dans un instant."
  }
  if (!res.ok) return `Je n'ai pas pu générer le rapport (code ${res.status}). Réessaie dans un instant.`
  return `Rapport KYC de ${name} envoyé en pièce jointe (PDF). Tu le reçois dans la conversation.`
}

// -- KYC par WhatsApp (Task 6) : attach_kyc_document (tier auto) -----------------

export async function execAttachKycDocument(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), category = s(a.category)
  if (!contactId || !category) return 'Erreur: contact_id et category requis.'
  const maps = kycCategoryMaps(category)
  if (!maps) return 'Erreur: catégorie invalide (identity, address ou funds).'
  if (!ctx.inboundMedia) return 'Je ne vois pas de document dans ce message. Envoie-moi la pièce (photo ou PDF) avec ta consigne.'

  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Ouvre-le d'abord (« ouvre un KYC pour ${name} »).`

  // 1. Re-fetch des bytes (le webhook les a lâchés après l'OCR générique) + OCR structuré KYC.
  let bytes: Uint8Array, mime: string | null
  try {
    const media = await fetchMetaMedia(ctx.inboundMedia.mediaId, {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
      apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    })
    bytes = media.bytes; mime = media.mime
  } catch {
    return 'Je n’ai pas pu récupérer le document (lien Meta expiré ?). Renvoie-le.'
  }

  // Validation AVANT OCR/upload (parité avec magic-link-upload) : type lisible + taille.
  // Sinon on gaspille un OCR et, pour >10 Mo, on crée une row documents (rétention 10 ans,
  // non supprimable) AVANT que l'insert kyc_magic_link_uploads échoue sur son CHECK taille.
  const MAX_KYC_BYTES = 10 * 1024 * 1024
  if (!isReadableDocMime(mime)) return 'Ce type de fichier n’est pas accepté pour un document KYC (PDF ou image uniquement).'
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_KYC_BYTES) return 'Le document dépasse la taille maximale (10 Mo). Compresse-le ou prends-le en photo.'

  const ocr = await readDocument(bytes, mime, Deno.env.get('GEMINI_API_KEY') ?? '', { prompt: KYC_DOC_PROMPT })
  const ocrFields = ocr.ok ? parseKycOcr(ocr.text) : {}

  // 2. Upload Storage (bucket privé kyc-magic-link, même que le canal magic link)
  const ext = extFromMime(mime)
  const path = `${ctx.agencyId}/${kc.id}/${ctx.inboundMedia.messageId}.${ext}`
  const { error: upErr } = await ctx.supabase.storage
    .from('kyc-magic-link')
    .upload(path, bytes, { contentType: mime ?? 'application/octet-stream', upsert: true })
  if (upErr) return `Erreur de stockage de la pièce: ${upErr.message}`

  // 3. SHA-256 (preuve d'intégrité FINMA). Cast nécessaire : le typage Deno de
  // Uint8Array<ArrayBuffer> ne s'assigne pas directement à BufferSource ici.
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')

  // 4. Row documents (canonique, kyc_case_id → rétention 10 ans auto via trigger)
  const filename = `${category}_${ctx.inboundMedia.messageId}.${ext}`.slice(0, 255)
  const { data: docRow, error: docErr } = await ctx.supabase.from('documents').insert({
    agency_id: ctx.agencyId,
    kyc_case_id: kc.id,
    name: filename,
    type: `kyc_${category}`,
    storage_path: path,
    size_bytes: bytes.byteLength,
    status: 'available',
    document_category: maps.document,
    sha256_hash: sha256,
    uploaded_by: null,
  }).select('id').single()
  if (docErr) {
    await ctx.supabase.storage.from('kyc-magic-link').remove([path])
    return `Erreur d'enregistrement du document: ${docErr.message}`
  }

  // 5. Row kyc_magic_link_uploads (canal whatsapp + OCR). NB : pas de dédup cross-turn sur
  // (kyc_case_id, wa_message_id) — re-joindre le même message dans un tour ultérieur recrée
  // une ligne (et un doc). Acceptable v1 (action rare ; on ne perd jamais une trace).
  const { error: upRowErr } = await ctx.supabase.from('kyc_magic_link_uploads').insert({
    agency_id: ctx.agencyId,
    kyc_case_id: kc.id,
    source: 'whatsapp',
    wa_message_id: ctx.inboundMedia.messageId,
    type: maps.upload,
    filename,
    size_bytes: bytes.byteLength,
    mime_type: mime,
    storage_path: path,
    sha256_hash: sha256,
    ocr_fields: ocrFields,
    ocr_provider: 'gemini',
    ocr_completed_at: ocr.ok ? new Date().toISOString() : null,
    document_id: docRow.id,
  })
  if (upRowErr) console.error('kyc attach upload row failed:', upRowErr.message)

  // 6. Lier la pièce à l'item de checklist (document_id) — JAMAIS is_completed (D2 : réservé MLRO).
  // La pièce reste rattachée au dossier via documents.kyc_case_id même si aucun item ne matche.
  const { data: linkedItems, error: linkErr } = await ctx.supabase.from('kyc_checklist_items')
    .update({ document_id: docRow.id })
    .eq('kyc_case_id', kc.id).eq('category', maps.checklist)
    .select('id')
  if (linkErr) console.error('kyc attach checklist link failed:', linkErr.message)
  else if (!linkedItems?.length) console.warn(`kyc attach: aucun item checklist '${maps.checklist}' pour ce dossier`)

  // 7. Audit IA (actor_kind='ai', actor_id NULL ; agent en metadata)
  const { error: auditErr } = await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'kyc_document_attached', entity_type: 'kyc_case', entity_id: kc.id,
    category: 'kyc', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId, contact_id: contactId, category, document_id: docRow.id },
  })
  if (auditErr) console.error('kyc attach audit failed')

  // 8. Restituer ce qui a été lu (humain, jamais d'ID brut)
  const read = summarizeKycOcr(ocrFields)
  const catLabel = category === 'identity' ? 'pièce d’identité' : category === 'address' ? 'justificatif de domicile' : 'justificatif de fonds'
  return `${catLabel.charAt(0).toUpperCase() + catLabel.slice(1)} de ${name} jointe au dossier${read ? ` — ${read}` : ''}. (Je ne coche pas la case : c'est à toi de valider dans le CRM.)`
}

/** Résumé humain des champs OCR (best-effort, jamais d'erreur). */
function summarizeKycOcr(f: Record<string, unknown>): string {
  const parts: string[] = []
  const get = (k: string) => (typeof f[k] === 'string' && (f[k] as string).trim() ? (f[k] as string).trim() : null)
  const nom = [get('prenom'), get('nom')].filter(Boolean).join(' ')
  if (nom) parts.push(nom)
  if (get('numero')) parts.push(`n° ${get('numero')}`)
  if (get('expiration')) parts.push(`expire ${get('expiration')}`)
  if (get('montant')) parts.push(`${get('montant')} ${get('devise') ?? ''}`.trim())
  if (get('adresse')) parts.push(get('adresse')!)
  return parts.join(', ')
}

// ── send_kyc_link (tier confirm) : lien d'upload KYC envoyé au client par email ──
// KYC FACULTATIF : un assist, jamais un blocage. magic-link-create exige un JWT agent
// (indisponible en service-role) → on reproduit sa logique ici en réutilisant les
// helpers de token signés partagés, puis on délègue l'email à magic-link-send-email
// (qui, lui, accepte le service-role). Aucune case cochée, aucune validation : MLRO.

/** Confirm-tier : valide (contact + email + dossier KYC ouvert), construit le prompt. */
export async function prepareSendKycLink(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: lang === 'en' ? 'Which contact should I send the KYC link to?' : 'À quel contact veux-tu envoyer le lien KYC ?' }
  const { data: cRow } = await ctx.supabase
    .from('contacts').select('first_name, last_name, email').eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as { first_name: string | null; last_name: string | null; email: string | null } | null
  if (!contact) return { ok: false, error: lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.' }
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || (lang === 'en' ? 'this contact' : 'ce contact')
  if (!contact.email) {
    return { ok: false, error: lang === 'en'
      ? `${name} has no email — I can't send the KYC link (KYC is optional anyway). Add an email first.`
      : `${name} n'a pas d'email — je ne peux pas envoyer le lien KYC (le KYC reste facultatif). Ajoute un email d'abord.` }
  }
  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) {
    return { ok: false, error: lang === 'en'
      ? `No KYC file for ${name} yet. KYC is optional — open one first if you want to send the link.`
      : `Pas de dossier KYC pour ${name}. Le KYC est facultatif — ouvre-en un d'abord si tu veux envoyer le lien.` }
  }
  if (kc.dossier_status === 'verified') {
    return { ok: false, error: lang === 'en'
      ? `${name}'s KYC is already verified — no need to send the link.`
      : `Le KYC de ${name} est déjà vérifié — pas besoin d'envoyer le lien.` }
  }
  const prompt = lang === 'en'
    ? `Send ${name} the secure link to upload their KYC documents by email (${contact.email})? It's optional. ("yes" / "no")`
    : `J'envoie à ${name} le lien sécurisé pour déposer ses pièces KYC par email (${contact.email}) ? C'est facultatif. (« oui » / « non »)`
  return { ok: true, prompt, payload: { contact_id: contactId, kyc_case_id: kc.id } }
}

/** Post-« oui » : crée le lien magique (insert + token signé) puis déclenche l'email. */
export async function executeSendKycLink(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const contactId = s(payload.contact_id), kycCaseId = s(payload.kyc_case_id)
  if (!contactId || !kycCaseId) return lang === 'en' ? 'Incomplete action, link not sent.' : 'Action incomplète, lien non envoyé.'

  // Re-validation (l'état a pu changer entre la préparation et le « oui »).
  const { data: cRow } = await ctx.supabase
    .from('contacts').select('first_name, email').eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as { first_name: string | null; email: string | null } | null
  if (!contact) return lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.'
  if (!contact.email) return lang === 'en' ? "This contact has no email — link not sent." : "Ce contact n'a pas d'email — lien non envoyé."
  const first = (contact.first_name ?? '').trim() || (lang === 'en' ? 'the contact' : 'le contact')
  // Le dossier doit appartenir à l'agence ET au contact (anti-confusion).
  const { data: kc } = await ctx.supabase
    .from('kyc_cases').select('id').eq('id', kycCaseId).eq('agency_id', ctx.agencyId).eq('contact_id', contactId).maybeSingle()
  if (!kc) return lang === 'en' ? 'KYC file not found for this contact.' : 'Dossier KYC introuvable pour ce contact.'

  // 1. INSERT row + token placeholder, 2. token signé (inclut l'UUID), 3. UPDATE.
  const exp = expiryFromDays(7)
  const { data: inserted, error: insErr } = await ctx.supabase
    .from('kyc_magic_links')
    .insert({
      token: crypto.randomUUID(), agency_id: ctx.agencyId, kyc_case_id: kycCaseId,
      contact_id: contactId, mode: 'libre', channels: ['email'], expires_at: exp.iso, created_by: ctx.profileId,
    })
    .select('id').single()
  if (insErr || !inserted) return `Erreur création du lien KYC: ${insErr?.message ?? 'inconnue'}`

  let token: string
  try {
    token = await signMagicLinkToken({ id: inserted.id, exp: exp.unix })
  } catch {
    await ctx.supabase.from('kyc_magic_links').delete().eq('id', inserted.id)
    return lang === 'en' ? 'KYC link service misconfigured — nothing sent.' : 'Service de lien KYC mal configuré — rien envoyé.'
  }
  const { error: updErr } = await ctx.supabase.from('kyc_magic_links').update({ token }).eq('id', inserted.id)
  if (updErr) {
    await ctx.supabase.from('kyc_magic_links').delete().eq('id', inserted.id)
    return `Erreur finalisation du lien KYC: ${updErr.message}`
  }

  // 4. Envoi email (magic-link-send-email accepte le service-role).
  let sent = false
  let reason: string | null = null
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/magic-link-send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ magic_link_id: inserted.id }),
      signal: AbortSignal.timeout(20_000),
    })
    const j = (await res.json().catch(() => ({}))) as { sent?: boolean; reason?: string }
    sent = !!j.sent
    reason = j.reason ?? null
  } catch (e) {
    reason = (e as Error)?.name ?? 'network'
  }

  // 5. Audit IA (actor_kind='ai', actor_id NULL ; category 'kyc'). Non bloquant.
  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'kyc_link_sent', entity_type: 'kyc_case', entity_id: kycCaseId, category: 'kyc', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId, contact_id: contactId, magic_link_id: inserted.id, email_sent: sent },
  }).then(() => {}, () => {})

  if (sent) {
    return lang === 'en'
      ? `KYC link sent to ${first} by email. They can upload their documents themselves — I'll let you know when it's done. (KYC stays optional.)`
      : `Lien KYC envoyé à ${first} par email. Il pourra déposer ses pièces lui-même — je te préviendrai quand c'est fait. (Le KYC reste facultatif.)`
  }
  return lang === 'en'
    ? `KYC link created but the email didn't go out (${reason ?? 'unknown'}). You can resend it from the CRM.`
    : `Lien KYC créé mais l'email n'est pas parti (${reason ?? 'inconnu'}). Tu peux le renvoyer depuis le CRM.`
}

// ── send_client_email (Task 3 — Sortie assistée) ─────────────────────────────
// Modèle prepare → execute : DeepSeek rédige le brouillon (sujet + corps) au ton de
// l'agent selon la compréhension du fil + l'instruction de l'agent. L'agent valide
// (WYSIWYG) avant tout envoi. Tier confirm, jamais auto.

/** Prépare le brouillon d'email via DeepSeek puis le soumet à la validation de l'agent. */
export async function prepareSendClientEmail(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const contactId = s(a.contact_id)
  const instruction = s(a.instruction)
  if (!contactId) return { ok: false, error: lang === 'en' ? 'Which contact should receive the email?' : 'Pour quel contact veux-tu envoyer un email ?' }
  if (!instruction) return { ok: false, error: lang === 'en' ? 'What should the email say?' : "Que doit dire l'email ?" }

  // 1. Résoudre le contact (prénom, nom, email) — scopé agence.
  const { data: cRow } = await ctx.supabase.from('contacts')
    .select('first_name, last_name, email')
    .eq('id', contactId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  const contact = cRow as { first_name: string | null; last_name: string | null; email: string | null } | null
  if (!contact) return { ok: false, error: lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.' }
  if (!contact.email) return { ok: false, error: lang === 'en' ? "This contact has no email address — email not sent." : "Ce contact n'a pas d'email — email non envoyé." }

  // 2. Compréhension du fil WhatsApp (dégrade proprement à null si absent).
  const { data: insightRow } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, intent, sentiment, next_action, commitments')
    .eq('contact_id', contactId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  const insight = insightRow as {
    summary: string | null; intent: string | null; sentiment: string | null
    next_action: unknown; commitments: unknown
  } | null

  // 3. Style appris de l'agent (self-gating : vide si pas 'active').
  const { data: prof } = await ctx.supabase.from('agent_ai_profiles')
    .select('learned_style')
    .eq('agent_id', ctx.profileId)
    .maybeSingle()
  const styleBlock = formatStyleBlock((prof?.learned_style as LearnedStyle | null) ?? null)

  // Mimétisme de voix : vrais messages clients récents de l'agence (few-shot). Vide si < 2.
  const voiceSamples = await fetchClientVoiceSamples(ctx.supabase, ctx.agencyId)
  const voiceBlock = formatVoiceExamples(voiceSamples, lang === 'en' ? 'en' : 'fr')

  // 4. Appel DeepSeek (JSON mode) pour rédiger le brouillon.
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return { ok: false, error: lang === 'en' ? "Email drafting unavailable right now — try again later." : "Je n'ai pas réussi à rédiger l'email, tu peux reformuler ?" }

  const firstName = (contact.first_name ?? '').trim()
  const lastName = (contact.last_name ?? '').trim()
  const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'le client'

  // Résumé du fil pour le contexte DeepSeek.
  const insightContext = insight
    ? [
        insight.summary ? `Résumé du fil : ${insight.summary}` : null,
        insight.intent ? `Intention du client : ${insight.intent}` : null,
        insight.next_action && typeof insight.next_action === 'object' && insight.next_action !== null
          && typeof (insight.next_action as Record<string, unknown>).label === 'string'
          ? `Prochaine action suggérée : ${(insight.next_action as Record<string, unknown>).label}` : null,
        Array.isArray(insight.commitments) && (insight.commitments as unknown[]).length
          ? `Engagements pris : ${(insight.commitments as string[]).slice(0, 5).join(' / ')}` : null,
      ].filter(Boolean).join('\n')
    : ''

  const systemPrompt = `Tu es un assistant immobilier suisse expert en rédaction d'emails professionnels pour agents immobiliers.
Tu rédiges un email POUR LE CLIENT de l'agent, au nom de l'agence.

RÈGLES ABSOLUES (s'imposent à tout le reste) :
- Vouvoiement strict (jamais de tutoiement avec le client).
- Français soigné et sobre, adapté à l'immobilier suisse.
- Aucune promesse non tenable, aucun chiffre ou donnée inventé.
- Pas de jargon technique ni d'identifiant brut.
- Email personnalisé selon l'instruction de l'agent et la compréhension du fil.
- Longueur adaptée à l'objet : ni trop court ni trop long.${styleBlock ? `\n\nTon ADDITIF de cet agent (nuance uniquement la chaleur/concision/traits, sans jamais déroger au vouvoiement ni aux règles ci-dessus) :${styleBlock}` : ''}${voiceBlock}

Réponds UNIQUEMENT en JSON strict : {"subject":"…","body":"…"}`

  const userPrompt = `Rédige un email immobilier suisse au client "${clientName}".

Instruction de l'agent : ${instruction}
${insightContext ? `\nContexte de la conversation :\n${insightContext}` : ''}`

  let subject = ''
  let body = ''
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        // marge confortable : un email client soigné (sujet+corps en JSON) ne doit pas
        // être tronqué en plein milieu (sinon JSON.parse échoue → "reformule" inutile).
        max_tokens: 1200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('DeepSeek draft email HTTP', res.status)
      return { ok: false, error: lang === 'en' ? "I couldn't draft the email — try again or rephrase." : "Je n'ai pas réussi à rédiger l'email, tu peux reformuler ?" }
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content ?? ''
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(raw) } catch { /* laisse subject/body vides */ }
    subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
    body = typeof parsed.body === 'string' ? parsed.body.trim() : ''
  } catch (e) {
    console.error('DeepSeek draft email error:', (e as Error)?.name ?? 'unknown')
    return { ok: false, error: lang === 'en' ? "I couldn't draft the email — try again or rephrase." : "Je n'ai pas réussi à rédiger l'email, tu peux reformuler ?" }
  }

  // 5. Échec de rédaction si sujet ou corps vides.
  if (!subject || !body) {
    return { ok: false, error: lang === 'en' ? "I couldn't draft the email — try again or rephrase." : "Je n'ai pas réussi à rédiger l'email, tu peux reformuler ?" }
  }

  // 6. Payload WYSIWYG figé — ce que l'agent valide est exactement ce qui partira.
  const who = firstName || (lang === 'en' ? 'this client' : 'ce client')
  const payload = { contact_id: contactId, to: contact.email, subject, body }
  const prompt = lang === 'en'
    ? `Email to ${who} — Subject: ${subject}\n\n${body}\n\nShall I send it? (« yes » / « no », or tell me what to change)`
    : `Email à ${who} — Objet : ${subject}\n\n${body}\n\nJ'envoie ? (« oui » / « non », ou dis-moi quoi changer)`
  return { ok: true, prompt, payload }
}

/** Post-« oui » : envoie l'email figé via send-relance-email (Resend). */
export async function executeSendClientEmail(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const contactId = s(payload.contact_id)
  const to = s(payload.to)
  const subject = s(payload.subject)
  const body = s(payload.body)
  if (!contactId || !to || !subject || !body) return lang === 'en' ? 'Incomplete action, email not sent.' : 'Action incomplète, email non envoyé.'

  // Re-validation : contact toujours présent et email inchangé.
  const { data: cRow } = await ctx.supabase.from('contacts')
    .select('first_name, email')
    .eq('id', contactId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  const contact = cRow as { first_name: string | null; email: string | null } | null
  if (!contact) return lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.'
  if (!contact.email) return lang === 'en' ? "This contact has no email — email not sent." : "Ce contact n'a pas d'email — email non envoyé."
  const first = (contact.first_name ?? '').trim() || (lang === 'en' ? 'the contact' : 'le contact')

  // Nom d'affichage de l'agent pour la signature.
  const { data: agentRow } = await ctx.supabase.from('profiles')
    .select('full_name')
    .eq('id', ctx.profileId)
    .maybeSingle()
  const agentName = (agentRow as { full_name: string | null } | null)?.full_name?.trim() ?? undefined

  // Envoi via send-relance-email (service-role).
  let emailSent = false
  let failReason: string | null = null
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-relance-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ to, subject, body, agentName, agencyId: ctx.agencyId, leadId: contactId }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) {
      emailSent = true
    } else {
      const j = await res.json().catch(() => ({})) as { error?: string }
      failReason = j.error ?? `HTTP ${res.status}`
    }
  } catch (e) {
    failReason = (e as Error)?.name ?? 'network'
  }

  // Audit IA non bloquant.
  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'whatsapp_ai_send_client_email', entity_type: 'contact', entity_id: contactId,
    category: 'contact', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId, contact_id: contactId, email_sent: emailSent },
  }).then(() => {}, () => {})

  if (emailSent) {
    return lang === 'en' ? `Email sent to ${first}.` : `Email envoyé à ${first}.`
  }
  return lang === 'en'
    ? `The email didn't go out (${failReason ?? 'unknown'}). You can send it from the CRM.`
    : `L'email n'est pas parti (${failReason ?? 'inconnu'}). Tu peux le renvoyer depuis le CRM.`
}

// summarize_group_thread (read-tier, agent-facing) : l'agent colle/transfère un bout de fil
// de GROUPE ; MEGGA rend un digest privé (décisions, questions ouvertes, qui attend quoi,
// point bloquant). NE poste rien — le résultat revient à l'agent dans son 1:1. Opère
// uniquement sur le texte collé (aucun accès Supabase → pas de garde hasAgency).
// NE DOIT JAMAIS throw : runTool n'a pas de try/catch → toute erreur renvoie une chaîne honnête.
export async function execSummarizeGroupThread(ctx: ActionCtx, a: Args): Promise<string> {
  const lang = ctx.lang ?? 'fr'
  const thread = s(a.thread)
  if (!thread) {
    return lang === 'en'
      ? 'Paste the group thread and I’ll summarize it for you.'
      : 'Colle-moi le fil du groupe et je te le résume.'
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return lang === 'en'
      ? "I can't summarize that right now — try again."
      : 'Je ne peux pas résumer là, réessaie.'
  }

  const failMsg = lang === 'en'
    ? "I couldn't summarize that thread — try again."
    : 'Je n’ai pas réussi à résumer ce fil, réessaie.'

  // Prompt : digest strict en JSON, attribution aux intervenants quand c'est clair, AUCUNE
  // invention. Fil borné à ~4000 caractères (anti-explosion de tokens).
  const prompt =
    'Voici un fil de groupe (plusieurs intervenants). Résume en JSON ' +
    '{"resume":"2-3 phrases","decisions":["…"],"en_attente":["qui attend quoi"],"bloquant":"le point qui bloque ou null"}. ' +
    "Attribue les propos aux intervenants quand c'est clair. AUCUNE invention.\n\n" +
    thread.slice(0, 4000)

  let parsed: Record<string, unknown> = {}
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('DeepSeek summarize group HTTP', res.status)
      return failMsg
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content ?? ''
    // JSON.parse ne throw QUE sur du JSON malformé : `null`/`true`/`123`/`[]` passent et
    // feraient throw `typeof parsed.resume` HORS du try/catch (→ 500). Garde de forme :
    // fail CLOSED au message honnête (le digest fail déjà à failMsg sur un contenu vide).
    try {
      const p = JSON.parse(raw)
      if (!p || typeof p !== 'object' || Array.isArray(p)) return failMsg
      parsed = p as Record<string, unknown>
    } catch { return failMsg }
  } catch (e) {
    console.error('DeepSeek summarize group error:', (e as Error)?.name ?? 'unknown')
    return failMsg
  }

  // Mise en forme courte et lisible (FR/EN), gras WhatsApp = UNE étoile, listes en « - ».
  const resume = typeof parsed.resume === 'string' ? parsed.resume.trim() : ''
  const decisions = Array.isArray(parsed.decisions)
    ? parsed.decisions.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const enAttente = Array.isArray(parsed.en_attente)
    ? parsed.en_attente.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const bloquant = typeof parsed.bloquant === 'string' && parsed.bloquant.trim() && parsed.bloquant.trim().toLowerCase() !== 'null'
    ? parsed.bloquant.trim()
    : ''

  // Rien d'exploitable → message honnête plutôt qu'un digest vide.
  if (!resume && decisions.length === 0 && enAttente.length === 0 && !bloquant) {
    return failMsg
  }

  const lines: string[] = []
  // Cadre déterministe : c'est une lecture du fil que l'agent a collé, à relire — pas un fait CRM établi.
  lines.push(lang === 'en' ? '_Summary of the thread you pasted — worth a re-read:_' : "_Synthèse du fil que tu m'as collé, à relire :_")
  if (resume) lines.push(resume)
  if (decisions.length > 0) {
    lines.push('')
    lines.push(lang === 'en' ? '*Decisions*' : '*Décisions*')
    for (const d of decisions) lines.push(`- ${d}`)
  }
  if (enAttente.length > 0) {
    lines.push('')
    lines.push(lang === 'en' ? '*Waiting on*' : '*En attente*')
    for (const w of enAttente) lines.push(`- ${w}`)
  }
  if (bloquant) {
    lines.push('')
    lines.push(lang === 'en' ? `*Blocker* : ${bloquant}` : `*Point bloquant* : ${bloquant}`)
  }
  return lines.join('\n')
}

// check_group_leak (read-tier, défensif, agent-facing) : vérifie qu'un brouillon de message
// de groupe ne révèle pas une info confidentielle d'une partie à l'autre (budget/plafond,
// motivation, KYC, stratégie…). Opère uniquement sur le texte fourni (aucun accès Supabase
// → pas de garde hasAgency). NE DOIT JAMAIS throw : runTool n'a pas de try/catch.
// NE RE-IMPRIME JAMAIS le secret en clair — seule la raison générique de DeepSeek remonte.
export async function execCheckGroupLeak(ctx: ActionCtx, a: Args): Promise<string> {
  const lang = ctx.lang ?? 'fr'
  const draft = s(a.draft)
  const parties = s(a.parties)

  if (!draft || !parties) {
    return lang === 'en'
      ? "I need both the draft message and the list of parties in the group to check for leaks."
      : "J'ai besoin du brouillon ET des parties présentes dans le groupe pour vérifier les fuites."
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return lang === 'en'
      ? "I can't check the draft right now — read it carefully before posting."
      : "Je ne peux pas vérifier le brouillon maintenant — relis-le à la main avant de poster."
  }

  const failMsg = lang === 'en'
    ? "I couldn't verify the draft — read it carefully before posting."
    : "Je n'ai pas pu vérifier, relis à la main avant de poster."

  const prompt =
    "Tu es un garde-fou de confidentialité immobilière. " +
    "Parties dans le groupe : " + parties.slice(0, 500) + ". " +
    "Brouillon que l'agent veut poster À TOUT LE GROUPE : " + draft.slice(0, 2000) + ". " +
    "Y a-t-il une info qui ne devrait PAS être vue par une des parties " +
    "(budget/plafond/plancher d'une partie, sa motivation/urgence, son KYC, une stratégie) ? " +
    'Réponds en JSON {"fuite":true|false,"raison":"courte, sans répéter le secret en clair","reformulation":"version sûre sans la fuite, ou null"}. ' +
    "Dans le doute, fuite=true."

  let parsed: Record<string, unknown> = {}
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('DeepSeek check_group_leak HTTP', res.status)
      return failMsg
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content ?? ''
    // JSON.parse ne throw QUE sur du JSON malformé : `null`/`true`/`123`/`[]` passent et
    // feraient throw `parsed.fuite` HORS du try/catch (→ 500). Garde de forme : fail CLOSED
    // au message honnête (un détecteur de fuite ne doit JAMAIS dire ✅ sur un parse douteux).
    try {
      const p = JSON.parse(raw)
      if (!p || typeof p !== 'object' || Array.isArray(p)) return failMsg
      parsed = p as Record<string, unknown>
    } catch { return failMsg }
  } catch (e) {
    console.error('DeepSeek check_group_leak error:', (e as Error)?.name ?? 'unknown')
    return failMsg
  }

  // Formatage de la réponse : on ne reprint JAMAIS le secret — seule la raison générique
  // fournie par DeepSeek (qui est instruite à ne pas répéter le secret) remonte.
  const fuite = Boolean(parsed.fuite)
  const raison = typeof parsed.raison === 'string' ? parsed.raison.trim() : ''
  const reformulation = typeof parsed.reformulation === 'string' && parsed.reformulation.trim() && parsed.reformulation.trim().toLowerCase() !== 'null'
    ? parsed.reformulation.trim()
    : ''

  if (fuite) {
    const parts: string[] = []
    parts.push(raison ? `⚠️ ${lang === 'en' ? 'Warning' : 'Attention'} : ${raison}` : (lang === 'en' ? '⚠️ Potential confidentiality leak detected.' : '⚠️ Fuite de confidentialité potentielle détectée.'))
    if (reformulation) {
      parts.push(lang === 'en' ? `Safe version: ${reformulation}` : `Version sûre : ${reformulation}`)
    }
    return parts.join('\n')
  }

  // Vérif assistée, JAMAIS une garantie : le verdict « pas de fuite » est un jugement IA non
  // vérifiable (faux négatif possible). On ne vend pas une coche verte catégorique → l'agent relit.
  return lang === 'en'
    ? "Nothing obvious flagged for the listed parties — still re-read the draft before posting (assisted check, not a guarantee)."
    : "Rien d'évident repéré pour les parties indiquées — relis quand même le brouillon avant de poster (vérif assistée, pas une garantie)."
}

// draft_listing_copy (read-tier, agent-facing) : l'agent demande de rédiger l'annonce d'un de
// ses biens (mandats `properties`, scopés agence). MEGGA résout le bien, construit la GRILLE de
// détails EN CODE (déterministe : colonnes + tags `features` → zéro chiffre inventé), fait
// rédiger UNIQUEMENT le titre + la description bilingue FR/EN par DeepSeek (ancré sur les seules
// données + voix de l'agence), puis assemble. 2 variantes : 'confidential' (sans adresse exacte
// ni coordonnée) / 'public' (+ bloc agence + agent). Variante absente → DEMANDE (jamais deviner).
// Accès DB scopé agence → garde hasAgency requise (contrairement aux lames groupe). Rien n'est
// envoyé au client : le résultat revient à l'agent dans son 1:1. NE DOIT JAMAIS throw : runTool
// n'a pas de try/catch → toute erreur renvoie une chaîne honnête. Garde objet sur le JSON DeepSeek.
type PropertyRow = {
  id: string
  title: string | null; type: string | null; status: string | null
  price: number | null; currency: string | null; transaction_type: string | null
  rooms: number | null; bedrooms: number | null; bathrooms: number | null
  surface_m2: number | null; address: string | null; city: string | null
  canton: string | null; postal_code: string | null; year_built: number | null
  floor: number | null; total_floors: number | null; charges_monthly: number | null
  energy_class: string | null; energy_label: string | null; minergie_label: string | null
  is_furnished: boolean | null; availability_date: string | null; deposit_months: number | null
  mandate_type: string | null; features: unknown
}

const PROPERTY_FIELDS =
  'id, title, type, status, price, currency, transaction_type, rooms, bedrooms, bathrooms, ' +
  'surface_m2, address, city, canton, postal_code, year_built, floor, total_floors, ' +
  'charges_monthly, energy_class, energy_label, minergie_label, is_furnished, ' +
  'availability_date, deposit_months, mandate_type, features'

/** Tags `features` reconnus → label bilingue de la grille (présence = OUI). Anti-fabrication :
 *  on ne déduit un équipement QUE si le tag est explicitement présent dans la fiche. */
const FEATURE_LABELS: Array<{ match: RegExp; fr: string; en: string }> = [
  { match: /piscine|pool/i, fr: 'Piscine', en: 'Pool' },
  { match: /terrasse|terrace/i, fr: 'Terrasse', en: 'Terrace' },
  { match: /balcon|balcony/i, fr: 'Balcon', en: 'Balcony' },
  { match: /parking|garage/i, fr: 'Parking / Garage', en: 'Parking / Garage' },
  { match: /ascenseur|elevator|lift/i, fr: 'Ascenseur', en: 'Elevator' },
  { match: /cave|cellar/i, fr: 'Cave', en: 'Cellar' },
  { match: /jardin|garden/i, fr: 'Jardin', en: 'Garden' },
  { match: /vue/i, fr: 'Vue dégagée', en: 'Open view' },
  { match: /buanderie|laundry/i, fr: 'Buanderie', en: 'Laundry' },
]

export async function execDraftListingCopy(ctx: ActionCtx, a: Args): Promise<string> {
  const lang = ctx.lang ?? 'fr'
  // Accès DB scopé agence → garde requise (contrairement aux lames groupe purement textuelles).
  if (!hasAgency(ctx)) return NO_AGENCY

  const query = s(a.query)
  if (!query) {
    return lang === 'en'
      ? 'Which property should I write the listing for?'
      : 'Pour quel bien veux-tu que je rédige l’annonce ?'
  }

  // Variante : jamais deviner. Absente → on demande.
  const variant = a.variant === 'public' ? 'public' : a.variant === 'confidential' ? 'confidential' : null
  if (!variant) {
    return lang === 'en'
      ? 'Do you want the confidential version (no contact details, no exact address) or the public one (with the agency)?'
      : 'Tu veux la version confidentielle (sans coordonnées ni adresse exacte) ou publique (avec l’agence) ?'
  }

  // Résolution du bien dans les mandats de l'agence (scopé agency_id, non supprimé).
  // PostgREST .or() découpe sur la virgule et le pattern ilike utilise % → on échappe les deux
  // dans la valeur pour éviter d'injecter un opérande ou de casser le filtre.
  const term = query.slice(0, 80).replace(/[%,()]/g, ' ').trim()
  if (!term) {
    return lang === 'en'
      ? 'Which property should I write the listing for?'
      : 'Pour quel bien veux-tu que je rédige l’annonce ?'
  }
  const { data: rows, error } = await ctx.supabase.from('properties')
    .select(PROPERTY_FIELDS)
    .eq('agency_id', ctx.agencyId)
    .is('deleted_at', null)
    .or(`title.ilike.%${term}%,address.ilike.%${term}%`)
    .limit(5)
  if (error) {
    console.error('draft_listing_copy properties query', error.code ?? 'unknown')
    return lang === 'en'
      ? "I couldn't look up that property — try again."
      : 'Je n’ai pas réussi à retrouver ce bien, réessaie.'
  }
  const list = (rows ?? []) as unknown as PropertyRow[]
  if (list.length === 0) {
    return lang === 'en'
      ? "I can't find that property in your mandates."
      : 'Je ne trouve pas ce bien dans tes mandats.'
  }
  if (list.length >= 2) {
    const choices = list
      .map((p) => `- ${p.title ?? (lang === 'en' ? 'Untitled' : 'Sans titre')}${p.city ? ` (${p.city})` : ''}`)
      .join('\n')
    return (lang === 'en'
      ? `I found several properties — which one?\n${choices}`
      : `J’ai trouvé plusieurs biens — lequel ?\n${choices}`)
  }
  const p = list[0]

  // Grille EN CODE (déterministe, anti-fabrication). Champ absent → omis (jamais inventé).
  const details: Array<{ fr: string; en: string; value: string }> = []
  const push = (fr: string, en: string, value: string | null | undefined) => {
    const v = typeof value === 'string' ? value.trim() : ''
    if (v) details.push({ fr, en, value: v })
  }
  const typeMap: Record<string, { fr: string; en: string }> = {
    apartment: { fr: 'Appartement', en: 'Apartment' },
    house: { fr: 'Maison', en: 'House' },
    villa: { fr: 'Villa', en: 'Villa' },
    commercial: { fr: 'Commercial', en: 'Commercial' },
    office: { fr: 'Bureau', en: 'Office' },
    parking: { fr: 'Parking', en: 'Parking' },
    storage: { fr: 'Dépôt', en: 'Storage' },
    land: { fr: 'Terrain', en: 'Land' },
  }
  const typeLabel = p.type ? (typeMap[p.type.toLowerCase()] ?? { fr: p.type, en: p.type }) : null
  push('Type', 'Type', lang === 'en' ? typeLabel?.en : typeLabel?.fr)
  if (typeof p.rooms === 'number') push('Pièces', 'Rooms', String(p.rooms))
  if (typeof p.bedrooms === 'number') push('Chambres', 'Bedrooms', String(p.bedrooms))
  if (typeof p.bathrooms === 'number') push('Salles de bain', 'Bathrooms', String(p.bathrooms))
  if (typeof p.surface_m2 === 'number') push('Surface', 'Surface', `${Math.round(p.surface_m2)} m²`)
  if (typeof p.floor === 'number') {
    push('Étage', 'Floor', typeof p.total_floors === 'number' ? `${p.floor} / ${p.total_floors}` : String(p.floor))
  }
  if (typeof p.year_built === 'number') push('Année', 'Year built', String(p.year_built))
  if (typeof p.charges_monthly === 'number') push('Charges', 'Charges', `${fmtCHF(p.charges_monthly)}/mois`)
  const energy = (p.minergie_label || p.energy_label || p.energy_class || '').toString().trim()
  if (energy) push('Énergie', 'Energy', energy)
  if (typeof p.is_furnished === 'boolean') {
    push('Meublé', 'Furnished', p.is_furnished ? (lang === 'en' ? 'Yes' : 'Oui') : (lang === 'en' ? 'No' : 'Non'))
  }
  if (typeof p.availability_date === 'string' && p.availability_date.trim()) {
    const av = p.availability_date.trim()
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(av)
    push('Disponibilité', 'Availability', iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : av)
  }
  if (typeof p.deposit_months === 'number') {
    push('Dépôt', 'Deposit', lang === 'en' ? `${p.deposit_months} months` : `${p.deposit_months} mois`)
  }
  if (typeof p.price === 'number' && p.price > 0) {
    const cur = (p.currency ?? 'CHF').toString().trim() || 'CHF'
    const priceStr = cur.toUpperCase() === 'CHF'
      ? (p.transaction_type === 'rent' ? `${fmtCHF(p.price)}/mois` : fmtCHF(p.price))
      : `${cur} ${Math.round(p.price)}`
    push('Prix', 'Price', priceStr)
  }
  // Tags features (présence = OUI). Borné, dédupliqué.
  const tags: string[] = Array.isArray(p.features)
    ? (p.features as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const seen = new Set<string>()
  for (const f of FEATURE_LABELS) {
    if (tags.some((t) => f.match.test(t)) && !seen.has(f.fr)) {
      seen.add(f.fr)
      push(lang === 'en' ? f.en : f.fr, lang === 'en' ? f.en : f.fr, lang === 'en' ? 'Yes' : 'Oui')
    }
  }

  // Référence dérivée de l'id (pas de migration) : 8 premiers caractères en MAJ.
  const reference = p.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  // Localisation selon la variante : confidentielle = quartier/canton seulement (jamais l'adresse
  // exacte) ; publique = ville + canton (l'adresse exacte reste hors de la copie marketing).
  const cantonStr = (p.canton ?? '').toString().trim()
  const cityStr = (p.city ?? '').toString().trim()
  const locationPublic = [cityStr, cantonStr].filter(Boolean).join(', ')
  const locationForCopy = variant === 'confidential' ? (cityStr || cantonStr || '') : (locationPublic || cityStr || cantonStr || '')

  // Données factuelles passées à DeepSeek (UNIQUEMENT ce qui existe → pas de fabrication).
  const factLines = details.map((d) => `${d.fr}: ${d.value}`)
  const facts = factLines.join('\n')
  const txLabel = p.transaction_type === 'rent'
    ? (lang === 'en' ? 'for rent' : 'à louer')
    : p.transaction_type === 'buy'
      ? (lang === 'en' ? 'for sale' : 'à vendre')
      : ''

  // Rédaction DeepSeek : titre + description bilingue UNIQUEMENT (le reste est en code).
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return lang === 'en'
      ? "Listing drafting unavailable right now — try again later."
      : 'Je ne peux pas rédiger l’annonce là, réessaie.'
  }

  const failMsg = lang === 'en'
    ? "I couldn't draft the listing — try again."
    : 'Je n’ai pas réussi à rédiger l’annonce, réessaie.'

  // Voix de l'agence : style appris (self-gating) + few-shot de vrais messages clients.
  const { data: prof } = await ctx.supabase.from('agent_ai_profiles')
    .select('learned_style')
    .eq('agent_id', ctx.profileId)
    .maybeSingle()
  const styleBlock = formatStyleBlock((prof?.learned_style as LearnedStyle | null) ?? null)
  const voiceSamples = await fetchClientVoiceSamples(ctx.supabase, ctx.agencyId)
  const voiceBlock = formatVoiceExamples(voiceSamples, lang === 'en' ? 'en' : 'fr')

  const confidentialClause = variant === 'confidential'
    ? "\n- VARIANTE CONFIDENTIELLE : ne mentionne JAMAIS l'adresse exacte ni de coordonnées ; situe le bien au quartier/canton seulement."
    : ''
  const systemPrompt = `Tu es un assistant immobilier suisse expert en rédaction d'annonces (contenu marketing pour l'agence, PAS un message à un client).
Tu rédiges UNIQUEMENT le titre et la description bilingue d'une annonce, à partir des SEULES données fournies.

RÈGLES ABSOLUES :
- N'invente RIEN : n'évoque AUCUN élément absent des données ; aucun chiffre marché ; aucun superlatif mensonger.
- Français et anglais soignés, sobres, registre immobilier suisse.
- Pas d'identifiant brut ni de jargon technique.${confidentialClause}${styleBlock ? `\n\nTon ADDITIF de cette agence (nuance la chaleur/concision, sans déroger aux règles ci-dessus) :${styleBlock}` : ''}${voiceBlock}

Réponds UNIQUEMENT en JSON strict : {"titre":"…","description_fr":"…","description_en":"…"}`

  const userPrompt = `Rédige le contenu d'une annonce immobilière suisse à partir de ces données (n'utilise QUE celles-ci) :
Type de transaction : ${txLabel || (lang === 'en' ? 'not specified' : 'non précisé')}
Localisation : ${locationForCopy || (lang === 'en' ? 'not specified' : 'non précisée')}
Détails :
${facts || (lang === 'en' ? '(none)' : '(aucun)')}

Titre court et percutant (style « ATTIQUE D'EXCEPTION À LOUER À CHAMPEL »). Description élégante et sobre, 2 à 4 paragraphes, en français (description_fr) et en anglais (description_en).`

  let parsed: Record<string, unknown> = {}
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 900,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('DeepSeek draft listing HTTP', res.status)
      return failMsg
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content ?? ''
    // JSON.parse ne throw QUE sur du JSON malformé : `null`/`true`/`[]` passent et feraient
    // throw les accès `parsed.titre` HORS du try/catch (→ 500). Garde de forme : fail CLOSED.
    try {
      const j = JSON.parse(raw)
      if (!j || typeof j !== 'object' || Array.isArray(j)) return failMsg
      parsed = j as Record<string, unknown>
    } catch { return failMsg }
  } catch (e) {
    console.error('DeepSeek draft listing error:', (e as Error)?.name ?? 'unknown')
    return failMsg
  }

  let titre = typeof parsed.titre === 'string' ? meggaProse(parsed.titre.trim()) : ''
  let descFr = typeof parsed.description_fr === 'string' ? meggaProse(parsed.description_fr.trim()) : ''
  let descEn = typeof parsed.description_en === 'string' ? meggaProse(parsed.description_en.trim()) : ''
  if (!titre && !descFr && !descEn) return failMsg
  // Variante confidentielle : filet déterministe par-dessus la consigne molle (confidentialClause).
  if (variant === 'confidential') {
    titre = stripExactAddress(titre, p.address)
    descFr = stripExactAddress(descFr, p.address)
    descEn = stripExactAddress(descEn, p.address)
  }

  // Bloc contact (variante publique seulement) — construit EN CODE depuis l'agence + l'agent.
  let contactBlock = ''
  if (variant === 'public') {
    const { data: agRow } = await ctx.supabase.from('agencies')
      .select('name, phone, email, website, logo_url')
      .eq('id', ctx.agencyId)
      .maybeSingle()
    const ag = agRow as { name: string | null; phone: string | null; email: string | null; website: string | null; logo_url: string | null } | null
    const { data: agentRow } = await ctx.supabase.from('profiles')
      .select('full_name')
      .eq('id', ctx.profileId)
      .maybeSingle()
    const agentName = (agentRow as { full_name: string | null } | null)?.full_name?.trim() ?? ''
    const contactLines: string[] = []
    if (ag?.name?.trim()) contactLines.push(ag.name.trim())
    if (agentName) contactLines.push(agentName)
    if (ag?.phone?.trim()) contactLines.push(ag.phone.trim())
    if (ag?.email?.trim()) contactLines.push(ag.email.trim())
    if (ag?.website?.trim()) contactLines.push(ag.website.trim())
    if (contactLines.length > 0) {
      contactBlock = `\n\n*Contact*\n${contactLines.join('\n')}`
    }
  }

  // Assemblage final EN CODE : titre + desc FR + desc EN + grille + (public) contact.
  const out: string[] = []
  if (titre) out.push(`*${titre}*`)
  if (descFr) { out.push(''); out.push(descFr) }
  if (descEn) { out.push(''); out.push(`*EN*`); out.push(descEn) }
  if (details.length > 0) {
    out.push('')
    out.push(lang === 'en' ? '*Details*' : '*Détails*')
    for (const d of details) out.push(`- ${lang === 'en' ? d.en : d.fr} : ${d.value}`)
  }
  out.push('')
  out.push(`${lang === 'en' ? 'Reference' : 'Référence'} : ${reference}`)
  let result = out.join('\n')
  if (contactBlock) result += contactBlock
  return result
}

// prepare_meeting (read-tier, agent-facing) : pour UN contact, MEGGA rend une synthèse de
// préparation de RDV — fiche + où on en est + biens correspondants + visite à venir + 3 points
// concrets à aborder. Agrégation des MÊMES requêtes que execGetContactBrief (fiche + recherches
// actives + timeline + compréhension), execGetMatches (biens) et execGetDailyBrief (table visits),
// puis une petite couche DeepSeek pour les 3 points (ancrés UNIQUEMENT sur le contexte fourni).
// Rien n'est envoyé : le résultat revient à l'agent dans son 1:1. Accès DB scopé agence → garde
// hasAgency. NE DOIT JAMAIS throw : runTool n'a pas de try/catch → toute erreur renvoie une chaîne
// honnête. DÉGRADATION PROPRE : si DeepSeek échoue, la partie factuelle (fiche+biens+visite) est
// rendue quand même avec une note « points à aborder indisponibles ». Garde objet sur le JSON.

/** Date+heure au format suisse DD.MM.YYYY HH:mm (Europe/Zurich), pour la synthèse de RDV. */
function swissDateTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Europe/Zurich',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`
}

export async function execPrepareMeeting(ctx: ActionCtx, a: Args): Promise<string> {
  const lang = ctx.lang ?? 'fr'
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) {
    return lang === 'en'
      ? 'Which contact is the meeting with? (find them via search_contacts)'
      : 'Avec quel contact est le rendez-vous ? (retrouve-le via search_contacts)'
  }

  // 1. Fiche contact (MÊMES champs que execGetContactBrief) — scopée agence au SQL.
  const { data: cRow } = await ctx.supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, type, score, tags, notes, search_criteria, last_interaction_at')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const contact = cRow as {
    id: string; first_name: string | null; last_name: string | null
    phone: string | null; email: string | null; type: string | null
    score: number | null; tags: string[] | null; notes: string | null
    search_criteria: unknown; last_interaction_at: string | null
  } | null
  if (!contact) {
    return lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.'
  }
  const fullName = [(contact.first_name ?? '').trim(), (contact.last_name ?? '').trim()].filter(Boolean).join(' ')
    || (lang === 'en' ? 'this contact' : 'ce contact')

  // 2. Compréhension du fil + timeline + recherches actives (mêmes requêtes que execGetContactBrief).
  const { data: insightRow } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, intent, sentiment, next_action, commitments')
    .eq('contact_id', contact.id).eq('agency_id', ctx.agencyId).maybeSingle()
  const insight = insightRow as {
    summary: string | null; intent: string | null; sentiment: string | null
    next_action: unknown; commitments: unknown
  } | null

  const { data: timelineRows } = await ctx.supabase
    .from('activity_events').select('action, object_label, created_at')
    .eq('entity_type', 'contact').eq('entity_id', contactId)
    .order('created_at', { ascending: false }).limit(5)
  const timeline = (timelineRows ?? []) as Array<{ action: string | null; object_label: string | null; created_at: string | null }>

  const { data: searchRows } = await ctx.supabase
    .from('client_searches').select('label, criteria')
    .eq('contact_id', contactId).eq('is_active', true).limit(3)
  const searches = (searchRows ?? []) as Array<{ label: string | null; criteria: unknown }>

  // 3. Biens correspondants (matches top 5) — mêmes requête/scope que execGetMatches, enrichis
  //    best-effort des titres/prix via properties / market_listings (champ absent → omis).
  const { data: matchRows } = await ctx.supabase
    .from('matches').select('score, status, market_listing_id, property_id')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('score', { ascending: false }).limit(5)
  const matches = (matchRows ?? []) as MatchListingInput[]

  // Résolution BATCH partagée (2 requêtes, pas N+1 ; champ absent → omis). On reprojette sur la
  // shape BienView attendue en aval (titre/montant/ville/score nullables).
  type BienView = { titre: string | null; montant: number | null; ville: string | null; score: number | null }
  const biens: BienView[] = (await resolveMatchListings(ctx, matches)).map((b) => ({
    titre: b.titre ?? null, montant: b.montant ?? null, ville: b.ville ?? null, score: b.score ?? null,
  }))

  // 4. Visite à venir : contact_id + agent_id + agency_id, scheduled_at >= now, status non annulé,
  //    la plus proche (order asc limit 1). Titre du bien résolu best-effort.
  const nowIso = new Date().toISOString()
  const { data: visitRow } = await ctx.supabase
    .from('visits').select('scheduled_at, status, visit_type, property_id')
    .eq('agency_id', ctx.agencyId).eq('agent_id', ctx.profileId).eq('contact_id', contactId)
    .gte('scheduled_at', nowIso).neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true }).limit(1).maybeSingle()
  const visit = visitRow as { scheduled_at: string | null; status: string | null; visit_type: string | null; property_id: string | null } | null
  let visitTitle: string | null = null
  if (visit?.property_id) {
    const { data: vp } = await ctx.supabase.from('properties')
      .select('title').eq('id', visit.property_id).eq('agency_id', ctx.agencyId).maybeSingle()
    visitTitle = (vp as { title: string | null } | null)?.title ?? null
  }

  // 5. « Où on en est » assemblé EN CODE depuis les vraies données.
  const nextActionLabel = insight && insight.next_action && typeof insight.next_action === 'object' && insight.next_action !== null
    && typeof (insight.next_action as Record<string, unknown>).label === 'string'
    ? ((insight.next_action as Record<string, unknown>).label as string).trim()
    : ''
  const commitments = insight && Array.isArray(insight.commitments)
    ? (insight.commitments as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const lastEvent = timeline[0]
  const lastEventLabel = lastEvent
    ? [lastEvent.action?.trim(), lastEvent.object_label?.trim()].filter(Boolean).join(' — ')
    : ''
  const searchLabels = searches.map((sr) => (sr.label ?? '').trim()).filter(Boolean)

  // 6. DeepSeek (clone prepareSendClientEmail) : génère UNIQUEMENT {brief, points[3]} ancrés sur
  //    le contexte fourni. Dégradation propre si échec — la partie factuelle ne dépend pas de lui.
  let brief = ''
  let points: string[] = []
  let pointsUnavailable = false

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    pointsUnavailable = true
  } else {
    // Contexte borné assemblé pour DeepSeek (UNIQUEMENT des vraies données — pas de fabrication).
    const ctxLines: string[] = []
    ctxLines.push(`Contact : ${fullName}${contact.type ? ` (${contact.type})` : ''}${typeof contact.score === 'number' ? `, score ${contact.score}` : ''}`)
    if (insight?.summary) ctxLines.push(`Résumé de la dernière conversation : ${insight.summary}`)
    if (insight?.intent) ctxLines.push(`Intention : ${insight.intent}`)
    if (insight?.sentiment) ctxLines.push(`Ressenti : ${insight.sentiment}`)
    if (nextActionLabel) ctxLines.push(`Prochaine action suggérée : ${nextActionLabel}`)
    if (commitments.length) ctxLines.push(`Engagements pris : ${commitments.slice(0, 5).join(' / ')}`)
    if (lastEventLabel) ctxLines.push(`Dernière action au dossier : ${lastEventLabel}`)
    if (searchLabels.length) ctxLines.push(`Recherches actives : ${searchLabels.join(' ; ')}`)
    if (biens.length) {
      const bienTxt = biens.map((b) => [b.titre, b.ville, b.montant ? fmtCHF(b.montant) : null].filter(Boolean).join(', ')).filter(Boolean)
      if (bienTxt.length) ctxLines.push(`Biens en attente de présentation : ${bienTxt.join(' | ')}`)
    }
    if (visit?.scheduled_at) {
      ctxLines.push(`Visite prévue : ${swissDateTime(visit.scheduled_at)}${visitTitle ? ` — ${visitTitle}` : ''}${visit.visit_type ? ` (${visit.visit_type})` : ''}`)
    }
    const context = ctxLines.join('\n').slice(0, 3000)

    const prompt =
      "Voici le contexte d'un rendez-vous immobilier (fiche client, compréhension de la dernière " +
      'conversation, dossier, biens en attente, visite prévue). Rends en JSON ' +
      '{"brief":"2-3 phrases de contexte","points":["…","…","…"]}. ' +
      'Les 3 points = sujets CONCRETS à aborder pendant le RDV, formulés en QUESTIONS ou actions à ' +
      "faire (« confirmer… », « demander… », « proposer… »), JAMAIS comme des faits acquis ni des " +
      "engagements déjà pris ; ancrés UNIQUEMENT sur les données fournies. N'attribue AUCUNE promesse " +
      "au client ou à l'agent qui ne figure pas littéralement dans « Engagements pris ». " +
      "N'invente RIEN (aucun chiffre, aucun bien, aucune donnée absente du contexte). Si peu de " +
      'données, propose des points génériques formulés en questions (confirmer les critères, planifier la suite).\n\n' +
      context

    let parsed: Record<string, unknown> = {}
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 500,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        console.error('DeepSeek prepare_meeting HTTP', res.status)
        pointsUnavailable = true
      } else {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const raw = data?.choices?.[0]?.message?.content ?? ''
        // JSON.parse ne throw QUE sur du JSON malformé : `null`/`true`/`[]` passent et feraient
        // throw les accès `parsed.brief` HORS du try/catch (→ 500). Garde de forme : dégradation
        // propre (on rend la partie factuelle avec une note plutôt qu'un message d'échec sec).
        try {
          const j = JSON.parse(raw)
          if (!j || typeof j !== 'object' || Array.isArray(j)) { pointsUnavailable = true }
          else { parsed = j as Record<string, unknown> }
        } catch { pointsUnavailable = true }
      }
    } catch (e) {
      console.error('DeepSeek prepare_meeting error:', (e as Error)?.name ?? 'unknown')
      pointsUnavailable = true
    }

    if (!pointsUnavailable) {
      brief = typeof parsed.brief === 'string' ? parsed.brief.trim() : ''
      points = Array.isArray(parsed.points)
        ? (parsed.points as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim()).slice(0, 3)
        : []
      if (!brief && points.length === 0) pointsUnavailable = true
    }
  }

  // 7. Assemblage final EN CODE (FR/EN). Dates au format suisse DD.MM.YYYY HH:mm.
  const out: string[] = []
  const header = `${lang === 'en' ? 'Meeting' : 'RDV'} — ${fullName}`
  const tags: string[] = []
  if (contact.type) tags.push(contact.type)
  if (typeof contact.score === 'number') tags.push(`score ${contact.score}`)
  out.push(`*${header}*${tags.length ? ` (${tags.join(', ')})` : ''}`)

  if (visit?.scheduled_at) {
    const vt = visit.visit_type ? ` (${visit.visit_type})` : ''
    const vb = visitTitle ? ` — ${visitTitle}` : ''
    out.push(`*${lang === 'en' ? 'Appointment' : 'Rendez-vous'}* : ${swissDateTime(visit.scheduled_at)}${vb}${vt}`)
  }

  if (brief || insight?.summary || nextActionLabel || lastEventLabel) {
    out.push('')
    out.push(lang === 'en' ? '*Where things stand*' : '*Où on en est*')
    if (brief) out.push(brief)
    else if (insight?.summary) out.push(insight.summary.trim())
    if (nextActionLabel) out.push(`- ${lang === 'en' ? 'Next step' : 'Prochaine action'} : ${nextActionLabel}`)
    if (lastEventLabel) out.push(`- ${lang === 'en' ? 'Last activity' : 'Dernière action'} : ${lastEventLabel}`)
  }

  if (biens.length) {
    const bienLines = biens.map((b) => {
      const label = b.titre ?? (lang === 'en' ? 'Property' : 'Bien')
      const facts = [b.ville, b.montant ? fmtCHF(b.montant) : null].filter(Boolean).join(' · ')
      return `- ${label}${facts ? ` — ${facts}` : ''}`
    })
    out.push('')
    out.push(lang === 'en' ? '*Relevant properties*' : '*Biens pertinents*')
    for (const bl of bienLines) out.push(bl)
  }

  out.push('')
  // Cadre DÉTERMINISTE : les points sont des pistes IA à valider, jamais du dossier vérifié — émis
  // quoi que rende DeepSeek, pour que l'agent ne les lise pas comme des faits/engagements acquis.
  out.push(lang === 'en' ? '*To discuss* _(suggested topics — validate against the file)_' : '*À aborder* _(pistes à valider — vérifie au dossier)_')
  if (points.length > 0) {
    points.forEach((p, i) => out.push(`${i + 1}. ${p}`))
  } else {
    out.push(lang === 'en' ? '(talking points unavailable — review the file above)' : '(points à aborder indisponibles — appuie-toi sur la synthèse ci-dessus)')
  }

  return out.join('\n')
}

// ── Lecture de documents entrants (doc-ingestion v1) ─────────────────────────
// L'agent envoie une photo/scan/PDF dans le message COURANT et désigne ce qu'il veut
// (« lis ce relevé », « range ce mandat dans la fiche de Dupont »). On RÉUTILISE l'OCR que le
// webhook a DÉJÀ fait sur toute pièce entrante (transcript du message) — pas de re-fetch Meta ni
// de 2e OCR Gemini dans le cas courant ; on ne re-lit la pièce (fetchMetaMedia + readDocument,
// modèle attach_kyc_document) qu'en REPLI si le webhook n'a rien pu extraire. Puis on en tire une
// lecture STRUCTURÉE et FIDÈLE via DeepSeek (décision Gregory 2 juin : vision = Gemini,
// compréhension = DeepSeek). AUCUNE invention : info absente = omise, partiellement lisible =
// « (à vérifier) ». Deux surfaces partagent cette extraction, sur des tiers distincts :
//   - read_document (read)  : rend la lecture à l'agent. Aucune écriture, aucun envoi.
//   - file_document (auto)  : classe la lecture en note timeline sur un contact. L'agent valide.
// v1 : pas de stockage du binaire (info seulement), pas de classification fine, pas de signature.

const MAX_DOC_BYTES = 15 * 1024 * 1024 // 15 Mo : borne raisonnable pour l'inline base64 Gemini

interface InboundDocResult {
  ok: boolean
  digest: string
  /** Message prêt à rendre à l'agent en cas d'échec (null si ok). */
  failMessage: string | null
}

// Récupère + lit la pièce du message courant et rend un digest structuré (ou un message
// d'échec déjà localisé). NE log JAMAIS le contenu (PII du document). Ne lève jamais.
async function readInboundDocument(ctx: ActionCtx, focus: string | null): Promise<InboundDocResult> {
  const lang = ctx.lang ?? 'fr'
  const fail = (fr: string, en: string): InboundDocResult => ({ ok: false, digest: '', failMessage: lang === 'en' ? en : fr })

  if (!ctx.inboundMedia) {
    return fail(
      'Je ne vois pas de document dans ce message. Envoie-moi la photo ou le PDF avec ta consigne (« lis ce relevé », « range ce mandat dans la fiche de Dupont »).',
      "I don't see a document in this message. Send me the photo or PDF along with your request (\"read this statement\", \"file this mandate under Dupont\").",
    )
  }

  // 1. Réutiliser l'OCR DÉJÀ fait par le webhook (passé dans ctx.inboundMedia.ocrText). Le webhook
  //    lit toute image/PDF entrant AVANT d'appeler l'agent (whatsapp-webhook) → pas de re-fetch Meta
  //    ni de 2e OCR Gemini dans le cas courant, et aucune requête DB (le texte voyage avec l'appel).
  let ocrText = (ctx.inboundMedia.ocrText ?? '').trim()

  // 2. REPLI : le webhook n'a rien pu extraire (OCR raté, texte absent) → on re-lit la pièce
  //    ici (self-contained, modèle attach_kyc_document). Validation type+taille AVANT l'OCR.
  if (!ocrText) {
    let bytes: Uint8Array, mime: string | null
    try {
      const media = await fetchMetaMedia(ctx.inboundMedia.mediaId, {
        metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
        apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
      })
      bytes = media.bytes; mime = media.mime
    } catch {
      return fail(
        "Je n'ai pas pu récupérer le document (lien Meta expiré ?). Renvoie-le.",
        "I couldn't fetch the document (Meta link expired?). Please resend it.",
      )
    }
    if (!isReadableDocMime(mime)) {
      return fail(
        'Ce type de fichier ne se lit pas (PDF ou image uniquement).',
        "I can't read this file type (PDF or image only).",
      )
    }
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_DOC_BYTES) {
      return fail(
        'Le document est trop volumineux (max 15 Mo). Compresse-le ou prends-le en photo.',
        'The document is too large (15 MB max). Compress it or take a photo.',
      )
    }
    // OCR fidèle (Gemini Vision). On NE log JAMAIS le contenu (PII du document) — statut seulement.
    const ocr = await readDocument(bytes, mime, Deno.env.get('GEMINI_API_KEY') ?? '')
    if (!ocr.ok || !ocr.text.trim()) {
      return fail(
        "Je n'ai rien pu lire dans ce document (illisible ou vide).",
        "I couldn't read anything in this document (illegible or empty).",
      )
    }
    ocrText = ocr.text.trim()
  }

  // 3. Lecture STRUCTURÉE via DeepSeek (compréhension = DeepSeek). Fidèle, aucune invention.
  //    Dégradation propre : sans clé ou si DeepSeek tombe, on rend un extrait OCR borné — fidèle,
  //    juste non mis en forme (on ne perd jamais la lecture brute).
  ocrText = ocrText.slice(0, 8000)
  const rawFallback = ocrText.slice(0, 1500)
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return { ok: true, digest: rawFallback, failMessage: null }

  const focusLine = focus ? `\nCONSIGNE de l'agent (priorise ça) : ${focus.slice(0, 300)}` : ''
  const prompt =
    'Tu lis un document professionnel (souvent immobilier : mandat, relevé, courrier, attestation, pièce). ' +
    'À partir du TEXTE OCR ci-dessous, rends une lecture FIDÈLE et COMPACTE en ' +
    (lang === 'en' ? 'anglais' : 'français') + ' (quelques lignes, ~500 caractères max). Structure : ' +
    'type de document ; personnes / parties ; montants et chiffres clés ; dates / échéances ; objet en une phrase. ' +
    "N'invente RIEN : une info absente est OMISE ; une info partiellement lisible est suivie de « (à vérifier) ». " +
    'Pas de préambule, pas de formule commerciale.' + focusLine + '\n\nTEXTE OCR :\n' + ocrText

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('DeepSeek read_document HTTP', res.status)
      return { ok: true, digest: rawFallback, failMessage: null }
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const digest = (data?.choices?.[0]?.message?.content ?? '').trim()
    return { ok: true, digest: digest || rawFallback, failMessage: null }
  } catch (e) {
    console.error('DeepSeek read_document error:', (e as Error)?.name ?? 'unknown')
    return { ok: true, digest: rawFallback, failMessage: null }
  }
}

/** read_document (tier read) : lit la pièce du message courant et rend la lecture à l'agent.
 *  N'accède à aucune table (média + OCR + DeepSeek) → pas de garde agence. Aucune écriture, aucun envoi. */
export async function execReadDocument(ctx: ActionCtx, a: Args): Promise<string> {
  const r = await readInboundDocument(ctx, s(a.focus))
  return r.ok ? r.digest : r.failMessage!
}

/** file_document (tier auto) : lit la pièce ET classe la lecture en note timeline sur un contact.
 *  Note seulement (pas de binaire en v1) ; l'agent valide ensuite dans le CRM. Jamais d'envoi client. */
export async function execFileDocument(ctx: ActionCtx, a: Args): Promise<string> {
  const lang = ctx.lang ?? 'fr'
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) {
    return lang === 'en'
      ? 'Which contact should I file this document under? (find them via search_contacts)'
      : 'Dans quelle fiche je classe ce document ? (retrouve le contact via search_contacts)'
  }
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) {
    return lang === 'en' ? 'Contact not found in your agency.' : 'Contact introuvable dans votre agence.'
  }
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim()
    || (lang === 'en' ? 'this contact' : 'ce contact')

  const r = await readInboundDocument(ctx, s(a.focus))
  if (!r.ok) return r.failMessage!

  // Note timeline (activity_events, actor_kind='ai', via logTimeline — object_label borné 500).
  const noteTitle = lang === 'en' ? 'Document read by MEGGA' : 'Document lu par MEGGA'
  const ok = await logTimeline(ctx, noteTitle, r.digest, contactId)
  if (!ok) {
    return lang === 'en'
      ? "I read the document but couldn't file the note — try again."
      : "J'ai lu le document mais je n'ai pas pu enregistrer la note — réessaie."
  }
  // On rend la lecture COMPLÈTE à l'agent, mais la note persistée par logTimeline est bornée à 500c.
  // Quand le digest dépasse, on NOMME la troncature en CODE (plus d'écart silencieux entre ce que
  // l'agent voit comme « classé » et ce qui est réellement en base). Validation humaine rappelée.
  const truncNote = r.digest.length > 500
    ? (lang === 'en'
        ? ' (CRM note shortened to its first 500 characters — re-read the full version in the file.)'
        : ' (Note CRM résumée aux 500 premiers caractères — relis la version complète dans la fiche.)')
    : ''
  return lang === 'en'
    ? `Filed under ${name}'s timeline.\n\n${r.digest}\n\n(AI read — please check it in the CRM.)${truncNote}`
    : `Classé dans la fiche de ${name}.\n\n${r.digest}\n\n(Lecture IA — vérifie dans le CRM.)${truncNote}`
}

// ── Syndication portails (Phase 2) ──────────────────────────────────────────
// publish_to_portals / withdraw_from_portals (tier confirm) + get_publication_status
// (read). Modèle « feed » : on inscrit/retire un bien du feed IDX de l'agence
// (table property_syndications) ; immobilier.ch va chercher le feed et importe.
// Préflight = mêmes règles que le sérialiseur (validateIdxProperty) + garde-fou
// compliance MANDAT SIGNÉ : on ne syndique jamais un bien sans mandat.

const VALID_PORTALS = new Set(['immobilier_ch'])
const DEFAULT_PORTAL = 'immobilier_ch'

// Statuts hors-marché (impubliables) → libellé FR. draft/active sont publiables
// (publier active un brouillon, comme le wizard).
const OFFMARKET_LABEL_FR: Record<string, string> = { reserved: 'réservé', sold: 'vendu', archived: 'archivé' }

const SYND_FIELDS =
  'id, title, type, status, transaction_type, price, currency, charges_monthly, rooms, ' +
  'surface_m2, description, address, postal_code, city, photos, deleted_at'
type SyndPropertyRow = {
  id: string; title: string | null; type: string | null; status: string | null
  transaction_type: string | null; price: number | string | null
  currency: string | null; charges_monthly: number | string | null
  rooms: number | string | null; surface_m2: number | string | null; description: string | null
  address: string | null; postal_code: string | null; city: string | null
  photos: string[] | null; deleted_at: string | null
}

type PropLookup =
  | { kind: 'one'; property: SyndPropertyRow }
  | { kind: 'none' }
  | { kind: 'many'; labels: string }
  | { kind: 'error' }

/** Résout UN bien des mandats de l'agence par requête libre (titre/adresse), scopé
 *  agency_id + non supprimé. Même filtre ilike que draft_listing_copy (échappe %,()). */
async function lookupAgencyProperty(ctx: ActionCtx, query: string, lang: WaLang): Promise<PropLookup> {
  const term = query.slice(0, 80).replace(/[%,()]/g, ' ').trim()
  if (!term) return { kind: 'none' }
  const { data, error } = await ctx.supabase.from('properties')
    .select(SYND_FIELDS)
    .eq('agency_id', ctx.agencyId)
    .is('deleted_at', null)
    .or(`title.ilike.%${term}%,address.ilike.%${term}%`)
    .limit(5)
  if (error) {
    console.error('syndication property lookup', error.code ?? 'unknown')
    return { kind: 'error' }
  }
  const rows = (data ?? []) as unknown as SyndPropertyRow[]
  if (rows.length === 0) return { kind: 'none' }
  if (rows.length >= 2) {
    const labels = rows
      .map((p) => `- ${p.title ?? (lang === 'en' ? 'Untitled' : 'Sans titre')}${p.city ? ` (${p.city})` : ''}`)
      .join('\n')
    return { kind: 'many', labels }
  }
  return { kind: 'one', property: rows[0] }
}

function toIdxInput(p: SyndPropertyRow): IdxProperty {
  return {
    id: p.id, type: p.type, transactionType: p.transaction_type, title: p.title,
    price: toNum(p.price), address: p.address, postalCode: p.postal_code, city: p.city,
    photos: p.photos ?? [],
  }
}

// Libellés FR/EN de type de bien pour l'aperçu (déterministe).
const PUBLISH_TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  apartment: { fr: 'Appartement', en: 'Apartment' },
  house: { fr: 'Maison', en: 'House' },
  villa: { fr: 'Villa', en: 'Villa' },
  commercial: { fr: 'Commercial', en: 'Commercial' },
  land: { fr: 'Terrain', en: 'Land' },
}

/** Aperçu DÉTERMINISTE de l'annonce telle qu'elle partira au portail (vraies
 *  données du bien, aucun appel IA). L'agent valide le CONTENU, pas juste l'action. */
function buildPublishPreview(p: SyndPropertyRow, lang: WaLang): string {
  const en = lang === 'en'
  const lines: string[] = []
  lines.push(`« ${p.title ?? (en ? 'Untitled' : 'Sans titre')} »`)

  const typeLabel = p.type ? (PUBLISH_TYPE_LABEL[p.type.toLowerCase()] ?? { fr: p.type, en: p.type }) : null
  const isRent = (p.transaction_type ?? 'buy') === 'rent'
  const txn = isRent ? (en ? 'Rent' : 'Location') : (en ? 'Sale' : 'Vente')
  const price = toNum(p.price)
  const charges = toNum(p.charges_monthly)
  const cur = (p.currency ?? 'CHF').toString().toUpperCase()
  let priceStr = ''
  if (price != null && price > 0) {
    priceStr = cur === 'CHF' ? (isRent ? `${fmtCHF(price)}${en ? '/mo' : '/mois'}` : fmtCHF(price)) : `${cur} ${Math.round(price)}`
    if (isRent && charges != null && charges > 0) priceStr += en ? ` (+ ${fmtCHF(charges)} charges)` : ` (+ ${fmtCHF(charges)} charges)`
  }
  lines.push([typeLabel ? (en ? typeLabel.en : typeLabel.fr) : null, txn, priceStr || null].filter(Boolean).join(' · '))

  const rooms = toNum(p.rooms)
  const surface = toNum(p.surface_m2)
  const place = [p.postal_code, p.city].filter(Boolean).join(' ')
  const geo = [
    rooms != null ? `${rooms}${en ? ' rooms' : ' pièces'}` : null,
    surface != null ? `${Math.round(surface)} m²` : null,
    place || null,
  ].filter(Boolean).join(' · ')
  if (geo) lines.push(geo)

  const photoCount = (p.photos ?? []).filter((u) => typeof u === 'string' && u.trim() !== '').length
  lines.push(`${photoCount} photo${photoCount > 1 ? 's' : ''}`)

  const desc = (p.description ?? '').trim()
  if (desc) lines.push(desc.length > 160 ? desc.slice(0, 160).trimEnd() + '…' : desc)

  return lines.join('\n')
}

/** Libellés humains des champs manquants au préflight IDX. */
const MISSING_LABELS: Record<string, { fr: string; en: string }> = {
  type: { fr: 'le type de bien', en: 'property type' },
  transaction_type: { fr: 'vente ou location', en: 'sale or rent' },
  title: { fr: 'un titre', en: 'a title' },
  price: { fr: 'le prix', en: 'the price' },
  address: { fr: "l'adresse", en: 'the address' },
  postal_code: { fr: 'le NPA', en: 'the postal code' },
  city: { fr: 'la localité', en: 'the city' },
  photos: { fr: 'au moins une photo', en: 'at least one photo' },
}

/** Portails demandés (normalisés + filtrés au catalogue supporté). Défaut immobilier.ch. */
function parsePortals(a: Args, fallback: string[] = [DEFAULT_PORTAL]): string[] {
  const raw = Array.isArray(a.portals) ? a.portals.filter((x): x is string => typeof x === 'string') : []
  const cleaned = raw.map(normalizePortal).filter((p) => VALID_PORTALS.has(p))
  return cleaned.length ? Array.from(new Set(cleaned)) : fallback
}

/** Confirm-tier : valide que le bien est actif + données IDX complètes (le MANDAT
 *  n'est PAS requis — optionnel, jamais bloquant, cf. KYC), puis construit l'APERÇU
 *  de l'annonce + le prompt de confirmation. */
export async function preparePublishToPortals(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const query = s(a.query)
  if (!query) return { ok: false, error: lang === 'en' ? 'Which property should I publish?' : 'Quel bien veux-tu publier ?' }

  const found = await lookupAgencyProperty(ctx, query, lang)
  if (found.kind === 'error') return { ok: false, error: lang === 'en' ? "I couldn't look up that property — try again." : 'Je n’ai pas réussi à retrouver ce bien, réessaie.' }
  if (found.kind === 'none') return { ok: false, error: lang === 'en' ? "I can't find that property in your mandates." : 'Je ne trouve pas ce bien dans tes mandats.' }
  if (found.kind === 'many') return { ok: false, error: (lang === 'en' ? 'Several properties match — which one?\n' : 'Plusieurs biens correspondent — lequel ?\n') + found.labels }
  const p = found.property
  const portals = parsePortals(a)
  const title = p.title ?? (lang === 'en' ? 'this property' : 'ce bien')

  // Statut : on accepte un BROUILLON (publier l'activera, comme le wizard) ou un
  // bien actif. On refuse seulement hors-marché (réservé/vendu/archivé). Le MANDAT
  // n'est PAS contrôlé : optionnel, jamais bloquant (comme le KYC).
  const offmarket = OFFMARKET_LABEL_FR[p.status ?? '']
  if (offmarket) {
    return { ok: false, error: lang === 'en'
      ? `"${title}" is ${p.status} — can't publish it.`
      : `« ${title} » est ${offmarket} — impossible de le publier.` }
  }
  // Préflight données IDX (validité d'annonce, pas de la compliance) : sans ces
  // champs on ne peut pas produire un enregistrement IDX valide.
  const missing = validateIdxProperty(toIdxInput(p))
  if (missing.length) {
    const human = missing.map((k) => (lang === 'en' ? MISSING_LABELS[k]?.en : MISSING_LABELS[k]?.fr) ?? k)
    return { ok: false, error: lang === 'en'
      ? `Before publishing "${title}", it's missing: ${human.join(', ')}.`
      : `Avant de publier « ${title} », il manque : ${human.join(', ')}.` }
  }

  // Aperçu de l'annonce (contenu réel) dans le confirm → l'agent valide ce qui part.
  const names = portals.map(portalLabel).join(', ')
  const preview = buildPublishPreview(p, lang)
  const prompt = lang === 'en'
    ? `${preview}\n\nPublish this on ${names}? ("yes" / "no")`
    : `${preview}\n\nJe publie ça sur ${names} ? (« oui » / « non »)`
  return { ok: true, prompt, payload: { property_id: p.id, portals, title } }
}

// Déclenche le push FTP du feed tout de suite (au lieu d'attendre le cron 05h30).
// idx-syndicate ACK vite (202) puis bosse en arrière-plan ; no-op tant que le FTP
// n'est pas configuré. Best-effort : toute erreur est avalée (le cron rattrape).
async function triggerImmediateSyndication(agencyId: string): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  try {
    await fetch(`${url}/functions/v1/idx-syndicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ agency_id: agencyId }),
      signal: AbortSignal.timeout(4000),
    })
  } catch { /* best-effort */ }
}

/** Si le bien est actuellement publié sur un portail (queued/published), redéploie
 *  le feed tout de suite pour refléter une modif (photo, prix…). Renvoie true si un
 *  push a été lancé — sinon (bien non syndiqué) ne fait rien. */
async function maybeRepushOnChange(ctx: ActionCtx, propertyId: string): Promise<boolean> {
  if (!ctx.agencyId) return false
  const { data } = await ctx.supabase.from('property_syndications')
    .select('id').eq('property_id', propertyId).eq('agency_id', ctx.agencyId)
    .in('status', ['queued', 'published']).limit(1)
  if (!Array.isArray(data) || data.length === 0) return false
  await triggerImmediateSyndication(ctx.agencyId)
  return true
}

/** Post-« oui » : inscrit le bien au feed (upsert property_syndications status='queued')
 *  puis déclenche le push immédiat. */
export async function executePublishToPortals(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const propertyId = s(payload.property_id)
  const portals = Array.isArray(payload.portals) ? payload.portals.filter((x): x is string => typeof x === 'string') : []
  if (!propertyId || portals.length === 0) return lang === 'en' ? 'Action incomplete, nothing published.' : 'Action incomplète, rien n’a été publié.'

  // Re-garde (défense en profondeur) : bien de l'agence, actif. PAS de mandat
  // (optionnel, jamais bloquant).
  const { data: prop } = await ctx.supabase.from('properties')
    .select('id, title, status')
    .eq('id', propertyId).eq('agency_id', ctx.agencyId).is('deleted_at', null).maybeSingle()
  if (!prop) return lang === 'en' ? 'Property not found in your agency.' : 'Bien introuvable dans votre agence.'
  if (OFFMARKET_LABEL_FR[prop.status ?? '']) {
    return lang === 'en' ? 'Property is off-market (reserved/sold/archived), nothing published.' : 'Bien hors marché (réservé/vendu/archivé), rien publié.'
  }

  const nowIso = new Date().toISOString()
  const rows = portals.map((portal) => ({
    property_id: propertyId, agency_id: ctx.agencyId, portal, status: 'queued', error: null, updated_at: nowIso,
  }))
  const { error } = await ctx.supabase.from('property_syndications').upsert(rows, { onConflict: 'property_id,portal' })
  if (error) return (lang === 'en' ? 'Error publishing: ' : 'Erreur publication: ') + error.message

  // Publier ACTIVE un brouillon (draft → active), comme le wizard. published_at est
  // posé par le trigger set_property_published_at au 1er passage en active.
  if (prop.status === 'draft') {
    await ctx.supabase.from('properties')
      .update({ status: 'active', updated_at: nowIso })
      .eq('id', propertyId).eq('agency_id', ctx.agencyId)
  }

  try {
    await ctx.supabase.from('activity_events').insert({
      agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
      action: 'property_published_to_portal', entity_type: 'property', entity_id: propertyId, category: 'bien',
      severity: 'info', metadata: { via: 'whatsapp', portals, profile_id: ctx.profileId },
    })
  } catch { /* non bloquant */ }

  // Livraison immédiate : déclenche le push du feed (no-op tant que FTP non
  // configuré), au lieu d'attendre le cron. Best-effort, ne bloque pas la réponse.
  if (ctx.agencyId) await triggerImmediateSyndication(ctx.agencyId)

  const names = portals.map(portalLabel).join(', ')
  const title = s(payload.title) ?? prop.title ?? (lang === 'en' ? 'the property' : 'le bien')
  return lang === 'en'
    ? `"${title}" published on ${names} — it goes to the portal at the next feed deposit.`
    : `« ${title} » publié sur ${names} — il part au portail au prochain dépôt du feed.`
}

/** Confirm-tier : retire un bien des portails où il est actuellement publié. */
export async function prepareWithdrawFromPortals(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const lang = ctx.lang ?? 'fr'
  const query = s(a.query)
  if (!query) return { ok: false, error: lang === 'en' ? 'Which property should I withdraw?' : 'Quel bien veux-tu retirer ?' }

  const found = await lookupAgencyProperty(ctx, query, lang)
  if (found.kind === 'error') return { ok: false, error: lang === 'en' ? "I couldn't look up that property — try again." : 'Je n’ai pas réussi à retrouver ce bien, réessaie.' }
  if (found.kind === 'none') return { ok: false, error: lang === 'en' ? "I can't find that property in your mandates." : 'Je ne trouve pas ce bien dans tes mandats.' }
  if (found.kind === 'many') return { ok: false, error: (lang === 'en' ? 'Several properties match — which one?\n' : 'Plusieurs biens correspondent — lequel ?\n') + found.labels }
  const p = found.property
  const title = p.title ?? (lang === 'en' ? 'this property' : 'ce bien')

  // Portails où le bien est actuellement actif (queued/published).
  const { data: synd } = await ctx.supabase.from('property_syndications')
    .select('portal, status').eq('property_id', p.id).eq('agency_id', ctx.agencyId).in('status', ['queued', 'published'])
  const active = (synd ?? []).map((r) => r.portal as string)
  const requested = Array.isArray(a.portals) && a.portals.length ? parsePortals(a, active) : active
  const targets = requested.filter((portal) => active.includes(portal))
  if (targets.length === 0) {
    return { ok: false, error: lang === 'en' ? `"${title}" isn't published on any portal.` : `« ${title} » n’est sur aucun portail.` }
  }

  const names = targets.map(portalLabel).join(', ')
  const prompt = lang === 'en'
    ? `I'll withdraw "${title}" from ${names}. Confirm? ("yes" / "no")`
    : `Je retire « ${title} » de ${names}. Tu confirmes ? (« oui » / « non »)`
  return { ok: true, prompt, payload: { property_id: p.id, portals: targets, title } }
}

/** Post-« oui » : passe les lignes ciblées en status='withdrawn' (sortent du feed). */
export async function executeWithdrawFromPortals(ctx: ActionCtx, payload: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const propertyId = s(payload.property_id)
  const portals = Array.isArray(payload.portals) ? payload.portals.filter((x): x is string => typeof x === 'string') : []
  if (!propertyId || portals.length === 0) return lang === 'en' ? 'Action incomplete, nothing withdrawn.' : 'Action incomplète, rien n’a été retiré.'

  const { error } = await ctx.supabase.from('property_syndications')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('property_id', propertyId).eq('agency_id', ctx.agencyId).in('portal', portals).in('status', ['queued', 'published'])
  if (error) return (lang === 'en' ? 'Error withdrawing: ' : 'Erreur retrait: ') + error.message

  try {
    await ctx.supabase.from('activity_events').insert({
      agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
      action: 'property_withdrawn_from_portal', entity_type: 'property', entity_id: propertyId, category: 'bien',
      severity: 'info', metadata: { via: 'whatsapp', portals, profile_id: ctx.profileId },
    })
  } catch { /* non bloquant */ }

  const names = portals.map(portalLabel).join(', ')
  const title = s(payload.title) ?? (lang === 'en' ? 'the property' : 'le bien')
  return lang === 'en'
    ? `"${title}" withdrawn from ${names} — it drops off at the portal's next import.`
    : `« ${title} » retiré de ${names} — il disparaîtra au prochain import du portail.`
}

/** Read-tier : sur quels portails un bien est publié + état (en ligne / en file). */
export async function execGetPublicationStatus(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const query = s(a.query)
  if (!query) return lang === 'en' ? 'Which property?' : 'Quel bien ?'

  const found = await lookupAgencyProperty(ctx, query, lang)
  if (found.kind === 'error') return lang === 'en' ? "I couldn't look up that property — try again." : 'Je n’ai pas réussi à retrouver ce bien, réessaie.'
  if (found.kind === 'none') return lang === 'en' ? "I can't find that property in your mandates." : 'Je ne trouve pas ce bien dans tes mandats.'
  if (found.kind === 'many') return (lang === 'en' ? 'Several properties match — which one?\n' : 'Plusieurs biens correspondent — lequel ?\n') + found.labels
  const p = found.property
  const title = p.title ?? (lang === 'en' ? 'this property' : 'ce bien')

  const { data: synd, error } = await ctx.supabase.from('property_syndications')
    .select('portal, status').eq('property_id', p.id).eq('agency_id', ctx.agencyId)
  if (error) return lang === 'en' ? "I couldn't read the publication status." : 'Je n’ai pas pu lire le statut de publication.'

  const live = (synd ?? []).filter((r) => r.status === 'queued' || r.status === 'published')
  if (live.length === 0) {
    return lang === 'en' ? `"${title}" isn't on any portal.` : `« ${title} » n’est sur aucun portail.`
  }
  const lines = live.map((r) => {
    const name = portalLabel(r.portal as string)
    const st = r.status === 'published'
      ? (lang === 'en' ? 'live' : 'en ligne')
      : (lang === 'en' ? 'queued (next import)' : 'en file (prochain import)')
    return `- ${name} : ${st}`
  }).join('\n')
  return (lang === 'en' ? `"${title}" — publication:\n` : `« ${title} » — publication :\n`) + lines
}

// ── Photos de bien par WhatsApp : attach_property_photos (tier auto) ──────────
// L'agent envoie une photo (1 par message) → on la met sur la galerie du bien.
// Réutilise le pipeline R2 : stage dans le bucket public property-photos →
// photo-processor (service role, 3 variantes JPEG → R2) → append atomique.

const MAX_PHOTO_BYTES = 15 * 1024 * 1024

/** Hash déterministe (djb2 → base36), comme property-photo-r2 (keyPrefix idempotent). */
function hash36(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export async function execAttachPropertyPhotos(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  if (!ctx.inboundMedia) {
    return lang === 'en'
      ? "I don't see a photo in this message. Send the photo with the property name."
      : 'Je ne vois pas de photo dans ce message. Envoie la photo avec le nom du bien.'
  }
  const query = s(a.query)
  if (!query) return lang === 'en' ? 'Which property are these photos for?' : 'Ces photos sont pour quel bien ?'

  const found = await lookupAgencyProperty(ctx, query, lang)
  if (found.kind === 'error') return lang === 'en' ? "I couldn't look up that property — try again." : 'Je n’ai pas réussi à retrouver ce bien, réessaie.'
  if (found.kind === 'none') return lang === 'en' ? "I can't find that property in your mandates." : 'Je ne trouve pas ce bien dans tes mandats.'
  if (found.kind === 'many') return (lang === 'en' ? 'Several properties match — which one?\n' : 'Plusieurs biens correspondent — lequel ?\n') + found.labels
  const p = found.property
  const title = p.title ?? (lang === 'en' ? 'this property' : 'ce bien')

  // 1. Récupère les bytes de l'image (lien Meta éphémère).
  let bytes: Uint8Array, mime: string | null
  try {
    const media = await fetchMetaMedia(ctx.inboundMedia.mediaId, {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
      apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    })
    bytes = media.bytes; mime = media.mime
  } catch {
    return lang === 'en' ? "I couldn't fetch the photo (Meta link expired?). Resend it." : 'Je n’ai pas pu récupérer la photo (lien Meta expiré ?). Renvoie-la.'
  }

  // 2. Valide : image uniquement + taille.
  if (!mime || !mime.startsWith('image/')) {
    return lang === 'en' ? "That file isn't a photo (image only)." : "Ce fichier n'est pas une photo (image uniquement)."
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    return lang === 'en' ? 'The photo is too large (15 MB max).' : 'La photo est trop lourde (15 Mo max).'
  }

  // 3. Stage dans le bucket PUBLIC property-photos (photo-processor fetchera l'URL ;
  //    le lien Meta direct exige l'auth Meta, donc on passe par le staging public).
  const baseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  if (!baseUrl || !serviceKey) return lang === 'en' ? 'Photo pipeline not configured.' : 'Pipeline photo non configuré.'
  const ext = extFromMime(mime)
  const stagePath = `wa/${ctx.agencyId}/${p.id}/${ctx.inboundMedia.messageId}.${ext}`
  const { error: upErr } = await ctx.supabase.storage
    .from('property-photos')
    .upload(stagePath, bytes, { contentType: mime, upsert: true })
  if (upErr) return (lang === 'en' ? 'Photo storage error: ' : 'Erreur de stockage de la photo: ') + upErr.message
  const stageUrl = `${baseUrl}/storage/v1/object/public/property-photos/${stagePath}`

  // 4. Mirror R2 via photo-processor (service role) ; keyPrefix dérivé server-side.
  const keyPrefix = `properties/${p.id.toLowerCase()}/photos/${hash36(stageUrl)}`
  let r2Url: string | null = null
  try {
    const res = await fetch(`${baseUrl}/functions/v1/photo-processor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: p.id, photoUrls: [stageUrl], keyPrefix }),
      signal: AbortSignal.timeout(30000),
    })
    const j = (await res.json()) as { success?: boolean; photos_cf?: Array<{ detail?: string; hero?: string; thumb?: string }> }
    const v = j.photos_cf?.[0]
    r2Url = v ? (v.detail ?? v.hero ?? v.thumb ?? null) : null
  } catch { /* géré ci-dessous */ }

  // Nettoie le staging (best-effort, évite les orphelins).
  await ctx.supabase.storage.from('property-photos').remove([stagePath]).then(() => {}, () => {})

  if (!r2Url) {
    return lang === 'en' ? "I couldn't process that photo — try another one." : 'Je n’ai pas pu traiter cette photo — essaie-en une autre.'
  }

  // 5. Append ATOMIQUE (RPC) — robuste à une rafale de photos en parallèle.
  const { data: count, error: rpcErr } = await ctx.supabase.rpc('append_property_photo', {
    p_property_id: p.id, p_agency_id: ctx.agencyId, p_url: r2Url,
  })
  if (rpcErr) return (lang === 'en' ? 'Error saving the photo: ' : 'Erreur enregistrement de la photo: ') + rpcErr.message
  if (count == null) return lang === 'en' ? 'Property not found in your agency.' : 'Bien introuvable dans votre agence.'

  // 6. Audit.
  try {
    await ctx.supabase.from('activity_events').insert({
      agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
      action: 'property_photo_added', entity_type: 'property', entity_id: p.id, category: 'bien',
      severity: 'info', metadata: { via: 'whatsapp', profile_id: ctx.profileId },
    })
  } catch { /* non bloquant */ }

  const n = typeof count === 'number' ? count : 0
  const live = await maybeRepushOnChange(ctx, p.id)
  const suffix = live ? (lang === 'en' ? ' Portal updated.' : ' Le portail est mis à jour.') : ''
  return lang === 'en'
    ? `Photo added to "${title}" (${n} photo${n > 1 ? 's' : ''} now).${suffix}`
    : `Photo ajoutée à « ${title} » (${n} photo${n > 1 ? 's' : ''} maintenant).${suffix}`
}

// ── Compléter / corriger un bien par WhatsApp : update_property (tier auto) ───
// Met à jour SEULEMENT les champs explicitement donnés par l'agent (jamais
// d'invention). Sert à finir une annonce avant publication, ou corriger une info.

// Map stricte vers l'enum property_type (apartment|house|villa|commercial|land).
// canonicalPropertyType (recherche) renvoie un vocabulaire plus large → inutilisable ici.
const PROPERTY_TYPE_ENUM_MAP: Record<string, string> = {
  appartement: 'apartment', appart: 'apartment', apartment: 'apartment', flat: 'apartment',
  studio: 'apartment', loft: 'apartment', duplex: 'apartment', attique: 'apartment', pph: 'apartment',
  maison: 'house', house: 'house', individuelle: 'house', mitoyenne: 'house', chalet: 'house',
  villa: 'villa',
  terrain: 'land', land: 'land', parcelle: 'land',
  commercial: 'commercial', commerce: 'commercial', bureau: 'commercial', bureaux: 'commercial',
  local: 'commercial', office: 'commercial', dépôt: 'commercial', depot: 'commercial', arcade: 'commercial',
}

interface CollectedPropertyFields { fields: Record<string, unknown>; applied: string[]; notes: string[] }

/** Coercion PARTAGÉE (create_property + update_property) : args libres → colonnes
 *  properties. Ne pose QUE les champs donnés explicitement (anti-fabrication). */
function collectPropertyFields(a: Args, lang: WaLang): CollectedPropertyFields {
  const fields: Record<string, unknown> = {}
  const applied: string[] = []
  const notes: string[] = []

  const pushText = (col: string, argKey: string, label: string, max: number) => {
    const v = s(a[argKey])
    if (!v) return
    const val = v.slice(0, max)
    fields[col] = val
    applied.push(`${label} ${val}`)
  }
  pushText('title', 'title', lang === 'en' ? 'title' : 'titre', 200)
  pushText('address', 'address', lang === 'en' ? 'address' : 'adresse', 300)
  pushText('city', 'city', lang === 'en' ? 'city' : 'localité', 120)
  pushText('canton', 'canton', 'canton', 40)
  pushText('description', 'description', 'description', 4000)

  const npa = s(a.postal_code)
  if (npa) {
    const val = npa.slice(0, 12)
    fields.postal_code = val
    applied.push(`${lang === 'en' ? 'postal code' : 'NPA'} ${val}`)
  }

  if (a.property_type != null) {
    const mapped = PROPERTY_TYPE_ENUM_MAP[String(a.property_type).toLowerCase().trim()]
    if (mapped) { fields.type = mapped; applied.push(`type ${mapped}`) }
    else notes.push(lang === 'en'
      ? `(type "${a.property_type}" not recognized)`
      : `(type « ${a.property_type} » non reconnu : appartement/maison/villa/terrain/commercial)`)
  }

  if (a.transaction_type != null) {
    const t = String(a.transaction_type).toLowerCase().trim()
    const tt = ['rent', 'location', 'louer', 'à louer', 'a louer'].includes(t) ? 'rent'
      : ['buy', 'sale', 'vente', 'achat', 'vendre', 'à vendre', 'a vendre'].includes(t) ? 'buy' : null
    if (tt) { fields.transaction_type = tt; applied.push(tt === 'rent' ? (lang === 'en' ? 'for rent' : 'à louer') : (lang === 'en' ? 'for sale' : 'à vendre')) }
    else notes.push(lang === 'en'
      ? `(transaction "${a.transaction_type}" not recognized)`
      : `(transaction « ${a.transaction_type} » non reconnue : vente ou location)`)
  }

  const price = parseAmount(a.price)
  if (price != null && price > 0) { fields.price = price; applied.push(`${lang === 'en' ? 'price' : 'prix'} ${fmtCHF(price)}`) }
  const charges = parseAmount(a.charges_monthly)
  if (charges != null && charges >= 0) { fields.charges_monthly = charges; applied.push(`${lang === 'en' ? 'charges' : 'charges'} ${fmtCHF(charges)}`) }

  const rooms = toNum(a.rooms)
  if (rooms != null && rooms > 0) { fields.rooms = rooms; applied.push(`${rooms} ${lang === 'en' ? 'rooms' : 'pièces'}`) }
  const surface = toNum(a.surface_m2)
  if (surface != null && surface > 0) { fields.surface_m2 = Math.round(surface * 100) / 100; applied.push(`${Math.round(surface)} m²`) }
  const yb = toNum(a.year_built)
  if (yb != null && yb > 1000 && yb < 2100) { fields.year_built = Math.round(yb); applied.push(`${lang === 'en' ? 'year' : 'année'} ${Math.round(yb)}`) }

  return { fields, applied, notes }
}

const PROPERTY_TYPE_TITLE: Record<string, { fr: string; en: string }> = {
  apartment: { fr: 'Appartement', en: 'Apartment' },
  house: { fr: 'Maison', en: 'House' },
  villa: { fr: 'Villa', en: 'Villa' },
  commercial: { fr: 'Local commercial', en: 'Commercial space' },
  land: { fr: 'Terrain', en: 'Land' },
}

/** Titre synthétisé depuis les champs donnés (type / pièces / localité) — composé
 *  de vraies entrées de l'agent, jamais inventé. Null si rien d'exploitable. */
function synthesizeTitle(fields: Record<string, unknown>, lang: WaLang): string | null {
  const parts: string[] = []
  const t = typeof fields.type === 'string' ? PROPERTY_TYPE_TITLE[fields.type] : null
  if (t) parts.push(lang === 'en' ? t.en : t.fr)
  if (typeof fields.rooms === 'number') parts.push(`${fields.rooms} ${lang === 'en' ? 'rooms' : 'pièces'}`)
  const head = parts.join(' ')
  const city = typeof fields.city === 'string' ? fields.city : ''
  if (head && city) return `${head} — ${city}`
  return head || city || null
}

export async function execUpdateProperty(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'
  const query = s(a.query)
  if (!query) return lang === 'en' ? 'Which property should I update?' : 'Quel bien veux-tu compléter ?'

  const found = await lookupAgencyProperty(ctx, query, lang)
  if (found.kind === 'error') return lang === 'en' ? "I couldn't look up that property — try again." : 'Je n’ai pas réussi à retrouver ce bien, réessaie.'
  if (found.kind === 'none') return lang === 'en' ? "I can't find that property in your mandates." : 'Je ne trouve pas ce bien dans tes mandats.'
  if (found.kind === 'many') return (lang === 'en' ? 'Several properties match — which one?\n' : 'Plusieurs biens correspondent — lequel ?\n') + found.labels
  const p = found.property
  const title = p.title ?? (lang === 'en' ? 'this property' : 'ce bien')

  const { fields: patch, applied, notes } = collectPropertyFields(a, lang)

  if (Object.keys(patch).length === 0) {
    if (notes.length) return notes.join(' ')
    return lang === 'en' ? 'Tell me which field to update (price, postal code, surface…).' : 'Dis-moi quel champ compléter (prix, NPA, surface…).'
  }

  patch.updated_at = new Date().toISOString()
  const { error } = await ctx.supabase.from('properties')
    .update(patch).eq('id', p.id).eq('agency_id', ctx.agencyId).is('deleted_at', null)
  if (error) return (lang === 'en' ? 'Update error: ' : 'Erreur mise à jour: ') + error.message

  try {
    await ctx.supabase.from('activity_events').insert({
      agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
      action: 'property_updated', entity_type: 'property', entity_id: p.id, category: 'bien',
      severity: 'info', metadata: { via: 'whatsapp', profile_id: ctx.profileId, fields: Object.keys(patch).filter((k) => k !== 'updated_at') },
    })
  } catch { /* non bloquant */ }

  const changed = applied.join(', ')
  const note = notes.length ? ' ' + notes.join(' ') : ''
  const live = await maybeRepushOnChange(ctx, p.id)
  const suffix = live ? (lang === 'en' ? ' Portal updated.' : ' Je mets le portail à jour.') : ''
  return lang === 'en'
    ? `Updated "${title}": ${changed}.${note}${suffix}`
    : `C'est noté pour « ${title} » : ${changed}.${note}${suffix}`
}

// ── Créer un bien de zéro par WhatsApp : create_property (tier auto) ──────────
// Crée un BROUILLON depuis ce que l'agent dicte. Le titre est synthétisé des
// champs donnés s'il n'est pas fourni. Publier l'activera ensuite (draft → active).
export async function execCreateProperty(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const lang = ctx.lang ?? 'fr'

  const { fields, applied, notes } = collectPropertyFields(a, lang)

  // Titre : explicite, sinon synthétisé (type/pièces/localité). Sans rien → on demande.
  if (!fields.title) {
    const synth = synthesizeTitle(fields, lang)
    if (synth) fields.title = synth
  }
  if (!fields.title) {
    const head = notes.length ? notes.join(' ') + ' ' : ''
    return head + (lang === 'en'
      ? 'Give me at least a title, or the type and city.'
      : 'Donne-moi au moins un titre, ou le type et la localité.')
  }

  const { data: created, error } = await ctx.supabase.from('properties').insert({
    agency_id: ctx.agencyId,
    status: 'draft',
    currency: 'CHF',
    created_by: ctx.profileId,
    ...fields,
  }).select('id, title').single()
  if (error) return (lang === 'en' ? 'Error creating the property: ' : 'Erreur création du bien: ') + error.message

  try {
    await ctx.supabase.from('activity_events').insert({
      agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
      action: 'property_created', entity_type: 'property', entity_id: created.id, category: 'bien',
      severity: 'info', metadata: { via: 'whatsapp', profile_id: ctx.profileId, fields: Object.keys(fields) },
    })
  } catch { /* non bloquant */ }

  // `applied` peut contenir « titre X » (titre explicite) → on l'écarte du détail,
  // le titre est déjà montré séparément.
  const titlePrefix = lang === 'en' ? 'title ' : 'titre '
  const details = applied.filter((x) => !x.startsWith(titlePrefix)).join(', ')
  const note = notes.length ? ' ' + notes.join(' ') : ''
  const tail = lang === 'en'
    ? ' Send me photos or say "publish it" when ready.'
    : ' Envoie-moi des photos ou dis « publie-le » quand c\'est prêt.'
  return (lang === 'en'
    ? `Draft created: "${created.title}"${details ? ` (${details})` : ''}.`
    : `Brouillon créé : « ${created.title} »${details ? ` (${details})` : ''}.`) + note + tail
}
