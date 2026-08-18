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
    rechercheAller: 'Voir',
    ctaTitre: 'Une question qui reste ?',
    ctaBouton: 'Nous contacter',
    filAriane: "Centre d'aide",
    aLireAussi: 'À lire aussi',
    surCettePage: 'Sur cette page',
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
    rechercheAller: 'Go',
    ctaTitre: 'Still stuck?',
    ctaBouton: 'Contact us',
    filAriane: 'Help center',
    aLireAussi: 'Read next',
    surCettePage: 'On this page',
  },
};

/**
 * Ce build a-t-il le DROIT de dégrader au lieu de casser ?
 *
 * ⛔ La règle n'est pas « suis-je en CI » mais « ce que je fabrique peut-il
 * atteindre la production ». Trois constructeurs bâtissent cette vitrine :
 *
 *   1. GitHub Actions → `wrangler pages deploy dist` : c'est la production.
 *   2. Cloudflare Pages sur la branche de production : c'en est une aussi.
 *   3. Cloudflare Pages sur toute autre branche : une PRÉVISUALISATION de PR,
 *      que personne ne sert au public.
 *
 * Les deux premiers doivent ÉCHOUER si le corpus est hors d'atteinte — un
 * centre d'aide vide publié est pire qu'un déploiement qui s'arrête. Le
 * troisième n'a rien à protéger : le casser ne fait que peindre en rouge une
 * PR dont le code est sain, et ce rouge-là finit par ne plus rien vouloir dire.
 *
 * ⚠ Un build de prévisualisation dégradé porte la page d'attente, qui DIT
 * qu'elle est une page d'attente. Elle ne peut pas se faire passer pour le vrai
 * centre d'aide auprès de quelqu'un qui relit la PR.
 *
 * `CF_PAGES` et `CF_PAGES_BRANCH` sont posés par Cloudflare Pages lui-même.
 */
const BRANCHE_DE_PRODUCTION = 'main';

/**
 * Vrai quand l'artefact peut atteindre le public : l'échec doit alors être bruyant.
 * Exportée pour être ÉPROUVÉE — une règle de ce genre se relit bien et se casse
 * en silence, et son défaut ne se verrait qu'au déploiement suivant.
 */
export function doitEchouerSur(env = process.env) {
  const previsualisation = env.CF_PAGES === '1' && (env.CF_PAGES_BRANCH || '') !== BRANCHE_DE_PRODUCTION;
  return Boolean(env.CI) && !previsualisation;
}

const doitEchouer = doitEchouerSur(process.env);

const echapper = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Vignette et halo d'une collection.
 *
 * ⚠ PAS la police d'icônes de la vitrine : `.icon-font-rounded` y est déclarée
 * mais compte ZÉRO emploi (mesuré le 18.08.2026), donc sa table de glyphes est
 * inconnue — on ne peut pas deviner quel caractère donne quelle forme. Les pages
 * d'intégration, elles, emploient des IMAGES. On reste sur du SVG en ligne :
 * quatre tracés, aucun fichier à servir, aucune police à déchiffrer.
 *
 * Les teintes viennent des trois primaires du dépôt (`--primary-colors--100/200/300`) ;
 * la quatrième est le violet du dégradé MEGGA X, qui n'a pas de variable.
 */
const COLLECTIONS_DECOR = {
  19659047: { teinte: '#424bfb', tracé: '<path d="M5 19l3-8 8-3-3 8-8 3Z"/><path d="M12 3v3M19 12h3M12 19v3M3 12h3"/>' }, // Démarrer
  19659048: { teinte: '#1abcfe', tracé: '<path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5V5.5Z"/><path d="M8 7h7M8 11h7"/>' }, // Général
  19659046: { teinte: '#00d95f', tracé: '<path d="M9 3v6M15 3v6"/><path d="M6 9h12v3a6 6 0 01-12 0V9Z"/><path d="M12 18v3"/>' }, // Intégrations
  19659049: { teinte: '#c413ff', tracé: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>' }, // Facturation
};
const DECOR_PAR_DEFAUT = { teinte: '#8dc1ff', tracé: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/>' };

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
 * Ancre d'un titre : `#comment-fonctionne-le-matching`.
 *
 * ⚠ Les corps venus d'Intercom n'ont AUCUN `id` sur leurs titres — l'éditeur
 * n'en pose pas. Sans ancre, un sommaire ne peut mener nulle part ; c'est le
 * seul endroit où ce générateur touche au corps d'un article, et il n'y ajoute
 * qu'un attribut.
 */
function ancre(texte) {
  return (
    'a-' +
    String(texte ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  );
}

/**
 * Découpe un corps en (corps ancré, sommaire).
 *
 * Le sommaire se construit sur les `<h2>` seuls : ce sont les sections que
 * l'auteur a voulues. Mesuré le 18.08.2026 sur les 18 articles — entre 4 et 8
 * titres, médiane 6. C'est trop pour lire d'une traite quand on cherche un point
 * précis, et c'est ce que le billet de blog n'a pas besoin d'avoir.
 *
 * ⚠ Deux titres homonymes dans un même article donneraient deux ancres
 * identiques, et le second serait inatteignable : on suffixe alors.
 */
function sommaireEtCorps(html) {
  const vus = new Map();
  const sommaire = [];
  const corps = String(html ?? '').replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (tout, attrs, dedans) => {
    const texte = dedans.replace(/<[^>]+>/g, '').trim();
    if (!texte) return tout;
    let id = ancre(texte);
    const n = (vus.get(id) ?? 0) + 1;
    vus.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    sommaire.push({ id, texte });
    return `<h2 id="${id}"${attrs ?? ''}>${dedans}</h2>`;
  });
  return { corps, sommaire };
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

/**
 * Page d'un article : fil d'Ariane, titre, corps, puis « à lire aussi ».
 *
 * ⚠ LE FIL D'ARIANE EST LE SEUL ÉLÉMENT NEUF DE TOUTE LA PAGE. Aucune classe de
 * la vitrine ne le porte — relevé sur ses 455 classes le 18.08.2026. Il est écrit
 * ici avec les classes existantes (`display-2`, `text-color-neutral-700`), parce
 * qu'une page atteinte depuis un moteur n'avait sinon AUCUN indice de l'endroit
 * où elle se trouve : un lien « retour » dit d'où l'on vient, pas où l'on est.
 */
function pageArticle({ chrome, langue, article, contenu, collection, voisins = [] }) {
  const m = MOTS[langue];
  const s = SORTIES[langue];
  const { corps: corpsAncre, sommaire } = sommaireEtCorps(contenu.body);
  const ariane = `<nav class="display-2 text-color-neutral-700 mg-bottom-2x-extra-small" aria-label="${echapper(m.filAriane)}">
      <a href="${s.prefixe}">${echapper(m.filAriane)}</a>
      ${collection ? ` &rsaquo; <a href="${s.prefixe}#c-${echapper(collection.id)}">${echapper(collection.nom)}</a>` : ''}
    </nav>`;

  // « À lire aussi » reprend l'idiome des billets de blog : un intertitre et une
  // grille de cartes. En bande claire, donc `card-light-mode` et encre foncée.
  const aussi = voisins.length
    ? `
<section class="section light-mode-section">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="title-and-button-container align-center mg-bottom-medium">
      <h2 class="display-3 text-color-neutral-100">${echapper(m.aLireAussi)}</h2>
    </div>
    <div class="w-layout-grid grid-3-columns gap-32px">
      ${voisins
        .map(
          (v) => `<a class="card card-light-mode aide-carte pd---content-inside-card pd---small w-inline-block" href="${s.prefixe}/${segment(v, langue)}">
             <h3 class="link-heading display-4 text-color-neutral-100">${echapper(contenuLocalise(v, langue).title)}</h3>
           </a>`,
        )
        .join('\n')}
    </div>
  </div>
</section>`
    : '';

  const corps = `
<section class="section hero top-68px---bottom-0px">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center">
      ${ariane}
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
    <div class="w-layout-grid grid-2-columns _1-78fr-right---center-content _1-col-tablet aide-article-grille">
      ${sommaire.length
        ? `<nav class="aide-sommaire" aria-label="${echapper(m.surCettePage)}">
             <div class="display-2 text-color-neutral-700 mg-bottom-3x-extra-small">${echapper(m.surCettePage)}</div>
             <ul class="w-list-unstyled aide-sommaire-liste">
               ${sommaire.map((t) => `<li><a href="#${t.id}">${echapper(t.texte)}</a></li>`).join('\n')}
             </ul>
           </nav>`
        : '<div></div>'}
      <div class="rich-text mg-bottom-large w-richtext">${corpsAncre || ''}</div>
    </div>
  </div>
</section>${aussi}
<section class="section pd-medium">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center text-center">
      <h2 class="display-5 mg-bottom-small">${echapper(m.ctaTitre)}</h2>
      <a class="primary-button w-inline-block" href="/contact"><div class="link-content-flex"><div>${echapper(m.ctaBouton)}</div></div></a>
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
  // Le sommaire en cartes est de la NAVIGATION, pas un résultat : le laisser
  // pendant une recherche afficherait quatre collections qui ne reflètent pas
  // le filtre, et dont les compteurs mentiraient.
  var sommaire = document.querySelector('[data-aide-sommaire]');
  var aller = document.querySelector('[data-aide-aller]');
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
      if (sommaire) sommaire.hidden = false;
      return;
    }
    if (sommaire) sommaire.hidden = true;
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

  // Le bouton du champ mène au premier résultat — utile sur mobile, où la liste
  // est loin sous le pli. Sans JavaScript il est inerte, comme le champ.
  if (aller) {
    aller.addEventListener('click', function () {
      var premiere = document.querySelector('[data-aide-article]:not([hidden])');
      if (premiere) premiere.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
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

/**
 * Index : un sommaire visuel en cartes, puis les articles en bande claire.
 *
 * COMPOSÉ AVEC LES CLASSES DE LA VITRINE, pas avec des composants neufs :
 *  · `icon-card` + son halo et son liseré dégradé — l'idiome des pages
 *    d'intégration, le seul du dépôt qui donne une carte à vignette ;
 *  · `input` dans `button-inside-input-wrapper` — le champ maison, présent sur
 *    14 pages, où le bouton se pose DANS le champ ;
 *  · `light-mode-section` pour la zone des articles ;
 *  · `badge` pour les compteurs, `grid-3-columns` pour les fiches.
 *
 * ⛔ NE PAS DÉPLACER LA RECHERCHE DANS LA BANDE CLAIRE. `.input.light-mode` pose
 * le fond ET la bordure sur `--neutral-colors--900` (#f9f9f9), c'est-à-dire la
 * couleur même de la section : le champ y devient invisible. C'est ce qui décide
 * que le hero reste sombre et que la bande claire ne commence qu'après.
 *
 * ⚠ EN BANDE CLAIRE, RIEN NE CASCADE — et c'est plus vicieux qu'il n'y paraît.
 * La section pose son fond et une encre, mais `card-light-mode` repeint la carte
 * en BLANC par-dessus, sans toucher au texte. Mesuré en construisant : le résumé
 * des fiches rendait `rgb(255,255,255)` sur `rgb(255,255,255)` — invisible, et
 * parfaitement invisible aussi dans le balisage, qui avait l'air juste.
 * Chaque encre posée sur une carte claire doit donc être NOMMÉE :
 * `text-color-neutral-100` pour les titres (19,9:1), `-500` pour le texte
 * secondaire (5,57:1 sur blanc). Ne jamais laisser hériter.
 */
function pageIndex({ chrome, langue, groupes }) {
  const m = MOTS[langue];
  const s = SORTIES[langue];

  /** Carte de collection : vignette, halo teinté, liseré dégradé, compteur. */
  const carteCollection = (g) => {
    const d = COLLECTIONS_DECOR[g.id] ?? DECOR_PAR_DEFAUT;
    return `<a class="card aide-collection pd---content-inside-card pd---small w-inline-block" href="#c-${echapper(g.id)}">
        <div class="icon-card-wrapper">
          <div class="icon-card">
            <div class="position-relative---z-index-1 aide-collection-vignette">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.tracé}</svg>
              <div style="background-color:${d.teinte}" class="icon-card---bg-blur"></div>
            </div>
          </div>
          <div class="icon-card-border-gradient"></div>
        </div>
        <div class="mg-top-3x-extra-small">
          <div class="display-3 aide-collection-nom">${echapper(g.nom)}</div>
          <div class="badge mg-top-4x-extra-small">${g.articles.length} ${g.articles.length > 1 ? m.articlesPluriel : m.articleUnique}</div>
        </div>
      </a>`;
  };

  // `w-inline-block` + `link-heading` : l'idiome des cartes du blog. Sans lui, le
  // lien enveloppant souligne TOUT son contenu, titre et résumé compris.
  //
  // `data-aide-texte` porte le texte CHERCHABLE — titre, résumé et corps réunis,
  // normalisés. Il vit sur la carte plutôt que dans un index à part : deux
  // structures parallèles finiraient par diverger, et le poids est le même.
  const carte = (a) =>
    `<a class="card card-light-mode aide-carte pd---content-inside-card pd---small w-inline-block" href="${s.prefixe}/${segment(a.article, langue)}"
        data-aide-article data-aide-texte="${echapper(normaliserRecherche([a.titre, a.resume, texteBrut(contenuLocalise(a.article, langue).body)].join(' ')))}">
       <h3 class="link-heading display-4 text-color-neutral-100 mg-bottom-3x-extra-small">${echapper(a.titre)}</h3>
       ${a.resume ? `<p class="paragraph-small text-color-neutral-500">${echapper(a.resume)}</p>` : ''}
     </a>`;

  const bloc = (g) =>
    `<div class="mg-bottom-large aide-groupe" data-aide-groupe id="c-${echapper(g.id)}">
       <div class="title-and-button-container align-center mg-bottom-medium">
         <h2 class="display-3 text-color-neutral-100">${echapper(g.nom)}</h2>
         <div class="badge" data-aide-compte="${g.articles.length}">${g.articles.length} ${g.articles.length > 1 ? m.articlesPluriel : m.articleUnique}</div>
       </div>
       <div class="w-layout-grid grid-3-columns gap-32px">${g.articles.map(carte).join('\n')}</div>
     </div>`;

  const corps = `
<section class="section hero top-68px---bottom-0px">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _826px center text-center">
      <h1 class="display-9 mg-bottom-2x-extra-small">${echapper(m.titre)}</h1>
      <p class="paragraph-large mg-bottom-small">${echapper(m.accroche)}</p>
      <div class="inner-container _480px center">
        <label class="aide-recherche-label" for="aide-recherche">${echapper(m.rechercheLabel)}</label>
        <div class="position-relative---z-index-1">
          <input class="input aide-recherche" id="aide-recherche" type="search" autocomplete="off"
                 placeholder="${echapper(m.recherchePlaceholder)}" data-aide-champ/>
          <div class="button-inside-input-wrapper">
            <button class="primary-button inside-input w-button" type="button" data-aide-aller>${echapper(m.rechercheAller)}</button>
          </div>
        </div>
      </div>
      <p class="paragraph-small mg-top-2x-extra-small" data-aide-etat role="status" aria-live="polite" hidden></p>
    </div>
  </div>
</section>
<section class="section pd-top-medium pd-bottom-medium" data-aide-sommaire>
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="w-layout-grid grid-4-columns aide-collections">${groupes.map(carteCollection).join('\n')}</div>
  </div>
</section>
<section class="section light-mode-section">
  <div class="w-layout-blockcontainer container-default w-container">
    ${groupes.map(bloc).join('\n')}
  </div>
</section>
<section class="section pd-medium">
  <div class="w-layout-blockcontainer container-default w-container">
    <div class="inner-container _690px center text-center">
      <h2 class="display-5 mg-bottom-small">${echapper(m.ctaTitre)}</h2>
      <a class="primary-button w-inline-block" href="/contact"><div class="link-content-flex"><div>${echapper(m.ctaBouton)}</div></div></a>
    </div>
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
        id: String(c.id),
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
  if (orphelins.length) groupes.push({ id: 'divers', nom: m.divers, articles: orphelins });
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
    if (doitEchouer) {
      console.error(`✗ [aide] ${AIDE_JETON_MANQUANT}\n` + "  Ce build peut atteindre la production : un centre d'aide vide n'en partira pas.");
      process.exit(1);
    }
    ecrirePagesDAttente();
    return;
  }

  // ⛔ L'ERREUR BRUTE NE SUFFIT PAS ICI. Ce script tourne dans des builds dont
  // on ne lit pas toujours le journal soi-même — Cloudflare Pages ne transmet à
  // GitHub qu'un « Build failed » sans texte. Une pile d'appels sur un rejet
  // non traité oblige alors à ouvrir un tableau de bord pour apprendre qu'il
  // manquait un scope. Le message porte donc son propre diagnostic.
  let collections;
  let liste;
  try {
    collections = await client.listAll('/help_center/collections');
    liste = await client.listAll('/articles');
  } catch (err) {
    const msg = String(err?.message ?? err);
    const code = msg.match(/HTTP (\d{3})/)?.[1];
    const quoi =
      code === '401'
        ? "jeton REFUSÉ par Intercom (401). Il est présent mais invalide : mal recopié, ou l'app qui le porte n'est pas installée sur l'espace de travail."
        : code === '403'
          ? "jeton VALIDE mais scope insuffisant (403). Il lui faut « Read content data »."
          : code === '429'
            ? 'Intercom limite le débit (429). Relancer le build.'
            : `appel à l'API en échec — ${msg}`;
    console.error(`✗ [aide] ${quoi}`);
    console.error(`  Où : la variable INTERCOM_ACCESS_TOKEN de CE build (GitHub Actions, ou Cloudflare Pages → Variables and Secrets, Production ET Preview).`);
    console.error(`  Éprouver le jeton sans dépenser un build :`);
    console.error(`    curl -s -o /dev/null -w '%{http_code}\\n' -H "Authorization: Bearer <jeton>" -H "Intercom-Version: 2.11" "https://api.intercom.io/articles?per_page=1"`);
    // Même règle que pour le jeton absent : seul un build qui peut atteindre le
    // public casse. Une prévisualisation dégrade — le diagnostic ci-dessus reste
    // dans son journal, mais la PR ne rougit pas pour un secret d'infrastructure.
    if (doitEchouer) process.exit(1);
    ecrirePagesDAttente();
    return;
  }

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

    const groupes = grouper(articles, collections, langue);
    writeFileSync(join(base, s.index), pageIndex({ chrome, langue, groupes }));

    // Le fil d'Ariane et « à lire aussi » se lisent dans le GROUPE de l'article :
    // c'est la même source que le sommaire, donc les deux ne peuvent pas diverger.
    for (const a of articles) {
      const g = groupes.find((x) => x.articles.some((y) => y.article.id === a.id));
      const voisins = (g?.articles ?? [])
        .map((x) => x.article)
        .filter((x) => x.id !== a.id)
        .slice(0, 3);
      writeFileSync(
        join(dossierArticles, `${segment(a, langue)}.html`),
        pageArticle({ chrome, langue, article: a, contenu: contenuLocalise(a, langue), collection: g, voisins }),
      );
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
