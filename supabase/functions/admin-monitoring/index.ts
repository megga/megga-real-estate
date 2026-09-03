import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkMetaToken, tokenDaysMetric, tokenNeedsAlert } from '../_shared/whatsapp-token.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { evaluateAndSendAlerts, type WhatsAppDeadletters } from '../_shared/admin-alerts.ts'
import { reportEdgeError } from '../_shared/audit-edge-error.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

/**
 * Requête non authentifiée.
 *
 * Un TYPE plutôt qu'un message : le catch de tête comparait `err.message` à
 * « Forbidden » pour choisir entre 403 et 401, alors qu'aucun chemin ne lève
 * jamais ce message exact (`requireSuperAdmin` RENVOIE ses Response, avec
 * « Forbidden: super_admin required »). La branche 403 était donc morte, et
 * toute panne interne — une RPC de santé en erreur, un timeout — repartait en
 * 401 « Unauthorized ». Chercher un problème d'authentification là où la base
 * ne répond plus coûte cher.
 */
class Unauthorized extends Error {}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Hors du `try` : le catch en a besoin pour journaliser la panne.
  const startedAt = Date.now()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Auth : appel interne (pg_cron) OU super_admin interactif (console).
    //
    // La garde interne compare le Bearer, à temps constant, au secret partagé
    // `app_config.service_role_key` — la valeur que pg_cron forwarde — avec repli
    // sur l'env. On NE décode PLUS le rôle porté par un JWT : la fonction est
    // déployée --no-verify-jwt, donc la plateforme ne vérifie aucune signature, et
    // un jeton forgé {"role":"service_role"} franchissait la garde sans connaître
    // le moindre secret. Le décodage servait à contourner une différence entre la
    // clé collée et l'env (49022a70) ; `isServiceSecret` accepte les deux formats,
    // ce qui résout ce problème-là sans ouvrir la porte.
    // Même correctif que photo-processor (S1b) et backfill-cf-images (S22).
    if (!req.headers.get('Authorization')) throw new Unauthorized('Unauthorized')

    if (!(await isServiceSecret(supabaseAdmin, req))) {
      // Interactive call from dashboard — super_admin : rôle + allowlist email
      // (voir _shared/require-super-admin.ts, migration 20260705160000)
      const auth = await requireSuperAdmin(req, corsHeaders)
      if (auth instanceof Response) return auth
    }

    // ── Collect metrics ──
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // Basic counts from Supabase tables
    const [agencyCount, userCount, propertyCount, transactionCount, errorCount, emailCount] = await Promise.all([
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
        .eq('action', 'edge_function_error').gte('created_at', dayAgo),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
        .eq('action', 'email_sent').gte('created_at', todayStart),
    ])

    // ── Pro plan: Real DB size via SQL ──
    let dbSizeMb = 0
    try {
      const { data: dbSize } = await supabaseAdmin.rpc('pg_database_size_mb', {})
      dbSizeMb = dbSize ?? 0
    } catch {
      // Fallback: query pg_database_size directly
      try {
        const { data } = await supabaseAdmin
          .from('pg_stat_database')
          .select('pg_database_size')
          .limit(1)
          .single()
        dbSizeMb = data ? Math.round(Number(data.pg_database_size) / (1024 * 1024)) : 0
      } catch {
        dbSizeMb = 160 // Fallback
      }
    }

    // ── Pro plan: Storage usage via pg_total_relation_size on storage.objects ──
    let storageUsedMb = 0
    try {
      // Query the actual size of all objects in Supabase Storage via the
      // internal storage.objects table. This is more accurate than the previous
      // bucket-count heuristic (buckets.length * 10 MB) which was always wrong.
      const { data: sizeRow } = await supabaseAdmin.rpc('storage_size_mb', {})
      storageUsedMb = sizeRow ?? 0
    } catch {
      // Fallback: count objects and estimate 500 KB average per file
      try {
        const { count } = await supabaseAdmin
          .from('objects' as never) // storage.objects schema
          .select('id', { count: 'exact', head: true })
        storageUsedMb = Math.round(((count ?? 0) * 0.5) / 1) // 0.5 MB avg
      } catch {
        storageUsedMb = 0
      }
    }

    // ── Flatfox sync health ──
    // Track listing count and last sync time so AdminMonitoringPage can show
    // whether the daily pg_cron sync ran successfully.
    let flatfoxActiveCount = 0
    let flatfoxLastSeen: string | null = null
    try {
      const [countRes, lastRes] = await Promise.all([
        // ⚠ CE COMPTAGE EST LENT ET LE RESTE — seule sa façon d'ÉCHOUER est corrigée ici.
        // Mesuré le 03.09.2026 : 17 933 ms à froid (bitmap heap scan, 23 625 blocs de tas),
        // ~480 ms à chaud. D'où 19 timeouts par 24 h dans les journaux postgres.
        // Le vrai dégât n'était pas la lenteur mais le `?? 0` plus bas : un échec publiait la
        // métrique à ZÉRO, indiscernable d'un corpus Flatfox réellement effondré.
        //
        // ⛔ TROIS PISTES ESSAYÉES ET ÉCARTÉES PAR LA MESURE, ne pas les redérouler :
        //  1. `count: 'estimated'` — le planificateur donne 45 178 pour 35 340 lignes réelles,
        //     après ANALYZE. 10 000 annonces d'écart sur la carte qui sert justement à repérer
        //     une synchro en panne : c'est le chiffre lui-même qui perdrait son sens.
        //  2. Index partiel dédié `(status) WHERE source_portal='flatfox' AND status='active'`
        //     (256 ko, 35 340 entrées) — CRÉÉ ET MESURÉ : le planificateur ne le choisit PAS.
        //     La carte de visibilité de market_listings n'est à jour qu'à 58 % des pages
        //     (table écrite en continu), donc un index-only scan devrait aller chercher ~42 %
        //     des lignes dans le tas et coûte plus cher que le bitmap. L'index a été retiré.
        //  3. `idx_ml_flatfox_sync` — l'index que le commentaire d'AdminMonitoringPage crédite
        //     de 166 ms : vrai à 173k lignes, faux à 250k, le planificateur ne le prend plus.
        //
        // Ce qui reste à trancher (décision produit, pas technique) : soit accepter la lenteur,
        // soit lire `total_seen` du dernier `flatfox_sync_runs` — bon marché et fidèle au but
        // affiché de la carte (« la synchro a-t-elle tourné ? »), mais ce n'est plus le même
        // chiffre, et le libellé i18n `admin:monitoring.flatfox.activeListings` devrait suivre.
        supabaseAdmin.from('market_listings').select('id', { count: 'exact', head: true })
          .eq('source_portal', 'flatfox').eq('status', 'active'),
        supabaseAdmin.from('market_listings').select('last_seen_at')
          .eq('source_portal', 'flatfox').order('last_seen_at', { ascending: false }).limit(1),
      ])
      // -1 (et non 0) quand le compte est indisponible : la page doit pouvoir distinguer
      // « zéro annonce » de « je n'ai pas pu compter ».
      flatfoxActiveCount = countRes.count ?? -1
      flatfoxLastSeen = lastRes.data?.[0]?.last_seen_at ?? null
    } catch { /* non-critical */ }

    // ── Open support tickets ──
    let openTickets = 0
    try {
      const { count } = await supabaseAdmin.from('support_tickets')
        .select('id', { count: 'exact', head: true }).in('status', ['new', 'open'])
      openTickets = count ?? 0
    } catch { /* non-critical */ }

    // ── Store all metrics ──
    const metrics = [
      { metric_type: 'agency_count', metric_value: agencyCount.count ?? 0 },
      { metric_type: 'user_count', metric_value: userCount.count ?? 0 },
      { metric_type: 'property_count', metric_value: propertyCount.count ?? 0 },
      { metric_type: 'transaction_count', metric_value: transactionCount.count ?? 0 },
      { metric_type: 'error_count_24h', metric_value: errorCount.count ?? 0 },
      { metric_type: 'email_count_today', metric_value: emailCount.count ?? 0 },
      { metric_type: 'db_size_mb', metric_value: dbSizeMb },
      { metric_type: 'storage_used_mb', metric_value: storageUsedMb },
      { metric_type: 'flatfox_active_count', metric_value: flatfoxActiveCount },
      { metric_type: 'open_tickets', metric_value: openTickets },
    ]

    // ── Santé du token Meta WhatsApp (expiration → panne silencieuse des envois) ──
    // Best-effort (non-critique) : métrique de tendance + état courant dans app_config
    // + log d'alerte si invalide ou expire bientôt. Réutilise ce cron horaire.
    try {
      const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
      if (metaToken) {
        const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
        const health = await checkMetaToken(metaToken, apiVersion, now.getTime())
        metrics.push({ metric_type: 'whatsapp_token_days_left', metric_value: tokenDaysMetric(health) })
        await supabaseAdmin.from('app_config').upsert(
          { key: 'whatsapp_token_health', value: JSON.stringify({ ...health, checked_at: now.toISOString() }) },
          { onConflict: 'key' },
        )
        if (tokenNeedsAlert(health)) {
          console.error('[whatsapp] ALERTE token Meta:',
            health.isValid ? `expire dans ${health.daysLeft} j` : `INVALIDE (${health.error})`)
        }
      }
    } catch (e) { console.error('whatsapp token check failed:', (e as Error)?.name ?? 'error') }

    // ── Dead-letters WhatsApp (audit WA) — files d'échec ni enregistrées ni
    // surveillées jusqu'ici. RPC serveur (une passe indexée par signal). 5
    // compteurs → tendance dans platform_metrics + alerting du taux 24h.
    // Best-effort : ne casse jamais la collecte.
    let waDeadletters: WhatsAppDeadletters | undefined
    try {
      const { data: dl, error: dlErr } = await supabaseAdmin.rpc('get_whatsapp_deadletter_metrics')
      // supabase-js ne LÈVE PAS sur erreur DB (RAISE 42501 / statement timeout /
      // permission) : il faut lire `error`. Sur échec → métriques ABSENTES (pas
      // de fausse-zéro qui masquerait un backlog réel) et alerte non évaluée.
      if (dlErr) throw dlErr
      const c = (dl ?? {}) as Record<string, unknown>
      const n = (k: string) => Number(c[k] ?? 0) || 0
      waDeadletters = {
        processing_failed: n('processing_failed'),
        processing_deadletter: n('processing_deadletter'),
        processing_deadletter_24h: n('processing_deadletter_24h'),
        agent_errors_24h: n('agent_errors_24h'),
        delivery_failed_24h: n('delivery_failed_24h'),
        async_jobs_failed_24h: n('async_jobs_failed_24h'),
      }
      metrics.push(
        { metric_type: 'wa_processing_failed', metric_value: waDeadletters.processing_failed },
        { metric_type: 'wa_processing_deadletter', metric_value: waDeadletters.processing_deadletter },
        { metric_type: 'wa_agent_errors_24h', metric_value: waDeadletters.agent_errors_24h },
        { metric_type: 'wa_delivery_failed_24h', metric_value: waDeadletters.delivery_failed_24h },
        { metric_type: 'wa_async_jobs_failed_24h', metric_value: waDeadletters.async_jobs_failed_24h },
      )
    } catch (e) { console.error('whatsapp deadletter metrics failed:', (e as Error)?.message ?? 'error') }

    // ── Santé des intégrations + MRR estimé (P7) — 2 RPC serveur, best-effort.
    // mrr_estimate + calendar_sync_stale_count + stripe_webhook_age_hours →
    // tendance dans platform_metrics + signaux passés à l'alerting.
    let calendarStaleCount: number | undefined
    let stripeWebhookAgeHours: number | null | undefined
    let activeSubscriptions: number | undefined
    try {
      const { data: mrr, error: mrrErr } = await supabaseAdmin.rpc('compute_platform_mrr_estimate')
      if (mrrErr) throw mrrErr
      metrics.push({ metric_type: 'mrr_estimate', metric_value: Number(mrr ?? 0) })

      const { data: health, error: healthErr } = await supabaseAdmin.rpc('get_admin_integrations_health')
      if (healthErr) throw healthErr
      const h = (health ?? {}) as Record<string, Record<string, unknown>>
      calendarStaleCount = Number(h.calendar?.stale_total ?? 0) || 0
      stripeWebhookAgeHours = h.stripe_webhook?.age_hours == null ? null : Number(h.stripe_webhook.age_hours)
      activeSubscriptions = Number(h.stripe_webhook?.active_subscriptions ?? 0) || 0
      metrics.push(
        { metric_type: 'calendar_sync_stale_count', metric_value: calendarStaleCount },
        { metric_type: 'stripe_webhook_age_hours', metric_value: stripeWebhookAgeHours ?? -1 },
      )
    } catch (e) {
      console.error('[admin-monitoring] integrations health failed:', (e as Error)?.message ?? 'error')
    }

    await supabaseAdmin.from('platform_metrics').insert(metrics)

    // Rétention 180 jours. Cette table n'en avait AUCUNE : elle grossit d'une
    // vingtaine de lignes par heure depuis avril 2026 et ne se vidait jamais.
    // La purge tient ici plutôt que dans un cron dédié — ce job tourne déjà
    // toutes les heures, et c'est lui qui écrit ces lignes. Le seul écran qui
    // les lit (`MrrSparkline`) remonte à 30 jours : 180 laisse six fois la marge
    // nécessaire, de quoi ouvrir une vue plus longue sans toucher à la purge.
    // Best-effort : une purge en échec ne doit pas perdre la collecte.
    try {
      const cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
      await supabaseAdmin.from('platform_metrics').delete().lt('recorded_at', cutoff)
    } catch (e) {
      console.error('[admin-monitoring] purge platform_metrics failed:', (e as Error)?.message ?? 'error')
    }

    // ── Alerting proactif (P3) — seuils app_config, dédup 24h, email aux
    // admins allowlistés. Best-effort : ne casse jamais la collecte.
    try {
      await evaluateAndSendAlerts(supabaseAdmin, {
        errorCount24h: errorCount.count ?? 0,
        flatfoxLastSeen,
        waDeadletters,
        calendarStaleCount,
        stripeWebhookAgeHours,
        activeSubscriptions,
        now,
      })
    } catch (e) {
      console.error('[admin-monitoring] alerting failed:', (e as Error)?.message)
    }

    return new Response(JSON.stringify({
      success: true,
      metrics,
      plan: 'pro',
      recorded_at: now.toISOString(),
      flatfox_last_seen: flatfoxLastSeen,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Un rejet d'authentification n'est pas une panne : il ne s'audite pas.
    // Sans cette distinction, n'importe quel appelant anonyme ferait écrire une
    // ligne dans `activity_events` — un moyen trivial de noyer la piste d'audit.
    if (err instanceof Unauthorized) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Tout le reste est une panne interne : une RPC de santé qui échoue, un
    // timeout, un bug de collecte. La fonction qui surveille la plateforme est
    // justement celle dont la panne doit se voir — d'autant qu'elle tourne sans
    // spectateur (cron horaire `platform-metrics-hourly`).
    const message = (err as Error)?.message ?? 'monitoring failed'
    console.error('[admin-monitoring] collecte en échec:', message)
    await reportEdgeError(supabaseAdmin, 'admin-monitoring', err, { startedAt })

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
