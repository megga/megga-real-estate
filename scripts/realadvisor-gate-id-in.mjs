#!/usr/bin/env node

/**
 * Gate empirique `id_in` — mesure le taux de FAUX ABSENTS parmi les candidats au retrait
 * du sweep RealAdvisor, en rejouant l'oracle depuis un poste plutôt que depuis pg_net.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs --apply
 *
 * À lancer quand le sweep sort `capped` 3 nuits d'affilée. Il tranche entre les deux
 * causes possibles, et une seule des deux se voit dans notre base :
 *   1. la sonde se trompe (faux absents) → visible ici, il faut un garde-fou ;
 *   2. notre vivier est gonflé face au catalogue réel de RA → la sonde est saine et le
 *      sweep SOUS-retire ; c'est l'écart live ↔ `total_count` qui le dit, pas le gate.
 * Le script mesure les DEUX, parce que mesurer la 1re seule mène à la mauvaise conclusion
 * (constaté le 11/08/2026 : sonde innocentée à 0,3 %, mais +1 558 biens de trop chez nous).
 *
 * Historique : 35,5 % de faux absents le 03/08 (incident daté, burst du 01/08), puis 0,3 %
 * le 11/08 et 0,8 % le 13/08 — la sonde ne se trompe pas en régime normal.
 *
 * Sans `--apply` le script n'écrit RIEN. Avec, il rend les vivants à la file via
 * `realadvisor_probe_bookkeep` (branche « présent » : remet absent_probe_count à 0).
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local n'existe que sur les postes qui l'ont créé — un checkout frais n'en a pas.
// L'environnement prime, le fichier ne sert que de commodité locale.
function readEnvFile(key) {
  const path = resolve(__dirname, '..', '.env.local')
  if (!existsSync(path)) return undefined
  return readFileSync(path, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim()
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || readEnvFile('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Env manquant. Usage :\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs [--apply]\n' +
      `(VITE_SUPABASE_URL ${SUPABASE_URL ? 'ok' : 'absent'}, ` +
      `SUPABASE_SERVICE_ROLE_KEY ${SERVICE_KEY ? 'ok' : 'absent'} — ni env ni .env.local)`,
  )
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

const RA_BASE = 'https://realadvisor.ch'
const PROBE_BATCH = 36        // = cap d'une page RA ; au-delà la réponse serait tronquée
const CONTROL_SIZE = 36
const DELAY_MS = 1400         // throttle volontaire : ~0,7 req/s, sous le radar de RA
const THRESHOLD = 3           // doit suivre p_threshold de realadvisor_probe_sweep
const MIN_AGE_HOURS = 48      // idem p_min_age_hours

// Fallback aligné sur UA_DEFAULT de l'edge function : si app_config est vide, on sonde
// avec la même identité que la prod, sinon le gate auditerait un autre chemin que celui
// qu'il est censé mesurer.
const UA_DEFAULT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const DB_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Base ────────────────────────────────────────────────────

async function db(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...DB_HEADERS, ...init.headers } })
  if (!res.ok) throw new Error(`PostgREST ${res.status} sur ${path} — ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function configValue(key) {
  const rows = await db(`app_config?select=value&key=eq.${key}`)
  return String(rows[0]?.value ?? '').trim()
}

/** UA + From de prod (surchargeables sans redeploy) — cf. loadIdentity de l'edge fn. */
async function loadIdentity() {
  const rows = await db('app_config?select=key,value&key=in.(realadvisor_user_agent,realadvisor_contact_email)')
  const m = new Map(rows.map((r) => [r.key, String(r.value ?? '').trim()]))
  const ua = m.get('realadvisor_user_agent') ?? ''
  return { ua: ua.length >= 10 ? ua : UA_DEFAULT, from: m.get('realadvisor_contact_email') || null }
}

/**
 * État du sweep sans rien retirer. Donne le live EXACT, le nombre de candidats calculé par
 * le vrai prédicat, et le plafond du soir.
 *
 * ⚠ `p_cap_abs: null` reproduit le cron : le cap absolu de 1200 a été retiré le 02/08 et
 * le cron passe null. Le laisser à sa valeur par défaut afficherait un plafond que la prod
 * n'applique plus. `p_cap_pct` vit dans app_config depuis le 11/08, bornes identiques.
 */
async function sweepDryRun() {
  const raw = Number(await configValue('realadvisor_sweep_cap_pct'))
  const pct = Number.isFinite(raw) && raw > 0 ? Math.min(0.1, Math.max(0.005, raw)) : 0.03
  const out = await db('rpc/realadvisor_probe_sweep', {
    method: 'POST',
    body: JSON.stringify({
      p_offer_type: 'buy',
      p_threshold: THRESHOLD,
      p_min_age_hours: MIN_AGE_HOURS,
      p_cap_abs: null,
      p_cap_pct: pct,
      p_apply: false,
    }),
  })
  return { ...out, cap_pct: pct }
}

/**
 * Candidats au retrait, prédicat de `realadvisor_probe_sweep`.
 *
 * ⚠ La garde `last_seen_at < absent_first_at` (#927 : un bien re-vu vivant n'est plus
 * candidat) compare DEUX COLONNES — PostgREST ne sait pas l'exprimer. On pousse tout le
 * reste au serveur et on applique cette dernière clause ici, sur un jeu déjà étroit. Le
 * total est recoupé avec celui du dry-run : un écart signale que ce prédicat a dérivé.
 */
async function loadCandidates() {
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 3600_000).toISOString()
  const rows = await db(
    'market_listings?select=source_id,absent_first_at,last_seen_at' +
      '&source_portal=eq.realadvisor&transaction_type=eq.buy' +
      '&status=in.(active,price_reduced)' +
      `&absent_probe_count=gte.${THRESHOLD}` +
      `&absent_first_at=lt.${cutoff}` +
      '&order=absent_first_at.asc&limit=20000',
  )
  return rows
    .filter((r) => r.last_seen_at === null || new Date(r.last_seen_at) < new Date(r.absent_first_at))
    .map((r) => r.source_id)
}

/** Lot témoin : des biens que la sonde tient pour VIVANTS. Si l'oracle les dit partis, il
 *  est throttlé et tout le reste du run est sans valeur. */
async function loadControl() {
  const seen = new Date(Date.now() - 18 * 3600_000).toISOString()
  const rows = await db(
    'market_listings?select=source_id' +
      '&source_portal=eq.realadvisor&transaction_type=eq.buy' +
      '&status=in.(active,price_reduced)&absent_probe_count=eq.0' +
      `&last_seen_at=gt.${seen}&order=last_seen_at.desc&limit=${CONTROL_SIZE}`,
  )
  return rows.map((r) => r.source_id)
}

// ── Oracle RA ───────────────────────────────────────────────

/** GET /api/listings avec backoff. Rend `ok:false` sur throttle — jamais « absent ». */
async function raGet(sp, ident) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': ident.ua,
    'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
    ...(ident.from ? { From: ident.from } : {}),
  }
  for (let attempt = 0; attempt <= 3; attempt++) {
    let res
    try {
      res = await fetch(`${RA_BASE}/api/listings?${sp}`, { headers })
    } catch (e) {
      if (attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
      return { ok: false, reason: `réseau: ${e.message}` }
    }
    if (res.ok) {
      const text = await res.text()
      try {
        const body = JSON.parse(text)
        return { ok: true, total_count: body.total_count ?? 0, present: (body.listings ?? []).map((l) => String(l.id)) }
      } catch {
        // 200 mais pas du JSON = page anti-bot ⇒ throttle silencieux, surtout pas « absent ».
        if (attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
        return { ok: false, reason: '200 non-JSON (throttle silencieux)' }
      }
    }
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
    return { ok: false, reason: `HTTP ${res.status}` }
  }
  return { ok: false, reason: 'retries épuisés' }
}

/**
 * « Sur ces ≤36 ids, lesquels existent encore ? »
 * ⚠ `page=0` : RA indexe ses pages à 0, et `page=1` sur un lot de ≤36 renvoie une liste
 * VIDE — tout le lot serait compté absent (bug #920, à ne pas réintroduire ici).
 */
const fetchIdIn = (ids, ident) =>
  raGet(new URLSearchParams({ offerType_eq: 'buy', id_in: ids.join(','), page: '0' }), ident)

/** Catalogue national déclaré par RA — le discriminant d'un `capped`. */
const fetchCatalogueTotal = (ident) =>
  raGet(new URLSearchParams({ offerType_eq: 'buy', page: '0' }), ident)

async function runCohort(label, ids, ident) {
  const alive = []
  let gone = 0
  let ambiguous = 0
  const failures = []
  const lots = Math.ceil(ids.length / PROBE_BATCH)
  for (let i = 0; i < ids.length; i += PROBE_BATCH) {
    const lot = ids.slice(i, i + PROBE_BATCH)
    const n = i / PROBE_BATCH + 1
    const r = await fetchIdIn(lot, ident)
    if (!r.ok) {
      failures.push({ lot: n, reason: r.reason })
      console.error(`[${label}] lot ${n}/${lots} ÉCHEC — ${r.reason}`)
    } else if (r.total_count !== r.present.length) {
      // Garde dure : array et total_count qui divergent = troncature ou throttle. Aucune
      // écriture, aucun comptage — exactement comme la sonde de prod.
      ambiguous++
      console.error(`[${label}] lot ${n}/${lots} AMBIGU — total_count=${r.total_count} vs array=${r.present.length}`)
    } else {
      const present = new Set(r.present)
      for (const id of lot) {
        if (present.has(id)) alive.push(id)
        else gone++
      }
      console.log(`[${label}] lot ${n}/${lots} — présents ${r.present.length}/${lot.length}`)
    }
    await sleep(DELAY_MS)
  }
  return { total: ids.length, alive, gone, ambiguous, failures }
}

// ── Geste correctif ─────────────────────────────────────────

/**
 * Rend les vivants à la file. Relit `absent_probe_count` JUSTE AVANT : mesuré le
 * 13/08/2026, 4 des 5 vivants s'étaient déjà auto-corrigés pendant le run (la sonde
 * horaire les avait re-vus). Les compter comme des erreurs de la sonde sur-estimait le
 * taux d'un facteur 5, et les « corriger » aurait été un geste à vide.
 */
async function applyBookkeep(aliveIds) {
  const rows = await db(
    'market_listings?select=source_id,absent_probe_count' +
      `&source_portal=eq.realadvisor&source_id=in.(${aliveIds.join(',')})`,
  )
  const stale = rows.filter((r) => (r.absent_probe_count ?? 0) > 0).map((r) => r.source_id)
  const selfHealed = aliveIds.length - stale.length
  if (stale.length > 0) {
    await db('rpc/realadvisor_probe_bookkeep', {
      method: 'POST',
      body: JSON.stringify({ p_present: stale, p_absent: [], p_min_gap_hours: 20 }),
    })
  }
  return { applied: stale.length, selfHealed, ids: stale }
}

// ── Main ────────────────────────────────────────────────────

const ident = await loadIdentity()
const [sweep, candidates, control] = await Promise.all([sweepDryRun(), loadCandidates(), loadControl()])

console.log(`Gate id_in — UA « ${ident.ua.slice(0, 44)}… »`)
console.log(`live ${sweep.live} · candidats ${sweep.candidates} · plafond ${sweep.limit} (${sweep.cap_pct * 100} %)`)
if (candidates.length !== Number(sweep.candidates)) {
  console.warn(
    `⚠ prédicat divergent : ${candidates.length} candidats reconstruits ici contre ` +
      `${sweep.candidates} côté RPC. Le prédicat du script a dérivé de realadvisor_probe_sweep.`,
  )
}
console.log(APPLY ? '⚠ mode --apply : les vivants seront rendus à la file\n' : 'mode constat (aucune écriture)\n')

if (candidates.length === 0) {
  console.log('Aucun candidat au retrait — rien à mesurer.')
  process.exit(0)
}

// Contrôle D'ABORD : inutile de sonder 600 ids si l'oracle ment déjà sur 36 vivants.
const ctrl = await runCohort('contrôle', control, ident)
const ctrlOk = ctrl.alive.length >= ctrl.total - 2
console.log(`\n→ contrôle : ${ctrl.alive.length}/${ctrl.total} présents — oracle ${ctrlOk ? 'SAIN' : '⚠ SUSPECT'}\n`)
if (!ctrlOk) {
  console.error('Oracle throttlé ou cassé : les absences mesurées ne vaudraient rien. Arrêt.')
  process.exit(2)
}

const cand = await runCohort('candidats', candidates, ident)
const mesures = cand.alive.length + cand.gone
const pct = mesures > 0 ? ((cand.alive.length / mesures) * 100).toFixed(1) : '—'
const cat = await fetchCatalogueTotal(ident)

console.log('\n═══ RÉSULTAT ═══')
console.log(`contrôle     : ${ctrl.alive.length}/${ctrl.total} présents`)
console.log(`candidats    : ${cand.alive.length} encore en ligne sur ${mesures} mesurés = ${pct} % de faux absents`)
console.log(`  dont 500*  : ${cand.alive.filter((i) => i.startsWith('500')).length}`)
console.log(`lots ambigus : ${cand.ambiguous} · échecs : ${cand.failures.length}`)
if (cand.alive.length > 0) console.log(`ids vivants  : ${cand.alive.join(',')}`)

if (APPLY && cand.alive.length > 0) {
  const r = await applyBookkeep(cand.alive)
  console.log(`\n→ bookkeep : ${r.applied} rendus à la file, ${r.selfHealed} déjà auto-corrigés par la sonde`)
} else if (cand.alive.length > 0) {
  console.log('\nRelancer avec --apply pour les rendre à la file.')
}

// Le second discriminant, celui que le gate seul ne voit pas.
console.log('\n═══ VIVIER vs CATALOGUE RA ═══')
if (!cat.ok) {
  console.log(`catalogue indisponible (${cat.reason}) — écart non mesuré.`)
} else {
  const ecart = sweep.live - cat.total_count
  console.log(`live ${sweep.live} · RA déclare ${cat.total_count} · écart ${ecart >= 0 ? '+' : ''}${ecart}`)
  console.log(
    ecart > 500
      ? '⇒ vivier gonflé : le sweep SOUS-retire. Laisser drainer, ou relever app_config.realadvisor_sweep_cap_pct.'
      : '⇒ vivier aligné sur le catalogue : un `capped` ne traduit plus qu\'un inflow qui frôle le plafond.',
  )
}
