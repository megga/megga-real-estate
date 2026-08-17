#!/usr/bin/env node
// Soumet à Meta les templates de `_shared/whatsapp-templates.ts`, DANS LES 4 LANGUES.
//
// POURQUOI UN SCRIPT PLUTÔT QUE L'INTERFACE. Le corps soumis doit correspondre au
// caractère près à celui que le code enverra — mêmes `{{n}}`, dans le même ordre.
// Retaper vingt textes dans un formulaire, c'est vingt occasions de glisser une
// espace ou d'inverser deux variables, et l'écart ne se voit qu'au moment où un
// client reçoit un message bancal. Ici les corps sont LUS dans le registre : la
// source de vérité reste le code.
//
// CHEZ META, un nom de template porte PLUSIEURS langues : on ne crée pas
// `megga_followup_de`, on ajoute la traduction `de` à `megga_followup`. C'est
// `language.code` qui choisit à l'envoi.
//
// Usage :
//   set -a; source .env.meta; set +a; node scripts/wa-submit-templates.mjs
//   … --dry-run   → affiche ce qui serait soumis, sans rien envoyer
//   … --status    → liste l'état côté Meta (statut ET catégorie EFFECTIVE)
//   … --lang=de   → restreint à une langue
//
// ⚠ La catégorie rendue par Meta peut différer de celle demandée (mesuré le
// 14.08.2026 : `megga_agent_daily_brief` soumis UTILITY, approuvé MARKETING).
// Toujours relire `--status`, jamais présumer.

import { readFileSync } from 'node:fs';

const API_VERSION = process.env.META_API_VERSION || 'v22.0';
const TOKEN = (process.env.META_WHATSAPP_TOKEN || '').trim();
const WABA_ID = (process.env.META_WABA_ID || '').trim();
const TEMPLATES_TS = 'supabase/functions/_shared/whatsapp-templates.ts';

const dryRun = process.argv.includes('--dry-run');
const statusOnly = process.argv.includes('--status');
const langArg = process.argv.find((a) => a.startsWith('--lang='))?.slice(7);

/**
 * Par clé du registre : nom Meta, catégorie demandée, et exemples PAR LANGUE.
 *
 * Les exemples ne sont pas décoratifs — Meta refuse un template à variables sans
 * `example`, et le relecteur juge la catégorie sur eux. Ils sont donc crédibles
 * dans chaque langue : un prénom et une raison sociale de la région concernée.
 */
const PLAN = {
  followup: {
    name: 'megga_followup', category: 'MARKETING',
    examples: {
      fr: ['Marie', 'Gregory Lyonnet'],
      de: ['Markus', 'Meier Immobilien AG'],
      en: ['James', 'Gregory Lyonnet'],
      it: ['Luca', 'Immobiliare Ceresio SA'],
    },
  },
  availability: {
    name: 'megga_availability', category: 'UTILITY',
    examples: {
      fr: ['Marie', 'Gregory Lyonnet', 'une visite'],
      de: ['Nicole', 'Bucher Immobilien AG', 'eine Besichtigung'],
      en: ['Emma', 'Lyonnet Immobilier', 'a viewing'],
      it: ['Chiara', 'Bernasconi Immobiliare SA', 'una visita'],
    },
  },
  new_listings: {
    name: 'megga_new_listings', category: 'MARKETING',
    examples: {
      fr: ['Marie', '3'], de: ['Stefan', '3'], en: ['James', '3'], it: ['Marco', '3'],
    },
  },
  agent_daily_brief: {
    name: 'megga_agent_daily_brief', category: 'UTILITY',
    examples: {
      fr: ['Gregory', '7'], de: ['Andrea', '7'], en: ['Gregory', '7'], it: ['Elena', '7'],
    },
  },
  kyc_documents_missing: {
    name: 'megga_kyc_documents_missing', category: 'UTILITY',
    examples: {
      fr: ['Marie', 'MEGGA Immobilier'],
      de: ['Beat', 'Zürisee Immobilien AG'],
      en: ['Emma', 'Lyonnet Immobilier'],
      it: ['Fabio', 'Studio Immobiliare Lugano SA'],
    },
  },
  // ⛔ SEUL TEMPLATE D'AUTHENTIFICATION, et il ne se soumet PAS comme les autres.
  //
  // Meta impose la catégorie AUTHENTICATION dès qu'un message porte un code à usage
  // unique : un template UTILITY qui en contient un est REFUSÉ (vérifié dans la
  // documentation Meta le 17.08.2026). En contrepartie, le corps n'est PAS le nôtre —
  // Meta l'écrit et le traduit, texte figé « <CODE> is your verification code. ». On ne
  // soumet donc ni texte ni exemple, mais TROIS composants imposés :
  //   · BODY   avec `add_security_recommendation` (ajoute « ne partagez pas ce code ») ;
  //   · FOOTER avec `code_expiration_minutes` (doit valoir le TTL réel de la RPC : 10) ;
  //   · BUTTONS avec un bouton OTP `COPY_CODE`.
  //
  // ⚠ `COPY_CODE` et non `ONE_TAP` : le remplissage automatique exige de déclarer les
  // applications autorisées (`supported_apps`, signature de paquet Android / bundle iOS).
  // MEGGA est une application WEB — il n'y a rien à déclarer, et un ONE_TAP sans
  // `supported_apps` est refusé.
  number_verification: {
    name: 'megga_number_verification', category: 'AUTHENTICATION',
    authentication: { codeExpirationMinutes: 10, securityRecommendation: true },
  },
};

/**
 * Lit les corps du registre TS, par clé puis par langue.
 *
 * POURQUOI PARSER PLUTÔT QUE RECOPIER. Le registre vit dans une edge function
 * (runtime Deno) qu'un script Node ne peut pas importer, et le dupliquer ici
 * ferait DEUX vérités qui divergeraient au premier ajustement de copie.
 */
function readRegistry() {
  const src = readFileSync(TEMPLATES_TS, 'utf8');
  const out = {};
  // Chaque entrée : `key: { nameEnv: '…', … bodyTexts: { fr: '…', de: '…', … },`
  const entry = /(\w+):\s*\{\s*nameEnv:\s*'([^']+)',[\s\S]*?bodyTexts:\s*\{([\s\S]*?)\n\s*\},/g;
  for (const m of src.matchAll(entry)) {
    const bodies = {};
    for (const b of m[3].matchAll(/(\w+):\s*'([^']*)'/g)) bodies[b[1]] = b[2];
    out[m[1]] = { nameEnv: m[2], bodies };
  }
  return out;
}

/** Nombre de variables `{{n}}` distinctes dans un corps. */
const varCount = (text) => new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;

if (!TOKEN || !WABA_ID) {
  console.error('✗ META_WHATSAPP_TOKEN ou META_WABA_ID absent — `source .env.meta` fait ?');
  process.exit(1);
}

const registry = readRegistry();
if (Object.keys(registry).length === 0) {
  console.error(`✗ registre illisible dans ${TEMPLATES_TS}`);
  process.exit(1);
}

if (statusOnly) {
  const r = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?fields=name,status,language,category,rejected_reason&limit=200`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) },
  );
  const j = await r.json();
  const rows = (j.data ?? []).sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  for (const t of rows) {
    const reason = t.rejected_reason && t.rejected_reason !== 'NONE' ? ` — ${t.rejected_reason}` : '';
    console.log(`${t.name.padEnd(28)} ${t.language.padEnd(6)} ${String(t.status).padEnd(10)} ${t.category ?? ''}${reason}`);
  }
  process.exit(0);
}

// Ce qui existe déjà côté Meta : un template déjà présent rend « Il y a déjà du
// contenu en <langue> pour ce modèle », état normal et non échec. On lit d'abord
// plutôt que d'interpréter des messages d'erreur localisés.
const existing = new Set();
/**
 * Catégorie EFFECTIVE par nom de template, telle que Meta la retient.
 *
 * Toutes les langues d'un même nom partagent une seule catégorie : soumettre une
 * traduction en UTILITY alors que Meta a reclassé le template en MARKETING est
 * refusé (« La catégorie UTILITY ne correspond pas à celle déjà associée »).
 * On suit donc la catégorie réelle plutôt que celle qu'on avait demandée.
 */
const effectiveCategory = new Map();
if (!dryRun) {
  const r = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?fields=name,language,category&limit=200`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) },
  );
  const j = await r.json().catch(() => null);
  for (const t of j?.data ?? []) {
    existing.add(`${t.name}::${t.language}`);
    if (t.category) effectiveCategory.set(t.name, t.category);
  }
}

let failures = 0;
let submitted = 0;

for (const [key, def] of Object.entries(registry)) {
  const plan = PLAN[key];
  if (!plan) { console.log(`· ${key} : pas de plan de soumission, ignoré`); continue; }

  for (const [lang, body] of Object.entries(def.bodies)) {
    if (langArg && lang !== langArg) continue;

    // Template d'AUTHENTIFICATION : ni texte ni exemple à fournir, Meta les génère.
    // Les contrôles de variables et d'exemples qui suivent n'ont donc pas d'objet.
    const auth = plan.authentication;

    const example = plan.examples?.[lang];
    if (!auth && !example) { console.log(`· ${plan.name} (${lang}) : pas d'exemples, ignoré`); continue; }

    const expected = varCount(body);
    if (!auth && example.length !== expected) {
      // Un exemple qui ne couvre pas toutes les variables fait rejeter le
      // template, et l'erreur Meta ne dit pas laquelle manque.
      console.log(`\x1b[31m✗\x1b[0m ${plan.name} (${lang}) : ${expected} variable(s) mais ${example.length} exemple(s)`);
      failures++;
      continue;
    }

    if (existing.has(`${plan.name}::${lang}`)) {
      console.log(`\x1b[90m·\x1b[0m ${plan.name} (${lang}) déjà présent — non resoumis`);
      continue;
    }

    if (dryRun) {
      console.log(`\n── ${plan.name} · ${lang} · ${plan.category}`);
      if (auth) {
        console.log(`corps ÉCRIT PAR META (préréglage traduit) — rendu attendu : ${body}`);
        console.log(`expiration : ${auth.codeExpirationMinutes} min · bouton : COPY_CODE`
          + `${auth.securityRecommendation ? ' · avertissement de sécurité' : ''}`);
      } else {
        console.log(body);
        console.log(`exemples : ${example.join(' | ')}`);
      }
      continue;
    }

    // La catégorie réelle prime sur celle du plan (cf. effectiveCategory).
    const category = effectiveCategory.get(plan.name) ?? plan.category;
    if (category !== plan.category) {
      console.log(`\x1b[33m!\x1b[0m ${plan.name} : Meta l'a classé ${category}, pas ${plan.category} — la traduction suit`);
    }

    let res, json;
    try {
      res = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plan.name,
          language: lang,
          category,
          components: auth
            ? [
              // Aucun `text` : Meta fournit le corps traduit. Le seul réglage est
              // l'ajout (ou non) de la phrase « ne partagez pas ce code ».
              { type: 'BODY', add_security_recommendation: auth.securityRecommendation },
              // Le pied affiche « expire dans N minutes ». Doit valoir le TTL RÉEL de
              // `start_whatsapp_number_verification`, sinon le message ment.
              { type: 'FOOTER', code_expiration_minutes: auth.codeExpirationMinutes },
              // Le libellé du bouton est traduit par Meta ; seul `otp_type` compte.
              { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
            ]
            : [{ type: 'BODY', text: body, example: { body_text: [example] } }],
        }),
        signal: AbortSignal.timeout(45000),
      });
      json = await res.json().catch(() => null);
    } catch (err) {
      // Un timeout réseau ne doit pas tuer le lot : le template suivant peut passer,
      // et une soumission déjà partie sera vue au prochain run (idempotence).
      console.log(`\x1b[31m✗\x1b[0m ${plan.name} (${lang}) : ${err?.name ?? 'erreur réseau'} — relancer le script`);
      failures++;
      continue;
    }

    if (res.ok && json?.id) {
      console.log(`\x1b[32m✓\x1b[0m ${plan.name} (${lang}) soumis — ${json.status ?? 'PENDING'}`);
      submitted++;
    } else {
      const e = json?.error ?? {};
      console.log(`\x1b[31m✗\x1b[0m ${plan.name} (${lang}) refusé : ${e.message ?? `HTTP ${res.status}`}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''}`);
      failures++;
    }
  }
}

if (!dryRun) {
  console.log(`\n${submitted} soumission(s). L’examen Meta prend de quelques minutes à 24 h.`);
  console.log('Suivre : node scripts/wa-submit-templates.mjs --status');
}
process.exit(failures > 0 ? 1 : 0);
