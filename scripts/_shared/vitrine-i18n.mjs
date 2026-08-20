/**
 * Socle i18n de la vitrine : périmètre des pages, slugs, extraction et URLs.
 *
 * La vitrine est un export Webflow SANS build : traduire en dupliquant les
 * fichiers ferait vivre 4 copies de chaque page, et chaque changement de
 * structure (un bouton ajouté au pied de page, un lien de nav) deviendrait
 * quadruple. On garde donc UNE source — le français — et les autres langues
 * sont générées à la construction, à partir d'un dictionnaire par langue.
 *
 * Les clés du dictionnaire sont les CHAÎNES FRANÇAISES elles-mêmes : pas
 * d'attribut `data-i18n` à semer dans un export qu'on ne maîtrise pas, et une
 * relecture qui se lit comme un texte suivi. Le prix à payer est qu'une même
 * phrase française ne peut pas avoir deux traductions différentes selon le
 * contexte ; à ce jour aucune ne le demande, et `scripts/vitrine-i18n.mjs
 * --extract` le signalerait.
 */

/** Langues générées. Le français reste à la racine. */
export const LANGUES = ['de', 'en', 'it'];

/**
 * Pages traduites (palier 1 — le parcours de conversion) et leur slug par langue.
 *
 * Volontairement PAS le blog (60 % du volume, et un article traduit se
 * positionne mal : mieux vaut des articles natifs plus tard), PAS les pages
 * légales (un contrat mal traduit est un risque ; la version française fait
 * foi), PAS `careers` ni `changelog`.
 *
 * Le slug fait partie de la traduction : `/de/pricing.html` trahissait que
 * l'effort s'arrêtait au contenu. Les marques ne se traduisent pas (Intercom,
 * Outlook, Skribble, WhatsApp), et le produit reste nommé dans le slug de son
 * intégration — la page « Gmail » annoncée sur /integrations rendrait un
 * `integration-google` ambigu. Google localise lui-même son calendrier en
 * « Google Kalender » (de) et le garde en « Google Calendar » (en, it).
 */
export const PAGES = {
  '404.html': { de: '404', en: '404', it: '404' },
  'about.html': { de: 'ueber-uns', en: 'about', it: 'chi-siamo' },
  'contact.html': { de: 'kontakt', en: 'contact', it: 'contatto' },
  'index.html': { de: 'index', en: 'index', it: 'index' },
  'integration-google-agenda.html': {
    de: 'integration-google-kalender',
    en: 'integration-google-calendar',
    it: 'integrazione-google-calendar',
  },
  'integration-claude.html': { de: 'integration-claude', en: 'integration-claude', it: 'integrazione-claude' },
  'integration-intercom.html': { de: 'integration-intercom', en: 'integration-intercom', it: 'integrazione-intercom' },
  'integration-microsoft-outlook.html': {
    de: 'integration-microsoft-outlook',
    en: 'integration-microsoft-outlook',
    it: 'integrazione-microsoft-outlook',
  },
  'integration-skribble.html': { de: 'integration-skribble', en: 'integration-skribble', it: 'integrazione-skribble' },
  'integration-stripe.html': { de: 'integration-stripe', en: 'integration-stripe', it: 'integrazione-stripe' },
  'integration-whatsapp.html': { de: 'integration-whatsapp', en: 'integration-whatsapp', it: 'integrazione-whatsapp' },
  'integrations.html': { de: 'integrationen', en: 'integrations', it: 'integrazioni' },
  'login.html': { de: 'anmelden', en: 'login', it: 'accedi' },
  'pricing.html': { de: 'preise', en: 'pricing', it: 'prezzi' },
  'reset-password.html': { de: 'neues-passwort', en: 'reset-password', it: 'nuova-password' },
  'signup.html': { de: 'registrieren', en: 'signup', it: 'registrazione' },
};

export const PAGES_TRADUITES = Object.keys(PAGES);

/** Balises dont le contenu textuel n'est jamais de la copy. */
const BALISES_OPAQUES = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);

/** Attributs porteurs de texte visible ou lu par les robots et les lecteurs d'écran. */
const ATTRIBUTS = ['alt', 'placeholder', 'title', 'aria-label', 'data-wait'];

/**
 * Une chaîne mérite-t-elle une traduction ?
 *
 * On écarte le bruit typographique (« · », « — »), les nombres seuls et les
 * fragments d'une lettre : les faire traduire encombre le dictionnaire sans
 * rien apporter, et un traducteur qui voit « © 2026 MEGGA Inc. » se demande
 * ce qu'on attend de lui.
 */
export function estTraduisible(texte) {
  const t = (texte || '').trim();
  if (t.length < 2) return false;
  if (!/[a-zà-öø-ÿ]{2}/i.test(t)) return false; // pas deux lettres à la suite
  if (/^[\d\s.,'’%+×—·|/-]+$/.test(t)) return false;
  return true;
}

/** Parcourt les nœuds de texte et les attributs traduisibles d'un document. */
export function parcourirTextes(document, visiter) {
  const marcheur = document.createTreeWalker(document.body || document, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (BALISES_OPAQUES.has(n.parentNode?.tagName)) continue;
    if (!estTraduisible(n.nodeValue)) continue;
    visiter({ type: 'texte', noeud: n, valeur: n.nodeValue });
  }

  for (const el of document.querySelectorAll('[' + ATTRIBUTS.join('],[') + ']')) {
    for (const attr of ATTRIBUTS) {
      const v = el.getAttribute(attr);
      if (v && estTraduisible(v)) visiter({ type: 'attribut', element: el, attribut: attr, valeur: v });
    }
  }

  // Libellé des boutons d'envoi : porté par `value`, pas par le contenu.
  for (const el of document.querySelectorAll('input[type="submit"][value]')) {
    const v = el.getAttribute('value');
    if (estTraduisible(v)) visiter({ type: 'attribut', element: el, attribut: 'value', valeur: v });
  }

  // Métadonnées : titre, description, Open Graph, Twitter.
  // `property^="twitter:"` autant que `name^=` : les deux formes circulent dans
  // l'export, et n'en couvrir qu'une laissait des cartes Twitter en français.
  const titre = document.querySelector('title');
  if (titre && estTraduisible(titre.textContent)) {
    visiter({ type: 'texte', noeud: titre.firstChild, valeur: titre.textContent });
  }
  for (const el of document.querySelectorAll(
    'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]'
  )) {
    const v = el.getAttribute('content');
    if (v && estTraduisible(v)) visiter({ type: 'attribut', element: el, attribut: 'content', valeur: v });
  }
}

/** Nom du fichier écrit sur le disque pour une page dans une langue. */
export function fichierLocalise(fichier, langue) {
  if (langue === 'fr') return fichier;
  const slug = PAGES[fichier]?.[langue];
  return slug ? slug + '.html' : fichier;
}

/**
 * URL CANONIQUE d'une page dans une langue — sans extension.
 *
 * Cloudflare Pages sert `/pricing.html` mais redirige en 308 vers `/pricing` :
 * annoncer la forme `.html` dans un canonical, un hreflang ou un sitemap revient
 * à désigner à Google une URL qui n'est pas la finale. On n'émet donc que la
 * forme servie. `index` disparaît : la racine de langue est `/de/`.
 *
 * ⚠ Ne traduit QUE les pages du palier 1. Pour les autres — blog, pages
 * légales, carrières — le chemin français est renvoyé tel quel : un lien vers
 * la version française vaut mieux qu'un 404 dans la bonne langue.
 */
export function urlLocalisee(chemin, langue) {
  const nu = chemin.replace(/^\//, '') || 'index.html';
  const fichier = nu.endsWith('.html') ? nu : nu + '.html';
  const traduite = Object.prototype.hasOwnProperty.call(PAGES, fichier);

  if (langue === 'fr' || !traduite) {
    if (!traduite) return '/' + nu.replace(/\.html$/, '');
    return fichier === 'index.html' ? '/' : '/' + fichier.replace(/\.html$/, '');
  }
  const slug = PAGES[fichier][langue];
  return slug === 'index' ? '/' + langue + '/' : '/' + langue + '/' + slug;
}

/** Vrai si la page existe dans cette langue (base d'un lien qui ne meurt pas). */
export function pageExiste(chemin, langue) {
  if (langue === 'fr') return true;
  const nu = chemin.replace(/^\//, '') || 'index.html';
  const fichier = nu.endsWith('.html') ? nu : nu + '.html';
  return Object.prototype.hasOwnProperty.call(PAGES, fichier);
}
