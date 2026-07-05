// supabase/functions/whatsapp-morning-brief/index.ts
// Morning brief proactif 07h30 (Europe/Zurich) — inverse le pull en push : pousse à
// chaque agent APPAIRÉ (whatsapp_agent_links.verified) sa journée — visites du jour,
// relances dues, offres qui expirent, nouveaux leads vendeurs. 0 LLM : requêtes
// déterministes + gabarit figé (_shared/morning-brief.ts). Agent-facing uniquement
// (jamais de client) → pas de HITL.
//
// Déclenché par pg_cron à 05:30, 06:30 ET 07:30 UTC (migration 20260705180000) : les
// schedules encadrent le DST et fournissent un tick filet, la fonction n'agit que si
// l'heure LOCALE Zurich est 07h (primaire) ou 08h (filet, audit anti tick-manqué) —
// pattern maison is_within_sla_window. Idempotent par (profile_id, date locale) via
// whatsapp_daily_briefs (claim insert-first + re-claim TTL des claims orphelins) :
// jamais de double envoi, pire cas un brief vers 08h30.
//
// Fenêtre 24h Meta : PAS trackée (comme partout) — on envoie, et si l'agent n'a pas
// écrit au copilote depuis >24h Meta refuse le texte libre (131047) → échec silencieux
// journalisé + claim relâché. Le teaser template (#795) prendra ce relais une fois
// l'activation Meta faite.
//
// Gardes : opt-in app_config.whatsapp_morning_brief_enabled='true' (fail-CLOSED,
// nouveau canal push) + kill-switch global whatsapp_enabled (fail-open) respecté.
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml) —
// garde applicative alignée sur app_config.service_role_key (comme whatsapp-process).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { toWhatsAppText } from '../_shared/whatsapp-format.ts'
import { meggaProse } from '../_shared/megga-prose.ts'
import { isWhatsAppEnabled } from '../_shared/whatsapp-config.ts'
import {
  composeMorningBrief, zurichHour, zurichDayBoundsUtc, SQL_LIMITS,
  type BriefVisit, type BriefReminder, type BriefOffer, type BriefSellerLead,
} from '../_shared/morning-brief.ts'
import type { WaLang } from '../_shared/whatsapp-i18n.ts'

const BUDGET_MS = 60_000
const FLAG_KEY = 'whatsapp_morning_brief_enabled'

function json(o: unknown, c: number): Response {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}

// Comparaison à temps constant (anti timing-attack sur le secret service-role).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface AgencyData {
  // agentId conservé pour filtrer « ta journée » par agent au moment de composer
  // (visite attribuée à un collègue ≠ ta visite ; non attribuée = visible par tous).
  visits: Array<BriefVisit & { agentId: string | null }>
  reminders: BriefReminder[]
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
}

type NameRow = { first_name: string | null; last_name: string | null } | null

function contactName(c: NameRow): string | null {
  return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || null
}

// Les 4 sources du brief, scoppées AGENCE (comme le cockpit Aujourd'hui). En service
// role la RLS est bypassée → le filtre agency_id est OBLIGATOIRE sur chaque requête.
// (Les RPC du Focus type focus_top_matches dérivent l'agence de auth.uid() et
// renvoient 0 ligne en service role — d'où des lectures de table directes.)
// Retourne null si UNE des requêtes échoue : un brief avec une section manquante en
// silence est mensonger (l'agent croirait sa matinée libre) — mieux vaut aucun brief.
async function loadAgencyData(
  admin: SupabaseClient, agencyId: string, startIso: string, endIso: string, now: Date,
): Promise<AgencyData | null> {
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString()

  const [visitsRes, remindersRes, offersRes, leadsRes] = await Promise.all([
    admin.from('visits')
      .select('scheduled_at, buyer_name, agent_id, contact:contacts(first_name, last_name), property:properties(title, city)')
      .eq('agency_id', agencyId)
      .in('status', ['planned', 'confirmed'])
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .limit(SQL_LIMITS.visits),
    // Dues = échéance avant la fin de la journée locale, retard inclus.
    admin.from('reminders')
      .select('type, trigger_at, contact:contacts(first_name, last_name)')
      .eq('agency_id', agencyId)
      .in('status', ['pending', 'triggered', 'snoozed'])
      .not('trigger_at', 'is', null)
      .lt('trigger_at', endIso)
      .order('trigger_at', { ascending: true })
      .limit(SQL_LIMITS.reminders),
    admin.from('crm_offers')
      .select('amount, by_label, expires_at')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', in48h)
      .order('expires_at', { ascending: true })
      .limit(SQL_LIMITS.offers),
    // Pool partagé (parité RLS front) : leads assignés à l'agence OU non assignés.
    // Fraîcheur 72 h (couvre le week-end pour le lundi matin) : « nouveaux » doit
    // rester vrai — un lead jamais traité ne revient pas tous les matins à vie,
    // le backlog complet vit dans le Focus/CRM.
    admin.from('seller_leads')
      .select('contact_name, property_data, estimation_median')
      .eq('status', 'new')
      .or(`assigned_agency_id.eq.${agencyId},assigned_agency_id.is.null`)
      .gte('created_at', new Date(now.getTime() - 72 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(SQL_LIMITS.sellerLeads),
  ])

  for (const res of [visitsRes, remindersRes, offersRes, leadsRes]) {
    if (res.error) {
      console.error('morning-brief agency query error:', res.error.message)
      return null
    }
  }

  // Casts via unknown : sans types générés, supabase-js type les embeds en tableau
  // alors que ces FK many-to-one renvoient un objet à l'exécution.
  const visits: AgencyData['visits'] = ((visitsRes.data ?? []) as unknown as Array<{
    scheduled_at: string; buyer_name: string | null; agent_id: string | null
    contact: NameRow; property: { title: string | null; city: string | null } | null
  }>).map((v) => ({
    scheduledAt: v.scheduled_at,
    who: contactName(v.contact) ?? v.buyer_name,
    propertyTitle: v.property?.title ?? null,
    city: v.property?.city ?? null,
    agentId: v.agent_id,
  }))

  const reminders: BriefReminder[] = ((remindersRes.data ?? []) as unknown as Array<{
    type: string; contact: NameRow
  }>).map((r) => ({ type: r.type, who: contactName(r.contact) }))

  const offers: BriefOffer[] = ((offersRes.data ?? []) as Array<{
    amount: number; by_label: string; expires_at: string
  }>).map((o) => ({ amount: o.amount, byLabel: o.by_label, expiresAt: o.expires_at }))

  const sellerLeads: BriefSellerLead[] = ((leadsRes.data ?? []) as Array<{
    contact_name: string; property_data: { city?: string } | null; estimation_median: number | null
  }>).map((l) => ({
    contactName: l.contact_name,
    city: l.property_data?.city ?? null,
    estimationMedian: l.estimation_median,
  }))

  return { visits, reminders, offers, sellerLeads }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Garde service-role : pg_cron envoie Bearer <service_role_key d'app_config>.
  {
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
    const expectedKey = (cfg?.value as string | undefined) ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!expectedKey || !safeEqual(providedKey, expectedKey)) return json({ error: 'Forbidden' }, 403)
  }

  // dryRun : compose et RETOURNE les textes sans claim/envoi/persist (vérif prod sans
  // toucher les agents). force : ignore le gate horaire (test manuel). Les deux
  // n'existent que derrière la garde service-role.
  let body: { force?: boolean; dryRun?: boolean } = {}
  try { body = await req.json() } catch { /* body vide du cron */ }
  const dryRun = body.dryRun === true
  const force = body.force === true || dryRun

  if (!(await isWhatsAppEnabled(admin))) return json({ ok: true, skipped: 'whatsapp_disabled' }, 200)

  // Opt-in fail-CLOSED : seul 'true' explicite active (nouveau canal push).
  {
    const { data: flag } = await admin.from('app_config').select('value').eq('key', FLAG_KEY).maybeSingle()
    if (((flag?.value as string | undefined) ?? '').trim().toLowerCase() !== 'true') {
      return json({ ok: true, skipped: 'disabled' }, 200)
    }
  }

  // Gate horaire : 07h local = tick primaire, 08h local = tick filet (audit : un tick
  // manqué/retardé ne doit pas coûter la journée). La dédup rend le filet no-op quand
  // le primaire a réussi ; pire cas = brief vers 08h30 au lieu de 07h30.
  const now = new Date()
  const localHour = zurichHour(now)
  if (!force && localHour !== 7 && localHour !== 8) {
    return json({ ok: true, skipped: 'off_hour', zurichHour: localHour }, 200)
  }
  const { startIso, endIso, dateKey } = zurichDayBoundsUtc(now)

  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
  if (!dryRun && (!metaToken || !metaPhoneNumberId)) return json({ ok: true, skipped: 'meta_env_missing' }, 200)
  const provider = getProvider('meta')
  const sendCfg: SendConfig = {
    metaToken, metaPhoneNumberId,
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }

  const { data: links, error: linksErr } = await admin
    .from('whatsapp_agent_links')
    .select('profile_id, wa_number, agency_id, profile:profiles(full_name, agency_id, spoken_languages, deleted_at)')
    .eq('verified', true)
    .eq('morning_brief_enabled', true) // opt-out par agent (défaut ON, colonne 20260705180000)
    .not('wa_number', 'is', null)
    .limit(200)
  if (linksErr) return json({ error: linksErr.message }, 500)
  // Fail-loud (hygiène maison) : à 200 liens pile, des agents sont peut-être exclus.
  const capped = (links ?? []).length === 200
  if (capped) console.error('morning-brief: plafond limit(200) atteint sur whatsapp_agent_links — paginer la requête')

  const t0 = Date.now()
  const agencyCache = new Map<string, AgencyData | null>()
  const drafts: Array<{ profile_id: string; lang: WaLang; text: string }> = []
  let sent = 0, skippedEmpty = 0, skippedDup = 0, failed = 0, truncated = 0

  const linkRows = (links ?? []) as unknown as Array<{
    profile_id: string; wa_number: string; agency_id: string | null
    profile: { full_name: string; agency_id: string | null; spoken_languages: string[] | null; deleted_at: string | null } | null
  }>
  for (let i = 0; i < linkRows.length; i++) {
    const link = linkRows[i]
    if (Date.now() - t0 > BUDGET_MS) {
      // Pas de claim posé pour les restants → le tick filet (08h local) les reprend.
      truncated = linkRows.length - i
      break
    }
    const profile = link.profile
    // Agence = SOURCE DE VÉRITÉ profiles.agency_id (tenant courant, aligné RLS), pas
    // le snapshot du lien d'appairage (écrit à la génération du code, jamais resync —
    // un agent qui a changé d'agence recevrait sinon le brief de son ANCIENNE agence).
    const agencyId = profile?.agency_id ?? null
    if (!profile || profile.deleted_at || !agencyId) { skippedEmpty++; continue }
    if (link.agency_id && link.agency_id !== agencyId) {
      console.error('morning-brief: lien d\'appairage périmé (agence du lien ≠ agence du profil), re-pair requis — profil', link.profile_id)
      skippedEmpty++
      continue
    }

    // Plusieurs agents liés dans la même agence → mêmes données, une seule salve de
    // requêtes (null = échec, caché aussi pour ne pas re-tenter à chaque agent).
    let data = agencyCache.get(agencyId)
    if (data === undefined) {
      data = await loadAgencyData(admin, agencyId, startIso, endIso, now)
      agencyCache.set(agencyId, data)
    }
    if (data === null) { failed++; continue }

    // « Ta journée » = les visites de CET agent (attribuées à lui ou non attribuées) ;
    // celles des collègues n'apparaissent pas comme les siennes (parité get_daily_brief).
    const visitsForAgent = data.visits.filter((v) => !v.agentId || v.agentId === link.profile_id)
    const lang: WaLang = profile.spoken_languages?.[0]?.toLowerCase().startsWith('en') ? 'en' : 'fr'
    const text = composeMorningBrief({ agentFullName: profile.full_name, ...data, visits: visitsForAgent }, lang)
    if (!text) { skippedEmpty++; continue } // journée vide → pas de brief creux

    if (dryRun) { drafts.push({ profile_id: link.profile_id, lang, text }); continue }

    // Claim insert-first (profile_id, date locale) : le tick filet lit 0 ligne insérée.
    const { data: claim, error: claimErr } = await admin
      .from('whatsapp_daily_briefs')
      .upsert({ profile_id: link.profile_id, brief_date: dateKey },
        { onConflict: 'profile_id,brief_date', ignoreDuplicates: true })
      .select('profile_id')
    if (claimErr) { console.error('morning-brief claim error:', claimErr.message); failed++; continue }
    let claimed = (claim?.length ?? 0) > 0
    if (!claimed) {
      // Re-claim TTL : une ligne posée il y a >10 min SANS confirmed_at = claim orphelin
      // (worker tué entre claim et envoi) → le tick filet le récupère au lieu de
      // laisser l'agent sans brief. UPDATE conditionnel atomique, pattern lease maison.
      const { data: reclaim } = await admin
        .from('whatsapp_daily_briefs')
        .update({ sent_at: new Date().toISOString() })
        .eq('profile_id', link.profile_id)
        .eq('brief_date', dateKey)
        .is('confirmed_at', null)
        .lt('sent_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .select('profile_id')
      claimed = (reclaim?.length ?? 0) > 0
    }
    if (!claimed) { skippedDup++; continue }

    const outText = toWhatsAppText(meggaProse(text))
    let outId: string | null = null
    let sendOk = false
    try {
      const sreq = provider.buildSendTextRequest({ toPhone: link.wa_number, body: outText }, sendCfg)
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      const sbody = await sres.json().catch(() => ({}))
      const parsed = provider.parseSendResult(sres.status, sbody)
      sendOk = parsed.ok
      outId = parsed.providerMessageId
      if (!parsed.ok) console.error('morning-brief send not ok:', sres.status, parsed.error ?? '')
    } catch (e) {
      console.error('morning-brief send failed:', (e as Error)?.name ?? 'error')
    }
    if (!sendOk) {
      // Échec (dont 131047 fenêtre 24h fermée) : silencieux côté agent, claim relâché
      // pour que le tick filet ou un déclenchement manuel du jour reste possible.
      await admin.from('whatsapp_daily_briefs').delete()
        .eq('profile_id', link.profile_id).eq('brief_date', dateKey)
      failed++
      continue
    }

    // Preuve d'envoi (sent_at = heure du claim, confirmed_at = accepté par Meta) ;
    // ferme aussi la fenêtre du re-claim TTL. Best-effort.
    await admin.from('whatsapp_daily_briefs')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('profile_id', link.profile_id).eq('brief_date', dateKey)

    // Journaliser le sortant dans le fil copilote (mêmes colonnes que la réponse
    // copilote du webhook) : visible CRM, repris par la mémoire C1 du cerveau.
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: outId ?? `local-brief-${link.profile_id}-${dateKey}`,
      direction: 'outbound',
      wa_from: metaPhoneNumberId,
      wa_to: link.wa_number,
      agency_id: agencyId,
      body: outText,
      status: 'received',
      is_agent_error: false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

    try {
      await admin.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: null, // cohérence : actor_kind 'ai' => actor_id NULL ; agent en metadata
        actor_kind: 'ai',
        action: 'whatsapp_morning_brief_sent',
        entity_type: 'whatsapp_message',
        category: 'ai',
        severity: 'info',
        metadata: { via: 'whatsapp', profile_id: link.profile_id, brief_date: dateKey },
      })
    } catch { /* non bloquant */ }
    sent++
  }

  if (truncated > 0) console.error(`morning-brief budget dépassé : ${truncated} agents non traités ce tick (repris par le tick filet)`)
  return json({
    ok: true, agents: linkRows.length, sent, skippedEmpty, skippedDup, failed, truncated, capped,
    ...(dryRun ? { dryRun: true, drafts } : {}),
  }, 200)
})
