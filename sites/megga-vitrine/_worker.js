// MEGGA vitrine (megga.ch) — HTTP Basic Auth gate (pré-lancement).
//
// Single-file Pages Worker (Advanced mode): gates the marketing pages with Basic
// Auth, then serves the static vitrine assets. No Supabase proxy here — the
// vitrine is a marketing landing that points to the CRM (app.megga.ch); it does
// not query listings. (The marketplace storefront that did proxy Supabase was
// deleted from the repo in July 2026; recoverable via git if it ever returns.)
//
// ⚠ Les pages d'AUTH sont hors du gate, et ce n'est pas un oubli. Le CRM n'a
// plus de page de connexion : ses 15 routes d'auth redirigent ici (cf.
// VITRINE_LOGIN_URL dans src/App.tsx). Un gate posé sur /login fermait donc
// l'accès au CRM lui-même — c'était le cas jusqu'au 26 juillet 2026 — et un
// gate sur /reset-password cassait les liens de réinitialisation envoyés par
// e-mail, qui arrivent chez des gens qui n'ont pas le mot de passe du gate.
//
// Credentials: megga / preview  (browser-native Basic Auth prompt, pre-launch).

const USER = 'megga';
const PASS = 'preview';

/**
 * Pages servies sans mot de passe : le gate protège le contenu marketing, pas la
 * porte d'entrée du produit.
 *
 * Les deux pages légales suivent les pages d'auth pour la même raison : la case
 * de consentement de /signup renvoie vers elles. Derrière le gate, on demandait
 * d'accepter des conditions que le visiteur reçoit en 401 — un consentement à un
 * texte illisible.
 */
const PUBLIC_PAGES = new Set([
  '/login',
  '/signup',
  '/reset-password',
  '/mentions-legales',
  '/confidentialite',
]);

/**
 * Dossiers de ressources laissés libres. Sans eux les pages d'auth arrivent nues
 * (styles, script de connexion, client Supabase, logo, polices). Aucune copie
 * marketing ne vit dans ces dossiers — `blog-posts/` et `mockups/`, qui en
 * portent, restent volontairement derrière le gate.
 */
const PUBLIC_PREFIXES = ['/css/', '/js/', '/images/', '/fonts/'];

/**
 * Chemin décodé, ou `null` s'il cherche à remonter l'arborescence.
 *
 * `new URL()` résout déjà `/js/../index.html` en `/index.html`, mais pas sa forme
 * encodée `%2e%2e` : sans ce décodage, un préfixe ouvert servirait de tunnel vers
 * une page gatée.
 */
function safePath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Encodage invalide : on garde la forme brute, qui ne matchera rien d'ouvert.
  }
  return decoded.includes('..') ? null : decoded;
}

/**
 * Forme canonique d'une page pour la comparaison.
 *
 * Pages sert `login.html` sous `/login`, et les DEUX formes circulent : liens
 * internes en `.html`, redirection du CRM sans extension. N'ouvrir qu'une des
 * deux laisserait la connexion cassée par un chemin sur deux.
 */
function canonicalPage(path) {
  const lower = path.toLowerCase();
  const trimmed = lower.length > 1 ? lower.replace(/\/+$/, '') : lower;
  return trimmed.replace(/\.html$/, '');
}

/** Vrai si la requête doit passer sans mot de passe. */
function isPublic(pathname) {
  const path = safePath(pathname);
  if (path === null) return false;
  if (PUBLIC_PAGES.has(canonicalPage(path))) return true;
  const lower = path.toLowerCase();
  return PUBLIC_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (!isPublic(pathname)) {
      const expected = 'Basic ' + btoa(`${USER}:${PASS}`);
      if (request.headers.get('Authorization') !== expected) {
        return new Response('Authentication required', {
          status: 401,
          headers: {
            // Realm sans tiret cadratin : une valeur d'en-tête HTTP ne porte
            // qu'un octet par caractère, et U+2014 sort de cette plage. Cloudflare
            // le tolère, un client strict refuse la réponse entière.
            'WWW-Authenticate': 'Basic realm="MEGGA - acces restreint", charset="UTF-8"',
            'Content-Type': 'text/plain; charset=UTF-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
