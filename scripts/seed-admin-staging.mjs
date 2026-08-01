#!/usr/bin/env node
/**
 * Applique le seed synthétique de la console super-admin — étape 15, spec §10.8.
 *
 *   node scripts/seed-admin-staging.mjs --confirm
 *
 * Lit SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement. Le jeu de données
 * vient de `_shared/admin-staging-seed.mjs`, qui est pur et déterministe : ce fichier-ci ne
 * décide de rien, il écrit.
 *
 * ── DEUX VERROUS, ET LE PREMIER N'EST PAS NÉGOCIABLE ────────────────────────────────
 *
 * Ce script CRÉE quatorze agences et cinquante-six comptes. Le lancer sur la production
 * serait un incident : des agences fictives apparaîtraient dans le CRM d'un client, dans le
 * MRR de l'écran Plans, et dans `activity_events` — qui refuse le DELETE. Il n'y aurait pas
 * de retour en arrière propre.
 *
 *   1. La référence du projet de PRODUCTION est refusée en dur, avant toute écriture.
 *      Une variable d'environnement mal pointée est l'erreur la plus banale qui soit.
 *   2. `--confirm` est obligatoire : aucun effet de bord sans intention explicite.
 *
 * ── nLPD ────────────────────────────────────────────────────────────────────────────
 * Aucune copie de production, jamais (§10.8). Tout est inventé, et le domaine `.invalid`
 * (RFC 2606) n'est routable nulle part : aucun de ces comptes ne peut recevoir de courrier.
 */

import { createClient } from '@supabase/supabase-js'
import { genererSeed, PLANS } from './_shared/admin-staging-seed.mjs'

/** Référence du projet de production (CLAUDE.md §8). Interdite, sans exception. */
const REF_PRODUCTION = 'eayczugyrvmtqnnmvjod'

const URL = process.env.SUPABASE_URL ?? ''
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const CONFIRME = process.argv.includes('--confirm')

function mourir(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!URL || !CLE) {
  mourir('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
}
if (URL.includes(REF_PRODUCTION)) {
  mourir(
    `REFUS — cette URL est celle de la PRODUCTION (${REF_PRODUCTION}).\n` +
    '  Ce script crée 14 agences et 56 comptes fictifs. En production, ils apparaîtraient\n' +
    '  dans le CRM d\'un client et dans le MRR, et `activity_events` refuse le DELETE :\n' +
    '  il n\'y aurait pas de retour en arrière propre. Pointe un projet de staging.'
  )
}
if (!CONFIRME) {
  mourir('Ajoute --confirm : ce script écrit en base, on ne le lance pas par inadvertance.')
}

const db = createClient(URL, CLE, { auth: { persistSession: false, autoRefreshToken: false } })
const seed = genererSeed()
const JOUR = 86_400_000

/** Date reculée de N jours, au format ISO. Le seul endroit où l'horloge entre en jeu. */
const ilYA = (jours) => new Date(Date.now() - jours * JOUR).toISOString()

async function poserAgences() {
  const idParSlug = new Map()
  for (const a of seed.agences) {
    // Idempotent par le slug : relancer le script ne duplique pas le jeu.
    const { data: existante } = await db.from('agencies').select('id').eq('slug', a.slug).maybeSingle()
    if (existante) {
      idParSlug.set(a.slug, existante.id)
      continue
    }
    const { data, error } = await db.from('agencies').insert({
      name: a.nom, slug: a.slug, city: a.ville, canton: a.canton,
      plan: a.plan, status: a.statut,
      email: `contact@${a.slug}.megga-staging.invalid`,
      // Antidatée : une agence « dormante » n'est crédible qu'au-delà de 30 jours (§7), et
      // créer une agence émet un `activity_events` que rien ne peut ensuite retoucher.
      created_at: ilYA(a.anciennete),
    }).select('id').single()
    if (error) mourir(`agence ${a.slug} : ${error.message}`)
    idParSlug.set(a.slug, data.id)
  }
  return idParSlug
}

async function poserAbonnements(idParSlug) {
  let n = 0
  for (const a of seed.agences) {
    if (!a.sub) continue
    const agencyId = idParSlug.get(a.slug)
    const { data: deja } = await db.from('subscriptions').select('id').eq('agency_id', agencyId).maybeSingle()
    if (deja) continue
    const { error } = await db.from('subscriptions').insert({
      agency_id: agencyId,
      plan: a.plan,
      billing_period: a.periode,
      status: a.sub,
      // NOT NULL sans défaut : l'omettre fait échouer l'insert entier.
      stripe_customer_id: `cus_staging_${a.slug}`,
      current_period_end: ilYA(-30),
    })
    if (error) mourir(`abonnement ${a.slug} : ${error.message}`)
    n++
  }
  return n
}

async function poserComptes(idParSlug) {
  let crees = 0
  for (const c of seed.comptes) {
    const agencyId = idParSlug.get(c.agence)
    const { data, error } = await db.auth.admin.createUser({
      email: c.email, password: `Staging-${c.agence}-${Date.now()}`, email_confirm: true,
      user_metadata: { full_name: c.nomComplet, role: c.role },
    })
    if (error) {
      // Déjà présent : le seed est rejouable, on n'en fait pas une erreur.
      if (/already|exists|registered/i.test(error.message)) continue
      mourir(`compte ${c.email} : ${error.message}`)
    }
    const { error: pErr } = await db.from('profiles').upsert({
      id: data.user.id, email: c.email, full_name: c.nomComplet,
      role: c.role, agency_id: agencyId,
    }, { onConflict: 'id' })
    if (pErr) mourir(`profil ${c.email} : ${pErr.message}`)
    crees++
  }
  return crees
}

async function poserActivite(idParSlug) {
  // Le volume sert au journal, au Live et à la colonne « dernière activité ». Les actions
  // sont des CLÉS techniques : la base ne stocke pas de français (20260729100000 fait foi).
  const actions = [
    ['contact_created', 'contact', 'contact'],
    ['property_created', 'property', 'bien'],
    ['stage_change', 'transaction', 'deal'],
    ['document_uploaded', 'document', 'doc'],
  ]
  const lignes = []
  for (const a of seed.agences) {
    const agencyId = idParSlug.get(a.slug)
    for (let i = 0; i < a.evenements; i++) {
      const [action, entity, categorie] = actions[i % actions.length]
      lignes.push({
        agency_id: agencyId, action, entity_type: entity, category: categorie,
        actor_kind: 'system', object_label: `${a.nom} — ${action} #${i + 1}`,
        // Une agence sans activité récente est le seul cas où « dormante » a du sens.
        created_at: ilYA(a.statut === 'suspended' ? 40 + (i % 20) : (i % 25)),
      })
    }
  }
  // Par lots de 500 : un insert unique de plusieurs milliers de lignes dépasse le timeout.
  // ⚠ Toutes les lignes portent EXACTEMENT les mêmes clés — un insert PostgREST en lot
  // prend l'UNION des clés, et une clé absente d'un objet devient NULL pour lui.
  for (let i = 0; i < lignes.length; i += 500) {
    const { error } = await db.from('activity_events').insert(lignes.slice(i, i + 500))
    if (error) mourir(`activité (lot ${i / 500 + 1}) : ${error.message}`)
  }
  return lignes.length
}

async function main() {
  console.log(`→ staging : ${URL}`)
  console.log(`  jeu v${seed.meta.version} — ${seed.meta.totalAgences} agences, ${seed.meta.totalComptes} comptes, plans ${PLANS.join('/')}`)

  const idParSlug = await poserAgences()
  console.log(`  ✓ ${idParSlug.size} agences`)
  const abos = await poserAbonnements(idParSlug)
  console.log(`  ✓ ${abos} abonnements`)
  const comptes = await poserComptes(idParSlug)
  console.log(`  ✓ ${comptes} comptes`)
  const evts = await poserActivite(idParSlug)
  console.log(`  ✓ ${evts} événements`)

  // Les jalons d'activation se DÉRIVENT des données qu'on vient de poser : la table est
  // fermée en écriture à tous, seule cette RPC y touche (étape 8).
  const { data: recalc, error } = await db.rpc('recompute_agency_activation', { p_agency_id: null })
  if (error) mourir(`recalcul d'activation : ${error.message}`)
  console.log(`  ✓ activation recalculée (${recalc} agences)`)

  console.log('\n✓ Seed appliqué. Rejouable : relancer ne duplique rien.')
}

main().catch((e) => mourir(e?.message ?? String(e)))
