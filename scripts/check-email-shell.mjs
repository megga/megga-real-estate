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
import { sansCommentaires } from './_shared/wa-outbound-purpose.mjs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';

/**
 * ⚠ `src/` EST DANS LE PÉRIMÈTRE DEPUIS LE 15.08.2026, et c'est un trou que cette porte
 * a elle-même laissé passer : `src/hooks/useSendAgentEmail.ts` fabriquait un document
 * HTML d'e-mail COMPLET dans le bundle navigateur, puis le postait à `send-email`. Une
 * quatorzième coquille, invisible tant qu'on ne scannait que les edge functions.
 *
 * Le front n'a AUCUNE raison de composer un e-mail : il envoie le texte, le serveur
 * compose. C'est ce que fait désormais `agent_freeform`.
 */
const SRC_DIR = 'src';

/** Le seul fichier autorisé à porter la coquille. */
const SHELL = 'supabase/functions/_shared/email-shell.ts';

/**
 * Fichiers qui fabriquent encore leur propre coquille, en attente de migration.
 * Chaque entrée dit CE QUE L'E-MAIL EST — pour qu'on sache ce qu'on casse en migrant,
 * et dans quel ordre s'y prendre (le client d'abord, l'interne ensuite).
 */
const A_MIGRER = {};

/** Marqueurs d'un document HTML complet — ce que seule la coquille a le droit d'écrire. */
const MARQUEURS = [/<!DOCTYPE\s+html/i, /<html[\s>]/i];

/**
 * ⛔ MARQUEURS D'UNE COQUILLE QUI N'EN A PAS L'AIR — ajoutés le 16 août 2026, après
 * qu'un gabarit VIVANT a traversé toute la migration sans être vu une seule fois.
 *
 * `_shared/weekly-digest.ts` (le bilan du vendredi, cron `weekly-digest-friday`)
 * rendait un `<div>` autonome — police système, encre `#1c1c1e` en dur, pied écrit
 * à la main — et le postait directement à Resend. Aucun `<!DOCTYPE>`, aucun
 * `<html>` : les deux marqueurs ci-dessus ne pouvaient pas le voir. La porte a donc
 * imprimé « Migration terminée » pendant que les agents recevaient chaque semaine
 * le dernier e-mail d'avant MEGGA X. Une porte aveugle à une famille entière est
 * pire qu'une porte absente : elle délivre un certificat.
 *
 * Ce qu'on cherche n'est donc pas la BALISE RACINE, c'est l'INTENTION D'ÊTRE UNE
 * COQUILLE. Un conteneur qui fixe sa propre police ou sa propre largeur maximale se
 * déclare enveloppe du message — c'est le geste d'un gabarit complet, jamais celui
 * d'un fragment inséré dans un corps existant.
 *
 * ⚠ Volontairement étroit sur ces deux propriétés-là. `unsubscribeFooterHtml`
 * (`email-guard.ts`) émet bien un `<p style="font-size:…">`, mais il ne fixe ni
 * police ni largeur : il s'insère dans une coquille au lieu d'en tenir lieu, et
 * reste donc hors du filet. Élargir aux `style=` en général rendrait la porte
 * bruyante, et une porte bruyante finit désactivée.
 */
const MARQUEURS_FRAGMENT = [
  /<(?:div|table|body)[^>]*style="[^"]*font-family:/i,
  /<(?:div|table|body)[^>]*style="[^"]*max-width:/i,
];

/** La coquille commune, importée — la preuve qu'un fichier ne s'en fabrique pas une. */
const IMPORTE_COQUILLE = /from\s+'[^']*email-shell\.ts'/;

/**
 * Dans `src/`, seul un `<!DOCTYPE>` compte. `<html` y désigne presque toujours un
 * sélecteur ou un commentaire sur l'élément racine (thème, verrou de défilement) — le
 * chercher produisait cinq faux positifs et aurait fait désactiver la porte.
 */
const MARQUEURS_SRC = [/<!DOCTYPE\s+html/i];

/**
 * Documents HTML de `src/` qui ne sont PAS des e-mails. Chaque entrée porte sa raison,
 * comme les autres listes de ce dépôt.
 */
const HORS_EMAIL = {
  'src/components/ai-copilot/panel/LetterReviewModal.tsx':
    "Lettre A4 IMPRIMABLE (`@page { size: A4 }`), pas un e-mail : elle part chez un imprimeur ou un PDF, jamais dans une boîte. La coquille d'e-mail lui donnerait un fond noir et un pied de désinscription sur du papier.",
  'src/lib/mail/sanitize.ts':
    "Le VISIONNEUR d'un mail REÇU (Messagerie, D9), pas un mail émis : `buildBodySrcdoc` fabrique le document d'une `<iframe sandbox srcdoc>` dont la CSP bloque script, connexions et images distantes. Il enveloppe le HTML de QUELQU'UN D'AUTRE — lui appliquer la coquille MEGGA poserait notre en-tête, notre pied et un lien de désinscription autour du message d'un client. Le sens de la porte est inversé ici : ce fichier ne compose pas un e-mail, il en affiche un sans le laisser s'exécuter.",
};

function fichiersTs(dir) {
  const out = [];
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiersTs(chemin));
    } else if (/\.tsx?$/.test(entree) && !/\.(test|spec)\.tsx?$/.test(entree)) {
      out.push(chemin);
    }
  }
  return out;
}

const fautifs = [];
const listePerimee = [];

for (const fichier of [...fichiersTs(FUNCTIONS_DIR), ...fichiersTs(SRC_DIR)]) {
  if (fichier === SHELL) continue;
  if (fichier in HORS_EMAIL) continue;
  // ⛔ ON SCANNE LE CODE, PAS LES COMMENTAIRES — mesuré le 16 août 2026 en écrivant
  // la détection de fragment ci-dessus : le commentaire qui EXPLIQUE la porte citait
  // « <html> », et la porte s'est dénoncée elle-même. Toute prose qui parle d'e-mails
  // — un en-tête d'explication, un exemple, un TODO — devenait une coquille à ses yeux.
  // L'assistant vient de `scripts/_shared/` et connaît les chaînes : un blanchiment naïf
  // de `//` détruirait le guillemet fermant de la moindre URL.
  const source = sansCommentaires(readFileSync(fichier, 'utf8'));
  const dansSrc = fichier.startsWith(`${SRC_DIR}/`);
  const motifs = dansSrc ? MARQUEURS_SRC : MARQUEURS;
  // La détection de FRAGMENT ne vaut que pour les edge functions, et seulement pour
  // qui n'importe pas la coquille : un gabarit qui la compose écrit légitimement des
  // conteneurs stylés DANS son `bodyHtml`.
  const seFabriqueUneCoquille = !dansSrc
    && !IMPORTE_COQUILLE.test(source)
    && MARQUEURS_FRAGMENT.some((m) => m.test(source));
  const emetDuHtml = motifs.some((m) => m.test(source)) || seFabriqueUneCoquille;

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
