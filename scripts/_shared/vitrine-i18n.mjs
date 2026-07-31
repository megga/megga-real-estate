/**
 * Socle i18n de la vitrine : périmètre des pages, extraction et traduction du HTML.
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

/**
 * Pages traduites (palier 1 — le parcours de conversion).
 *
 * Volontairement PAS le blog (60 % du volume, et un article traduit se
 * positionne mal : mieux vaut des articles natifs plus tard), PAS les pages
 * légales (un contrat mal traduit est un risque ; la version française fait
 * foi), PAS `careers` ni `changelog`.
 */
export const PAGES_TRADUITES = [
  '404.html',
  'about.html',
  'contact.html',
  'index.html',
  'integration-google-agenda.html',
  'integration-intercom.html',
  'integration-microsoft-outlook.html',
  'integration-skribble.html',
  'integration-whatsapp.html',
  'integrations.html',
  'login.html',
  'pricing.html',
  'reset-password.html',
  'signup.html',
];

/** Langues générées. Le français reste à la racine. */
export const LANGUES = ['de', 'en', 'it'];

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
  const titre = document.querySelector('title');
  if (titre && estTraduisible(titre.textContent)) {
    visiter({ type: 'texte', noeud: titre.firstChild, valeur: titre.textContent });
  }
  for (const el of document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')) {
    const v = el.getAttribute('content');
    if (v && estTraduisible(v)) visiter({ type: 'attribut', element: el, attribut: 'content', valeur: v });
  }
}

/**
 * Le chemin d'une page dans une langue donnée.
 *
 * ⚠ Ne préfixe QUE les pages effectivement traduites. Sans ce test, la
 * navigation allemande enverrait vers `/de/blog.html`, qui n'existe pas : un
 * lien mort vaut moins qu'un lien vers la version française.
 */
export function cheminLocalise(chemin, langue) {
  const nu = chemin.replace(/^\//, '');
  const fichier = nu === '' ? 'index.html' : nu;
  if (langue === 'fr') return '/' + (nu === 'index.html' ? '' : nu);
  if (!PAGES_TRADUITES.includes(fichier)) return '/' + nu; // reste en français
  return '/' + langue + '/' + (fichier === 'index.html' ? '' : fichier);
}
