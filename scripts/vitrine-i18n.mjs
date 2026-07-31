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
import { PAGES_TRADUITES, LANGUES, parcourirTextes, cheminLocalise } from './_shared/vitrine-i18n.mjs';

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

/** Réécrit un href interne vers sa version dans la langue, si elle existe. */
function localiserHref(href, langue) {
  if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href) || href.startsWith('//')) return href;
  const [chemin, ...reste] = href.split(/(?=[#?])/);
  const suffixe = reste.join('');
  if (chemin.startsWith('/')) return cheminLocalise(chemin, langue) + suffixe;
  if (chemin === '' || chemin.startsWith('blog-posts/')) return href;
  return cheminLocalise('/' + chemin, langue) + suffixe;
}

function construire() {
  if (!existsSync(dist)) { console.error('[i18n] pas de dist/ — lancer après le build'); process.exit(0); }

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

      const url = SITE + cheminLocalise('/' + page, langue);
      const canonical = doc.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', url);

      // Alternates : chaque langue déclare toutes les autres, plus x-default
      // sur le français — sans quoi Google traite les versions comme des
      // doublons et n'en indexe qu'une.
      for (const vieux of doc.querySelectorAll('link[rel="alternate"][hreflang]')) vieux.remove();
      const tete = doc.querySelector('head');
      for (const code of ['fr', ...LANGUES, 'x-default']) {
        const l = doc.createElement('link');
        l.setAttribute('rel', 'alternate');
        l.setAttribute('hreflang', code === 'x-default' ? 'x-default' : code);
        l.setAttribute('href', SITE + cheminLocalise('/' + page, code === 'x-default' ? 'fr' : code));
        tete.appendChild(l);
      }

      writeFileSync(join(sortie, page), dom.serialize());
    }
    console.log(`[i18n] ${langue}: ${PAGES_TRADUITES.length} pages générées` + (manquantes ? ` (${manquantes} occurrences laissées en français — noms propres et marques)` : ''));
  }

  ecrireSitemap();
}

/**
 * Ajoute au sitemap les pages générées, chacune avec ses alternates.
 *
 * Une langue absente du sitemap n'est pas explorée : c'est la moitié du
 * bénéfice d'une traduction qui se perd. On ne liste QUE les langues dont le
 * dictionnaire est rempli, et que les pages du palier 1.
 */
function ecrireSitemap() {
  const f = join(dist, 'sitemap.xml');
  if (!existsSync(f)) return;
  const languesPretes = LANGUES.filter((l) => Object.values(lireDictionnaire(l)).some(Boolean));
  if (!languesPretes.length) return;

  let xml = readFileSync(f, 'utf8');
  if (xml.includes('hreflang=')) return; // déjà enrichi
  if (!xml.includes('xmlns:xhtml')) {
    xml = xml.replace('<urlset ', '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" ');
  }

  const entrees = [];
  for (const langue of languesPretes) {
    for (const page of PAGES_TRADUITES) {
      if (page === '404.html' || !existsSync(join(dist, langue, page))) continue;
      const alternates = ['fr', ...languesPretes]
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${cheminLocalise('/' + page, l)}"/>`)
        .join('\n');
      entrees.push(`  <url>\n    <loc>${SITE}${cheminLocalise('/' + page, langue)}</loc>\n${alternates}\n  </url>`);
    }
  }
  writeFileSync(f, xml.replace('</urlset>', entrees.join('\n') + '\n</urlset>'));
  console.log(`[i18n] sitemap: ${entrees.length} URLs traduites ajoutées`);
}

const mode = process.argv[2];
if (mode === '--extract') extraire();
else if (mode === '--build') construire();
else { console.error('usage: vitrine-i18n.mjs --extract | --build'); process.exit(1); }
