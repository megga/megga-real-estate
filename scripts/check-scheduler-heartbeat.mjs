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
 *
 * ⚠ LE TEST DES SENTINELLES EST SÉMANTIQUE, PAS LITTÉRAL. `schedule = '* * * * *'`
 * comparait une CHAÎNE : réécrire la minute en intervalle — forme « barre oblique 1 »,
 * strictement équivalente et acceptée par pg_cron — faisait tomber le compte à 0 et
 * déclenchait « le pouls a disparu »
 * toutes les 30 min sur un ordonnanceur en pleine santé. Or le dépôt re-pose régulièrement
 * des commandes de cron par migration. On normalise donc les espaces et on accepte les
 * deux écritures de « chaque minute » (vérifié sur les 6 formes).
 *
 * ⚠ LE SILENCE SE MESURE SUR UNE FENÊTRE BORNÉE. `max(end_time)` sur toute la table était
 * un Parallel Seq Scan — 208 000 lignes, 15 403 buffers, 92 ms — répété à chaque passage
 * sur une table que RIEN ne purge, et qui évinçait 125 Mo du cache partagé au passage.
 * Les 2 000 derniers `runid` couvrent ~30 h d'historique pour un seuil de 10 min : marge
 * intacte, et le plan devient un Index Scan Backward sur la PK (280 buffers, 1,4 ms).
 */
const SQL = `
  select
    (select round(extract(epoch from (now() - max(end_time))) / 60.0)::int
       from (select end_time from cron.job_run_details
              order by runid desc limit 2000) r)                       as silence_min,
    (select count(*)::int from cron.job
      where active
        and split_part(regexp_replace(btrim(schedule), '\\s+', ' ', 'g'), ' ', 1) in ('*', '*/1')
        and regexp_replace(btrim(schedule), '\\s+', ' ', 'g') like '% * * * *')
                                                                       as sentinelles,
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
  if (!res.ok) {
    const err = new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
    err.statut = res.status;
    throw err;
  }
  const lignes = await res.json();
  // ⚠ La forme fait partie du contrat, et elle se vérifie : un corps vide ou inattendu
  // laissait `row` à `undefined`, et la première lecture de champ levait un TypeError
  // HORS du try/catch — workflow rouge, mais AUCUNE alerte envoyée.
  const row = Array.isArray(lignes) ? lignes[0] : undefined;
  if (!row || typeof row.jobs_actifs !== 'number') {
    const err = new Error(`réponse inattendue du Management API : ${JSON.stringify(lignes).slice(0, 200)}`);
    err.statut = res.status;
    throw err;
  }
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

/**
 * ⚠ LA SONDE N'EST PAS LA BASE. Elle interroge `api.supabase.com`, le PLAN DE CONTRÔLE :
 * son échec ne prouve donc PAS que la production est tombée. Annoncer « Production
 * Supabase INJOIGNABLE » sur un 401 revenait à crier à la mort du patient parce que le
 * téléphone du veilleur ne marche plus — et, à raison d'un passage toutes les 30 minutes
 * sans aucun état conservé entre eux, à le crier des dizaines de fois par jour jusqu'à ce
 * que quelqu'un renouvelle le jeton.
 *
 * On sépare donc trois cas, parce qu'ils appellent trois gestes différents :
 *   · 401/403 → NOTRE configuration est cassée (jeton révoqué ou périmé). Le workflow
 *     rouge est le bon canal : un e-mail quotidien sur notre propre panne de veille est
 *     du bruit, et il userait la seule adresse censée signifier « la plateforme est morte ».
 *   · 429/5xx/réseau/timeout → très probablement transitoire : on réessaie avant de parler.
 *   · échec persistant → on alerte, mais en le NOMMANT pour ce qu'il est (la sonde est
 *     aveugle), sans affirmer l'état de la base qu'on n'a justement pas pu lire.
 */
const TENTATIVES = Number(process.env.HEARTBEAT_TRIES ?? 3);
const ATTENTE_MS = Number(process.env.HEARTBEAT_DELAY_MS ?? 20_000);

let etat;
let dernierEchec;
for (let essai = 1; essai <= TENTATIVES; essai++) {
  try {
    etat = await interroger(token);
    break;
  } catch (err) {
    dernierEchec = err;
    if (err.statut === 401 || err.statut === 403) {
      console.error(
        `✗ Le veilleur ne peut plus s'authentifier (HTTP ${err.statut}) : ${err.message}\n` +
        '  C\'est SUPABASE_ACCESS_TOKEN qu\'il faut renouveler, pas la production qu\'il faut réveiller.\n' +
        '  Aucun e-mail envoyé : ce workflow rouge est le bon canal pour une panne de la veille.',
      );
      process.exit(2);
    }
    if (essai < TENTATIVES) {
      console.error(`… sonde en échec (${err.message}) — nouvel essai ${essai + 1}/${TENTATIVES} dans ${Math.round(ATTENTE_MS / 1000)} s.`);
      await new Promise((r) => setTimeout(r, ATTENTE_MS));
    }
  }
}

if (!etat) {
  await alerter('Le battement de production ne peut plus être mesuré', [
    `La sonde a échoué ${TENTATIVES} fois de suite : ${dernierEchec?.message ?? 'aucune tentative effectuée'}`,
    'Elle interroge api.supabase.com — cet échec ne dit PAS que la base est tombée, il dit',
    'que la veille est aveugle. Les alertes internes, elles, vivent dans Supabase : si la',
    'plateforme est effectivement morte, personne d\'autre ne parlera.',
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
