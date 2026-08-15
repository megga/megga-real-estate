#!/usr/bin/env node
/**
 * Garde-fou du chemin SORTANT WhatsApp : rien ne part vers une personne sans passer par la
 * garde de consentement.
 *
 * POURQUOI UN GREP DE SYMBOLES NE SUFFIT PAS, et c'est tout l'intérêt de ce fichier.
 * Les trois trous les plus graves du chantier passaient par le BON symbole avec un MAUVAIS
 * argument :
 *   · le site de l'avis LPD appelait la garde avec `kind:'phone'`, ce qui désactivait le
 *     registre entier — un grep sur `sendOutboundGuarded` l'aurait vu, et déclaré conforme ;
 *   · `kyc-report-pdf` recevait `profile_id` dans son corps et ne s'en servait pas, si bien
 *     qu'un `to_phone` arbitraire partait sans vérification ;
 *   · l'accusé de désinscription construisait encore sa requête à la main, deux lots après
 *     l'arrivée de la garde.
 * On vérifie donc les ARGUMENTS et les LIEUX, pas la présence d'un nom.
 *
 * Trois propriétés, chacune tombée d'un défaut réel :
 *   1. `provider.buildSend*Request` n'existe que dans la gateway et dans la garde. Cinq
 *      `fetch` bruts contournaient jadis `sendWithRetry` ; une garde qu'on évite en écrivant
 *      `fetch` n'est pas une garde.
 *   2. tout `purpose:` est LISIBLE STATIQUEMENT — un littéral, ou un ternaire dont les deux
 *      branches en sont. `purpose: p` rendrait le lot conformité inauditable.
 *   3. les deux finalités PRIVILÉGIÉES sont géographiquement bornées : `lpd_notice` passe
 *      outre un opt-out déclaratif, `opt_out_ack` écrit à un numéro BLOQUÉ. Les laisser
 *      partout reviendrait à offrir deux laissez-passer.
 *
 * Usage : node scripts/check-whatsapp-outbound.mjs   → exit 1 à la première violation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// La LECTURE de la finalité vit à part, parce qu'elle a besoin d'un banc : c'est elle qui
// rend le verdict, et une porte dont le lecteur n'est pas éprouvé rend un vert non gagné.
import {
  PURPOSES, purposeLisible, valeurDe, corpsArguments, sansCommentaires,
} from './_shared/wa-outbound-purpose.mjs';

const RACINE = 'supabase/functions';

/** Seuls fichiers autorisés à construire une requête d'envoi. */
const CONSTRUCTEURS = [
  'supabase/functions/_shared/whatsapp-gateway.ts',
  'supabase/functions/_shared/whatsapp-outbound-guard.ts',
];

/**
 * Finalités PRIVILÉGIÉES → fichiers qui ont le droit de les émettre.
 *
 * `opt_out_ack` vit dans `_shared/whatsapp-stop.ts` et non dans les deux fonctions qui
 * l'appellent : le module EST la branche STOP, partagée par le webhook et le cron. La
 * dupliquer pour satisfaire la lettre du plan l'aurait fait diverger — exactement ce que le
 * module existe pour empêcher.
 */
const RESERVEES = {
  lpd_notice: ['supabase/functions/whatsapp-process/index.ts'],
  opt_out_ack: ['supabase/functions/_shared/whatsapp-stop.ts'],
};

function sources(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const ligneDe = (txt, i) => txt.slice(0, i).split('\n').length;

const fautes = [];
const fichiers = sources(RACINE);
let appels = 0;

for (const f of fichiers) {
  const brut = readFileSync(f, 'utf8');
  const txt = sansCommentaires(brut);

  // ── Propriété 1 ───────────────────────────────────────────────────────────
  if (!CONSTRUCTEURS.includes(f)) {
    for (const m of txt.matchAll(/\.buildSend(Text|Image|Document|Template)Request\b/g)) {
      fautes.push({
        f, ligne: ligneDe(txt, m.index),
        quoi: `\`buildSend${m[1]}Request\` hors de la gateway et de la garde — le sortant doit passer par \`sendOutboundGuarded\``,
      });
    }
  }

  // ── Propriétés 2 et 3 ─────────────────────────────────────────────────────
  // ⚠ On repère l'APPEL, pas « l'appel suivi d'une accolade ». L'ancienne forme
  // (`\(\s*\{`) ne voyait tout simplement pas `sendOutboundGuarded(args)` : l'envoi
  // n'était ni compté, ni contrôlé — un contournement en une variable.
  for (const m of txt.matchAll(/\bsendOutboundGuarded\s*\(/g)) {
    // La DÉCLARATION n'est pas un appel. L'ancienne forme l'écartait par accident — sa
    // signature ne commence pas par `{` —, ce qui n'était pas une raison mais une chance.
    if (/\bfunction\s+$/.test(txt.slice(Math.max(0, m.index - 40), m.index))) continue;
    appels++;
    const args = corpsArguments(txt, m.index + m[0].length);
    if (args === null) {
      fautes.push({
        f, ligne: ligneDe(txt, m.index),
        quoi: '`sendOutboundGuarded` sans littéral d\'objet en ligne — la finalité doit être lisible SUR PLACE',
      });
      continue;
    }
    const expr = valeurDe(args, 'purpose');
    if (!expr) {
      fautes.push({ f, ligne: ligneDe(txt, m.index), quoi: '`sendOutboundGuarded` sans `purpose:`' });
      continue;
    }
    const valeurs = purposeLisible(expr);
    if (!valeurs) {
      fautes.push({
        f, ligne: ligneDe(txt, m.index),
        quoi: `\`purpose: ${expr}\` n'est pas lisible statiquement — littéral, ou ternaire de littéraux`,
      });
      continue;
    }
    for (const v of valeurs) {
      const autorises = RESERVEES[v];
      if (autorises && !autorises.includes(f)) {
        fautes.push({
          f, ligne: ligneDe(txt, m.index),
          quoi: `\`purpose: '${v}'\` est réservé à ${autorises.join(', ')}`,
        });
      }
    }
  }
}

if (fautes.length) {
  console.error(`\n✗ Chemin sortant WhatsApp : ${fautes.length} violation(s).\n`);
  for (const v of fautes) console.error(`  ${v.f}:${v.ligne}\n    ${v.quoi}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ Chemin sortant WhatsApp — ${appels} appel(s) à la garde, tous à finalité lisible.`);
console.log(`  Aucun buildSend*Request hors de ${CONSTRUCTEURS.length} fichiers autorisés.`);
