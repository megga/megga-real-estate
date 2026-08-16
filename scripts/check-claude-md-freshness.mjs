#!/usr/bin/env node
/**
 * Confronte les prétentions CHIFFRÉES de CLAUDE.md au code qu'elles décrivent.
 *
 * POURQUOI CETTE PORTE EXISTE. Le 16 août 2026, quelqu'un a repris les sept règles
 * visuelles du §3 une par une : UNE SEULE était encore vraie. Les six autres décrivaient
 * Sugar Pure, direction supprimée le 10 août — « pas d'ombres » alors qu'un test EXIGE
 * l'ombre de carte, « jamais bg-accent plein » alors que 120 sites le peignent, « badges
 * sans fond » alors que 25 fichiers sur 27 en posent un.
 *
 * ⛔ ET UNE RÈGLE FAUSSE ICI COÛTE PLUS CHER QU'UN DÉFAUT DANS LE CODE : c'est ce qu'un
 * agent lit AVANT d'écrire. Elle ne dort pas dans un fichier, elle se recopie sur chaque
 * surface neuve. Le CLAUDE.md est le seul fichier du dépôt dont l'erreur se propage par
 * la main de ses lecteurs.
 *
 * Ce document porte déjà ses chiffres et ses dates — il est ÉCRIT pour être vérifié
 * mécaniquement. Personne ne le faisait. C'est tout ce que fait cette porte.
 *
 * ── CE QU'ELLE VÉRIFIE, DANS LES DEUX SENS ─────────────────────────────────────────
 *
 * 1. CODE → DOC. Chaque prétention est remesurée. Un écart signifie que le doc est
 *    périmé (`derive`) ou que le code a régressé (`dur`).
 * 2. DOC → REGISTRE. La `phrase` de chaque entrée doit encore exister VERBATIM dans
 *    CLAUDE.md. Sans ce second sens, le registre survivrait à la phrase qu'il garde et
 *    vérifierait éternellement une affirmation que plus personne ne lit.
 *
 * ⛔ LA PORTE NE RÉÉCRIT JAMAIS LA PROSE. `--update` rafraîchit les chiffres du registre,
 * rien d'autre — parce qu'un nombre qui bouge peut renverser la PHRASE qui le portait :
 * « 740 boxShadow contre 6 classes shadow-* » soutient « l'ombre vient de la direction ».
 * Le jour où c'est 400 contre 300, rafraîchir les deux chiffres produirait une phrase
 * grammaticalement correcte et fausse. La porte tient le registre ; décider de la
 * conclusion reste un geste humain.
 *
 * Usage :
 *   node scripts/check-claude-md-freshness.mjs            # vérifie
 *   node scripts/check-claude-md-freshness.mjs --update    # rafraîchit les `derive`
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { sansCommentaires } from './_shared/wa-outbound-purpose.mjs';

const REGISTRE = 'scripts/_data/claude-md-claims.json';
const DOC = 'CLAUDE.md';
const MAJ = process.argv.includes('--update');

/** Dossiers qu'on ne traverse jamais — ni dépendances, ni sorties de build. */
const IGNORES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'playwright-report']);

const BLANCHIR_JS = new Set(['.ts', '.tsx', '.mjs', '.js']);

/**
 * ⛔ LE CSS SE BLANCHIT AUSSI, ET IL A FALLU QUE LA PORTE SE DÉNONCE POUR LE VOIR.
 *
 * Premier tour, 17.08.2026 : la prétention « plus d'attribut `<html data-crm-da>` » est
 * ressortie violée, à UNE occurrence — `globals.css:236`, dans le commentaire qui
 * RACONTE le retrait de Sugar. Le doc avait raison ; c'est la porte qui lisait de la
 * prose comme du code. Exactement le piège que check-email-shell.mjs a documenté avant
 * elle, dans l'autre langage.
 *
 * ⚠ Mais PAS avec le lecteur JavaScript : en CSS, `//` n'ouvre rien et apparaît dans
 * chaque `url(https://…)`. CSS ne connaît que la forme BLOC, sans ambiguïté — la
 * blanchir seule suffit et ne peut pas mutiler une valeur.
 */
const COMMENTAIRE_CSS = /\/\*[\s\S]*?\*\//g;

const cacheFichier = new Map();

/** Source d'un fichier, commentaires blanchis selon son langage. Lue une seule fois. */
function source(chemin) {
  if (!cacheFichier.has(chemin)) {
    const brut = readFileSync(chemin, 'utf8');
    const ext = extname(chemin);
    let net = brut;
    if (BLANCHIR_JS.has(ext)) net = sansCommentaires(brut);
    else if (ext === '.css') net = brut.replace(COMMENTAIRE_CSS, '');
    cacheFichier.set(chemin, net);
  }
  return cacheFichier.get(chemin);
}

const cacheArbre = new Map();

function fichiersSous(racine, extensions) {
  const cle = `${racine}|${extensions.join(',')}`;
  if (cacheArbre.has(cle)) return cacheArbre.get(cle);
  const out = [];
  const marche = (dir) => {
    for (const entree of readdirSync(dir)) {
      if (IGNORES.has(entree)) continue;
      const chemin = join(dir, entree);
      if (statSync(chemin).isDirectory()) marche(chemin);
      else if (extensions.includes(extname(chemin))) out.push(chemin);
    }
  };
  marche(racine);
  cacheArbre.set(cle, out);
  return out;
}

/**
 * Borne un motif sur les limites d'un IDENTIFIANT, tirets compris.
 *
 * ⛔ `\b` NE SUFFIT PAS, et c'est ce qui a rendu cette porte nécessaire deux fois en une
 * heure. `\buseCrmDa\b` matche l'intérieur de `useCrmDark` — un hook vivant, sans rapport,
 * 44 fois : la prétention « plus de hook useCrmDa » dénonçait alors une régression
 * imaginaire. Même piège entre `bg-accent` et `bg-accent-solid`, qui sont DEUX jetons.
 * Une porte qui crie au loup finit désactivée ; celle-ci refuse le tiret des deux côtés.
 */
function borne(motif) {
  return `(?<![\\w-])(?:${motif})(?![\\w-])`;
}

function regex(motif, mot) {
  return new RegExp(mot ? borne(motif) : motif, 'g');
}

/** Applique une `mesure` du registre et rend `{ occurrences, fichiers, valeursDistinctes, present }`. */
function mesurer(mesure) {
  // — Cas 1 : présence d'un littéral dans un fichier nommé.
  if (mesure.contient) {
    return { present: source(mesure.fichier).includes(mesure.contient) };
  }

  const motifs = mesure.motifs ?? [mesure.motif];
  const cibles = mesure.fichier
    ? [mesure.fichier]
    : mesure.portee.flatMap((racine) => fichiersSous(racine, mesure.ext));

  let occurrences = 0;
  const fichiers = new Set();
  const distinctes = new Set();

  for (const chemin of cibles) {
    if (mesure.exclure?.some((frag) => chemin.includes(frag))) continue;
    const src = source(chemin);
    for (const motif of motifs) {
      for (const m of src.matchAll(regex(motif, mesure.mot))) {
        occurrences += 1;
        fichiers.add(chemin);
        distinctes.add(mesure.capture ? m[mesure.capture] : m[0]);
      }
    }
  }

  return { occurrences, fichiers: fichiers.size, valeursDistinctes: distinctes.size };
}

/**
 * CLAUDE.md, espaces normalisés.
 *
 * Le doc est enveloppé à ~90 colonnes : « 175 sites `zIndex`\n  portant 44 valeurs »
 * est UNE phrase coupée en deux. Comparer sans replier ferait échouer la garde
 * doc→registre sur la mise en page plutôt que sur le fond.
 */
const docNormalise = readFileSync(DOC, 'utf8').replace(/\s+/g, ' ');

const registre = JSON.parse(readFileSync(REGISTRE, 'utf8'));

const perimes = [];   // la phrase a disparu du doc
const regressions = []; // prétention `dur` violée → le CODE a bougé
const derives = [];   // prétention `derive` hors tolérance → le DOC est périmé
const verts = [];

/**
 * TOUTES les prétentions `derive` et leur mesure, tolérées ou non.
 *
 * `--update` en a besoin, pas seulement des fautives : le registre est censé refléter
 * ce que la PROSE affirme, et la tolérance autorise justement l'écart à rester sous le
 * radar. Sans cette liste, corriger un chiffre du doc de 102 à 106 laisserait le
 * registre à 102 — une désynchronisation muette, dans l'outil chargé de les détecter.
 */
const toutesDerives = [];

for (const claim of registre.claims) {
  if (!docNormalise.includes(claim.phrase.replace(/\s+/g, ' '))) {
    perimes.push(claim);
    continue;
  }

  const reel = mesurer(claim.mesure);
  if (claim.severite === 'derive') toutesDerives.push({ claim, reel });
  const ecarts = [];

  for (const [cle, attendu] of Object.entries(claim.attendu)) {
    const obtenu = reel[cle];
    if (obtenu === attendu) continue;
    const tolere =
      claim.severite === 'derive' &&
      typeof attendu === 'number' &&
      attendu > 0 &&
      Math.abs(obtenu - attendu) / attendu <= (claim.tolerance ?? 0);
    if (!tolere) ecarts.push({ cle, attendu, obtenu });
  }

  if (!ecarts.length) verts.push(claim);
  else if (claim.severite === 'dur') regressions.push({ claim, ecarts });
  else derives.push({ claim, ecarts, reel });
}

// ── Rapport ────────────────────────────────────────────────────────────────────────

const ligne = (e) => `${e.cle} : doc ${e.attendu} → réel ${e.obtenu}`;

if (perimes.length) {
  console.error(`\n✖ ${perimes.length} entrée(s) du registre citent une phrase ABSENTE de ${DOC} :\n`);
  for (const c of perimes) console.error(`    ${c.id}  (${c.section})\n      « ${c.phrase} »`);
  console.error(`
  Le registre a survécu à la phrase qu'il gardait. Soit la phrase a été
  reformulée — mettre à jour \`phrase\` dans ${REGISTRE} — soit elle a été
  retirée du doc, et l'entrée doit l'être aussi.\n`);
}

if (regressions.length) {
  console.error(`\n✖ ${regressions.length} prétention(s) DURE(s) violée(s) — le code a bougé :\n`);
  for (const { claim, ecarts } of regressions) {
    console.error(`    ${claim.id}  (${claim.section})`);
    console.error(`      « ${claim.phrase} »`);
    for (const e of ecarts) console.error(`      ⛔ ${ligne(e)}`);
    if (claim.note) console.error(`      ↳ ${claim.note}`);
  }
  console.error(`
  Une prétention DURE ne se rafraîchit pas : c'est le code qui doit revenir.
  \`--update\` refuse d'y toucher, volontairement.\n`);
}

if (derives.length) {
  console.error(`\n⚠ ${derives.length} prétention(s) chiffrée(s) ont DÉRIVÉ — ${DOC} est périmé :\n`);
  for (const { claim, ecarts } of derives) {
    console.error(`    ${claim.id}  (${claim.section}, mesuré le ${claim.mesureLe})`);
    console.error(`      « ${claim.phrase} »`);
    for (const e of ecarts) console.error(`      → ${ligne(e)}`);
    if (claim.note) console.error(`      ↳ ${claim.note}`);
  }
  console.error(`
  Corriger ${DOC} — le chiffre ET, s'il la renverse, la conclusion qu'il portait —
  puis \`node scripts/check-claude-md-freshness.mjs --update\` pour réaligner le
  registre. Dater la correction dans le doc : un chiffre sans date se périme sans
  prévenir.\n`);
}

if (MAJ) {
  if (regressions.length || perimes.length) {
    console.error('✖ --update refusé tant qu\'une prétention DURE est violée ou qu\'une phrase manque.\n');
    process.exit(1);
  }
  /**
   * ⛔ ON NE RÉALIGNE PAS LE REGISTRE SUR UN DOC RESTÉ FAUX.
   *
   * Sans ce verrou, `--update` serait le geste qui CASSE la porte : il rendrait le
   * registre vert en le calant sur le code, pendant que CLAUDE.md continuerait
   * d'afficher l'ancien chiffre — et plus rien ne le signalerait jamais. On aurait
   * automatisé la péremption silencieuse qu'on essaie d'éliminer.
   *
   * La `phrase` cite le chiffre du doc. Exiger qu'elle porte déjà la valeur mesurée,
   * c'est exiger que la prose ait été corrigée AVANT. L'ordre est donc imposé :
   * corriger le doc, reporter la phrase ici, puis rafraîchir.
   */
  const chiffresDe = (s) => new Set((s.match(/\d+/g) ?? []).map(Number));
  /** Clés dont la valeur MESURÉE n'apparaît pas dans la phrase du doc. */
  const nonCites = ({ claim, reel }) => {
    const cites = chiffresDe(claim.phrase);
    return Object.keys(claim.attendu).filter((cle) => !cites.has(reel[cle]));
  };

  const nonCorriges = derives
    .map(({ claim, reel }) => ({ claim, reel, manquants: nonCites({ claim, reel }) }))
    .filter((d) => d.manquants.length);

  if (nonCorriges.length) {
    console.error(`✖ --update refusé : ${nonCorriges.length} phrase(s) portent encore l'ancien chiffre.\n`);
    for (const { claim, manquants, reel } of nonCorriges) {
      console.error(`    ${claim.id}  — « ${claim.phrase} »`);
      for (const cle of manquants) console.error(`      ${cle} mesuré à ${reel[cle]}, absent de la phrase`);
    }
    console.error(`
  Corriger d'abord ${DOC}, puis reporter le nouveau texte dans \`phrase\`
  (${REGISTRE}). Rafraîchir le registre seul rendrait la porte verte
  sur un document faux — exactement ce qu'elle existe pour empêcher.\n`);
    process.exit(1);
  }

  // On synchronise toute prétention que la prose affirme déjà — pas seulement les
  // fautives : c'est ce qui évite qu'un chiffre corrigé à l'intérieur de la tolérance
  // laisse le registre en arrière.
  const aSyncer = toutesDerives.filter((d) => !nonCites(d).length);
  /**
   * ⚠ JOURNÉE CIVILE SUISSE, PAS UTC. `toISOString()` a daté du 16 août un registre
   * réaligné le 17 à 01h07 à Zurich — deux heures par nuit, l'horodatage aurait
   * désigné la veille. Anodin ailleurs ; ici la DATE est le signal de fraîcheur que
   * toute cette porte sert à défendre, et « mesuré le 16 » envoie relire un doc qu'on
   * vient de corriger. `sv-SE` rend le format ISO sans avoir à recomposer les champs.
   */
  const aujourdhui = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
  let touchees = 0;

  for (const { claim, reel } of aSyncer) {
    const entree = registre.claims.find((c) => c.id === claim.id);
    const bouge = Object.keys(entree.attendu).some((cle) => entree.attendu[cle] !== reel[cle]);
    if (!bouge) continue;
    for (const cle of Object.keys(entree.attendu)) entree.attendu[cle] = reel[cle];
    entree.mesureLe = aujourdhui;
    touchees += 1;
  }

  writeFileSync(REGISTRE, `${JSON.stringify(registre, null, 2)}\n`);
  console.log(`✓ Registre réaligné sur la prose : ${touchees} prétention(s) remesurée(s) au ${aujourdhui}.`);
  process.exit(0);
}

const echec = perimes.length + regressions.length + derives.length;

if (!echec) {
  console.log(`✓ Fraîcheur ${DOC} : ${verts.length} prétention(s) chiffrée(s) vérifiées, aucun écart.`);
} else {
  console.error(`✖ ${echec} écart(s) sur ${registre.claims.length} prétention(s) — ${verts.length} vérifiée(s).`);
}

process.exit(echec ? 1 : 0);
