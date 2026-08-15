#!/usr/bin/env node
/**
 * Défend la direction artistique des E-MAILS.
 *
 * POURQUOI CETTE PORTE EXISTE. Mesuré le 15.08.2026 : `supabase/functions/` comptait
 * TREIZE fichiers fabriquant chacun son propre `<!DOCTYPE html>`, onze en police système,
 * avec huit fonds de page différents. Il n'y avait pas un design d'e-mail MEGGA, il y en
 * avait treize — alors que le CRM et la vitrine sont passés à MEGGA X.
 *
 * ⚠ ET SURTOUT : ON SAIT QU'UN MODULE PARTAGÉ NE SUFFIT PAS, PARCE QU'ON A DÉJÀ ESSAYÉ.
 * `_shared/resend.ts` a été écrit exactement pour être le point d'ENVOI unique ; son
 * propre en-tête constate que les quatorze appels existants n'ont jamais été convertis,
 * et deux sites sur seize l'utilisent. Un module disponible n'est pas un module adopté.
 * C'est cette porte, et elle seule, qui empêche le treizième design de naître demain.
 *
 * CE QU'ELLE VÉRIFIE : aucun fichier de `supabase/functions/` n'émet de document HTML
 * (`<!DOCTYPE html>` ou `<html`) en dehors de `_shared/email-shell.ts`.
 *
 * LA LISTE DE MIGRATION est le seul moyen de livrer la porte AVANT les treize migrations :
 * elle ferme immédiatement pour tout NOUVEL e-mail, et rétrécit à mesure qu'on convertit.
 * Même patron qu'`OPEN_BY_DESIGN` dans check-edge-auth.mjs — et même exigence : chaque
 * entrée porte sa raison, sinon la liste devient le tapis sous lequel on glisse les
 * oublis. Un fichier migré qui y resterait est signalé, pour qu'elle ne pourrisse pas.
 *
 * Usage : node scripts/check-email-shell.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';

/** Le seul fichier autorisé à porter la coquille. */
const SHELL = 'supabase/functions/_shared/email-shell.ts';

/**
 * Fichiers qui fabriquent encore leur propre coquille, en attente de migration.
 * Chaque entrée dit CE QUE L'E-MAIL EST — pour qu'on sache ce qu'on casse en migrant,
 * et dans quel ordre s'y prendre (le client d'abord, l'interne ensuite).
 */
const A_MIGRER = {
  'supabase/functions/_shared/whatsapp-optin-send.ts':
    "Invitation à consentir au canal WhatsApp. CLIENT, envoyée au contact d'une agence.",
  'supabase/functions/send-email/index.ts':
    "Fonction générique (estimation vendeur, notification d'agent, accès portail). Porte sa propre `wrapHTML` en gris clair ; c'est le plus gros chantier des treize.",
  'supabase/functions/send-reminder-email/index.ts':
    'Rappel de rendez-vous ou de tâche. CLIENT.',
  'supabase/functions/weekly-report/index.ts':
    "Rapport hebdomadaire à l'agent. INTERNE au produit, donc moins pressé.",
};

/** Marqueurs d'un document HTML complet — ce que seule la coquille a le droit d'écrire. */
const MARQUEURS = [/<!DOCTYPE\s+html/i, /<html[\s>]/i];

function fichiersTs(dir) {
  const out = [];
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiersTs(chemin));
    } else if (entree.endsWith('.ts') && !entree.endsWith('.test.ts')) {
      out.push(chemin);
    }
  }
  return out;
}

const fautifs = [];
const listePerimee = [];

for (const fichier of fichiersTs(FUNCTIONS_DIR)) {
  if (fichier === SHELL) continue;
  const source = readFileSync(fichier, 'utf8');
  const emetDuHtml = MARQUEURS.some((m) => m.test(source));

  if (fichier in A_MIGRER) {
    // Un fichier migré qui resterait listé ferait croire à du travail restant, et pire :
    // il pourrait re-fabriquer une coquille sans que personne ne le voie.
    if (!emetDuHtml) listePerimee.push(fichier);
    continue;
  }

  if (emetDuHtml) fautifs.push(fichier);
}

let echec = false;

if (fautifs.length) {
  echec = true;
  console.error(`\n✖ ${fautifs.length} fichier(s) fabriquent une coquille d'e-mail hors de la coquille commune :\n`);
  for (const f of fautifs) console.error(`    ${f}`);
  console.error(`
  Un e-mail MEGGA se compose avec ${SHELL} :
    import { shell, p, h2, row, button } from '../_shared/email-shell.ts'
    shell({ title, preheader, bodyHtml, legalNote, headerCta })

  Écrire son propre <!DOCTYPE> refait un quatorzième design, et c'est
  exactement ce que cette porte existe pour empêcher.

  Si le fichier est un cas légitime, l'ajouter à A_MIGRER dans ce script
  AVEC sa justification écrite.\n`);
}

if (listePerimee.length) {
  echec = true;
  console.error(`\n✖ ${listePerimee.length} fichier(s) sont listés « à migrer » mais n'émettent plus de HTML :\n`);
  for (const f of listePerimee) console.error(`    ${f}`);
  console.error('\n  Les retirer de A_MIGRER : une liste qui ne rétrécit pas ne veut plus rien dire.\n');
}

if (!echec) {
  const reste = Object.keys(A_MIGRER).length;
  console.log(
    `✓ Coquille e-mail : aucune coquille hors de ${SHELL}.` +
      (reste ? ` ${reste} fichier(s) restent à migrer (liste A_MIGRER).` : ' Migration terminée.'),
  );
}

process.exit(echec ? 1 : 0);
