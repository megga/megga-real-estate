#!/usr/bin/env node
/**
 * Le veilleur HORS SUPABASE : il parle quand Supabase se tait.
 *
 * Pourquoi ce script existe. §10.9 demande une alerte pour le cas où la plateforme
 * devient muette. Le mécanisme d'alerte du produit existe déjà et il est bon
 * (`supabase/functions/_shared/admin-alerts.ts`, 11 règles) — mais il tourne DANS
 * Supabase, déclenché par pg_cron, et il envoie par une Edge Function. Mesuré : les
 * 46 crons de santé sont dans `cron.job`, sans exception. Si Supabase tombe, ils se
 * taisent TOUS ensemble, y compris celui qui devait prévenir. C'est précisément le
 * scénario que §10.9 vise, et c'est le seul que le mécanisme interne ne peut pas couvrir.
 *
 * Ce veilleur-ci tourne sur l'infrastructure GitHub. Le dépôt s'en sert déjà comme
 * veilleur planifié — `security-audit.yml`, cron hebdomadaire, qui sonde la production
 * et envoie par Resend. Il ne manquait pas un canal, il manquait un signal.
 *
 * ⚠ LE DESTINATAIRE EST EN DUR, ET C'EST UN CHOIX. On pourrait le lire dans
 * `super_admin_allowlist()` — ce que fait le mécanisme interne, et c'est plus propre.
 * Mais lire l'allowlist exige la base de données, c'est-à-dire exactement ce qui peut
 * être tombé. Un veilleur dont le carnet d'adresses vit chez le patient ne sert à rien.
 *
 * LE SEUIL EST DÉRIVÉ, PAS CHOISI. Deux jobs tournent à la minute
 * (`whatsapp-process-minute`, `whatsapp-agent-async-minute`) : mesuré sur 6 heures de
 * production, l'écart MAXIMAL entre deux exécutions consécutives, tous jobs confondus,
 * est de 60 secondes — parfaitement régulier. Dix minutes de silence valent donc dix
 * battements manqués. Aucun arbitrage produit là-dedans : c'est un multiple de la
 * cadence observée.
 *
 * Usage :  SUPABASE_ACCESS_TOKEN=… node scripts/check-scheduler-heartbeat.mjs
 *          node scripts/check-scheduler-heartbeat.mjs --dry-run   (n'envoie rien)
 */
const PROJECT_REF = 'eayczugyrvmtqnnmvjod';
const SILENCE_MAX_MIN = 10;      // 10 battements manqués (cadence mesurée : 60 s)
const DESTINATAIRE = 'noreply@megga.ch';

const DRY = process.argv.includes('--dry-run');

/**
 * L'état de l'ordonnanceur, en une requête. On lit `cron.job_run_details` plutôt qu'une
 * table applicative : c'est la seule preuve que pg_cron lui-même tourne, et elle ne
 * dépend d'aucune fonctionnalité métier.
 *
 * `sentinelles` compte les jobs à la minute ENCORE PLANIFIÉS : un job supprimé ne laisse
 * aucune trace, il cesse simplement d'écrire — le pouls disparaîtrait sans que le silence
 * ne prouve quoi que ce soit sur la santé du reste. Le dépôt a déjà payé ça
 * (realadvisor-rolling-daily supprimé le 21/06, personne ne l'a vu pendant un mois).
 */
const SQL = `
  select
    (select round(extract(epoch from (now() - max(end_time))) / 60.0)::int
       from cron.job_run_details)                                      as silence_min,
    (select count(*)::int from cron.job
      where schedule = '* * * * *' and active)                         as sentinelles,
    (select count(*)::int from cron.job where active)                  as jobs_actifs`;

async function interroger(token) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SQL }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) throw new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const [row] = await res.json();
  return row;
}

/**
 * Envoi direct par Resend, sans passer par une Edge Function : elle vit chez le patient.
 * Un échec d'envoi est FATAL pour ce script — un veilleur qui n'a pas pu parler doit
 * laisser le workflow rouge, sinon son silence se lit comme « tout va bien ».
 */
async function alerter(sujet, lignes) {
  console.error(`\n✗ ${sujet}`);
  for (const l of lignes) console.error(`  ${l}`);

  const cle = process.env.RESEND_API_KEY;
  if (DRY || !cle) {
    console.error(DRY ? '\n(--dry-run : aucun e-mail envoyé)' : '\nRESEND_API_KEY absente — e-mail non envoyé.');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: DESTINATAIRE,
      to: [DESTINATAIRE],
      subject: `[MEGGA] ${sujet}`,
      html: `<h2 style="color:#dc2626">${sujet}</h2><ul>${
        lignes.map((l) => `<li>${l.replace(/</g, '&lt;')}</li>`).join('')
      }</ul><hr><p style="color:#6b7280;font-size:12px">scripts/check-scheduler-heartbeat.mjs — veilleur hors Supabase, workflow scheduler-heartbeat.yml</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 200)}`);
  console.error(`✉  Alerte envoyée à ${DESTINATAIRE}`);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN manquant — ce veilleur interroge la production.');
  process.exit(2);
}

let etat;
try {
  etat = await interroger(token);
} catch (err) {
  // ⚠ C'EST LE CAS QUE §10.9 VISE, et il ne ressemble pas à un défaut de données : la
  // base ne répond pas du tout. On alerte sur l'échec lui-même, sans rien pouvoir lire.
  await alerter('Production Supabase INJOIGNABLE', [
    `La sonde a échoué : ${err.message}`,
    'Aucune alerte interne ne peut partir dans cet état : elles vivent toutes dans Supabase.',
  ]);
  process.exit(1);
}

const anomalies = [];
if (etat.sentinelles < 1) {
  anomalies.push(
    'Aucun job à la minute n\'est planifié : le pouls a disparu, et son silence ne prouverait plus rien.',
  );
}
if (etat.silence_min === null) {
  anomalies.push('`cron.job_run_details` est vide : pg_cron n\'a jamais tourné sur cette base.');
} else if (etat.silence_min > SILENCE_MAX_MIN) {
  anomalies.push(
    `Aucune exécution de cron depuis ${etat.silence_min} min (seuil ${SILENCE_MAX_MIN} min, ` +
    'soit dix battements manqués sur une cadence mesurée à 60 s).',
  );
}

if (anomalies.length === 0) {
  console.log(
    `✓ Ordonnanceur vivant : dernière exécution il y a ${etat.silence_min} min, ` +
    `${etat.sentinelles} sentinelle(s) à la minute, ${etat.jobs_actifs} jobs actifs.`,
  );
  process.exit(0);
}

await alerter('L\'ordonnanceur de production ne bat plus', anomalies);
process.exit(1);
