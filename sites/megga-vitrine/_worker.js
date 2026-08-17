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
 * UNE seule valeur ouvre la vitrine — `off` — d'où que la valeur vienne.
 *
 * Un autre mot, une valeur vide, une faute de frappe ferment : une valeur qu'on
 * n'a pas su lire ne doit pas ouvrir.
 *
 * ⚠ Ce qui est ABSENT, en revanche, ne passe pas par ici : il prend
 * `GATE_PAR_DEFAUT`. Cette fonction ne décide donc pas du sort d'une préversion
 * ni d'un projet Pages recréé — c'est la constante qui le fait.
 */
function demandeOuverture(valeur) {
  return String(valeur ?? '').trim().toLowerCase() === 'off';
}

/** Clé lue dans le KV. */
const CLE_GATE = 'gate';

/**
 * Ce que vaut le gate quand aucun réglage ne répond — `off`, donc OUVERT.
 *
 * Ni le KV ni la variable n'existent en production : c'est donc cette constante
 * qui gouverne `megga.ch`, et le site est en accès libre.
 *
 * Refermer, au choix, du plus vif au plus définitif :
 *   1. clé `gate` du KV `VITRINE_CONFIG` → `on` (~60 s, sans déploiement) ;
 *   2. variable `VITRINE_GATE` → `on`, effectif au déploiement suivant ;
 *   3. cette constante → `'on'`, qui n'exige aucun accès au tableau de bord.
 *
 * ⚠ CETTE CONSTANTE A BASCULÉ TROIS FOIS EN DEUX JOURS — `off` le 16 août 2026
 * (#1240), `on` le 17 (#1250), `off` de nouveau le 17 (#1257), à chaque fois sur
 * demande. Ce n'est pas de l'indécision : c'est que **le levier 1 n'existe
 * toujours pas**. Le binding KV n'a jamais été créé au tableau de bord, donc la
 * bascule « 60 s sans déploiement » reste théorique, et chaque changement d'avis
 * coûte une PR, une CI et un déploiement — environ sept minutes. Poser le
 * binding une fois supprimerait ce coût pour toutes les fois suivantes.
 *
 * ⛔ Tant que la valeur est `off`, la vitrine de pré-lancement est lisible ET
 * indexable par n'importe qui — `robots.txt` porte `Allow: /`, et le gate est la
 * seule chose qui tenait les moteurs à distance. La sonde de
 * `.claude/hooks/session-start.sh` est le seul rappel à l'écran : « vitrine :
 * 200 — le gate est OUVERT ⚠ ».
 */
const GATE_PAR_DEFAUT = 'off';

/**
 * Le gate est-il posé ? Deux sources, dans cet ordre (16 août 2026, Julien).
 *
 * 1. **KV `VITRINE_CONFIG`, clé `gate`** — la bascule VIVE. Écrire la valeur
 *    depuis le tableau de bord suffit : aucun déploiement, aucune PR. C'est le
 *    seul réglage de ce fichier qui n'exige pas de repasser par la CI.
 * 2. **Variable `VITRINE_GATE`** — le réglage de repli, relu au déploiement
 *    seulement. Il gouverne là où le KV n'est pas branché : préversions de
 *    branche, `wrangler dev`, et la période avant que le binding existe.
 * 3. **`GATE_PAR_DEFAUT`** — quand ni l'un ni l'autre n'existe. Il vaut `off`,
 *    donc **l'état par défaut est OUVERT** : c'est ce qui gouverne la production
 *    aujourd'hui, où aucun des deux réglages n'est posé.
 *
 * Un niveau ne parle que s'il a quelque chose à dire. Clé absente du KV
 * (`null`) = « pas d'avis » → on descend à la variable. C'est l'état juste
 * après la création du namespace, et il ne doit rien changer au comportement.
 *
 * ⛔ Une LECTURE EN ÉCHEC, elle, n'est pas une absence d'avis : elle ferme, et
 * ne descend pas à la variable. Si le plan de contrôle est illisible, on ne
 * sait pas ce qu'on est censé faire — et « on ne sait pas » vaut fermé. Sans
 * cette distinction, une panne de KV pendant que la variable dit `off`
 * ouvrirait le site au moment précis où l'on a le moins de visibilité.
 *
 * ⚠ Le binding KV lui-même s'ajoute au tableau de bord (Settings › Functions),
 * et l'ATTACHER demande un déploiement — une fois. Ce sont les bascules
 * suivantes qui sont gratuites.
 *
 * ⚠ La bascule n'est pas instantanée à la seconde près : `cacheTtl` est au
 * plancher de Workers KV (60 s), et une écriture met jusqu'à ~60 s à se
 * propager. Compter environ une minute avant que tous les points de présence
 * soient d'accord.
 *
 * Tant que la vitrine est ouverte, elle est lisible et indexable par n'importe
 * qui, contenu marketing de pré-lancement compris. La sonde de
 * `.claude/hooks/session-start.sh` le rappelle à chaque session : « vitrine :
 * 200 — le gate est OUVERT ⚠ ».
 */
async function gateActif(env) {
  const kv = env?.VITRINE_CONFIG;
  if (kv && typeof kv.get === 'function') {
    try {
      const valeur = await kv.get(CLE_GATE, { cacheTtl: 60 });
      if (valeur !== null && valeur !== undefined) return !demandeOuverture(valeur);
    } catch {
      return true;
    }
  }
  return !demandeOuverture(env?.VITRINE_GATE ?? GATE_PAR_DEFAUT);
}

/**
 * Pages servies sans mot de passe : le gate protège le contenu marketing, pas la
 * porte d'entrée du produit.
 *
 * Les pages légales suivent les pages d'auth pour la même raison : la case de
 * consentement de /inscription renvoie vers elles. Derrière le gate, on
 * demandait d'accepter des conditions que le visiteur reçoit en 401 — un
 * consentement à un texte illisible.
 *
 * ⚠ L'ACCUEIL est REFERMÉ depuis le 10 août 2026. Il était la dernière page
 * marketing lisible sans mot de passe, donc la vitrine entière se laissait voir
 * depuis n'importe quel poste, en pré-lancement. Plus aucune page de contenu
 * ne sort du gate : seules restent ouvertes la porte d'entrée du produit
 * (pages d'auth), les textes qu'elle fait accepter (pages légales), le sitemap
 * et les dossiers de ressources.
 *
 * Ce que cette fermeture coûte, et qu'il faut savoir avant de la défaire ou de
 * la refaire : `/` avait été ouvert le 31 juil. 2026 parce que Google exige,
 * pour vérifier l'écran de consentement OAuth (« Continuer avec Google »), une
 * page d'accueil consultable SANS connexion, qui explique l'objet de l'app,
 * porte son nom et lie la politique de confidentialité. Son robot recevait 401
 * et rejetait la demande sur cinq points d'un coup. Tant que `/` est fermé,
 * cette vérification ne peut pas aboutir. Si elle est relancée, rouvrir `/` le
 * temps de la passer — la cause sera ici, pas dans la configuration Google.
 *
 * `/sitemap.xml` est ouvert bien qu'il liste des pages encore gatées : un
 * sitemap muré est un sitemap illisible, et il porte les 156 alternates
 * hreflang des quatre langues. Ouvrir le fichier n'ouvre pas les pages —
 * un robot qui suit ces URLs reçoit toujours 401 tant que le gate est là,
 * mais le jour du lancement le référencement multilingue démarre voyant.
 * (`robots.txt` passe déjà : Cloudflare Pages le sert avant le worker.)
 */
const PUBLIC_PAGES = new Set([
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
 * (styles, script de connexion, client Supabase, logo, polices).
 *
 * `mockups/` en est SORTI le 10 août 2026, avec la fermeture de l'accueil : il
 * n'était ouvert que parce que `/` l'était — `index.html` est le seul fichier
 * du site à référencer ces maquettes, en iframe. L'accueil gaté, elles le sont
 * avec lui, et le navigateur joint l'identifiant du gate aux sous-requêtes de
 * même origine une fois celui-ci franchi. Laisser le préfixe ouvert n'aurait
 * plus servi aucune page publique : ce n'aurait été que de la surface.
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

/**
 * Slugs des pages traduites, par langue. Doit rester le miroir de `PAGES` dans
 * `scripts/_shared/vitrine-i18n.mjs` — `tests/unit/vitrine-slugs.spec.ts` échoue
 * si les deux divergent.
 *
 * ⚠ Sans cette table, le gate comparait `/de/anmelden` à `/anmelden`, absent de
 * PUBLIC_PAGES : la connexion allemande aurait répondu 401, et l'entrée du
 * produit aurait été murée dans trois langues sur quatre.
 */
const SLUGS_PAR_LANGUE = {
  de: {
    '/about': '/ueber-uns', '/contact': '/kontakt', '/integrations': '/integrationen',
    '/login': '/anmelden', '/pricing': '/preise', '/reset-password': '/neues-passwort',
    '/signup': '/registrieren', '/integration-google-agenda': '/integration-google-kalender',
  },
  en: {
    '/integration-google-agenda': '/integration-google-calendar',
  },
  it: {
    '/about': '/chi-siamo', '/contact': '/contatto', '/integrations': '/integrazioni',
    '/login': '/accedi', '/pricing': '/prezzi', '/reset-password': '/nuova-password',
    '/signup': '/registrazione', '/integration-google-agenda': '/integrazione-google-calendar',
    '/integration-intercom': '/integrazione-intercom',
    '/integration-microsoft-outlook': '/integrazione-microsoft-outlook',
    '/integration-skribble': '/integrazione-skribble',
    '/integration-whatsapp': '/integrazione-whatsapp',
  },
};

/** Sens inverse : slug traduit → page canonique, toutes langues confondues. */
const SLUGS = new Map(
  Object.values(SLUGS_PAR_LANGUE).flatMap((m) => Object.entries(m).map(([page, slug]) => [slug, page]))
);

/**
 * `/de/pricing` → `/de/preise`.
 *
 * Les pages traduites ont d'abord été servies sous leur nom anglais, avant que
 * les slugs ne soient localisés le même jour. Ces 301 couvrent l'intervalle, et
 * rattrapent le visiteur qui devine une URL depuis une autre langue.
 */
function slugTraduit(path) {
  const m = path.match(/^\/(de|en|it)(\/.*)?$/i);
  if (!m) return undefined;
  const langue = m[1].toLowerCase();
  const page = canonicalPage(m[2] || '/');
  const slug = SLUGS_PAR_LANGUE[langue]?.[page];
  return slug ? '/' + langue + slug : undefined;
}

function sansLangue(path) {
  const m = path.match(/^\/(de|en|it)(\/.*)?$/i);
  if (!m) return path;
  const reste = m[2] || '/';
  return SLUGS.get(canonicalPage(reste)) || reste;
}

// ─────────────────────────────────────────────────────────────────────────────
//  /api/geo — d'où vient le visiteur, et dans quelle langue lui parler
// ─────────────────────────────────────────────────────────────────────────────
//
// Cloudflare pose déjà le pays et la subdivision sur `request.cf` : la détection
// se fait donc au bord, dans le processus qui sert la page. Aucun appel à un
// service tiers, aucune adresse IP transmise ni journalisée, et la réponse ne
// porte que le pays et le canton — pas la ville, pas les coordonnées, dont
// personne n'a besoin ici.
//
// L'arbitrage est rendu ICI plutôt que dans les deux clients (le JS de la
// vitrine, le TypeScript du CRM). Trois raisons : `Accept-Language` n'existe
// qu'au bord sous sa forme complète et pondérée ; la vitrine est un export
// Webflow sans build, qui ne peut pas importer un module partagé ; et une table
// de langues dupliquée en deux exemplaires diverge le jour où l'un des deux est
// corrigé seul.

/** Les quatre langues du produit. Tout code hors de cette liste est ignoré. */
const LANGUES_PRODUIT = ['fr', 'de', 'en', 'it'];

/**
 * Langue de travail par canton — les 26, une entrée chacun, jamais de « et le
 * reste en allemand ».
 *
 * ⚠ L'exhaustivité n'est pas de la coquetterie : une règle par défaut ferait
 * tomber dans le seau allemand tout ce qui n'est pas un canton — `CH-ZH` mal
 * découpé, le `FL` que `npaToCanton` rend pour le Liechtenstein, ou la chaîne
 * vide — sans que rien ne le signale. Un code inconnu doit sortir `undefined`
 * et faire abstenir l'appelant.
 *
 * Le critère n'est pas « quelle langue parle-t-on ici » mais « dans quelle
 * langue cet agent travaille-t-il » : registre foncier, notaire, extrait du
 * registre du commerce, administration cantonale. D'où les quatre arbitrages
 * des cantons plurilingues :
 *   BE → de (Berne, Thoune, l'Oberland font le volume ; le Jura bernois et
 *            Bienne sont mal servis, et l'assument)
 *   FR → fr (~68 % francophone, administration à priorité française)
 *   VS → fr (~63 % francophone ; c'est le cas le plus coûteux de la table —
 *            le Haut-Valais germanophone est un marché de résidences
 *            secondaires à forte valeur, et on lui propose du français)
 *   GR → de (Coire, Davos, l'Engadine ; les vallées italophones du Sud sont
 *            mal servies)
 * Le romanche n'entre pas : le produit ne le parle pas, et ses locuteurs
 * travaillent en allemand ou en italien.
 */
const LANGUE_PAR_CANTON = {
  GE: 'fr', VD: 'fr', VS: 'fr', NE: 'fr', FR: 'fr', JU: 'fr',
  ZH: 'de', BE: 'de', LU: 'de', UR: 'de', SZ: 'de', OW: 'de', NW: 'de',
  GL: 'de', ZG: 'de', SO: 'de', BS: 'de', BL: 'de', SH: 'de', AR: 'de',
  AI: 'de', SG: 'de', GR: 'de', AG: 'de', TG: 'de',
  TI: 'it',
};

/**
 * Pays où plusieurs de nos langues sont défendables, et dans lesquels
 * `Accept-Language` tranche mieux que l'adresse IP.
 *
 * C'est le seul endroit où la langue du navigateur est consultée, et le
 * restreindre ainsi est délibéré : elle ne choisit qu'entre des langues déjà
 * plausibles là où se trouve la personne. Un macOS en anglais à Genève ne
 * bascule donc rien — `en` n'est pas dans la liste suisse, on retombe sur le
 * canton.
 */
const LANGUES_PLAUSIBLES_PAR_PAYS = {
  CH: ['fr', 'de', 'it'],
  LU: ['fr', 'de'],
  BE: ['fr'],
  CA: ['fr', 'en'],
};

/**
 * Meilleure langue connue par pays. Absent de la table → anglais (voir
 * `resoudreLangue`), ce qui est le bon pari pour ES, PT, NL, PL, BR, TR, JP,
 * les Émirats… : de nos quatre langues, c'est celle qu'ils ont le plus de
 * chances de lire.
 *
 * Les pays francophones hors Europe et les collectivités françaises d'outre-mer
 * y figurent parce qu'ils portent leur propre code ISO : sans eux, un visiteur
 * de Casablanca ou de Fort-de-France recevrait de l'anglais alors qu'il lit le
 * français mieux que nous.
 */
const LANGUE_PAR_PAYS = {
  CH: 'fr', LI: 'de',
  FR: 'fr', MC: 'fr', BE: 'fr', LU: 'fr',
  DE: 'de', AT: 'de',
  IT: 'it', SM: 'it', VA: 'it',
  // Outre-mer français
  GP: 'fr', MQ: 'fr', GF: 'fr', RE: 'fr', YT: 'fr', PM: 'fr',
  BL: 'fr', MF: 'fr', NC: 'fr', PF: 'fr', WF: 'fr',
  // Francophonie
  MA: 'fr', TN: 'fr', DZ: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', CD: 'fr',
  GA: 'fr', ML: 'fr', BF: 'fr', BJ: 'fr', TG: 'fr', NE: 'fr', MG: 'fr', HT: 'fr',
};

/** Code pays ISO 3166-1 alpha-2, ou `null` si Cloudflare n'a rien de exploitable. */
function normaliserPays(brut) {
  const code = String(brut || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Code de subdivision ISO 3166-2 sans son préfixe pays — le canton, en Suisse.
 *
 * Le préfixe est retiré par précaution : `regionCode` est documenté sans lui,
 * mais une valeur `CH-GE` qui traverserait la table sans être reconnue serait
 * indistinguable d'un canton inconnu, et ferait taire la détection sans bruit.
 */
function normaliserSubdivision(brut) {
  const code = String(brut || '').trim().toUpperCase().replace(/^[A-Z]{2}-/, '');
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Codes de langue d'un en-tête `Accept-Language`, du plus voulu au moins voulu.
 *
 * Le tri par `q` est nécessaire : rien n'oblige le navigateur à envoyer ses
 * préférences dans l'ordre décroissant, et `q=0` signifie « surtout pas ».
 * À poids égal, l'ordre d'apparition tranche.
 */
function languesAcceptees(entete) {
  if (!entete) return [];
  return String(entete)
    .split(',')
    .map((brut, rang) => {
      const morceaux = brut.trim().split(';');
      const parametreQ = morceaux.slice(1).map((p) => p.trim()).find((p) => p.startsWith('q='));
      const poids = parametreQ ? Number.parseFloat(parametreQ.slice(2)) : 1;
      return {
        code: morceaux[0].trim().slice(0, 2).toLowerCase(),
        poids: Number.isFinite(poids) ? poids : 0,
        rang,
      };
    })
    .filter((e) => /^[a-z]{2}$/.test(e.code) && e.poids > 0)
    .sort((a, b) => b.poids - a.poids || a.rang - b.rang)
    .map((e) => e.code);
}

/** Première langue voulue par le navigateur parmi `candidates`, ou `null`. */
function premiereLangueVoulue(entete, candidates) {
  for (const code of languesAcceptees(entete)) {
    if (candidates.includes(code)) return code;
  }
  return null;
}

/**
 * La langue à proposer, et à quel point on y croit.
 *
 * `confidence: 'low'` veut dire « on ne sait pas » : la langue rendue est alors
 * le défaut produit, et l'appelant ne doit RIEN proposer. C'est le cas d'un
 * visiteur suisse dont le canton est inconnu — mobile derrière un CGNAT, relais
 * privé iCloud, VPN. Lui suggérer le français qu'il a déjà sous les yeux, ou
 * pire lui « confirmer » un choix qu'on n'a pas fait, serait mentir sur ce
 * qu'on sait.
 */
function resoudreLangue(pays, subdivision, acceptLanguage) {
  const plausibles = LANGUES_PLAUSIBLES_PAR_PAYS[pays];

  // 1. Le navigateur tranche, mais seulement entre des langues déjà plausibles
  //    là où se trouve la personne.
  if (plausibles) {
    const voulue = premiereLangueVoulue(acceptLanguage, plausibles);
    if (voulue) return { language: voulue, confidence: 'high', source: 'accept-language' };
  }

  // 2. En Suisse, le canton. C'est le seul pays où il change quelque chose.
  if (pays === 'CH') {
    const parCanton = LANGUE_PAR_CANTON[subdivision];
    if (parCanton) return { language: parCanton, confidence: 'high', source: 'canton' };
    return { language: 'fr', confidence: 'low', source: 'defaut' };
  }

  // 3. Le pays.
  const parPays = LANGUE_PAR_PAYS[pays];
  if (parPays) return { language: parPays, confidence: 'medium', source: 'pays' };

  // 4. Pays inconnu de la table : on servirait de l'anglais. Là, et là
  //    seulement, la langue du navigateur vaut mieux que rien — un visiteur
  //    marocain qui demande du français doit le recevoir.
  if (pays) {
    const voulue = premiereLangueVoulue(acceptLanguage, LANGUES_PRODUIT);
    if (voulue) return { language: voulue, confidence: 'medium', source: 'accept-language' };
    return { language: 'en', confidence: 'medium', source: 'pays-defaut' };
  }

  // 5. Même pas de pays : hors réseau Cloudflare, ou `cf` absent.
  return { language: 'fr', confidence: 'low', source: 'defaut' };
}

/**
 * Origines admises à interroger l'endpoint depuis un autre hôte.
 *
 * Le CRM vit sur `app.megga.ch`, donc sur une AUTRE origine que la vitrine :
 * sans cet en-tête, le navigateur lui refuse la lecture de la réponse. Les
 * préversions Cloudflare du projet `megga-app` sont admises pour qu'une branche
 * se teste comme la production ; `localhost` pour `npm run dev`.
 *
 * ⚠ Écrit ICI et pas dans `_headers` : megga.ch tourne en mode Advanced, où
 * Cloudflare n'évalue ni `_headers` ni `_redirects` (cf. public/_headers).
 */
const ORIGINES_CRM = /^https:\/\/(app\.megga\.ch|[a-z0-9-]+\.megga-app\.pages\.dev)$/;

function origineAutorisee(origine) {
  if (!origine) return false;
  if (ORIGINES_CRM.test(origine)) return true;
  return /^http:\/\/localhost:(5173|4173|4180)$/.test(origine);
}

/**
 * Réponse de `/api/geo`.
 *
 * `no-store` n'est pas une précaution de style : la réponse dépend de l'adresse
 * IP et de l'en-tête `Accept-Language` de CHAQUE visiteur. Mise en cache, elle
 * servirait l'allemand d'un Zurichois à tout le monde.
 */
function reponseGeo(request) {
  const origine = request.headers.get('Origin');
  const entetes = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'CDN-Cache-Control': 'no-store',
    Vary: 'Origin, Accept-Language',
  };
  if (origineAutorisee(origine)) entetes['Access-Control-Allow-Origin'] = origine;

  // La préflight doit répondre ici : le navigateur ne joint pas d'en-tête
  // `Authorization` à un OPTIONS, un gate posé devant lui rendrait 401 et le
  // CRM ne verrait jamais la réponse.
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...entetes, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...entetes, Allow: 'GET, OPTIONS' } });
  }

  // `request.cf` est absent hors du réseau Cloudflare (aperçu local, éditeur du
  // tableau de bord) : sans ce repli, la détection lèverait au lieu de s'abstenir.
  const cf = request.cf || {};
  const pays = normaliserPays(cf.country);
  const subdivision = normaliserSubdivision(cf.regionCode);
  const decision = resoudreLangue(pays, subdivision, request.headers.get('Accept-Language'));

  return new Response(
    JSON.stringify({ country: pays, region: subdivision, ...decision }),
    { headers: entetes }
  );
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

    // Détection de langue, tout en haut : ni redirection ni mot de passe.
    //
    // Le gate répondrait 401 (`/api/geo` n'est ni dans PUBLIC_PAGES ni sous un
    // préfixe ouvert), et l'ajouter aux chemins publics ne suffirait pas — la
    // requête finirait ligne « env.ASSETS.fetch » sur un fichier qui n'existe
    // pas. C'est un endpoint calculé, il se traite avant tout le reste.
    if (canonicalPage(pathname) === '/api/geo') return reponseGeo(request);

    // Anciennes URLs → forme définitive, AVANT le gate (voir LEGACY_REDIRECTS).
    // La query est conservée ; le fragment n'atteint jamais le serveur et le
    // navigateur le ré-attache lui-même après un 301 même origine.
    const path = safePath(pathname);
    const cible = path === null ? undefined : (LEGACY_REDIRECTS.get(canonicalPage(path)) || slugTraduit(path));
    if (cible) {
      return new Response(null, {
        status: 301,
        headers: { Location: cible + url.search, 'Cache-Control': 'no-store' },
      });
    }

    // `isPublic` d'ABORD : il est local et gratuit, alors que `gateActif` peut
    // toucher le KV. Dans cet ordre, les ressources, les pages d'auth et le
    // sitemap ne déclenchent aucune lecture — seul un chemin réellement gaté
    // en paie une (mise en cache 60 s au point de présence).
    if (!isPublic(pathname) && (await gateActif(env))) {
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

// Exports nommés pour `tests/unit/vitrine-geo.spec.ts`. Cloudflare ne lit que
// l'export par défaut ; ceux-ci lui sont indifférents, et ils évitent que la
// table des 26 cantons ne soit vérifiable que par une regex sur le fichier.
export {
  LANGUE_PAR_CANTON,
  LANGUE_PAR_PAYS,
  gateActif,
  languesAcceptees,
  normaliserPays,
  normaliserSubdivision,
  origineAutorisee,
  resoudreLangue,
};
