/**
 * Comparaisons de SECRET écrites à la main dans les edge functions — le lecteur des passes
 * « secret » de `check-edge-auth.mjs`.
 *
 * POURQUOI. Audit du 13.09.2026, point S8. Quatre fonctions authentifiaient leur appelant
 * interne par un `===` nu contre la clé de service — `authHeader === \`Bearer ${clé}\`` —
 * et `weekly-report` acceptait `profiles.role = 'super_admin'` sans l'allowlist d'e-mail
 * qu'exigent `requireSuperAdmin` et `is_super_admin()`. La porte les laissait passer : deux
 * entrées sur mesure (BESPOKE) les couvraient, et les gardes partagées y étaient reconnues
 * à la simple PRÉSENCE de leur nom — un `isServiceSecret` cité dans un commentaire suffisait.
 * Les deux gardes partagées existent et sont éprouvées ailleurs ; ce lecteur fait rougir
 * leurs contrefaçons locales, qui sont la forme sous laquelle le défaut revient.
 *
 * CINQ RÈGLES, lues sur la source commentaires blanchis (`sansCommentaires`, qui conserve
 * les numéros de ligne) :
 *   · `egalite-brute`      — `==`/`===`/`!=`/`!==` accolé à un gabarit `Bearer ${…}`, à un
 *                            identifiant qui NOMME un secret (`serviceRoleKey`, `svcKey`,
 *                            `CRON_SECRET`, `…_SECRET`…) ou à un `Deno.env.get('…KEY|SECRET')`
 *                            écrit sur place. Un `===` n'est pas à temps constant, et il ne
 *                            connaît qu'UNE source de secret là où `isServiceSecret` accepte
 *                            `app_config` OU l'env.
 *   · `egalite-teintee`    — la même égalité sur un identifiant déclaré depuis
 *                            `Deno.env.get('…KEY|SECRET|TOKEN')`, ou sur une ligne qui lit
 *                            `service_role_key` : le nom de la variable ne trahit plus rien,
 *                            sa provenance si.
 *   · `sous-chaine`        — `.startsWith/.endsWith/.includes/.indexOf` appliqué à un gabarit
 *                            `Bearer ${…}` ou à un secret : pire qu'une égalité, un préfixe
 *                            du secret suffit.
 *   · `helper-local`       — une définition locale de `safeEqual`, `constantTimeEqual`,
 *                            `timingSafeEqual` ou `secureCompare`. La comparaison y est à
 *                            temps constant, mais la SOURCE du secret y est choisie à la main
 *                            (l'env seul, ou `app_config` seul) : c'est ce qui rendait la
 *                            moitié des gardes dépendante de la coïncidence des deux clés
 *                            (docs/audits/2026-08-04-blast-radius-service-role.md §4.3).
 *   · `role-sans-allowlist`— `role ==/!= 'super_admin'` ou `.eq('role', 'super_admin')` dans
 *                            une source qui n'appelle ni `requireSuperAdmin(` ni la RPC
 *                            `super_admin_allowlist_match`. Le rôle seul se pose en base ;
 *                            l'allowlist lit l'e-mail d'authentification, que le titulaire ne
 *                            choisit pas.
 *
 * ⚠ LIMITES CONNUES — c'est une lecture par motifs, pas une analyse de flux. Elle attrape
 * les idiomes qui se sont RÉELLEMENT produits dans ce dépôt, pas toutes les formes
 * possibles. Ne sont PAS vus :
 *   · une comparaison coupée sur deux lignes, ou masquée derrière une parenthèse
 *     (`(Deno.env.get('X_SECRET') ?? '') === h`) ;
 *   · un secret passé en PARAMÈTRE à une fonction qui compare, ou obtenu par
 *     déstructuration (`const { data: cfg } = …`) ;
 *   · une teinte par réaffectation (`x = Deno.env.get(…)` sans `const`/`let`) ;
 *   · une garde APPELÉE mais dont le résultat est ignoré (`await isServiceSecret(admin, req)`
 *     sans `if`) : elle passe ici comme dans `check-edge-auth.mjs`.
 * Une chaîne ou un gabarit contenant un guillemet dans un littéral d'expression régulière
 * peut dérégler le blanchiment ; les chaînes simples s'arrêtent en fin de ligne pour borner
 * l'effet. Le banc est `tests/unit/edge-secret-compare.spec.ts`.
 */

import { sansCommentaires } from './wa-outbound-purpose.mjs';

/** Les cinq règles, dans l'ordre de l'en-tête. */
export const REGLES = [
  'egalite-brute',
  'egalite-teintee',
  'sous-chaine',
  'helper-local',
  'role-sans-allowlist',
];

/**
 * Définitions locales à temps constant TOLÉRÉES, par chemin ET par nom.
 *
 * Trois sont les implémentations légitimes de `_shared/` — celle de `isServiceSecret`, et
 * les deux vérifications de signature de webhook, dont le secret n'est pas la clé de service.
 * Les sept autres sont les copies locales d'avant S8 : elles comparent à temps constant, mais
 * à UNE seule source de secret. Leur migration vers `isServiceSecret` est un chantier séparé
 * (la « phase 2 » du plan S8, non livrée ici) ; en attendant, chacune est nommée ici plutôt
 * que couverte par une exemption de répertoire — une copie NOUVELLE, même dans `_shared/`,
 * rougit.
 *
 * ⛔ CLIQUET : `check-edge-auth.mjs` fait rougir une entrée dont le fichier ne définit plus
 * le helper. Une exemption qui survit à son motif couvrirait la prochaine réintroduction.
 */
export const HELPERS_LOCAUX_TOLERES = Object.freeze([
  ['supabase/functions/_shared/require-service-secret.ts', 'safeEqual'],
  ['supabase/functions/_shared/esign-gateway.ts', 'timingSafeEqual'],
  ['supabase/functions/_shared/whatsapp-gateway.ts', 'constantTimeEqual'],
  ['supabase/functions/whatsapp-process/index.ts', 'safeEqual'],
  ['supabase/functions/whatsapp-agent-async/index.ts', 'safeEqual'],
  ['supabase/functions/whatsapp-morning-brief/index.ts', 'safeEqual'],
  ['supabase/functions/learn-agent-style/index.ts', 'safeEqual'],
  ['supabase/functions/weekly-digest/index.ts', 'safeEqual'],
  ['supabase/functions/agency-verification-notify/index.ts', 'safeEqual'],
  ['supabase/functions/agency-verification-run/index.ts', 'safeEqual'],
].map((e) => Object.freeze(e)));

/** Opérateur d'égalité, sans confondre `=>`, `<=`, `>=` ni une affectation. */
const EGAL = String.raw`(?<![=!<>])(?:===|!==|==|!=)(?!=)`;

/** Identifiants qui NOMMENT un secret dans ce dépôt (sensible à la casse, à dessein). */
const IDENT_SECRET = String.raw`(?:serviceRoleKey|SERVICE_ROLE_KEY|service_role_key|svcKey|serviceKey|envKey|expectedKey|expectedSecret|expectedCronSecret|cronSecret|CRON_SECRET|[A-Z][A-Z0-9_]*_SECRET)`;

/** Noms des helpers à temps constant qu'on ne doit plus recopier. */
const NOMS_HELPERS = String.raw`(?:safeEqual|constantTimeEqual|timingSafeEqual|secureCompare)`;

const SOUS_CHAINE = String.raw`\.(?:startsWith|endsWith|includes|indexOf)\(`;

/** Gabarit `Bearer ${…}` complet — le jeton attendu reconstruit à la main. */
const GABARIT_BEARER = String.raw`\`Bearer \$\{[^\`]*\``;

/** Nom de variable d'environnement qui porte un secret. */
const NOM_ENV_SECRET = String.raw`['"\`][A-Z0-9_]*(?:KEY|SECRET)['"\`]`;
const NOM_ENV_TEINTE = String.raw`['"\`][A-Z0-9_]*(?:KEY|SECRET|TOKEN)['"\`]`;

/**
 * L'autre membre est un témoin de PRÉSENCE, pas un secret : chaîne vide, `null`,
 * `undefined`, nombre. `serviceRoleKey !== ''` vérifie qu'une clé est posée, il ne la compare
 * à rien que l'appelant contrôle.
 */
const TEMOIN_APRES = /^\s*(?:''|""|``|null\b|undefined\b|-?\d)/;
const TEMOIN_AVANT = /(?:''|""|``|\bnull|\bundefined|\d)\s*$/;
const TYPEOF_AVANT = /\btypeof\s+(?:[\w$]+\??\.)*$/;
const LONGUEUR_APRES = /^\s*\??\.\s*length\b/;

const echapper = (s) => s.replace(/[$]/g, '\\$');

/** Fin d'une chaîne simple ouverte en `i`, -1 si elle ne se referme pas sur la même ligne. */
function finChaineSimple(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === '\n') return -1;
    if (src[j] === q) return j;
  }
  return -1;
}

/** Fin d'un gabarit ouvert en `i` (les gabarits imbriqués dans `${…}` ne sont pas suivis). */
function finGabarit(src, i) {
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === '`') return j;
  }
  return -1;
}

/**
 * Contenu des chaînes `'…'` et `"…"` blanchi, guillemets et longueur conservés ; gabarits
 * INTACTS (la règle `Bearer ${…}` les lit). Sans ce blanchiment, `.eq('key',
 * 'service_role_key')` ferait d'un NOM de clé de configuration un secret comparé.
 */
function sansChaines(code) {
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "'" || c === '"') {
      const f = finChaineSimple(code, i);
      if (f < 0) { out += c; continue; }
      out += c + code.slice(i + 1, f).replace(/[^\n]/g, ' ') + c;
      i = f;
      continue;
    }
    if (c === '`') {
      const f = finGabarit(code, i);
      if (f < 0) { out += code.slice(i); break; }
      out += code.slice(i, f + 1);
      i = f;
      continue;
    }
    out += c;
  }
  return out;
}

const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;

/** Normalise un chemin (séparateurs Windows, `./` initial) pour la comparaison de suffixe. */
const normaliser = (chemin) => String(chemin ?? '').replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * La source APPELLE-t-elle `nom(` en dehors des commentaires ? Un import ou une mention en
 * prose ne garde rien : c'est le défaut que l'ancienne détection `source.includes(nom)`
 * laissait passer.
 */
export function appelle(source, nom) {
  return new RegExp(String.raw`(?<![\w$])${echapper(nom)}\s*\(`).test(sansChaines(sansCommentaires(String(source ?? ''))));
}

/** Noms des helpers à temps constant DÉFINIS dans la source (commentaires exclus). */
export function helpersLocauxDefinis(source) {
  const code = sansChaines(sansCommentaires(String(source ?? '')));
  const noms = new Set();
  const re = new RegExp(
    String.raw`\bfunction\s*\*?\s*(${NOMS_HELPERS})\s*\(|\b(?:const|let|var)\s+(${NOMS_HELPERS})\s*=`,
    'g',
  );
  for (const m of code.matchAll(re)) noms.add(m[1] ?? m[2]);
  return [...noms];
}

/** Identifiants teintés : déclarés depuis l'env d'un secret, ou sur une ligne qui lit `service_role_key`. */
function identifiantsTeintes(code) {
  const teintes = new Set();
  const depuisEnv = new RegExp(
    String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*\(?\s*Deno\.env\.get\(\s*${NOM_ENV_TEINTE}\s*\)`,
    'g',
  );
  for (const m of code.matchAll(depuisEnv)) teintes.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b[^\n;]*\bservice_role_key\b/g)) {
    teintes.add(m[1]);
  }
  return teintes;
}

/**
 * Toutes les comparaisons suspectes d'une source d'edge function.
 *
 * `chemin` ne sert qu'à la règle `helper-local` : une définition n'est tolérée que si le
 * couple (chemin, nom) figure dans `HELPERS_LOCAUX_TOLERES`. Sans chemin, aucune ne l'est.
 *
 * @param {string} source contenu du fichier
 * @param {{ chemin?: string }} [options]
 * @returns {{ ligne: number, regle: string, texte: string }[]} triés par ligne
 */
export function trouverComparaisonsSecretes(source, { chemin = '' } = {}) {
  const brut = String(source ?? '');
  const code = sansCommentaires(brut); // chaînes conservées : 'super_admin', noms d'env
  const nu = sansChaines(code);        // chaînes blanchies : identifiants et gabarits seuls
  const lignes = brut.split('\n');
  const hits = new Map();

  const noter = (texte, index, regle) => {
    const ligne = ligneDe(texte, index);
    const cle = `${ligne}:${regle}`;
    if (hits.has(cle)) return;
    hits.set(cle, { ligne, regle, texte: (lignes[ligne - 1] ?? '').trim().slice(0, 160) });
  };

  /**
   * `ident ⟂ …` et `… ⟂ ident` : l'égalité est notée sauf si l'autre membre est un témoin
   * de présence, si l'identifiant est lu par `typeof`, ou si c'est sa `.length` qui est
   * comparée.
   */
  const egalites = (texte, ident, regle, { propriete = true } = {}) => {
    const avantIdent = propriete ? String.raw`\b` : String.raw`(?<![\w$.])`;
    const gauche = new RegExp(String.raw`${avantIdent}(${ident})\b(?!\s*\??\.\s*length\b)(\s*)(${EGAL})`, 'g');
    for (const m of texte.matchAll(gauche)) {
      const avant = texte.slice(Math.max(0, m.index - 80), m.index);
      const apres = texte.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (TYPEOF_AVANT.test(avant) || TEMOIN_APRES.test(apres)) continue;
      noter(texte, m.index, regle);
    }
    const droite = new RegExp(String.raw`(${EGAL})\s*((?:[A-Za-z_$][\w$]*\??\.)*)(${ident})\b`, 'g');
    for (const m of texte.matchAll(droite)) {
      if (!propriete && m[2]) continue; // `link.token !== token` : `link.token` n'est pas la variable teintée
      const avant = texte.slice(Math.max(0, m.index - 80), m.index);
      const apres = texte.slice(m.index + m[0].length, m.index + m[0].length + 20);
      if (TEMOIN_AVANT.test(avant) || LONGUEUR_APRES.test(apres)) continue;
      noter(texte, m.index, regle);
    }
  };

  // ── (a) égalité brute ────────────────────────────────────────────────────
  for (const m of nu.matchAll(new RegExp(String.raw`${EGAL}\s*${GABARIT_BEARER}|${GABARIT_BEARER}\s*${EGAL}`, 'g'))) {
    noter(nu, m.index, 'egalite-brute');
  }
  egalites(nu, IDENT_SECRET, 'egalite-brute');
  const envSurPlace = new RegExp(
    String.raw`(${EGAL})\s*Deno\.env\.get\(\s*${NOM_ENV_SECRET}\s*\)|Deno\.env\.get\(\s*${NOM_ENV_SECRET}\s*\)\s*(${EGAL})`,
    'g',
  );
  for (const m of code.matchAll(envSurPlace)) {
    const avant = code.slice(Math.max(0, m.index - 80), m.index);
    const apres = code.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (m[1] && TEMOIN_AVANT.test(avant)) continue;
    if (m[2] && TEMOIN_APRES.test(apres)) continue;
    noter(code, m.index, 'egalite-brute');
  }

  // ── (b) égalité sur une valeur teintée ───────────────────────────────────
  const teintes = identifiantsTeintes(code);
  if (teintes.size) {
    const alt = `(?:${[...teintes].map(echapper).join('|')})`;
    egalites(nu, alt, 'egalite-teintee', { propriete: false });
  }

  // ── (c) comparaison par sous-chaîne ──────────────────────────────────────
  const secretsOuTeintes = teintes.size
    ? `(?:${IDENT_SECRET}|${[...teintes].map(echapper).join('|')})`
    : IDENT_SECRET;
  const sousChaine = new RegExp(
    String.raw`${SOUS_CHAINE}\s*${GABARIT_BEARER}` +
      String.raw`|${SOUS_CHAINE}\s*(?:[A-Za-z_$][\w$]*\??\.)*${secretsOuTeintes}\b(?!\s*\??\.\s*length\b)` +
      // Le secret lui-même comme receveur — sauf devant un LITTÉRAL : `svcKey.startsWith('sb_secret_')`
      // vérifie un FORMAT de clé, il ne compare rien que l'appelant fournisse.
      String.raw`|(?<![\w$.])${secretsOuTeintes}\s*\??${SOUS_CHAINE}(?!\s*['"])`,
    'g',
  );
  for (const m of nu.matchAll(sousChaine)) noter(nu, m.index, 'sous-chaine');

  // ── (d) helper local à temps constant ────────────────────────────────────
  const cheminNormalise = normaliser(chemin);
  const tolere = (nom) =>
    cheminNormalise !== '' &&
    HELPERS_LOCAUX_TOLERES.some(([c, n]) => n === nom && (cheminNormalise === c || cheminNormalise.endsWith(`/${c}`)));
  const definitions = new RegExp(
    String.raw`\bfunction\s*\*?\s*(${NOMS_HELPERS})\s*\(|\b(?:const|let|var)\s+(${NOMS_HELPERS})\s*=`,
    'g',
  );
  for (const m of nu.matchAll(definitions)) {
    if (tolere(m[1] ?? m[2])) continue;
    noter(nu, m.index, 'helper-local');
  }

  // ── (e) rôle super_admin sans allowlist ──────────────────────────────────
  // Même lecture d'un APPEL que `appelle` ; la RPC, elle, se nomme dans une chaîne.
  const allowlistee =
    /(?<![\w$])requireSuperAdmin\s*\(/.test(nu) || /\bsuper_admin_allowlist_match\b/.test(code);
  if (!allowlistee) {
    const role = new RegExp(
      String.raw`\brole\b\s*${EGAL}\s*['"\`]super_admin['"\`]` +
        String.raw`|['"\`]super_admin['"\`]\s*${EGAL}\s*(?:[A-Za-z_$][\w$]*\??\.)*role\b` +
        String.raw`|\.eq\(\s*['"\`]role['"\`]\s*,\s*['"\`]super_admin['"\`]\s*\)`,
      'g',
    );
    for (const m of code.matchAll(role)) noter(code, m.index, 'role-sans-allowlist');
  }

  return [...hits.values()].sort((a, b) => a.ligne - b.ligne || REGLES.indexOf(a.regle) - REGLES.indexOf(b.regle));
}
