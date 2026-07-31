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
 * Les pages légales suivent les pages d'auth pour la même raison : la case de
 * consentement de /inscription renvoie vers elles. Derrière le gate, on
 * demandait d'accepter des conditions que le visiteur reçoit en 401 — un
 * consentement à un texte illisible.
 *
 * ⚠ L'ACCUEIL est ouvert depuis le 31 juil. 2026, et ce n'est pas un
 * relâchement du gate : Google exige, pour vérifier l'écran de consentement
 * OAuth (« Continuer avec Google »), une page d'accueil consultable SANS
 * connexion, qui explique l'objet de l'app, porte son nom et lie la politique
 * de confidentialité. Son robot recevait 401 et rejetait la demande sur cinq
 * points d'un coup. Fermer `/` revient donc à casser la connexion Google.
 * Le reste du marketing — tarifs, blog, à-propos, intégrations… — reste gaté.
 *
 * `/sitemap.xml` est ouvert bien qu'il liste des pages encore gatées : un
 * sitemap muré est un sitemap illisible, et il porte les 156 alternates
 * hreflang des quatre langues. Ouvrir le fichier n'ouvre pas les pages —
 * un robot qui suit ces URLs reçoit toujours 401 tant que le gate est là,
 * mais le jour du lancement le référencement multilingue démarre voyant.
 * (`robots.txt` passe déjà : Cloudflare Pages le sert avant le worker.)
 */
const PUBLIC_PAGES = new Set([
  '/',
  '/index',
  '/login',
  '/signup',
  '/reset-password',
  '/legal',
  '/privacy',
  '/terms',
  '/sitemap.xml',
]);

/**
 * Slugs français servis quelques heures le 31 juil. 2026 → URLs anglaises
 * courtes, qui sont la forme définitive.
 *
 * Les pages ont d'abord été renommées en français, puis ramenées à l'anglais
 * court le jour même. Ces 301 couvrent l'intervalle : liens partagés, onglets
 * restés ouverts, éventuel passage d'un robot. La redirection s'exécute AVANT
 * le gate — un 401 sur un chemin d'auth couperait l'entrée du produit
 * (incident du 26 juil. 2026).
 *
 * Le CRM (VITRINE_LOGIN_URL, ProtectedRoute) et les e-mails de
 * réinitialisation Supabase (RESET_REDIRECT, dans l'allowlist Auth) visent
 * `/login` et `/reset-password.html` : ces deux chemins sont de nouveau les
 * vrais fichiers, donc plus aucune redirection dans ce sens.
 */
const LEGACY_REDIRECTS = new Map([
  ['/connexion', '/login'],
  ['/inscription', '/signup'],
  ['/nouveau-mot-de-passe', '/reset-password'],
  ['/tarifs', '/pricing'],
  ['/a-propos', '/about'],
  ['/carrieres', '/careers'],
  ['/mentions-legales', '/legal'],
  ['/confidentialite', '/privacy'],
  ['/conditions-generales', '/terms'],
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

/**
 * Retire le préfixe de langue d'un chemin (`/de/signup` → `/signup`).
 *
 * Le gate raisonne sur la PAGE, pas sur la langue : une page publique en
 * français l'est dans toutes ses traductions. Sans ce retrait, `/de/` aurait
 * répondu 401 au robot de Google alors que `/` lui est ouvert, et la version
 * allemande de l'inscription aurait été murée.
 */
const LANGUES = ['de', 'en', 'it'];
function sansLangue(path) {
  const m = path.match(/^\/(de|en|it)(\/.*)?$/i);
  if (!m) return path;
  return m[2] || '/';
}

/** Vrai si la requête doit passer sans mot de passe. */
function isPublic(pathname) {
  const path = safePath(pathname);
  if (path === null) return false;
  if (PUBLIC_PAGES.has(canonicalPage(sansLangue(path)))) return true;
  const lower = path.toLowerCase();
  return PUBLIC_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Anciennes URLs → françaises, AVANT le gate (voir LEGACY_REDIRECTS).
    // La query est conservée ; le fragment n'atteint jamais le serveur et le
    // navigateur le ré-attache lui-même après un 301 même origine.
    const path = safePath(pathname);
    const cible = path === null ? undefined : LEGACY_REDIRECTS.get(canonicalPage(path));
    if (cible) {
      return new Response(null, {
        status: 301,
        headers: { Location: cible + url.search, 'Cache-Control': 'no-store' },
      });
    }

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
