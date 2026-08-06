#!/usr/bin/env node
/**
 * Diagnostic du montage « compte de service + délégation à l'échelle du domaine »,
 * celui qui permet au backend d'agir au nom d'une boîte Google Workspace de MEGGA
 * pour lire ses disponibilités, poser l'événement d'un appel d'accueil et produire
 * son lien Meet.
 *
 * POURQUOI CE SCRIPT EXISTE. Le montage a QUATRE pièces, et trois vivent chez Google,
 * hors du dépôt : la clé du compte de service, l'autorisation de délégation, la portée
 * exacte, l'activation de l'API Calendar. Aucune lecture locale ne peut les voir. Quand
 * l'une manque, la plateforme ne se casse pas bruyamment : les hôtes adossés à une boîte
 * MEGGA sortent `degraded`, donc aucun créneau n'est proposé — et le symptôme visible
 * est « aucun créneau » sur l'écran de réservation d'une AGENCE, à l'autre bout du
 * produit. Un message qui ne désigne aucune des quatre causes et qui ressemble à un
 * agenda plein.
 *
 * La console porte le même diagnostic (`onboarding-calendar-check` + bouton « Tester la
 * connexion »), mais il exige que le secret soit DÉJÀ posé et la fonction déployée.
 * Celui-ci travaille depuis un poste, sur le fichier de clé, avant tout déploiement.
 *
 * ⚠ LA CLÉ PRIVÉE NE SORT PAS DE LA MACHINE et n'est jamais affichée : elle sert à
 * signer localement une assertion, et seule cette assertion part chez Google.
 *
 * Usage :
 *   node scripts/check-workspace-delegation.mjs <cle.json> <boite@megga.ch>
 */
import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary'

/**
 * ⚠ RECOPIÉE À L'IDENTIQUE depuis `supabase/functions/_shared/google-workspace.ts`.
 * Google compare les portées littéralement : diagnostiquer avec une chaîne voisine de
 * celle que le backend demande donnerait un verdict sans rapport avec la réalité.
 */
const SCOPE = 'https://www.googleapis.com/auth/calendar'

const [, , keyPath, mailbox] = process.argv

if (!keyPath || !mailbox) {
  console.error('Usage : node scripts/check-workspace-delegation.mjs <cle.json> <boite@megga.ch>')
  process.exit(2)
}

/** Chaque échec nomme LA case à corriger, et où. Un code brut de Google ne le fait pas. */
const REMEDES = {
  unauthorized_client: [
    'La délégation n\'est pas accordée à ce compte de service, ou pas pour cette portée.',
    '  → Console d\'administration Workspace › Sécurité › Contrôle des API',
    '    › Délégation à l\'échelle du domaine › Ajouter',
    '  → ID client  : l\'« Unique ID » numérique affiché ci-dessus',
    `  → Portée     : ${SCOPE}`,
    '  (Comptez quelques minutes de propagation après l\'ajout.)',
  ],
  invalid_grant: [
    'La boîte visée est inconnue du domaine, ou elle est suspendue.',
    '  → Vérifiez l\'adresse, et qu\'il s\'agit d\'un utilisateur ACTIF du domaine.',
  ],
  invalid_client: [
    'Le compte de service n\'existe plus, ou sa clé a été révoquée.',
  ],
  calendar_api_disabled: [
    'L\'API Google Calendar n\'est pas activée sur le projet Google Cloud DE CE compte de service.',
    '  → console.cloud.google.com › APIs and services › Library › Google Calendar API › Enable',
    '  ⚠ Vérifiez le PROJET : deux projets peuvent porter le même nom et ne différer que',
    '    par leur identifiant. L\'API doit être active dans celui qui héberge la clé.',
  ],
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function fin(ok, titre, lignes = []) {
  console.log('')
  console.log(`${ok ? '✓' : '✗'} ${titre}`)
  for (const l of lignes) console.log(`  ${l}`)
  console.log('')
  process.exit(ok ? 0 : 1)
}

// ── 1. La clé ────────────────────────────────────────────────────────────────
let key
try {
  const raw = readFileSync(keyPath, 'utf8').trim()
  // Le base64 est accepté comme dans le backend : le JSON contient un PEM à vrais
  // sauts de ligne, que beaucoup d'interfaces de secrets abîment au collage.
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  key = JSON.parse(text)
} catch {
  fin(false, 'Fichier de clé illisible.', [
    'Attendu : le JSON téléchargé depuis Google Cloud (ou sa version base64).',
  ])
}

if (!key.client_email || !key.private_key) {
  fin(false, 'Ce JSON n\'est pas une clé de compte de service.', [
    'Il doit contenir `client_email` et `private_key`.',
    'Une clé d\'API ou un client OAuth ne conviennent pas.',
  ])
}

console.log('')
console.log('  Compte de service :', key.client_email)
console.log('  Projet            :', key.project_id ?? '(absent du JSON)')
console.log('  Unique ID         :', key.client_id ?? '(absent du JSON)')
console.log('  Boîte visée       :', mailbox)
console.log('  Portée demandée   :', SCOPE)

// ── 2. Signature locale ──────────────────────────────────────────────────────
const nowS = Math.floor(Date.now() / 1000)
const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const claims = base64url(JSON.stringify({
  iss: key.client_email,
  // C'est CE champ qui fait la délégation. Sans lui, Google rendrait un jeton valide
  // pour le compte de service lui-même, dont l'agenda est vide et que nul ne regarde.
  sub: mailbox,
  scope: SCOPE,
  aud: TOKEN_URL,
  iat: nowS,
  exp: nowS + 3600,
}))

let assertion
try {
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(key.private_key.replace(/\\n/g, '\n')).toString('base64url')
  assertion = `${header}.${claims}.${signature}`
} catch {
  fin(false, 'Signature impossible : la clé privée est abîmée.', [
    'Cause la plus fréquente : les sauts de ligne du PEM ont été mangés au collage.',
    'Repartez du fichier téléchargé, sans le rouvrir dans un éditeur qui le reformate.',
  ])
}

// ── 3. Échange, puis vraie lecture ───────────────────────────────────────────
const tokenRes = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }),
}).catch(() => null)

if (!tokenRes) fin(false, 'Google injoignable (réseau).')

const tokenData = await tokenRes.json().catch(() => ({}))

if (!tokenRes.ok || !tokenData.access_token) {
  const code = tokenData.error ?? `HTTP ${tokenRes.status}`
  fin(false, `Jeton refusé : ${code}`, [
    ...(REMEDES[code] ?? [tokenData.error_description ?? 'Réponse inattendue de Google.']),
  ])
}

// Obtenir un jeton ne prouve rien à soi seul : la délégation peut être accordée et
// l'agenda rester inaccessible. Seul un aller-retour réel répond à « ça marche ? ».
const calRes = await fetch(CALENDAR_URL, {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
}).catch(() => null)

if (!calRes) fin(false, 'Google injoignable au moment de lire l\'agenda (réseau).')

if (!calRes.ok) {
  // 403 AVEC un jeton valide = l'API Calendar n'est pas activée sur le projet. C'est la
  // case distincte de la délégation, et celle qu'on oublie.
  const cause = calRes.status === 403 ? 'calendar_api_disabled' : null
  fin(false, `Agenda inaccessible (HTTP ${calRes.status})`, [
    ...(REMEDES[cause] ?? ['Réponse inattendue de l\'API Calendar.']),
  ])
}

const cal = await calRes.json().catch(() => ({}))

fin(true, 'Les quatre pièces sont en place.', [
  `Agenda joignable : ${cal.id ?? mailbox}`,
  `Fuseau déclaré   : ${cal.timeZone ?? '(non déclaré)'}`,
  '',
  'Prochaine étape — poser le secret Supabase :',
  `  supabase secrets set --project-ref eayczugyrvmtqnnmvjod \\`,
  `    GOOGLE_WORKSPACE_SA_KEY="$(cat ${keyPath})"`,
])
