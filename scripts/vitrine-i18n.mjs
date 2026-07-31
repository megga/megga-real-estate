#!/usr/bin/env node
/**
 * Vitrine multilingue : extraction des chaînes, puis génération des langues.
 *
 *   node scripts/vitrine-i18n.mjs --extract     met à jour i18n/<langue>.json
 *   node scripts/vitrine-i18n.mjs --build       écrit dist/<langue>/*.html
 *
 * `--extract` relève les chaînes françaises des pages du palier 1 et complète
 * chaque dictionnaire : les nouvelles arrivent avec une valeur vide, les
 * traductions déjà écrites sont conservées, et celles dont la source a disparu
 * sont retirées. Une chaîne vide signale simplement « pas encore traduit » —
 * la génération laissera le français plutôt que d'inventer.
 *
 * `--build` tourne APRÈS la recopie de la vitrine dans dist/ (postbuild) et
 * produit un dossier par langue : textes remplacés, liens internes préfixés
 * quand la cible existe dans cette langue, `lang`, canonical et alternates
 * hreflang réécrits.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { PAGES_TRADUITES, LANGUES, parcourirTextes, urlLocalisee, fichierLocalise, pageExiste } from './_shared/vitrine-i18n.mjs';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(racine, 'sites/megga-vitrine');
const dossierI18n = resolve(source, 'i18n');
const dist = resolve(racine, 'dist');
const SITE = 'https://megga.ch';

function lireDictionnaire(langue) {
  const f = join(dossierI18n, `${langue}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}

/** Clé insensible aux espaces insécables et aux apostrophes typographiques. */
function normaliser(s) {
  return s.replace(/ /g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Cherche la traduction d'une chaîne.
 *
 * La copy mélange espaces insécables (« Valable 1 h. ») et apostrophes droites
 * ou courbes selon les pages. Exiger une correspondance au caractère près
 * laissait passer des phrases en français dans une page allemande, sans rien
 * signaler : on retombe donc sur une comparaison normalisée.
 */
function traduire(dico, index, cle) {
  return dico[cle] || index.get(normaliser(cle)) || '';
}

function extraire() {
  const chaines = new Map(); // chaîne → pages où elle apparaît
  for (const page of PAGES_TRADUITES) {
    const chemin = join(source, page);
    if (!existsSync(chemin)) { console.warn(`[i18n] page absente, ignorée : ${page}`); continue; }
    const dom = new JSDOM(readFileSync(chemin, 'utf8'));
    parcourirTextes(dom.window.document, ({ valeur }) => {
      const cle = valeur.trim();
      if (!chaines.has(cle)) chaines.set(cle, []);
      if (!chaines.get(cle).includes(page)) chaines.get(cle).push(page);
    });
  }

  mkdirSync(dossierI18n, { recursive: true });
  for (const langue of LANGUES) {
    const ancien = lireDictionnaire(langue);
    const neuf = {};
    let nouvelles = 0;
    for (const cle of [...chaines.keys()].sort((a, b) => a.localeCompare(b, 'fr'))) {
      neuf[cle] = ancien[cle] ?? '';
      if (!ancien[cle]) nouvelles++;
    }
    const retirees = Object.keys(ancien).filter((k) => !(k in neuf)).length;
    writeFileSync(join(dossierI18n, `${langue}.json`), JSON.stringify(neuf, null, 2) + '\n');
    console.log(`[i18n] ${langue}: ${Object.keys(neuf).length} chaînes (${nouvelles} à traduire, ${retirees} périmées retirées)`);
  }
  console.log(`[i18n] ${chaines.size} chaînes uniques sur ${PAGES_TRADUITES.length} pages`);
}

/**
 * Réécrit un href interne vers sa version dans la langue.
 *
 * Émet la forme CANONIQUE, sans `.html` : Cloudflare Pages redirige `/preise.html`
 * en 308 vers `/preise`, et faire naviguer tout le site à travers des redirections
 * coûte un aller-retour par clic. Les pages hors palier 1 (blog, légales) gardent
 * leur chemin français : mieux vaut la bonne page dans l'autre langue qu'un 404.
 */
function localiserHref(href, langue) {
  if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href) || href.startsWith('//')) return href;
  const [chemin, ...reste] = href.split(/(?=[#?])/);
  const suffixe = reste.join('');
  if (chemin === '') return href;
  const absolu = chemin.startsWith('/') ? chemin : '/' + chemin;
  if (absolu.startsWith('/blog-posts/')) return absolu.replace(/\.html$/, '') + suffixe;
  return urlLocalisee(absolu, langue) + suffixe;
}

/**
 * Canonical + alternates hreflang d'une page, dans une langue.
 *
 * ⚠ Google n'honore les annotations que si elles sont RÉCIPROQUES : si la page
 * allemande désigne la française comme alternative, la française doit désigner
 * l'allemande en retour. Sans ça il les ignore TOUTES, et le multilingue devient
 * invisible — c'est pourquoi cette fonction tourne aussi sur les pages FR.
 * `x-default` va au français : c'est la langue servie quand aucune ne correspond.
 */
function poserAlternates(doc, page, langue) {
  const canonical = doc.querySelector('link[rel="canonical"]');
  const url = SITE + urlLocalisee('/' + page, langue);
  if (canonical) canonical.setAttribute('href', url);

  for (const vieux of doc.querySelectorAll('link[rel="alternate"][hreflang]')) vieux.remove();
  const tete = doc.querySelector('head');
  for (const code of ['fr', ...LANGUES, 'x-default']) {
    const cible = code === 'x-default' ? 'fr' : code;
    if (!pageExiste('/' + page, cible)) continue;
    const l = doc.createElement('link');
    l.setAttribute('rel', 'alternate');
    l.setAttribute('hreflang', code);
    l.setAttribute('href', SITE + urlLocalisee('/' + page, cible));
    tete.appendChild(l);
  }
}

function construire() {
  if (!existsSync(dist)) { console.error('[i18n] pas de dist/ — lancer après le build'); process.exit(0); }

  // Le français en premier : il doit déclarer ses alternates comme les autres.
  let fr = 0;
  for (const page of PAGES_TRADUITES) {
    const chemin = join(dist, page);
    if (!existsSync(chemin)) continue;
    const dom = new JSDOM(readFileSync(chemin, 'utf8'));
    poserAlternates(dom.window.document, page, 'fr');
    writeFileSync(chemin, dom.serialize());
    fr++;
  }
  console.log(`[i18n] fr: ${fr} pages annotées (canonical + alternates)`);

  for (const langue of LANGUES) {
    const dico = lireDictionnaire(langue);
    const index = new Map(Object.entries(dico).filter(([, v]) => v).map(([k, v]) => [normaliser(k), v]));
    const traduites = Object.values(dico).filter(Boolean).length;
    if (!traduites) { console.log(`[i18n] ${langue}: dictionnaire vide, langue non générée`); continue; }

    const sortie = join(dist, langue);
    mkdirSync(sortie, { recursive: true });
    let manquantes = 0;

    for (const page of PAGES_TRADUITES) {
      const chemin = join(dist, page);
      if (!existsSync(chemin)) continue;
      const dom = new JSDOM(readFileSync(chemin, 'utf8'));
      const doc = dom.window.document;

      parcourirTextes(doc, (item) => {
        const cle = item.valeur.trim();
        const trad = traduire(dico, index, cle);
        if (!trad) { manquantes++; return; } // vide → on garde le français
        if (item.type === 'texte') {
          item.noeud.nodeValue = item.noeud.nodeValue.replace(cle, trad);
        } else {
          item.element.setAttribute(item.attribut, item.valeur.replace(cle, trad));
        }
      });

      // Les ressources d'abord : l'export Webflow les référence en RELATIF
      // (`images/logo.svg`, `js/vendor.js`). Servies depuis /de/, elles se
      // résolvent en `/de/images/…` et n'existent pas — la page arrive alors
      // sans style ni logo, ce que la traduction seule ne laisse pas voir.
      for (const el of doc.querySelectorAll('[src], [href], [srcset]')) {
        for (const attr of ['src', 'href', 'srcset']) {
          const v = el.getAttribute(attr);
          if (!v) continue;
          if (attr === 'srcset') {
            el.setAttribute(attr, v.replace(/(^|,\s*)(?!https?:|\/|data:)/g, '$1/'));
          } else if (/^(images|js|css|fonts|documents|mockups)\//.test(v)) {
            el.setAttribute(attr, '/' + v);
          }
        }
      }

      for (const a of doc.querySelectorAll('a[href]')) {
        a.setAttribute('href', localiserHref(a.getAttribute('href'), langue));
      }

      doc.documentElement.setAttribute('lang', langue);

      // Le JSON-LD porte sa propre déclaration de langue : laissée à "fr", une
      // page allemande annonçait aux moteurs un contenu français.
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        script.textContent = script.textContent.replace(/"inLanguage"\s*:\s*"[a-z-]+"/gi, `"inLanguage":"${langue}"`);
      }

      poserAlternates(doc, page, langue);
      writeFileSync(join(sortie, fichierLocalise(page, langue)), dom.serialize());
    }
    console.log(`[i18n] ${langue}: ${PAGES_TRADUITES.length} pages générées` + (manquantes ? ` (${manquantes} occurrences laissées en français — noms propres et marques)` : ''));
  }

  ecrireSitemap();
}

/**
 * Réécrit le sitemap à partir de ce que dist/ contient RÉELLEMENT.
 *
 * L'ancien était tenu à la main : les cinq pages d'intégration et les trois
 * pages légales n'y ont jamais figuré, et les entrées françaises ne portaient
 * aucun alternate — un cluster hreflang à sens unique, que Google ignore.
 * Le construire depuis les fichiers rend l'oubli impossible.
 *
 * Deux exclusions : les pages en `noindex` (on ne demande pas l'indexation de
 * ce qu'on a marqué comme non indexable) et la 404.
 */
function ecrireSitemap() {
  const f = join(dist, 'sitemap.xml');
  if (!existsSync(f)) return;
  const languesPretes = LANGUES.filter((l) => Object.values(lireDictionnaire(l)).some(Boolean));

  const nonIndexable = (chemin) =>
    !existsSync(chemin) || /<meta[^>]+content="noindex"|<meta[^>]+name="robots"[^>]*noindex/i.test(readFileSync(chemin, 'utf8'));

  // Toutes les pages françaises servies, plus les articles du blog.
  const pagesFr = readdirSync(dist)
    .filter((n) => n.endsWith('.html') && n !== '404.html')
    .sort();
  const articles = existsSync(join(dist, 'blog-posts'))
    ? readdirSync(join(dist, 'blog-posts')).filter((n) => n.endsWith('.html')).sort().map((n) => 'blog-posts/' + n)
    : [];

  const entrees = [];
  const ajouter = (loc, alternates) => {
    const liens = alternates.map(
      (a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${SITE}${a.href}"/>`
    );
    entrees.push(`  <url>\n    <loc>${SITE}${loc}</loc>\n${liens.join('\n')}${liens.length ? '\n' : ''}  </url>`);
  };

  for (const page of [...pagesFr, ...articles]) {
    if (nonIndexable(join(dist, page))) continue;
    const langues = ['fr', ...languesPretes].filter((l) => pageExiste('/' + page, l));
    const alternates = langues.length > 1
      ? [...langues, 'x-default'].map((c) => ({ code: c, href: urlLocalisee('/' + page, c === 'x-default' ? 'fr' : c) }))
      : [];
    ajouter(urlLocalisee('/' + page, 'fr'), alternates);

    for (const langue of langues.filter((l) => l !== 'fr')) {
      ajouter(urlLocalisee('/' + page, langue), alternates);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`
    + entrees.join('\n') + `\n</urlset>\n`;
  writeFileSync(f, xml);
  console.log(`[i18n] sitemap: ${entrees.length} URLs (${languesPretes.length + 1} langues, noindex exclues)`);
}

const mode = process.argv[2];
if (mode === '--extract') extraire();
else if (mode === '--build') construire();
else { console.error('usage: vitrine-i18n.mjs --extract | --build'); process.exit(1); }
