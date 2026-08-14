#!/usr/bin/env node
// Sonde de bascule Meta WhatsApp — vérifie une configuration Meta AVANT de la
// poser en secrets Supabase (ou après, pour diagnostiquer une panne d'envoi).
//
// POURQUOI. Un changement de portefeuille Meta (Business Portfolio) fait changer
// CINQ valeurs d'un coup — app secret, token système, phone number id, WABA, noms
// de templates — et chacune casse en silence : un token sans le bon scope rend un
// 200 sur `debug_token` mais un 190 à l'envoi ; un `phone_number_id` de l'ANCIEN
// WABA reste appelable tant que l'ancien portefeuille vit ; un template approuvé
// dont le corps diverge d'un caractère part quand même et rend 132000
// (nombre de paramètres) ou un rendu faux. La sonde tape Graph et compare au
// registre du code, au lieu de croire l'écran de Meta Business Manager.
//
// Ce n'est PAS une porte CI (elle appelle l'API Meta avec un token vivant) :
// c'est l'outil du jour de bascule et du renouvellement de token.
//
// Usage — les valeurs passent par l'ENV, jamais en argument (un argument reste
// dans l'historique du shell) :
//
//   META_WHATSAPP_TOKEN=EAA… META_PHONE_NUMBER_ID=… META_WABA_ID=… \
//     node scripts/wa-meta-check.mjs
//
// Optionnels : META_API_VERSION (défaut v22.0, la valeur de repli du code),
// WA_TEMPLATE_FOLLOWUP / _AVAILABILITY / _NEW_LISTINGS (+ _LANG) pour vérifier
// l'approbation ET le corps, WHATSAPP_VERIFY_TOKEN pour éprouver le handshake
// du webhook déployé.
//
// Sortie : un rapport par bloc, exit 1 si un contrôle échoue.
import { readFileSync } from 'node:fs';

const API_VERSION = process.env.META_API_VERSION || 'v22.0';
const TOKEN = (process.env.META_WHATSAPP_TOKEN || '').trim();
const PHONE_NUMBER_ID = (process.env.META_PHONE_NUMBER_ID || '').trim();
const WABA_ID = (process.env.META_WABA_ID || '').trim();
const VERIFY_TOKEN = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
const WEBHOOK_URL = process.env.MEGGA_WEBHOOK_URL
  || 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/whatsapp-webhook';

/** Scopes sans lesquels le reste ment : l'un envoie, l'autre lit templates et WABA. */
const REQUIRED_SCOPES = ['whatsapp_business_messaging', 'whatsapp_business_management'];

const TEMPLATES_TS = 'supabase/functions/_shared/whatsapp-templates.ts';

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const skip = (m) => console.log(`  \x1b[90m·\x1b[0m ${m}`);
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/** GET Graph. Ne lève pas : rend { ok, status, json } pour que chaque bloc décide. */
async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', TOKEN);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: { message: e?.message ?? String(e) } } };
  }
}

const errMsg = (r) => r.json?.error?.message ?? `HTTP ${r.status}`;

/**
 * Lit les corps de référence dans le registre TS.
 *
 * POURQUOI PARSER PLUTÔT QUE RECOPIER. Le corps attendu vit dans une edge function
 * (runtime Deno, TS) qu'un script Node ne peut pas importer — et le dupliquer ici
 * ferait DEUX vérités qui divergeraient au premier ajustement de copie. On lit donc
 * le fichier source : si le registre change, la sonde suit.
 */
function readTemplateRegistry() {
  const src = readFileSync(TEMPLATES_TS, 'utf8');
  const out = {};
  // Chaque entrée : `key: { nameEnv: '…', langEnv: '…', defaultLang: '…', bodyText: '…',`
  const re = /(\w+):\s*\{\s*nameEnv:\s*'([^']+)',\s*langEnv:\s*'([^']+)',\s*defaultLang:\s*'([^']+)',\s*bodyText:\s*'([^']*)'/g;
  for (const m of src.matchAll(re)) {
    out[m[1]] = { nameEnv: m[2], langEnv: m[3], defaultLang: m[4], bodyText: m[5] };
  }
  return out;
}

/** Compare deux corps de template en ignorant l'espace, mais RIEN d'autre. */
const normalizeBody = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

async function checkToken() {
  section('1 · Token');
  if (!TOKEN) { bad('META_WHATSAPP_TOKEN absent de l\'env'); return null; }
  const r = await graph('debug_token', { input_token: TOKEN });
  if (!r.ok) { bad(`debug_token : ${errMsg(r)}`); return null; }
  const d = r.json?.data;
  if (!d) { bad('debug_token : réponse illisible'); return null; }

  if (d.is_valid) ok(`valide — app ${d.app_id ?? '?'} (${d.application ?? 'app sans nom'})`);
  else { bad(`INVALIDE : ${d.error?.message ?? 'raison non fournie'}`); return d; }

  if (!d.expires_at) ok('n\'expire jamais (token System User)');
  else {
    const days = Math.floor((d.expires_at * 1000 - Date.now()) / 86_400_000);
    // Un token utilisateur expire ; en prod il rendra une panne muette d'envoi.
    warn(`expire dans ${days} j (${new Date(d.expires_at * 1000).toISOString().slice(0, 10)}) — préférer un token System User permanent`);
  }

  const scopes = Array.isArray(d.scopes) ? d.scopes : [];
  for (const s of REQUIRED_SCOPES) {
    if (scopes.includes(s)) ok(`scope ${s}`);
    else bad(`scope MANQUANT : ${s}`);
  }
  return d;
}

async function checkPhoneNumber() {
  section('2 · Numéro (META_PHONE_NUMBER_ID)');
  if (!PHONE_NUMBER_ID) { bad('META_PHONE_NUMBER_ID absent de l\'env'); return null; }
  const r = await graph(PHONE_NUMBER_ID, {
    fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput',
  });
  if (!r.ok) { bad(`inaccessible avec ce token : ${errMsg(r)}`); return null; }
  const p = r.json;
  ok(`${p.display_phone_number ?? '?'} — « ${p.verified_name ?? '?'} »`);
  if (p.code_verification_status && p.code_verification_status !== 'VERIFIED') {
    bad(`numéro non vérifié (code_verification_status=${p.code_verification_status}) → aucun envoi`);
  } else ok('numéro vérifié');
  if (p.quality_rating) {
    const q = String(p.quality_rating).toUpperCase();
    if (q === 'GREEN' || q === 'UNKNOWN') ok(`quality_rating ${q}`);
    else warn(`quality_rating ${q} — quotas réduits par Meta`);
  }
  if (p.platform_type) skip(`platform_type ${p.platform_type}`);
  return p;
}

async function checkWabaBinding() {
  section('3 · WABA et souscription webhook');
  if (!WABA_ID) { skip('META_WABA_ID non fourni → blocs WABA/templates ignorés'); return false; }

  const r = await graph(WABA_ID, { fields: 'id,name,timezone_id,message_template_namespace,account_review_status' });
  if (!r.ok) { bad(`WABA inaccessible : ${errMsg(r)}`); return false; }
  ok(`WABA « ${r.json.name ?? '?'} » (${WABA_ID})`);
  if (r.json.account_review_status) {
    const s = String(r.json.account_review_status).toUpperCase();
    if (s === 'APPROVED') ok('account_review_status APPROVED');
    else warn(`account_review_status ${s}`);
  }

  // Le numéro doit appartenir à CE WABA. Sans ce contrôle, un phone_number_id
  // resté de l'ancien portefeuille passe les blocs 1 et 2 sans broncher.
  const nums = await graph(`${WABA_ID}/phone_numbers`, { fields: 'id,display_phone_number' });
  if (!nums.ok) warn(`liste des numéros du WABA illisible : ${errMsg(nums)}`);
  else {
    const ids = (nums.json?.data ?? []).map((n) => n.id);
    if (!PHONE_NUMBER_ID) skip('pas de numéro à rattacher');
    else if (ids.includes(PHONE_NUMBER_ID)) ok('le numéro appartient bien à ce WABA');
    else bad(`le numéro ${PHONE_NUMBER_ID} n'appartient PAS à ce WABA (numéros : ${ids.join(', ') || 'aucun'})`);
  }

  // Souscription de l'app aux webhooks du WABA : sans elle, zéro inbound —
  // et rien ne le signale, la conversation reste simplement muette.
  const subs = await graph(`${WABA_ID}/subscribed_apps`);
  if (!subs.ok) warn(`subscribed_apps illisible : ${errMsg(subs)}`);
  else {
    const apps = subs.json?.data ?? [];
    if (apps.length === 0) bad('AUCUNE app souscrite aux webhooks de ce WABA → aucun message entrant');
    else ok(`app(s) souscrite(s) : ${apps.map((a) => a.whatsapp_business_api_data?.name ?? a.whatsapp_business_api_data?.id ?? '?').join(', ')}`);
  }
  return true;
}

async function checkTemplates(wabaOk) {
  section('4 · Templates (WA_TEMPLATE_*)');
  const registry = readTemplateRegistry();
  const keys = Object.keys(registry);
  if (keys.length === 0) { bad(`registre illisible dans ${TEMPLATES_TS}`); return; }

  const configured = keys.filter((k) => (process.env[registry[k].nameEnv] || '').trim());
  if (configured.length === 0) {
    skip(`aucun WA_TEMPLATE_* posé → chemin hors-fenêtre-24h INERTE (repli gracieux, 0 impact prod)`);
    skip(`clés disponibles : ${keys.map((k) => registry[k].nameEnv).join(', ')}`);
    return;
  }
  if (!wabaOk) { warn('META_WABA_ID requis pour vérifier l\'approbation — contrôle sauté'); return; }

  const r = await graph(`${WABA_ID}/message_templates`, { fields: 'name,status,language,components', limit: '200' });
  if (!r.ok) { bad(`liste des templates illisible : ${errMsg(r)}`); return; }
  const all = r.json?.data ?? [];

  for (const key of configured) {
    const def = registry[key];
    const name = process.env[def.nameEnv].trim();
    const lang = (process.env[def.langEnv] || '').trim() || def.defaultLang;
    const match = all.find((t) => t.name === name && t.language === lang);
    if (!match) {
      bad(`${key} → « ${name} » (${lang}) introuvable dans ce WABA — les templates ne migrent PAS entre WABA, il faut les re-soumettre`);
      continue;
    }
    if (match.status !== 'APPROVED') { bad(`${key} → « ${name} » statut ${match.status}`); continue; }

    const body = (match.components ?? []).find((c) => c.type === 'BODY')?.text ?? '';
    if (normalizeBody(body) === normalizeBody(def.bodyText)) {
      ok(`${key} → « ${name} » (${lang}) APPROVED, corps conforme au registre`);
    } else {
      bad(`${key} → « ${name} » APPROVED mais le corps DIVERGE du registre`);
      console.log(`      attendu : ${normalizeBody(def.bodyText)}`);
      console.log(`      approuvé: ${normalizeBody(body)}`);
    }
  }
}

async function checkWebhookHandshake() {
  section('5 · Handshake webhook (edge déployée)');
  if (!VERIFY_TOKEN) { skip('WHATSAPP_VERIFY_TOKEN non fourni → handshake non éprouvé'); return; }
  const url = new URL(WEBHOOK_URL);
  url.searchParams.set('hub.mode', 'subscribe');
  url.searchParams.set('hub.verify_token', VERIFY_TOKEN);
  url.searchParams.set('hub.challenge', 'megga-probe');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = (await res.text()).trim();
    if (res.status === 200 && text === 'megga-probe') ok(`${WEBHOOK_URL} rend le challenge — le verify token en prod correspond`);
    else if (res.status === 403) bad('403 : le WHATSAPP_VERIFY_TOKEN testé ≠ celui posé en secret Supabase');
    else bad(`réponse inattendue (HTTP ${res.status}) : ${text.slice(0, 80)}`);
  } catch (e) {
    bad(`webhook injoignable : ${e?.message ?? e}`);
  }
}

console.log(`\x1b[1mSonde Meta WhatsApp\x1b[0m — API ${API_VERSION}`);
const token = await checkToken();
if (token?.is_valid) {
  await checkPhoneNumber();
  const wabaOk = await checkWabaBinding();
  await checkTemplates(wabaOk);
} else {
  warn('token invalide → blocs 2 à 4 sautés (tout en dépend)');
}
await checkWebhookHandshake();

console.log('');
if (failures > 0) {
  console.log(`\x1b[31m${failures} contrôle(s) en échec\x1b[0m — ne pas basculer les secrets tant qu'ils tiennent.`);
  process.exit(1);
}
console.log('\x1b[32mTous les contrôles passent.\x1b[0m');
