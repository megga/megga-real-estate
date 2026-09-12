#!/usr/bin/env node
/**
 * Bascule vers `getmegga.com` des URLs et adresses STOCKÉES EN BASE.
 *
 * Usage :
 *   node scripts/migrate-domaine-getmegga.mjs              # constat seul (défaut)
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-domaine-getmegga.mjs --apply
 *
 * ⛔ POURQUOI UN SCRIPT ET PAS UNE MIGRATION. Une migration de `supabase/migrations/`
 * s'applique AU PROCHAIN MERGE sur `main`, sans qu'on choisisse le moment. Or les deux
 * réécritures ci-dessous dépendent chacune d'un prérequis qui vit HORS du dépôt :
 *
 *   · les `photos_cf` ne doivent basculer qu'une fois `img.getmegga.com` branché sur le
 *     bucket R2 — sinon les annonces du matching perdent leurs images, et la panne est
 *     MUETTE (une balise `<img>` cassée ne lève rien). ⚠ Le volume réel est **814** lignes,
 *     pas 9 434 : ce dernier chiffre comptait les lignes AYANT un `photos_cf`, pas celles
 *     pointant vers l'ancien hôte. ✅ Fait le 09.09.2026 — cette moitié du script ne
 *     trouvera plus rien ;
 *   · `app_config` porte `tech@…`, qui ne doit basculer qu'une fois la boîte créée —
 *     sinon les alertes RealAdvisor partent vers une adresse qui rebondit, et le
 *     rebond n'arrive nulle part.
 *
 * Les jouer trop tôt casse en silence ; les jouer trop tard ne casse rien. D'où un
 * exécutable, lancé à la PHASE E de docs/migration-getmegga.md, et non une migration.
 *
 * ⚠ LE CONSTAT EST LE DÉFAUT. Sans `--apply`, rien n'est écrit : le script compte et
 * montre un échantillon. C'est la seule façon de vérifier le périmètre sur la
 * production avant de la toucher.
 */
import { readFileSync } from 'node:fs'

const APPLIQUER = process.argv.includes('--apply')

// Même provenance que `recalculate-quality.mjs` : l'URL vient du `.env` du dépôt,
// la clé de service NON — elle ne doit jamais être écrite dans un fichier versionné.
const envContent = (() => {
  try { return readFileSync(new URL('../.env', import.meta.url), 'utf8') } catch { return '' }
})()
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  ?? envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Il manque VITE_SUPABASE_URL (.env) ou SUPABASE_SERVICE_ROLE_KEY (env).')
  console.error('Usage : SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-domaine-getmegga.mjs --apply')
  process.exit(1)
}

const entetes = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

/** Réécriture d'une chaîne : les hôtes réels qui bougent, et eux seuls. */
function reecrire(texte) {
  return texte
    .replaceAll('app.megga.ch', 'app.getmegga.com')
    .replaceAll('api.megga.ch', 'api.getmegga.com')
    .replaceAll('img.megga.ch', 'img.getmegga.com')
    .replaceAll('send.megga.ch', 'send.getmegga.com')
    .replaceAll('megga.ch', 'getmegga.com')
}

async function appel(chemin, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { ...init, headers: entetes })
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${chemin} → ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

// ── 1. app_config — trois clés de contact RealAdvisor ────────────────────────
async function migrerAppConfig() {
  console.log('\n── app_config ──────────────────────────────────────────────')
  const lignes = await appel('app_config?select=key,value')
  // ⚠ `value` est du jsonb : on réécrit sa REPRÉSENTATION, puis on la reparse.
  // Réécrire la valeur décodée perdrait le type (une chaîne JSON reste une chaîne).
  const aChanger = lignes
    .map((l) => ({ key: l.key, avant: JSON.stringify(l.value) }))
    .map((l) => ({ ...l, apres: reecrire(l.avant) }))
    .filter((l) => l.avant !== l.apres)

  if (aChanger.length === 0) { console.log('  rien à faire'); return 0 }
  for (const { key, avant, apres } of aChanger) {
    console.log(`  ${key}\n    − ${avant}\n    + ${apres}`)
    if (APPLIQUER) {
      await appel(`app_config?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: JSON.parse(apres) }),
      })
    }
  }
  return aChanger.length
}

// ── 2. market_listings.photos_cf — les URLs R2 des annonces ──────────────────
async function migrerPhotos() {
  console.log('\n── market_listings.photos_cf ───────────────────────────────')
  // ⛔ BORNÉ PAR PAGES, ET PAR `photos_cf=not.is.null`. §7 de CLAUDE.md : un scan
  // complet de `market_listings` (253k lignes) dépasse le statement timeout. Le
  // filtre ramène le lot à ~9 400 lignes, la pagination le découpe en écritures
  // courtes — une page qui échoue ne perd que sa page.
  const TAILLE = 500
  let offset = 0
  let vues = 0
  let changees = 0
  let montre = 0

  for (;;) {
    const page = await appel(
      `market_listings?select=id,photos_cf&photos_cf=not.is.null&order=id.asc&offset=${offset}&limit=${TAILLE}`,
    )
    if (page.length === 0) break
    vues += page.length

    for (const ligne of page) {
      const avant = JSON.stringify(ligne.photos_cf)
      const apres = reecrire(avant)
      if (avant === apres) continue
      changees++
      if (montre < 2) { console.log(`  ex. ${ligne.id}\n    − ${avant.slice(0, 120)}…\n    + ${apres.slice(0, 120)}…`); montre++ }
      if (APPLIQUER) {
        await appel(`market_listings?id=eq.${ligne.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ photos_cf: JSON.parse(apres) }),
        })
      }
    }
    offset += TAILLE
    process.stdout.write(`\r  parcourues ${vues} · à réécrire ${changees}`)
  }
  console.log(`\n  ${changees} ligne(s) portant l'ancien domaine, sur ${vues} avec photos_cf`)
  return changees
}

const config = await migrerAppConfig()
const photos = await migrerPhotos()

console.log('\n════════════════════════════════════════════════════════════')
console.log(`app_config : ${config} · photos_cf : ${photos}`)
console.log(APPLIQUER
  ? '✅ ÉCRIT en base.'
  : "ℹ️  CONSTAT SEUL — rien n'a été écrit. Relancer avec --apply pour appliquer.")
console.log('════════════════════════════════════════════════════════════')
