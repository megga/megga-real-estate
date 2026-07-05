#!/usr/bin/env node
// Génère (ou vérifie) le SQL de seed du corpus knowledge_snippets à partir du
// fichier versionné supabase/knowledge/corpus.seed.json.
//
// Source de vérité = le JSON (reviewable en PR). Ce script :
//   1. VALIDE chaque snippet (refuse tout ce qui n'est pas sourçable/daté) ;
//   2. NORMALISE les mots-clés (minuscules, sans accents) — DOIT rester aligné
//      sur normalizeText() de _shared/knowledge-retrieval.ts ;
//   3. ÉMET des upserts idempotents (ON CONFLICT (slug) DO UPDATE).
//
// USAGE :
//   node scripts/knowledge-seed.mjs --check                      # valide seulement
//   node scripts/knowledge-seed.mjs > supabase/migrations/<ts>_knowledge_seed_v1.sql
//
// Ré-seed ultérieur = éditer le JSON + régénérer une NOUVELLE migration (les
// migrations appliquées sont immuables). Un snippet ne passe 'active' qu'après
// relecture humaine (revue de PR) : c'est la validation humaine du corpus.

import { readFileSync } from 'node:fs'

const CORPUS_PATH = 'supabase/knowledge/corpus.seed.json'
const checkOnly = process.argv.includes('--check')

const DOMAINS = new Set([
  'lab_lba', 'lex_koller', 'bail_co', 'fiscalite', 'notarial', 'cecb',
  'financement', 'ldtr_ge', 'droits_enregistrement_ge',
])
const STATUSES = new Set(['draft', 'active', 'expired'])
const ACTIONS = new Set([
  'chat', 'summarize_contact', 'suggest_next_action', 'draft_email',
  'draft_description', 'analyze_kyc', 'score_lead', 'analyze_market', 'detect_intent',
])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Miroir de normalizeText() côté edge (minuscules, sans accents, apostrophes). */
function normKeyword(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}

function fail(msg) {
  process.stderr.write(`✗ ${msg}\n`)
  process.exitCode = 1
}

function validate(s, i) {
  const where = `snippet #${i} (${s.slug ?? 'sans slug'})`
  const errs = []
  if (!s.slug || !/^[a-z0-9-]+$/.test(s.slug)) errs.push('slug kebab-case requis')
  if (!DOMAINS.has(s.domain)) errs.push(`domain invalide: ${s.domain}`)
  if (s.canton != null && typeof s.canton !== 'string') errs.push('canton doit être string|null')
  if (!s.title || s.title.length < 5) errs.push('title requis')
  if (!s.body_md || s.body_md.length < 40) errs.push('body_md trop court')
  if (!Array.isArray(s.keywords) || s.keywords.length === 0) errs.push('keywords non vide requis')
  if (!Array.isArray(s.applies_to_actions) || s.applies_to_actions.some((a) => !ACTIONS.has(a)))
    errs.push('applies_to_actions invalide')
  if (!s.source_url || !/^https?:\/\//.test(s.source_url)) errs.push('source_url officielle requise')
  if (!DATE_RE.test(s.verified_at || '')) errs.push('verified_at (YYYY-MM-DD) requis')
  if (s.review_after != null && !DATE_RE.test(s.review_after)) errs.push('review_after invalide')
  if (!STATUSES.has(s.status)) errs.push(`status invalide: ${s.status}`)
  // Garde-fou anti-cadratin (style maison).
  if (/[—–]/.test(s.body_md || '')) errs.push('body_md contient un tiret cadratin/demi-cadratin')
  if (errs.length) fail(`${where}: ${errs.join(' ; ')}`)
  return errs.length === 0
}

function dollarQuote(s) {
  // Choisit un tag $q…$ absent de la chaîne.
  let tag = 'q'
  while (s.includes(`$${tag}$`)) tag += 'q'
  return `$${tag}$${s}$${tag}$`
}
function arr(a) {
  return `ARRAY[${(a || []).map((x) => `'${String(x).replace(/'/g, "''")}'`).join(',')}]::text[]`
}
function lit(v) {
  return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
}

function main() {
  let corpus
  try {
    corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'))
  } catch (e) {
    fail(`lecture ${CORPUS_PATH}: ${e.message}`)
    return
  }
  const snippets = Array.isArray(corpus) ? corpus : (corpus.snippets || [])
  if (!snippets.length) { fail('corpus vide'); return }

  const slugs = new Set()
  let ok = 0
  for (let i = 0; i < snippets.length; i++) {
    const s = snippets[i]
    if (slugs.has(s.slug)) fail(`slug dupliqué: ${s.slug}`)
    slugs.add(s.slug)
    if (validate(s, i)) ok++
  }

  if (process.exitCode === 1) {
    process.stderr.write(`\n${snippets.length - ok}/${snippets.length} snippet(s) invalide(s) — abandon.\n`)
    return
  }
  const active = snippets.filter((s) => s.status === 'active').length
  process.stderr.write(`✓ ${ok} snippets valides (${active} active, ${ok - active} draft).\n`)
  if (checkOnly) return

  const rows = snippets.map((s) => {
    const kw = arr([...new Set((s.keywords || []).map(normKeyword).filter(Boolean))])
    return `  (${lit(s.slug)}, ${lit(s.domain)}, ${lit(s.canton)}, ${lit(s.title)}, ${dollarQuote(s.body_md)}, ${arr(s.applies_to_actions)}, ${kw}, ${Number(s.priority) || 5}, ${lit(s.source_url)}, ${lit(s.source_ref)}, ${lit(s.verified_at)}, ${s.review_after ? lit(s.review_after) : 'NULL'}, ${lit(s.status)}, ${lit(s.lang || 'fr')})`
  }).join(',\n')

  const sql = `-- Seed du corpus knowledge_snippets v1 (généré par scripts/knowledge-seed.mjs).
-- NE PAS ÉDITER À LA MAIN : éditer supabase/knowledge/corpus.seed.json puis régénérer.
-- Idempotent (ON CONFLICT slug). Un snippet actif a été relu en revue de PR.

INSERT INTO public.knowledge_snippets
  (slug, domain, canton, title, body_md, applies_to_actions, keywords, priority, source_url, source_ref, verified_at, review_after, status, lang)
VALUES
${rows}
ON CONFLICT (slug) DO UPDATE SET
  domain = EXCLUDED.domain, canton = EXCLUDED.canton, title = EXCLUDED.title,
  body_md = EXCLUDED.body_md, applies_to_actions = EXCLUDED.applies_to_actions,
  keywords = EXCLUDED.keywords, priority = EXCLUDED.priority,
  source_url = EXCLUDED.source_url, source_ref = EXCLUDED.source_ref,
  verified_at = EXCLUDED.verified_at, review_after = EXCLUDED.review_after,
  status = EXCLUDED.status, lang = EXCLUDED.lang, updated_at = now();
`
  process.stdout.write(sql)
}

main()
