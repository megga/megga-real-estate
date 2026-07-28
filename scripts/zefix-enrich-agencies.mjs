#!/usr/bin/env node
/**
 * zefix-enrich-agencies.mjs — récupération du n° IDE/CHE des agences (DRY-RUN par défaut).
 *
 * Rôle : matcher les agences de `agency_profiles` contre l'index Open Data Zefix
 * pour retrouver leur numéro IDE (CHE-xxx.xxx.xxx), en vue de prospection.
 *
 * Source : endpoint SPARQL LINDAS (https://lindas.admin.ch/query, graphe
 * <https://lindas.admin.ch/foj/zefix>) — PUBLIC, sans auth, ~790k organisations.
 * Choisi plutôt que l'API REST Zefix (qui exige des identifiants OFJ + throttle).
 *
 * ⚠ NE FAIT AUCUNE ÉCRITURE EN BASE. Produit un CSV + un résumé de taux de match.
 *   Le statut actif/radié n'est PAS exposé par LINDAS : présence ≈ inscrite au RC.
 *
 * Entrées (au choix) :
 *   --input <fichier>   texte "name|city|canton" (une agence par ligne) → dry-run
 *   --supabase          lit agency_profiles via REST (SUPABASE_URL +
 *                       SUPABASE_SERVICE_ROLE_KEY dans l'env) → passe réelle
 * Options :
 *   --limit N           borne le nombre d'agences traitées
 *   --concurrency C     requêtes LINDAS simultanées (défaut 5)
 *   --out <fichier>     CSV de sortie (défaut ./zefix_dryrun.csv)
 *
 * Exemple : node scripts/zefix-enrich-agencies.mjs --input sample.psv --out out.csv
 */

import { readFileSync, writeFileSync } from 'node:fs';

const LINDAS = 'https://lindas.admin.ch/query';
const GRAPH = 'https://lindas.admin.ch/foj/zefix';

// ── args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? (argv[i + 1] ?? d) : d; };
const INPUT = opt('--input');
const USE_SB = flag('--supabase');
const LIMIT = Number(opt('--limit', 0)) || 0;
const CONC = Number(opt('--concurrency', 5)) || 5;
const OUT = opt('--out', './zefix_dryrun.csv');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── normalisation des noms ──────────────────────────────────────────────────
// Le cœur du matching : on compare des ENSEMBLES de tokens « de contenu »
// (hors formes juridiques, mots génériques immo et bruit géographique), parce
// que la raison sociale du registre diffère souvent du nom commercial Flatfox.
const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const GENERIC = new Set([
  'immobilier', 'immobiliere', 'immobilien', 'immobiliare', 'immobiliari', 'immobili',
  'immo', 'real', 'estate', 'realestate', 'gerance', 'gerances', 'regie', 'regies',
  'gestion', 'verwaltung', 'verwaltungen', 'treuhand', 'agence', 'agency', 'agentur',
  'group', 'groupe', 'gruppe', 'partners', 'partner', 'conseil', 'services', 'service',
  'sa', 'ag', 'sarl', 'sagl', 'gmbh', 'holding', 'co', 'company', 'consulting',
  'ch', 'swiss', 'suisse', 'schweiz', 'svizzera',
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'and', 'par', 'pour',
  'von', 'der', 'die', 'das', 'und', 'the', 'di', 'e',
  // termes structurels très courants (bruitent le score sans distinguer)
  'societe', 'sociedad', 'cooperative', 'coop', 'anstalt', 'stiftung', 'fondation',
  'fondazione', 'unternehmungen', 'unternehmung', 'generalunternehmung', 'bau',
  // grandes communes (filet en plus de l'exclusion par le champ ville)
  'geneve', 'lausanne', 'zurich', 'bern', 'berne', 'basel', 'bale', 'luzern', 'lugano',
  'fribourg', 'sion', 'neuchatel', 'winterthur', 'zug', 'chur', 'baden', 'aarau', 'thun',
  'biel', 'bienne', 'montreux', 'nyon', 'locarno', 'bellinzona',
]);

const tokens = (raw) => stripAccents(raw).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean);
const contentTokens = (raw) => tokens(raw).filter((t) => !GENERIC.has(t));
// Tokens en gardant les accents (pour sonder LINDAS qui stocke « Gmünder », pas « Gmunder »).
const rawTokens = (raw) => String(raw || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);

// Token-sonde envoyé à LINDAS : le plus long token distinctif, hors génériques
// ET hors tokens de la ville de l'agence (sinon on sonde « lausanne » → noyé).
function pickProbe(name, city = '') {
  const cityset = new Set(tokens(city));
  const cand = rawTokens(name)
    .map((t) => ({ raw: t, norm: stripAccents(t) }))
    .filter((x) => !GENERIC.has(x.norm) && !cityset.has(x.norm));
  const big = cand.filter((x) => x.norm.length >= 4).sort((a, b) => b.norm.length - a.norm.length);
  if (big.length) return big[0].raw;
  const mid = cand.filter((x) => x.norm.length >= 3).sort((a, b) => b.norm.length - a.norm.length);
  return mid[0] ? mid[0].raw : null;
}

// Variantes du token pour le CONTAINS : accentué (matche « Gmünder »),
// désaccentué (matche « Gmunder »), et translittéré ä→ae ö→oe ü→ue.
function probeVariants(tok) {
  const ue = tok.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  return [...new Set([tok, stripAccents(tok), ue])].map((v) => v.replace(/["\\]/g, '')).filter(Boolean);
}

function dice(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

const cityKey = (s) => stripAccents(s).toLowerCase().replace(/[^a-z]/g, '');

// CHE106840111 → CHE-106.840.111
function cheFormat(uid) {
  const m = /^CHE(\d{9})$/.exec(uid || '');
  return m ? `CHE-${m[1].slice(0, 3)}.${m[1].slice(3, 6)}.${m[1].slice(6, 9)}` : (uid || '');
}

// eCH-0097 formes juridiques (les plus courantes) — 0151 = succursale (à signaler).
const LEGAL = { '0103': 'RI', '0104': 'SNC', '0105': 'SCm', '0106': 'SA', '0107': 'Sàrl', '0108': 'coop', '0109': 'assoc', '0110': 'fond', '0151': 'succursale' };
const legalLabel = (code) => LEGAL[code] || code || '';

// ── requête LINDAS ──────────────────────────────────────────────────────────
function sparql(probe) {
  const ors = probeVariants(probe).map((v) => `CONTAINS(?n, "${v}")`).join(' || ');
  return `PREFIX schema: <http://schema.org/>
SELECT ?legalName ?uid ?street ?postalCode ?locality ?region ?forme WHERE {
  GRAPH <${GRAPH}> {
    ?c a <https://schema.ld.admin.ch/ZefixOrganisation> ; schema:legalName ?legalName .
    BIND(LCASE(STR(?legalName)) AS ?n)
    FILTER(${ors})
    ?c schema:identifier ?id . ?id schema:value ?uid . FILTER(STRSTARTS(?uid, "CHE"))
    OPTIONAL {
      ?c schema:address ?a .
      ?a schema:addressLocality ?locality ; schema:addressRegion ?region .
      OPTIONAL { ?a schema:streetAddress ?street . }
      OPTIONAL { ?a schema:postalCode ?postalCode . }
    }
    OPTIONAL { ?c schema:additionalType ?forme . }
  }
} LIMIT 60`;
}

async function queryLindas(probe, tries = 3) {
  const url = `${LINDAS}?query=${encodeURIComponent(sparql(probe))}`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j.results.bindings.map((b) => ({
        legalName: b.legalName?.value || '',
        uid: b.uid?.value || '',
        street: b.street?.value || '',
        postalCode: b.postalCode?.value || '',
        locality: b.locality?.value || '',
        region: b.region?.value || '',
        forme: legalLabel((b.forme?.value || '').split('/').pop()),
      }));
    } catch (e) {
      if (i === tries - 1) return { error: String(e?.message || e) };
      await sleep(800 * (i + 1));
    }
  }
}

// ── scoring d'une agence contre ses candidats Zefix ─────────────────────────
function evaluate(ag, cands) {
  const agC = contentTokens(ag.name);
  const agCity = cityKey(ag.city);
  const agCanton = String(ag.canton || '').toUpperCase().trim();
  let best = null;
  let strong = 0;
  const strongUids = new Set();
  for (const c of cands) {
    const nameScore = dice(agC, contentTokens(c.legalName));
    const cCity = cityKey(c.locality);
    const cantonMatch = !!(agCanton && c.region && agCanton === c.region.toUpperCase());
    const cityMatch = !!(agCity && cCity && (cCity.includes(agCity) || agCity.includes(cCity)));
    const composite = nameScore + (cantonMatch ? 0.15 : 0) + (cityMatch ? 0.15 : 0);
    if (nameScore >= 0.8) { strong++; strongUids.add(c.uid); }
    const rec = { ...c, nameScore, cantonMatch, cityMatch, composite };
    if (!best || composite > best.composite) best = rec;
  }
  return { best, ambiguous: strongUids.size > 1, strong };
}

function confidence(ev) {
  if (!ev.best) return 'NONE';
  const { nameScore, cantonMatch, cityMatch } = ev.best;
  const locOk = cantonMatch || cityMatch;
  if (nameScore >= 0.85 && locOk) return 'HIGH';
  if (nameScore >= 0.98) return 'HIGH';
  if (nameScore >= 0.6) return 'MEDIUM';
  if (nameScore >= 0.4) return 'LOW';
  return 'NONE';
}

// ── chargement des agences ──────────────────────────────────────────────────
async function loadAgencies() {
  if (INPUT) {
    return readFileSync(INPUT, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
      // Parse par la droite : les noms commerciaux contiennent parfois un « | »
      // (ex. « Bernard Nicod | Lausanne BC Gérance »). Les 2 derniers champs
      // sont ville|canton ; tout le reste est la raison commerciale.
      const parts = line.split('|');
      const canton = (parts.pop() || '').trim();
      const city = (parts.pop() || '').trim();
      const name = parts.join('|').trim();
      return { name, city, canton };
    });
  }
  if (USE_SB) {
    const base = process.env.SUPABASE_URL || 'https://eayczugyrvmtqnnmvjod.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant pour --supabase');
    const url = `${base}/rest/v1/agency_profiles?select=id,name,city,canton&order=name`;
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Supabase REST HTTP ${r.status} ${await r.text()}`);
    return r.json();
  }
  throw new Error('Fournir --input <fichier> ou --supabase');
}

// ── main ────────────────────────────────────────────────────────────────────
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

async function main() {
  let agencies = await loadAgencies();
  if (LIMIT) agencies = agencies.slice(0, LIMIT);
  process.stderr.write(`Zefix dry-run : ${agencies.length} agences, concurrence ${CONC}\n`);

  const rows = new Array(agencies.length);
  let idx = 0, done = 0;
  async function worker() {
    while (idx < agencies.length) {
      const my = idx++;
      const ag = agencies[my];
      const probe = pickProbe(ag.name, ag.city);
      let rec;
      if (!probe) {
        rec = { ag, conf: 'NONE', reason: 'no-probe', best: null, cands: 0, ambiguous: false };
      } else {
        const cands = await queryLindas(probe);
        if (cands && cands.error) {
          rec = { ag, conf: 'ERROR', reason: cands.error, best: null, cands: 0, ambiguous: false };
        } else {
          const ev = evaluate(ag, cands);
          rec = { ag, conf: confidence(ev), best: ev.best, cands: cands.length, ambiguous: ev.ambiguous, probe };
        }
      }
      rows[my] = rec;
      if (++done % 20 === 0) process.stderr.write(`  ${done}/${agencies.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  // CSV
  const header = ['name', 'city', 'canton', 'confidence', 'ambiguous', 'che', 'legal_name', 'forme', 'street', 'postal_code', 'locality', 'region', 'address_full', 'name_score', 'canton_match', 'city_match', 'probe', 'n_candidates'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const b = r.best || {};
    // Adresse postale suisse : « rue, NPA ville » (parties présentes uniquement).
    const addressFull = b.uid ? [b.street, [b.postalCode, b.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
    lines.push([
      r.ag.name, r.ag.city, r.ag.canton, r.conf, r.ambiguous ? 'yes' : '',
      b.uid ? cheFormat(b.uid) : '', b.legalName || '', b.forme || '',
      b.street || '', b.postalCode || '', b.locality || '', b.region || '', addressFull,
      b.nameScore != null ? b.nameScore.toFixed(2) : '', b.cantonMatch ? 'yes' : '', b.cityMatch ? 'yes' : '',
      r.probe || '', r.cands,
    ].map(csvCell).join(','));
  }
  writeFileSync(OUT, lines.join('\n'));

  // résumé
  const tally = {};
  for (const r of rows) tally[r.conf] = (tally[r.conf] || 0) + 1;
  const n = rows.length;
  const pct = (k) => `${(((tally[k] || 0) / n) * 100).toFixed(0)}%`;
  const amb = rows.filter((r) => r.ambiguous).length;
  process.stderr.write('\n──────── RÉSUMÉ ────────\n');
  for (const k of ['HIGH', 'MEDIUM', 'LOW', 'NONE', 'ERROR']) {
    process.stderr.write(`  ${k.padEnd(7)} ${String(tally[k] || 0).padStart(4)}  (${pct(k)})\n`);
  }
  process.stderr.write(`  dont ambigus (>1 IDE fort) : ${amb}\n`);
  process.stderr.write(`\n  CSV → ${OUT}\n`);

  // échantillons concrets par bucket
  const show = (conf, m) => {
    const ex = rows.filter((r) => r.conf === conf).slice(0, m);
    if (!ex.length) return;
    process.stderr.write(`\n  ── ${conf} ──\n`);
    for (const r of ex) {
      const b = r.best;
      process.stderr.write(`   ${r.ag.name}  [${r.ag.canton}]  →  ${b ? `${b.legalName} / ${cheFormat(b.uid)} / ${b.locality} ${b.region} (score ${b.nameScore.toFixed(2)})` : '—'}\n`);
    }
  };
  show('HIGH', 6);
  show('MEDIUM', 5);
  show('NONE', 6);
}

main().catch((e) => { console.error(e); process.exit(1); });
