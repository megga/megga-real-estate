#!/usr/bin/env node
// Enregistrement du numéro WhatsApp sur le Cloud API — et surtout, LECTURE DE L'ERREUR.
//
// POURQUOI CE SCRIPT EXISTE. L'écran « Register » de l'app et celui du gestionnaire
// WhatsApp échouent tous les deux en disant « Erreur inconnue » / « Registration
// failed. Please try again. » — deux formulations qui ne distinguent pas un PIN
// refusé, un numéro pas encore propagé, et un blocage pour excès de tentatives.
// L'API Graph, elle, rend un code précis. Ce script fait le MÊME appel que le
// bouton, et traduit le code au lieu de l'avaler.
//
// VÉRIFIÉ ≠ ENREGISTRÉ. Le code reçu par appel a validé la PROPRIÉTÉ du numéro
// (`code_verification_status: VERIFIED`). L'enregistrement est l'étape suivante :
// elle attache le numéro au Cloud API et fait passer `platform_type` de
// `NOT_APPLICABLE` à `CLOUD_API`. C'est elle qui refuse.
//
// Usage — le PIN se met dans `.env.meta` (non versionné), PAS ici :
//
//   set -a; source .env.meta; set +a; node scripts/wa-register-number.mjs
//
// Le PIN peut aussi être passé en argument pour un essai ponctuel :
//
//   node scripts/wa-register-number.mjs 123456
//
// ⚠ Chaque échec compte : Meta bloque l'enregistrement après quelques tentatives
// ratées (133016 / 133008). Lire l'erreur AVANT de réessayer.

const API_VERSION = process.env.META_API_VERSION || 'v22.0';
const TOKEN = (process.env.META_WHATSAPP_TOKEN || '').trim();
const PHONE_NUMBER_ID = (process.env.META_PHONE_NUMBER_ID || '').trim();
const PIN = (process.argv[2] || process.env.WA_PIN || '').trim();

/**
 * Codes d'erreur de `/register`, traduits.
 *
 * La colonne qui compte est `action` : plusieurs de ces codes se ressemblent à
 * l'écran mais demandent des gestes opposés — réessayer tout de suite, attendre,
 * ou changer de PIN.
 */
const ERRORS = {
  100: ['Paramètre invalide', 'Le PIN doit faire exactement 6 chiffres, et messaging_product=whatsapp.'],
  190: ['Token invalide ou expiré', 'Régénérer le token System User et le reposer dans .env.meta.'],
  131000: ['Erreur générique côté Meta', 'Souvent transitoire. Attendre 15–30 min et refaire UN essai.'],
  133000: ['Échec de déchiffrement / vérification en deux étapes', 'Le numéro a un PIN antérieur. Désactiver la vérification en deux étapes dans WhatsApp Manager, puis réessayer.'],
  133004: ['Serveur temporairement indisponible', 'Purement transitoire. Réessayer dans quelques minutes.'],
  133005: ['PIN incorrect', 'Un PIN est DÉJÀ posé sur ce numéro et ce n\'est pas celui-là. Le réinitialiser dans WhatsApp Manager → Vérification à deux étapes.'],
  133006: ['Numéro pas (ou plus) vérifié', 'Refaire la vérification par appel/SMS avant d\'enregistrer.'],
  133008: ['Trop de tentatives de PIN', 'BLOQUÉ temporairement. Ne plus réessayer avant l\'expiration indiquée par Meta.'],
  133009: ['PIN saisi trop vite', 'Attendre quelques secondes entre deux essais.'],
  133010: ['Numéro non enregistré sur la plateforme', 'Vérifier que le numéro est bien rattaché à ce WABA.'],
  133015: ['Numéro en cours de désenregistrement', 'Attendre la fin de l\'opération (quelques minutes).'],
  133016: ['Numéro récemment supprimé / trop de tentatives', 'Attendre 5 min (parfois 30) avant un nouvel essai.'],
};

if (!TOKEN || !PHONE_NUMBER_ID) {
  console.error('✗ META_WHATSAPP_TOKEN ou META_PHONE_NUMBER_ID absent — as-tu bien fait `source .env.meta` ?');
  process.exit(1);
}
if (!/^\d{6}$/.test(PIN)) {
  console.error('✗ PIN absent ou mal formé : il faut EXACTEMENT 6 chiffres.');
  console.error('  Pose-le dans .env.meta sur la ligne `WA_PIN=`, ou passe-le en argument.');
  process.exit(1);
}

console.log(`Enregistrement du numéro ${PHONE_NUMBER_ID} (API ${API_VERSION})…\n`);

const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/register`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ messaging_product: 'whatsapp', pin: PIN }),
  signal: AbortSignal.timeout(20000),
});

const json = await res.json().catch(() => null);

if (res.ok && json?.success === true) {
  console.log('\x1b[32m✓ Numéro enregistré.\x1b[0m');
  console.log('  Vérifie avec la sonde : `node scripts/wa-meta-check.mjs`');
  console.log('  (platform_type doit être passé de NOT_APPLICABLE à CLOUD_API)');
  process.exit(0);
}

const err = json?.error ?? {};
const code = err.code;
const known = ERRORS[code];

console.log(`\x1b[31m✗ Refusé (HTTP ${res.status})\x1b[0m`);
console.log(`  code      : ${code ?? '?'}${err.error_subcode ? ` (sous-code ${err.error_subcode})` : ''}`);
console.log(`  message   : ${err.message ?? '(aucun)'}`);
if (err.error_user_title) console.log(`  titre     : ${err.error_user_title}`);
if (err.error_user_msg) console.log(`  détail    : ${err.error_user_msg}`);
if (known) {
  console.log(`\n  \x1b[1mCe que ça veut dire\x1b[0m : ${known[0]}`);
  console.log(`  \x1b[1mÀ faire\x1b[0m            : ${known[1]}`);
} else {
  console.log('\n  Code inconnu de ce script — réponse brute complète :');
  console.log(JSON.stringify(json, null, 2));
}
process.exit(1);
