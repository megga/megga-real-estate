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
// Fenêtre 24h Meta : si l'agent n'a pas écrit au copilote depuis >24h, le texte libre ne
// peut pas partir (131047 chez Meta, refusé AVANT par la garde). Le brief part alors en
// template `agent_daily_brief` (approuvé le 14.08.2026) : le DÉCOMPTE du jour, et la
// consigne de répondre « mon point du jour ». Cette réponse rouvre la fenêtre, et l'outil
// `get_daily_brief` livre le détail — lu par le même `loadAgencyData`. Sans le secret
// `WA_TEMPLATE_AGENT_DAILY_BRIEF`, rien ne part hors fenêtre : échec journalisé + claim
// relâché, comme avant.
//
// Gardes : opt-in app_config.whatsapp_morning_brief_enabled='true' (fail-CLOSED,
// nouveau canal push) + kill-switch global whatsapp_enabled (fail-open) respecté.
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml) —
// garde applicative alignée sur app_config.service_role_key (comme whatsapp-process).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, type WhatsAppProvider } from '../_shared/whatsapp-gateway.ts'
import { isWhatsAppEnabled } from '../_shared/whatsapp-config.ts'
import { sendOutboundGuarded } from '../_shared/whatsapp-outbound-guard.ts'
import { buildTemplateMessage } from '../_shared/whatsapp-templates.ts'
import {
  composeMorningBrief, zurichHour, zurichDayBoundsUtc, briefVisitsForAgent, briefItemCount,
  type BriefAgencyData,
} from '../_shared/morning-brief.ts'
import { loadAgencyData } from '../_shared/morning-brief-data.ts'
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

/**
 * Fenêtre 24 h fermée avec l'agent : le brief en texte libre ne peut pas partir. Le template
 * approuvé `agent_daily_brief` porte le DÉCOMPTE du jour ; sa réponse (« mon point du jour »)
 * rouvre la fenêtre et `get_daily_brief` livre le détail. Rend `true` si le template est PARTI.
 *
 * Sans `WA_TEMPLATE_AGENT_DAILY_BRIEF`, rend `false` sans appel réseau : le brief retombe
 * dans l'échec d'avant (claim relâché, repris par le tick filet), rien de plus.
 *
 * ⚠ Meta a classé ce template MARKETING — c'est le TARIF. La finalité déclarée à la garde
 * reste `utility` : le destinataire est l'agent, utilisateur du service sous base
 * contractuelle, et la garde refuse tout `marketing` vers un agent. La catégorie Meta fixe le
 * prix, pas la base légale.
 */
async function sendBriefTeaser(
  admin: SupabaseClient, provider: WhatsAppProvider,
  a: {
    waNumber: string; profileId: string; agencyId: string
    firstName: string | null; lang: WaLang; count: number; atLimit: boolean
  },
): Promise<boolean> {
  const message = buildTemplateMessage('agent_daily_brief', a.waNumber, {
    agentFirstName: a.firstName ?? undefined,
    itemCount: a.count,
    itemCountAtLimit: a.atLimit,
    lang: a.lang,
  }, (k) => Deno.env.get(k))
  if (!message) return false
  const r = await sendOutboundGuarded({
    admin, provider, to: a.waNumber,
    purpose: 'utility', scope: 'daily_brief',
    payload: { type: 'template', message, templateKey: 'agent_daily_brief' },
    profileId: a.profileId, agencyId: a.agencyId,
    isAutomated: true, // template Meta (boilerplate) : jamais du corpus de voix
  })
  return r.ok
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
  const agencyCache = new Map<string, BriefAgencyData | null>()
  const drafts: Array<{ profile_id: string; lang: WaLang; text: string }> = []
  let sent = 0, viaTemplate = 0, skippedEmpty = 0, skippedDup = 0, failed = 0, truncated = 0

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
    const visitsForAgent = briefVisitsForAgent(data.visits, link.profile_id)
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

    // SITE 10 — `scope:'daily_brief'` est ce qui rend le toggle du brief SIGNIFIANT : sans
    // lui, un agent qui coupe son brief couperait aussi son copilote, son PDF KYC et ses
    // résultats async. Le brief part en TEXTE LIBRE, donc il dépend de la fenêtre 24 h avec
    // l'agent — hors fenêtre, la garde le refuse AVANT le POST et appelle `onWindowClosed`,
    // qui envoie le template du décompte. Le refus reste journalisé (`fallback_offered`).
    const briefSent = await sendOutboundGuarded({
      admin, provider, to: link.wa_number,
      purpose: 'service', scope: 'daily_brief',
      payload: { type: 'text', body: text },
      profileId: link.profile_id, agencyId,
      isAutomated: true, // brief quotidien généré (vers l'agent) : jamais du corpus de voix
      onWindowClosed: () => sendBriefTeaser(admin, provider, {
        waNumber: link.wa_number, profileId: link.profile_id, agencyId, lang,
        firstName: (profile.full_name ?? '').trim().split(/\s+/)[0] || null,
        // Le décompte porte sur CE que `get_daily_brief` rendra : les visites de l'agent,
        // pas celles de ses collègues.
        ...briefItemCount({ ...data, visits: visitsForAgent }),
      }),
    })
    // Texte refusé mais template parti : le brief du jour EST livré (sous forme de décompte).
    const teaser = !briefSent.ok && briefSent.blocked && briefSent.reason === 'window_closed'
      && briefSent.fallbackOffered
    if (!briefSent.ok && !teaser) {
      // Échec (fenêtre fermée sans template, ou panne) : silencieux côté agent, claim relâché
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

    try {
      await admin.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: null, // cohérence : actor_kind 'ai' => actor_id NULL ; agent en metadata
        actor_kind: 'ai',
        action: 'whatsapp_morning_brief_sent',
        entity_type: 'whatsapp_message',
        category: 'ai',
        severity: 'info',
        metadata: {
          via: 'whatsapp', profile_id: link.profile_id, brief_date: dateKey,
          mode: teaser ? 'template' : 'text',
        },
      })
    } catch { /* non bloquant */ }
    sent++
    if (teaser) viaTemplate++
  }

  if (truncated > 0) console.error(`morning-brief budget dépassé : ${truncated} agents non traités ce tick (repris par le tick filet)`)
  return json({
    ok: true, agents: linkRows.length, sent, viaTemplate, skippedEmpty, skippedDup, failed, truncated, capped,
    ...(dryRun ? { dryRun: true, drafts } : {}),
  }, 200)
})
