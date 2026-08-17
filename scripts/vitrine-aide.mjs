#!/usr/bin/env node
/**
 * Centre d'aide de la vitrine — GÉNÉRÉ au build depuis Intercom.
 *
 * POURQUOI GÉNÉRER PLUTÔT QUE RECOPIER. Le corpus (18 articles) est écrit et
 * maintenu dans Intercom, qui reste la source unique. Le dépôt a déjà payé
 * l'alternative : `helpArticles.ts`, 1750 lignes de contenu figé, retiré le
 * 20 juillet 2026 parce qu'il racontait l'ancienne version de ce qu'Intercom
 * corrigeait. Ici rien n'est versionné — seul ce générateur entre dans le dépôt.
 *
 * POURQUOI PAS SIMPLEMENT LIER `help.megga.ch`. Le centre d'aide Intercom
 * n'accepte ni HTML ni CSS personnalisés (dit par Intercom, sans échéance) : il
 * ne peut porter que nos couleurs, jamais MEGGA X. Cette page-ci est la vitrine,
 * avec ses classes et son chrome.
 *
 * CE QU'ELLE NE REMPLACE PAS : Fin et la recherche d'Intercom vivent dans le
 * Messenger et ne s'exportent pas. Le bouton « ? » du CRM garde donc le panneau ;
 * cette page remplace `help.megga.ch`, pas le panneau.
 *
 * PLACE DANS LA CHAÎNE — ce script tourne EN DERNIER :
 *   overlay-storefront.mjs  (dist/ = la vitrine statique)
 *   → vitrine-i18n.mjs --build  (dist/de, dist/en, dist/it)
 *   → vitrine-aide.mjs  (ce fichier)
 * Il lui faut les langues DÉJÀ générées : le chrome anglais (nav, pied de page)
 * est prélevé sur `dist/en/index.html` au lieu d'être retraduit ici.
 *
 * ⚠ LA PAGE N'EST PAS DANS `PAGES` de scripts/_shared/vitrine-i18n.mjs, et ce
 * n'est pas un oubli. L'y mettre ferait passer les 18 corps d'articles dans le
 * dictionnaire de traduction : `--extract` demanderait de traduire à la main un
 * corpus qu'Intercom maintient déjà, et le compteur « occurrences laissées en
 * français » du build — l'oracle qui garde les libellés de la nav — deviendrait
 * illisible. Ce script porte donc lui-même ses deux langues.
 *
 * LANGUES : français et anglais. L'allemand et l'italien n'ont AUCUN article
 * (mesuré le 17.08.2026 : `{"en":18,"fr":18}`), donc `/de` et `/it` pointent sur
 * la version anglaise — décision de Julien. C'est le rôle de `relierLangues()`.
 *
 * ⚠ FRAÎCHEUR = DÉPLOIEMENT (décision de Julien : pas de cron). Une correction
 * faite dans Intercom n'apparaît qu'au prochain build de la vitrine.
 *
 * Le corps des articles est injecté tel quel : c'est du HTML que NOUS écrivons
 * dans notre propre espace Intercom, pas une entrée d'utilisateur.
 *
 * Usage : node scripts/vitrine-aide.mjs   (après le build ; INTERCOM_ACCESS_TOKEN requis en CI)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { creerClientIntercom, AIDE_JETON_MANQUANT } from './_shared/intercom-api.mjs';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(racine, 'dist');
const SITE = 'https://megga.ch';

/** Les deux langues servies, et où elles atterrissent. */
const SORTIES = {
  fr: { dossier: '', index: 'aide.html', prefixe: '/aide', chrome: 'index.html' },
  en: { dossier: 'en', index: 'help.html', prefixe: '/en/help', chrome: 'en/index.html' },
};

/** Chrome de la page : les quelques chaînes que ce script écrit lui-même. */
const MOTS = {
  fr: {
    titre: "Centre d'aide",
    accroche: 'Guides et réponses pour prendre MEGGA en main.',
    collections: 'Collections',
    divers: 'Autres articles',
    retour: "Retour au centre d'aide",
    articleUnique: 'article',
    articlesPluriel: 'articles',
    descriptionIndex: "Guides et réponses sur MEGGA : contacts, pipeline, KYC, WhatsApp, facturation.",
    rechercheLabel: 'Rechercher dans les articles',
    recherchePlaceholder: 'Rechercher un article…',
    rechercheAucun: 'Aucun article ne correspond.',
    rechercheUn: '1 article correspond.',
    recherchePlusieurs: '{n} articles correspondent.',
  },
  en: {
    titre: 'Help center',
    accroche: 'Guides and answers to get started with MEGGA.',
    collections: 'Collections',
    divers: 'More articles',
    retour: 'Back to the help center',
    articleUnique: 'article',
    articlesPluriel: 'articles',
    descriptionIndex: 'Guides and answers about MEGGA: contacts, pipeline, KYC, WhatsApp, billing.',
    rechercheLabel: 'Search the articles',
    recherchePlaceholder: 'Search for an article…',
    rechercheAucun: 'No article matches.',
    rechercheUn: '1 article matches.',
    recherchePlusieurs: '{n} articles match.',
  },
};

const echapper = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Corps HTML → texte nu, pour l'indexer. */
function texteBrut(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:#39|apos|rsquo|lsquo);/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisation de recherche — SOURCE UNIQUE, partagée par le build et le navigateur.
 *
 * ⚠ Le texte est normalisé à la GÉNÉRATION (dans `data-aide-texte`) et la requête
 * l'est à la FRAPPE, dans la page. Deux implémentations qui divergeraient d'un
 * accent feraient échouer la recherche en silence — « kyc » ne trouverait plus un
 * article indexé « kyc » mais comparé autrement. On écrit donc la fonction UNE
 * fois, sous forme de source : Node l'évalue pour indexer, la page la reçoit
 * telle quelle pour interroger.
 */
const SOURCE_NORMALISE =
  "(s) => String(s == null ? '' : s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()";
export const normaliserRecherche = new Function(`return ${SOURCE_NORMALISE}`)();

/**
 * Segment d'URL d'un article : `<id>-<titre-en-tirets>`, dans la langue servie.
 *
 * L'identifiant porte la stabilité — un titre corrigé ne casse alors aucun lien
 * entrant, alors qu'un slug tiré du seul titre changerait d'adresse à chaque
 * relecture éditoriale. C'est aussi la forme qu'Intercom emploie lui-même.
 *
 * ⚠ Le titre vient de la LOCALE, pas de l'article : `/en/help/…-demarrer-avec-megga`
 * annoncerait du français à Google sur la page qu'on veut justement voir indexée
 * en anglais. L'identifiant, lui, reste le même des deux côtés.
 */
export function segment(article, langue) {
  const titre = (contenuLocalise(article, langue).title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${article.id}${titre ? '-' + titre : ''}`;
}

/**
 * Rend absolus TOUS les chemins internes du chrome prélevé — ressources ET liens
 * de page.
 *
 * L'export Webflow les écrit en relatif (`images/logo.svg`, `about.html`), ce qui
 * ne tient que pour une page à la racine. Les articles vivent sous `/aide/`, où
 * `about.html` se résout en `/aide/about.html` : la nav et le pied de page
 * partiraient en 404 sur chacun des dix-huit articles, et le style avec eux.
 * ⚠ Le chrome ANGLAIS est déjà absolu (`vitrine-i18n --build` le fait pour /en/),
 * d'où une passe volontairement idempotente.
 */
function absolutiserChemins(doc) {
  for (const el of doc.querySelectorAll('[src], [href], [srcset]')) {
    for (const attr of ['src', 'href', 'srcset']) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      if (attr === 'srcset') {
        el.setAttribute(attr, v.replace(/(^|,\s*)(?!https?:|\/|data:)/g, '$1/'));
      } else if (/^(images|js|css|fonts|documents|mockups)\//.test(v)) {
        el.setAttribute(attr, '/' + v);
      } else if (el.tagName === 'A' && !/^([a-z]+:|\/\/|\/|#)/i.test(v)) {
        el.setAttribute(attr, '/' + v);
      }
    }
  }
}

/**
 * Prélève le chrome d'une page déjà construite : ressources de `<head>`, en-tête,
 * pied de page, scripts de fin. On le PRÉLÈVE au lieu de le réécrire pour qu'un
 * changement de nav (l'entrée « Aide », par exemple) suive tout seul.
 */
function prendreChrome(cheminRelatif) {
  const chemin = join(dist, cheminRelatif);
  if (!existsSync(chemin)) throw new Error(`chrome introuvable : ${cheminRelatif} (le build i18n a-t-il tourné ?)`);
  const dom = new JSDOM(readFileSync(chemin, 'utf8'));
  const doc = dom.window.document;
  absolutiserChemins(doc);

  // Du <head>, on ne garde que ce qui est commun à toutes les pages : styles,
  // icônes, préchargements. Titre, description, canonical et alternates sont
  // propres à CHAQUE page et sont réécrits plus bas.
  const tete = [...doc.head.querySelectorAll('link[rel="stylesheet"], link[rel*="icon"], script[src], meta[charset], meta[name="viewport"]')]
    .map((el) => el.outerHTML)
    .join('\n  ');

  const entete = doc.querySelector('.header')?.outerHTML;
  const pied = doc.querySelector('.footer-wrapper')?.outerHTML;
  if (!entete || !pied) throw new Error(`chrome incomplet dans ${cheminRelatif} (.header ou .footer-wrapper absent)`);

  const scripts = [...doc.body.querySelectorAll('script')].map((el) => el.outerHTML).join('\n');
  return { tete, entete, pied, scripts };
}

/** Coquille commune — même structure que les pages de la vitrine. */
function coquille({ chrome, langue, titre, description, canonical, contenu }) {
  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  ${chrome.tete}
  <title>${echapper(titre)}</title>
  <meta name="description" content="${echapper(description)}"/>
  <meta property="og:title" content="${echapper(titre)}"/>
  <meta property="og:description" content="${echapper(description)}"/>
  <meta property="og:type" content="article"/>
  <link rel="canonical" href="${SITE}${canonical}"/>
</head>
<body>
<div class="page-wrapper">
${chrome.entete}
${contenu}
${chrome.pied}
</div>
${chrome.scripts}
</body>
</html>`;
}

/** Page d'un article : titre, résumé, corps rédactionnel. */
function pageArticle({ chrome, langue, article, contenu }) {
  const m = MOTS[langue];
  const s = SORTIES[langue];
  const corps = `
<section class="section hero top-68px---bottom-0px">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center">
      <div class="mg-bottom-2x-extra-small"><a class="link-wrapper" href="${s.prefixe}">← ${echapper(m.retour)}</a></div>
      <h1 class="display-9 mg-bottom-2x-extra-small">${echapper(contenu.title)}</h1>
      <!-- ⚠ Le résumé n'est PAS repris ici. Mesuré le 17.08.2026 : les 18 corps
           ouvrent tous par leur propre <p class="lead">, donc l'afficher poserait
           deux paragraphes d'introduction l'un sur l'autre — et sur trois articles,
           deux fois presque la même phrase. Il sert là où il informe vraiment :
           la carte du sommaire, et la meta description. -->
    </div>
  </div>
</section>
<section class="section pd-top-0 pd-bottom-medium">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center">
      <div class="rich-text mg-bottom-large w-richtext">${contenu.body || ''}</div>
    </div>
  </div>
</section>`;
  return coquille({
    chrome,
    langue,
    titre: `${contenu.title} | ${m.titre} MEGGA`,
    description: contenu.description || m.descriptionIndex,
    canonical: `${s.prefixe}/${segment(article, langue)}`,
    contenu: corps,
  });
}

/** Index : les collections, puis les articles qui n'en ont pas. */
function pageIndex({ chrome, langue, groupes }) {
  const m = MOTS[langue];
  const s = SORTIES[langue];
  // `w-inline-block` + `link-heading` : l'idiome des cartes du blog. Sans lui, le
  // lien enveloppant souligne TOUT son contenu, titre et résumé compris — la
  // carte se lit alors comme un bloc de texte cliqué, pas comme une carte.
  //
  // `data-aide-texte` porte le texte CHERCHABLE de l'article — titre, résumé et
  // corps réunis, normalisés. Il vit sur la carte plutôt que dans un index à
  // part : deux structures parallèles finiraient par diverger, et le poids est le
  // même. C'est aussi ce qui permet à la recherche de porter sur le CORPS, pas
  // seulement sur les titres — sans quoi elle ne servirait presque à rien.
  const carte = (a) =>
    `<a class="card aide-carte pd---content-inside-card pd---small w-inline-block" href="${s.prefixe}/${segment(a.article, langue)}"
        data-aide-article data-aide-texte="${echapper(normaliserRecherche([a.titre, a.resume, texteBrut(contenuLocalise(a.article, langue).body)].join(' ')))}">
       <h3 class="link-heading display-3 mg-bottom-3x-extra-small">${echapper(a.titre)}</h3>
       ${a.resume ? `<p class="paragraph-small text-paragraph">${echapper(a.resume)}</p>` : ''}
     </a>`;
  const bloc = (g) =>
    `<div class="mg-bottom-large" data-aide-groupe>
       <div class="title-and-button-container align-center mg-bottom-medium">
         <h2 class="display-3">${echapper(g.nom)}</h2>
         <div class="text-color-neutral-700" data-aide-compte="${g.articles.length}">${g.articles.length} ${g.articles.length > 1 ? m.articlesPluriel : m.articleUnique}</div>
       </div>
       <div class="w-layout-grid grid-2-columns gap-48px">${g.articles.map(carte).join('\n')}</div>
     </div>`;
  const corps = `
<section class="section hero top-68px---bottom-0px">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _826px center text-center">
      <h1 class="display-9 mg-bottom-2x-extra-small">${echapper(m.titre)}</h1>
      <p class="paragraph-large mg-bottom-small">${echapper(m.accroche)}</p>
      <div class="inner-container _480px center">
        <label class="aide-recherche-label" for="aide-recherche">${echapper(m.rechercheLabel)}</label>
        <input class="input aide-recherche" id="aide-recherche" type="search" autocomplete="off"
               placeholder="${echapper(m.recherchePlaceholder)}" data-aide-champ/>
      </div>
      <p class="paragraph-small text-paragraph mg-top-2x-extra-small" data-aide-etat role="status" aria-live="polite" hidden></p>
    </div>
  </div>
</section>
<section class="section pd-150px">
  <div class="w-layout-blockcontainer container-default w-container">
    ${groupes.map(bloc).join('\n')}
  </div>
</section>`;
  return coquille({
    chrome,
    langue,
    titre: `${m.titre} MEGGA`,
    description: m.descriptionIndex,
    canonical: s.prefixe,
    contenu: corps + scriptRecherche(m),
  });
}

/**
 * Recherche côté client, sans dépendance.
 *
 * Dix-huit fiches : le filtrage tient en trente lignes, et une bibliothèque
 * coûterait plus à charger qu'à chercher. `fuse.js` a d'ailleurs traîné un mois
 * dans `dependencies` sans être importé — on ne le réinstalle pas ici.
 *
 * ⛔ La recherche RESTREINT une liste déjà rendue ; elle ne la construit pas.
 * Sans JavaScript, le sommaire complet reste lisible et tous les liens marchent —
 * c'est ce qui permet aussi aux moteurs de voir les dix-huit articles.
 *
 * Tous les termes doivent être présents (ET, pas OU) : sur un corpus aussi
 * petit, un OU rend presque toujours toute la liste et donne l'impression que
 * la recherche ne fait rien.
 */
function scriptRecherche(m) {
  return `
<script>
(function () {
  var champ = document.querySelector('[data-aide-champ]');
  var etat = document.querySelector('[data-aide-etat]');
  if (!champ) return;
  var cartes = [].slice.call(document.querySelectorAll('[data-aide-article]'));
  var groupes = [].slice.call(document.querySelectorAll('[data-aide-groupe]'));
  var normalise = ${SOURCE_NORMALISE};
  var MOTS = ${JSON.stringify({ aucun: m.rechercheAucun, un: m.rechercheUn, plusieurs: m.recherchePlusieurs, article: m.articleUnique, articles: m.articlesPluriel })};

  // Le compteur de chaque collection doit suivre le filtre : laissé au total, il
  // annonce « 4 articles » au-dessus d'une seule carte, et c'est le compteur
  // qu'on croit plutôt que ce qu'on voit.
  function poserCompte(el, n) {
    el.textContent = n + ' ' + (n > 1 ? MOTS.articles : MOTS.article);
  }

  function filtrer() {
    var termes = normalise(champ.value).split(' ').filter(Boolean);
    if (!termes.length) {
      cartes.forEach(function (c) { c.hidden = false; });
      groupes.forEach(function (g) {
        g.hidden = false;
        var compte = g.querySelector('[data-aide-compte]');
        if (compte) poserCompte(compte, Number(compte.getAttribute('data-aide-compte')));
      });
      etat.hidden = true;
      return;
    }
    var trouves = 0;
    cartes.forEach(function (c) {
      var texte = c.getAttribute('data-aide-texte') || '';
      var ok = termes.every(function (t) { return texte.indexOf(t) !== -1; });
      c.hidden = !ok;
      if (ok) trouves++;
    });
    groupes.forEach(function (g) {
      var visibles = g.querySelectorAll('[data-aide-article]:not([hidden])').length;
      g.hidden = visibles === 0;
      var compte = g.querySelector('[data-aide-compte]');
      if (compte) poserCompte(compte, visibles);
    });
    etat.hidden = false;
    etat.textContent = trouves === 0 ? MOTS.aucun
      : trouves === 1 ? MOTS.un
      : MOTS.plusieurs.replace('{n}', trouves);
  }

  champ.addEventListener('input', filtrer);
  champ.addEventListener('keydown', function (e) {
    // Échap vide le champ : le raccourci attendu d'un champ de recherche, que
    // Safari ne câble pas tout seul sur un input hors formulaire.
    if (e.key === 'Escape') { champ.value = ''; filtrer(); }
  });
  filtrer();
})();
</script>`;
}

/** Contenu d'un article dans une langue, via `translated_content`. */
export function contenuLocalise(article, langue) {
  const tc = article.translated_content || {};
  const loc = tc[langue];
  if (loc && (loc.body || '').trim()) return { title: loc.title || article.title, description: loc.description || '', body: loc.body };
  // Repli sur la locale par défaut de l'article — mieux qu'une page vide.
  return { title: article.title, description: article.description || '', body: article.body || '' };
}

/** Groupe les articles par collection ; ceux qui n'en ont pas forment le dernier bloc. */
export function grouper(articles, collections, langue) {
  const m = MOTS[langue];
  const nomCollection = (c) => c?.translated_content?.[langue]?.name || c?.name || '';
  const parId = new Map(collections.map((c) => [String(c.id), c]));
  const groupes = [];
  const orphelins = [];

  for (const c of collections) {
    const dedans = articles.filter((a) => String(a.parent_id ?? '') === String(c.id));
    if (dedans.length) {
      groupes.push({
        nom: nomCollection(c),
        articles: dedans.map((a) => {
          const co = contenuLocalise(a, langue);
          return { article: a, titre: co.title, resume: co.description };
        }),
      });
    }
  }
  for (const a of articles) {
    if (!parId.has(String(a.parent_id ?? ''))) {
      const co = contenuLocalise(a, langue);
      orphelins.push({ article: a, titre: co.title, resume: co.description });
    }
  }
  if (orphelins.length) groupes.push({ nom: m.divers, articles: orphelins });
  return groupes;
}

/** Liste récursive des .html d'un dossier. */
function htmls(racineDossier, acc = []) {
  if (!existsSync(racineDossier)) return acc;
  for (const nom of readdirSync(racineDossier)) {
    const chemin = join(racineDossier, nom);
    if (statSync(chemin).isDirectory()) htmls(chemin, acc);
    else if (nom.endsWith('.html')) acc.push(chemin);
  }
  return acc;
}

/**
 * L'allemand et l'italien n'ont pas d'articles : leur entrée « Aide » doit mener
 * à la version anglaise, pas à la française.
 *
 * ⚠ Pourquoi ici et pas dans `localiserHref` : la page n'est pas dans `PAGES`,
 * donc `urlLocalisee` rend le chemin français tel quel dans toutes les langues.
 * Plutôt que d'inscrire une exception dans le socle i18n — qui vaudrait pour
 * toute page hors palier 1 — on corrige les liens de CETTE page, ici, où la
 * décision « /de et /it servent l'anglais » est écrite et lisible.
 */
function relierLangues() {
  let touches = 0;
  for (const langue of ['de', 'en', 'it']) {
    for (const fichier of htmls(join(dist, langue))) {
      const avant = readFileSync(fichier, 'utf8');
      const apres = avant.replace(/href="\/aide"/g, 'href="/en/help"');
      if (apres !== avant) {
        writeFileSync(fichier, apres);
        touches++;
      }
    }
  }
  return touches;
}

async function generer() {
  if (!existsSync(dist)) {
    console.error('[aide] pas de dist/ — lancer après le build');
    process.exit(1);
  }

  // ⛔ Le jeton n'existe qu'en CI (secret GitHub). Un `npm run build` local ne
  // l'a pas — et sans traitement explicite, ce script écrirait un centre d'aide
  // VIDE que la chaîne publierait sans broncher. On distingue donc les deux :
  // en CI c'est une panne de déploiement, en local c'est une page d'attente.
  let client;
  try {
    client = creerClientIntercom();
  } catch {
    if (process.env.CI) {
      console.error(`✗ [aide] ${AIDE_JETON_MANQUANT}\n` + "  En CI, un centre d'aide vide ne doit pas partir en production.");
      process.exit(1);
    }
    ecrirePagesDAttente();
    return;
  }

  const collections = await client.listAll('/help_center/collections');
  const liste = await client.listAll('/articles');
  const publies = liste.filter((a) => a.state === 'published');
  // Le corps entier n'est PAS dans la liste : il faut un GET par article.
  const articles = [];
  for (const a of publies) articles.push(await client.api(`/articles/${a.id}`));

  if (!articles.length) {
    console.error("✗ [aide] l'API n'a rendu aucun article publié — refus d'écrire un centre d'aide vide.");
    process.exit(1);
  }

  for (const [langue, s] of Object.entries(SORTIES)) {
    const chrome = prendreChrome(s.chrome);
    const base = s.dossier ? join(dist, s.dossier) : dist;
    const dossierArticles = join(base, s.index.replace(/\.html$/, ''));
    mkdirSync(dossierArticles, { recursive: true });

    writeFileSync(join(base, s.index), pageIndex({ chrome, langue, groupes: grouper(articles, collections, langue) }));
    for (const a of articles) {
      writeFileSync(join(dossierArticles, `${segment(a, langue)}.html`), pageArticle({ chrome, langue, article: a, contenu: contenuLocalise(a, langue) }));
    }
    console.log(`[aide] ${langue}: 1 index + ${articles.length} articles → ${s.prefixe}`);
  }

  const relies = relierLangues();
  console.log(`[aide] ${relies} page(s) de/en/it pointées sur /en/help (de et it n'ont pas de corpus)`);
}

/**
 * Sans jeton, hors CI : une page qui DIT pourquoi elle est vide.
 * Mieux qu'un 404 sur un lien que la nav porte dans 31 fichiers, et impossible à
 * confondre avec le vrai centre d'aide.
 */
function ecrirePagesDAttente() {
  console.warn(
    "⚠ [aide] INTERCOM_ACCESS_TOKEN absent — centre d'aide NON généré.\n" +
      "  Build local : une page d'attente est écrite à sa place, qui renvoie vers Intercom.\n" +
      '  Pour générer réellement : INTERCOM_ACCESS_TOKEN=... npm run build',
  );
  for (const [langue, s] of Object.entries(SORTIES)) {
    let chrome;
    try {
      chrome = prendreChrome(s.chrome);
    } catch {
      continue; // langue non générée (dictionnaire vide) : rien à habiller
    }
    const m = MOTS[langue];
    const attente =
      langue === 'fr'
        ? "Cette page est générée au déploiement, depuis le centre d'aide. En attendant, les articles sont ici :"
        : 'This page is generated at deploy time from the help center. In the meantime, the articles are here:';
    const base = s.dossier ? join(dist, s.dossier) : dist;
    mkdirSync(base, { recursive: true });
    writeFileSync(
      join(base, s.index),
      coquille({
        chrome,
        langue,
        titre: `${m.titre} MEGGA`,
        description: m.descriptionIndex,
        canonical: s.prefixe,
        contenu: `
<section class="section hero top-68px---bottom-0px">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center text-center">
      <h1 class="display-9 mg-bottom-2x-extra-small">${echapper(m.titre)}</h1>
      <p class="paragraph-large">${echapper(attente)}</p>
      <a class="primary-button w-inline-block" href="https://intercom.help/megga/fr"><div class="link-content-flex"><div>intercom.help/megga</div></div></a>
    </div>
  </div>
</section>`,
      }),
    );
  }
  relierLangues();
}

// Importable sans effet de bord : la garde `tests/unit/vitrine-aide.spec.ts`
// éprouve `segment`, `grouper` et `contenuLocalise` sur une charge utile de
// fixture. Sans ce test, un module importé lancerait une génération complète.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generer();
}
