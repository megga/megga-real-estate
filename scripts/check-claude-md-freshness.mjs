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

/**
 * `--prod` : les prétentions de base de données sont le SEUL intérêt de l'appel, donc un
 * jeton absent doit ÉCHOUER au lieu d'être signalé.
 *
 * ⛔ Convention reprise de check-types-freshness.mjs, qui la porte pour avoir payé le
 * défaut : « sans le drapeau, le script passait au vert en ayant sauté toutes ses
 * assertions de prod ». C'est le même piège que l'étape sautée en silence — un
 * avertissement dans une sortie verte se lit comme un succès dès que personne ne lit.
 */
const PROD = process.argv.includes('--prod');

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

/**
 * ⚠ Drapeau `m` — sans lui, `^` ne désigne que le début du FICHIER, pas de la ligne, et
 * un motif ancré rend silencieusement 0. Relevé le 17.08.2026 : `^\s*'[a-z0-9-]+',`
 * comptait zéro entrée du roster au lieu de 81. Zéro est une valeur plausible, donc
 * l'erreur se lisait comme une dérive à corriger dans le doc — un motif défaillant qui
 * accuse la prose est la pire façon de se tromper ici.
 */
function regex(motif, mot) {
  return new RegExp(mot ? borne(motif) : motif, 'gm');
}

const PROJECT_REF = 'eayczugyrvmtqnnmvjod';
const JETON = process.env.SUPABASE_ACCESS_TOKEN;

/**
 * Couture d'ESSAI — le jeton de production ne quitte pas la CI, donc sans elle le
 * chemin HTTP partirait en production sans avoir jamais tourné une seule fois.
 * Les requêtes, elles, sont éprouvées séparément contre la vraie base. Même idiome
 * que `DRIFT_TRIES` / `DRIFT_DELAY_MS` dans check-migration-drift.mjs.
 */
const API_BASE = process.env.SUPABASE_API_URL ?? 'https://api.supabase.com';

/**
 * Mesure une prétention de BASE DE DONNÉES contre la production.
 *
 * ⛔ POURQUOI CETTE FAMILLE EST À PART. Les prétentions du §7 et des volumes ne se
 * lisent dans AUCUN fichier : « 41 jobs pg_cron », « ~173k market_listings » ne sont
 * vraies que d'un serveur. Elles périment donc sans qu'aucun diff ne bouge — le pire
 * régime pour un document, puisque même une relecture attentive du dépôt ne peut pas
 * les démentir. Mesuré le 17.08.2026 : le compte de jobs avait pris +9 depuis le
 * 29 juillet, et §8 annonçait 90k annonces pour 207 599 réelles.
 *
 * ⚠ Elles ne peuvent PAS tourner dans unit-tests.yml, qui est statique et sans secret
 * par conception (« la comparaison à la production vit dans migration-drift.yml, le
 * seul workflow qui l'interroge »). Sans jeton on les IGNORE — mais on le DIT, sinon
 * une exécution partielle se lirait comme une exécution complète.
 *
 * Même endpoint et même jeton que check-migration-drift.mjs.
 */
async function mesurerSql(sql) {
  const res = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Supabase ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const lignes = await res.json();
  if (!Array.isArray(lignes) || lignes.length !== 1) {
    throw new Error(`la requête doit rendre UNE ligne, elle en rend ${lignes?.length}`);
  }
  const valeurs = Object.values(lignes[0]);
  if (valeurs.length !== 1) throw new Error(`la requête doit rendre UNE colonne, elle en rend ${valeurs.length}`);
  return { valeur: Number(valeurs[0]) };
}

/** Applique une `mesure` du registre et rend `{ occurrences, fichiers, valeursDistinctes, present }`. */
function mesurer(mesure) {
  // — Cas 1 : présence d'un littéral dans un fichier nommé.
  if (mesure.contient) {
    return { present: source(mesure.fichier).includes(mesure.contient) };
  }

  const cibles = mesure.fichier
    ? [mesure.fichier]
    : mesure.portee.flatMap((racine) => fichiersSous(racine, mesure.ext));

  // — Cas 2 : compter les FICHIERS eux-mêmes, sans motif. `fichiers` compte ailleurs les
  // fichiers qui CONTIENNENT une occurrence ; « ~100 hooks » parle du dossier, pas d'un
  // contenu, et le forcer dans un motif universel donnerait une mesure qu'on ne saurait
  // plus relire.
  if (mesure.compterFichiers) {
    const gardes = cibles.filter((c) => !mesure.exclure?.some((frag) => c.includes(frag)));
    return { fichiers: gardes.length };
  }

  const motifs = mesure.motifs ?? [mesure.motif];

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
 * Un document, espaces normalisés. Lu une seule fois.
 *
 * Les docs sont enveloppés à ~90 colonnes : « 175 sites `zIndex`\n  portant 44 valeurs »
 * est UNE phrase coupée en deux. Comparer sans replier ferait échouer la garde
 * doc→registre sur la mise en page plutôt que sur le fond.
 */
const cacheDoc = new Map();
function docNormalise(chemin) {
  if (!cacheDoc.has(chemin)) cacheDoc.set(chemin, readFileSync(chemin, 'utf8').replace(/\s+/g, ' '));
  return cacheDoc.get(chemin);
}

/**
 * Le document d'une prétention. `DOC` par défaut — les 29 premières entrées ont été
 * écrites quand le registre n'en gardait qu'un, et les réécrire toutes pour rendre
 * explicite ce qui est déjà la règle ajouterait du bruit sans ajouter de garantie.
 */
const docDe = (claim) => claim.doc ?? DOC;

const registre = JSON.parse(readFileSync(REGISTRE, 'utf8'));

if (PROD && !JETON) {
  console.error(
    'SUPABASE_ACCESS_TOKEN manquant — `--prod` existe pour que ce cas ÉCHOUE.\n' +
      "  Les prétentions de base de données sont le seul intérêt de cet appel ; passer au vert\n" +
      '  en les ayant toutes sautées certifierait un document que personne n\'a vérifié.',
  );
  process.exit(2);
}

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

/** Prétentions de base de données non mesurées faute de jeton — comptées, jamais tues. */
const ignorees = [];
/** Requête partie en erreur : ni vert ni rouge, un TROU. Doit se voir comme un échec. */
const echecsSql = [];

for (const claim of registre.claims) {
  if (!docNormalise(docDe(claim)).includes(claim.phrase.replace(/\s+/g, ' '))) {
    perimes.push(claim);
    continue;
  }

  let reel;
  if (claim.mesure.sql) {
    if (!JETON) {
      ignorees.push(claim);
      continue;
    }
    try {
      reel = await mesurerSql(claim.mesure.sql);
    } catch (erreur) {
      echecsSql.push({ claim, message: erreur.message });
      continue;
    }
  } else {
    reel = mesurer(claim.mesure);
  }

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

// ── Cohérence : une même grandeur, un seul chiffre ─────────────────────────────────

/**
 * Deux affirmations sur LA MÊME grandeur doivent porter le même chiffre.
 *
 * ⛔ CE DÉFAUT-LÀ ÉCHAPPE À TOUT LE RESTE, et c'est pour ça qu'il fallait un
 * troisième contrôle. Relevé le 17.08.2026 : `docs/system-map.md` annonce **67**
 * edge functions à sa ligne 91 et **71** au titre de son §5 — deux chiffres, un
 * seul objet, dans le même document. Et CLAUDE.md compte **17** pages de console
 * admin là où le system-map en compte **19**, la bonne réponse.
 *
 * Ni la mesure ni la tolérance ne peuvent le voir : prise ISOLÉMENT, chaque
 * affirmation est simplement fausse à sa manière, et deux dérives séparées ne
 * disent pas qu'elles se contredisent. Or c'est l'incohérence qui coûte le plus
 * cher à un lecteur — face à deux chiffres, il ne sait pas lequel croire, et
 * choisit au hasard.
 *
 * ⚠ Contrôle DOCUMENTAIRE, pas de production : il compare les entrées entre elles,
 * jamais au réel. Il tourne donc même sans jeton, et même sur les prétentions de
 * base de données qui n'ont pas été mesurées.
 */
const parGrandeur = new Map();
for (const claim of registre.claims) {
  if (!claim.grandeur) continue;
  if (!parGrandeur.has(claim.grandeur)) parGrandeur.set(claim.grandeur, []);
  parGrandeur.get(claim.grandeur).push(claim);
}

const incoherences = [];
for (const [grandeur, groupe] of parGrandeur) {
  if (groupe.length < 2) continue;
  const cles = new Set(groupe.flatMap((c) => Object.keys(c.attendu)));
  for (const cle of cles) {
    const portant = groupe.filter((c) => cle in c.attendu);
    const valeurs = new Set(portant.map((c) => c.attendu[cle]));
    if (valeurs.size > 1) incoherences.push({ grandeur, cle, portant });
  }
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
  const docsTouches = [...new Set(derives.map(({ claim }) => docDe(claim)))];
  console.error(`\n⚠ ${derives.length} prétention(s) chiffrée(s) ont DÉRIVÉ — ${docsTouches.join(' et ')} périmé(s) :\n`);
  for (const { claim, ecarts } of derives) {
    console.error(`    ${claim.id}  (${docDe(claim)} · ${claim.section}, mesuré le ${claim.mesureLe})`);
    console.error(`      « ${claim.phrase} »`);
    for (const e of ecarts) console.error(`      → ${ligne(e)}`);
    if (claim.note) console.error(`      ↳ ${claim.note}`);
  }
  console.error(`
  Corriger le document — le chiffre ET, s'il la renverse, la conclusion qu'il portait —
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

if (incoherences.length) {
  console.error(`\n✖ ${incoherences.length} grandeur(s) affirmée(s) avec DEUX chiffres différents :\n`);
  for (const { grandeur, cle, portant } of incoherences) {
    console.error(`    « ${grandeur} » (${cle}) :`);
    for (const c of portant) {
      console.error(`      ${c.attendu[cle]}  ${docDe(c)} — ${c.section}`);
      console.error(`         « ${c.phrase} »`);
    }
  }
  console.error(`
  Un lecteur face à deux chiffres ne sait pas lequel croire, et choisit au
  hasard. Trancher, corriger les DEUX endroits, puis réaligner le registre.\n`);
}

if (echecsSql.length) {
  console.error(`\n✖ ${echecsSql.length} requête(s) de mesure en ERREUR — ni vérifiées, ni démenties :\n`);
  for (const { claim, message } of echecsSql) console.error(`    ${claim.id}\n      ${message}`);
  console.error(`
  Un trou n'est pas un succès. Corriger la requête du registre, ou le droit
  du jeton — mais ne pas retirer la prétention pour faire taire l'erreur.\n`);
}

const echec = perimes.length + regressions.length + derives.length + echecsSql.length + incoherences.length;
const docsGardes = [...new Set(registre.claims.map(docDe))];

if (!echec) {
  console.log(
    `✓ Fraîcheur : ${verts.length} prétention(s) chiffrée(s) vérifiées sur ${docsGardes.length} document(s)` +
      ` (${docsGardes.join(', ')}), aucun écart.`,
  );
} else {
  console.error(`✖ ${echec} écart(s) sur ${registre.claims.length} prétention(s) — ${verts.length} vérifiée(s).`);
}

// ⚠ TOUJOURS imprimé, vert compris. Une exécution partielle qui se tait se lit comme
// une exécution complète — c'est exactement ainsi qu'une étape « skipped » a certifié
// la porte des e-mails pendant des mois.
if (ignorees.length) {
  console.log(
    `\n⚠ ${ignorees.length} prétention(s) de BASE DE DONNÉES non mesurées : SUPABASE_ACCESS_TOKEN absent.` +
      '\n  Elles tournent dans migration-drift.yml, le seul workflow qui interroge la production.' +
      `\n  Localement : SUPABASE_ACCESS_TOKEN=… npm run lint:claude-md\n  ${ignorees.map((c) => c.id).join(', ')}\n`,
  );
}

process.exit(echec ? 1 : 0);
