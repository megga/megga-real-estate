/**
 * Ordre GARDE → EFFET, et périmètre des EXPÉDITEURS d'e-mail — le lecteur des passes « ordre »
 * et « expéditeurs » de `check-edge-auth.mjs`.
 *
 * POURQUOI. Audit du 13.09.2026, point S17. Les 88 edge functions sont déployées sans
 * vérification de JWT par la passerelle : chaque fonction porte sa garde, et la porte
 * `lint:edge-auth` vérifiait qu'un symbole de garde était PRÉSENT — pas qu'il s'exécutait
 * AVANT ce qu'il protège, ni ce qu'il laissait passer. Deux constats du même audit en sont
 * nés : S1, un relais e-mail ouvert derrière une garde bien présente (elle authentifiait
 * l'appelant, rien ne bornait le destinataire), et S8, des secrets comparés par `===`.
 * Ce module lit donc l'ORDRE d'exécution et l'INVENTAIRE des envois.
 *
 * CE QU'IL LIT.
 *   · Le GESTIONNAIRE : le corps de la fonction passée à `serve(` / `Deno.serve(`. Le code
 *     écrit au-dessus ne s'exécute pas avant la garde — il ne s'exécute qu'appelé.
 *   · Les fonctions NOMMÉES (`function f`, `const f = (…) =>`), où qu'elles soient : leur
 *     corps est retiré du balayage linéaire et DÉROULÉ à chaque appel (ou passage par nom,
 *     `rows.map(f)`) ; les imports de `_shared/` sont résolus et déroulés de même, sur
 *     autant de modules que la chaîne en traverse. Un appel qui garde avant d'écrire est
 *     une garde ; un appel qui écrit d'abord est un effet, rapporté au site de l'appel.
 *   · Les GARDES : l'appel d'une garde partagée, ou un marqueur sur mesure (vérification
 *     d'un jeton ou d'une signature) que la porte nomme par fonction.
 *   · Les EFFETS (`TYPES_EFFET`) :
 *       ecriture       `.insert/.upsert/.update/.delete(` sur une requête — `.from(` dans la
 *                      chaîne du receveur, ou un identifiant qui en porte une ;
 *       stockage       `.upload/.remove/.move/.copy/.update/.delete(` sur `storage` ;
 *       auth           tout `auth.admin.*(` qui n'est ni `get…` ni `list…` ;
 *       rpc            TOUT `.rpc(`, sauf les lectures nommées par la porte — et la porte
 *                      vérifie leur volatilité dans les migrations (`volatilitesSql`) : une
 *                      fonction STABLE ou IMMUTABLE ne peut pas écrire, Postgres le refuse ;
 *                      un nom dynamique est un effet ;
 *       envoi-email    `fetch` vers `api.resend.com` (URL littérale, gabarit ou constante
 *                      du module), un canal NOMMÉ (boîte de l'agent), ou un envoi par GoTrue
 *                      (`inviteUserByEmail`, `resetPasswordForEmail`, `signInWithOtp`) ;
 *       envoi-whatsapp `fetch` vers `graph.facebook.com/…/messages` ou `api.twilio.com`, ou
 *                      le canal nommé qui porte l'appel HTTP à Meta ;
 *       invocation     `fetch` vers `/functions/v1/`, ou `functions.invoke(` — une autre
 *                      fonction, souvent appelée avec le secret de service.
 *   · Les EXPÉDITEURS : les canaux d'e-mail ATTEIGNABLES depuis le gestionnaire, et lequel
 *     vient d'abord, de la garde de périmètre (`guardOutboundEmail`) ou du premier envoi.
 *
 * ⚠ LIMITES CONNUES — c'est une lecture du TEXTE, pas une analyse de flot :
 *   · l'ordre est celui du texte : une garde écrite dans une branche compte pour la branche
 *     d'à côté, et une garde APPELÉE dont le résultat est ignoré ou décidé plus loin
 *     (`const ok = await isServiceSecret(…)` puis une écriture, puis `if (!ok)`) passe ;
 *   · une fonction ANONYME passée en argument est lue là où elle est écrite (on la suppose
 *     exécutée sur place) ; une méthode d'objet ou de classe, un appel dynamique
 *     (`obj[nom]()`), un helper reçu en paramètre ne sont pas suivis ;
 *   · une requête reçue en paramètre (`function f(q) { return q.delete() }`) n'est pas vue
 *     comme une écriture ; un client rangé dans une structure non plus ;
 *   · une URL d'envoi construite HORS du module (reçue en paramètre) n'est pas lue — d'où
 *     les canaux nommés ; les appels sortants génériques (Stripe, agendas, IA) ne sont pas
 *     des effets pour cette porte ;
 *   · volatilité SQL : la dernière définition par NOM l'emporte (surcharges confondues), et
 *     une fonction STABLE qui appellerait une fonction volatile n'est pas suivie ;
 *   · lexique : la barre oblique est tranchée par le jeton qui précède (regex ou division),
 *     et un gabarit imbriqué dans `${…}` est suivi, un littéral de regex dans un gabarit non.
 * Le banc est `tests/unit/edge-guard-order.spec.ts`.
 */

// ── Lexique ─────────────────────────────────────────────────────────────────

/** Mots après lesquels une barre oblique ouvre une expression régulière, pas une division. */
const MOTS_AVANT_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do',
  'else', 'yield', 'await',
]);

/** Ponctuations après lesquelles une barre oblique ouvre une expression régulière. */
const PONCTUATION_AVANT_REGEX = '(,=:[!&|?{};+-*%<>~^';

const OPERANDE = 'operande';

/**
 * Deux vues d'une source, de même longueur, sauts de ligne conservés :
 *   · `code`   — commentaires blanchis, chaînes intactes (on y lit un nom de RPC, une URL) ;
 *   · `masque` — commentaires ET contenu des chaînes, gabarits et regex blanchis ; les
 *                expressions `${…}` d'un gabarit y restent du code. C'est la vue où l'on
 *                compte les accolades et où l'on cherche les appels.
 *
 * ⛔ POURQUOI UN LEXIQUE ET PAS `sansCommentaires`. Compter des accolades exige de savoir
 * où finit une chaîne, un gabarit (dont les `${…}` contiennent du code, et des accolades) et
 * une expression régulière (`/[{}]/`, `/https?:\/\//`). Mesuré sur les 209 sources edge :
 * toutes équilibrées, après un seul correctif — `amount! / surface!` (assertion non nulle
 * puis division) se lisait comme une regex et déséquilibrait `_shared/copilot-actions.ts`.
 */
export function lexer(source) {
  const s = String(source ?? '');
  const n = s.length;
  const code = s.split('');
  const masque = s.split('');
  const blanchir = (vue, a, b) => {
    for (let k = a; k < b && k < n; k++) if (vue[k] !== '\n') vue[k] = ' ';
  };
  let prec = '';
  let precMot = '';
  const regexPossible = () =>
    prec === '' || PONCTUATION_AVANT_REGEX.includes(prec) || (prec === 'mot' && MOTS_AVANT_REGEX.has(precMot));

  function finChaine(i) {
    const q = s[i];
    for (let j = i + 1; j < n; j++) {
      if (s[j] === '\\') { j++; continue; }
      if (s[j] === q || s[j] === '\n') return j;
    }
    return n;
  }

  function finRegex(i) {
    let classe = false;
    for (let j = i + 1; j < n; j++) {
      const c = s[j];
      if (c === '\\') { j++; continue; }
      if (c === '\n') return -1;
      if (classe) { if (c === ']') classe = false; continue; }
      if (c === '[') { classe = true; continue; }
      if (c === '/') return j;
    }
    return -1;
  }

  function lireGabarit(i) {
    let debutTexte = i + 1;
    let j = i + 1;
    while (j < n) {
      const c = s[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') { blanchir(masque, debutTexte, j); return j + 1; }
      if (c === '$' && s[j + 1] === '{') {
        blanchir(masque, debutTexte, j);
        prec = '(';
        precMot = '';
        j = lireCode(j + 2, true);
        debutTexte = j;
        continue;
      }
      j++;
    }
    blanchir(masque, debutTexte, n);
    return n;
  }

  function lireCode(i, dansGabarit) {
    let prof = 0;
    while (i < n) {
      const c = s[i];
      if (c === '/' && s[i + 1] === '/') {
        const f = s.indexOf('\n', i);
        const j = f < 0 ? n : f;
        blanchir(code, i, j); blanchir(masque, i, j); i = j; continue;
      }
      if (c === '/' && s[i + 1] === '*') {
        const f = s.indexOf('*/', i + 2);
        const j = f < 0 ? n : f + 2;
        blanchir(code, i, j); blanchir(masque, i, j); i = j; continue;
      }
      if (c === "'" || c === '"') {
        const j = finChaine(i);
        blanchir(masque, i + 1, j);
        i = s[j] === c ? j + 1 : j;
        prec = OPERANDE; precMot = '';
        continue;
      }
      if (c === '`') {
        i = lireGabarit(i);
        prec = OPERANDE; precMot = '';
        continue;
      }
      if (c === '/' && regexPossible()) {
        const j = finRegex(i);
        if (j > 0) {
          blanchir(masque, i + 1, j);
          i = j + 1;
          while (i < n && /[a-z]/i.test(s[i])) i++;
          prec = OPERANDE; precMot = '';
          continue;
        }
      }
      if (dansGabarit) {
        if (c === '{') prof++;
        else if (c === '}') {
          if (prof === 0) return i + 1;
          prof--;
        }
      }
      if (/[\w$]/.test(c)) {
        let j = i;
        while (j < n && /[\w$]/.test(s[j])) j++;
        precMot = s.slice(i, j);
        prec = /^\d/.test(precMot) ? OPERANDE : 'mot';
        i = j;
        continue;
      }
      if (!/\s/.test(c)) {
        // `x!` (assertion non nulle de TypeScript) laisse une OPÉRANDE : `amount! / surface!`
        // est une division.
        const nonNul = c === '!' && /[\w$)\]]/.test(s[i - 1] ?? '') && s[i + 1] !== '=';
        prec = c === ')' || c === ']' || nonNul ? OPERANDE : c;
        precMot = '';
      }
      i++;
    }
    return n;
  }

  lireCode(0, false);
  return { code: code.join(''), masque: masque.join('') };
}

const OUVRANTS = { '(': ')', '[': ']', '{': '}' };
const FERMANTS = { ')': '(', ']': '[', '}': '{' };

/** Index du fermant qui équilibre l'ouvrant en `i` (sur le masque), -1 sinon. */
function finGroupe(masque, i) {
  const pile = [];
  for (let j = i; j < masque.length; j++) {
    const c = masque[j];
    if (OUVRANTS[c]) pile.push(c);
    else if (FERMANTS[c]) {
      if (pile.pop() !== FERMANTS[c]) return -1;
      if (pile.length === 0) return j;
    }
  }
  return -1;
}

/** Index de l'ouvrant qu'équilibre le fermant en `j`, -1 sinon. */
function debutGroupe(masque, j) {
  const pile = [];
  for (let k = j; k >= 0; k--) {
    const c = masque[k];
    if (FERMANTS[c]) pile.push(c);
    else if (OUVRANTS[c]) {
      if (OUVRANTS[c] !== pile.pop()) return -1;
      if (pile.length === 0) return k;
    }
  }
  return -1;
}

const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;

// ── Fonctions et gestionnaire ───────────────────────────────────────────────

/** Mots qui, dans une annotation de type, appellent un type à leur suite. */
const MOTS_DE_TYPE = new Set(['is', 'keyof', 'typeof', 'extends', 'infer', 'asserts', 'readonly', 'unique', 'in', 'as', 'new']);

/**
 * À partir de `i` (juste après la liste de paramètres), l'index de l'accolade qui ouvre le
 * corps d'une déclaration `function`, en sautant une annotation de retour — y compris un
 * type littéral `{ … }`, reconnu à sa position (juste après `:`, `|`, `&`, `,`). -1 pour
 * une signature de surcharge, qui n'a pas de corps.
 */
function accoladeDuCorps(masque, i) {
  let attendType = false;
  let j = i;
  while (j < masque.length) {
    const c = masque[j];
    if (/\s/.test(c)) { j++; continue; }
    if (c === ':' || c === '|' || c === '&' || c === ',' || c === '.' || c === '?') { attendType = true; j++; continue; }
    if (c === '{') {
      if (!attendType) return j;
      const f = finGroupe(masque, j);
      if (f < 0) return -1;
      j = f + 1;
      attendType = false;
      continue;
    }
    if (c === '(' || c === '[') {
      const f = finGroupe(masque, j);
      if (f < 0) return -1;
      j = f + 1;
      attendType = false;
      continue;
    }
    if (c === '<') {
      let prof = 0;
      for (; j < masque.length; j++) {
        if (masque[j] === '<') prof++;
        else if (masque[j] === '>') { prof--; if (prof === 0) break; }
      }
      j++;
      attendType = false;
      continue;
    }
    if (c === '=' && masque[j + 1] === '>') { attendType = true; j += 2; continue; }
    if (/[\w$]/.test(c)) {
      let k = j;
      while (k < masque.length && /[\w$]/.test(masque[k])) k++;
      const mot = masque.slice(j, k);
      // Un opérateur de type (`s is string`) appelle la suite ; un nom de type la termine ;
      // un mot qui SUIT un type complet n'en fait plus partie (`): Promise<X>` puis `export`).
      if (MOTS_DE_TYPE.has(mot)) attendType = true;
      else if (attendType) attendType = false;
      else return -1;
      j = k;
      continue;
    }
    return -1;
  }
  return -1;
}

/**
 * Un saut de ligne de profondeur 0 clôt-il l'instruction ? Non si la ligne finit sur un
 * opérateur, ou si la suivante commence par une continuation (`.`, `?`, `&&`, `+`…) — le
 * style sans point-virgule des edge functions ne laisse que ce critère.
 */
function finInstruction(masque, iSaut) {
  let a = iSaut - 1;
  while (a >= 0 && /[ \t\r]/.test(masque[a])) a--;
  if (a >= 0 && /[=+\-*/%&|^!?:,(<>.]/.test(masque[a])) return false;
  let b = iSaut + 1;
  while (b < masque.length && /\s/.test(masque[b])) b++;
  return !(b < masque.length && /[.?:&|+\-*/%=<>,)\]}]/.test(masque[b]));
}

/** Fin d'une expression commencée en `debut` : premier `,` `;` ou fermant de même profondeur, ou fin d'instruction. */
function finExpression(masque, debut, borne = masque.length) {
  let prof = 0;
  let j = debut;
  for (; j < borne; j++) {
    const c = masque[j];
    if (OUVRANTS[c]) prof++;
    else if (FERMANTS[c]) { if (prof === 0) break; prof--; }
    else if ((c === ',' || c === ';') && prof === 0) break;
    else if (c === '\n' && prof === 0 && finInstruction(masque, j)) break;
  }
  return j;
}

/** Corps d'une fonction fléchée dont la flèche est en `iFleche` : bloc (accolades exclues) ou expression. */
function corpsFleche(masque, iFleche, borne = masque.length) {
  let j = iFleche + 2;
  while (j < borne && /\s/.test(masque[j])) j++;
  if (masque[j] === '{') {
    const f = finGroupe(masque, j);
    return f < 0 ? null : [j + 1, f];
  }
  return [j, finExpression(masque, j, borne)];
}

/** `=>` de profondeur 0 dans `[a, b[`. */
function flecheDansIntervalle(masque, a, b) {
  let prof = 0;
  for (let j = a; j < b - 1; j++) {
    const c = masque[j];
    if (OUVRANTS[c]) prof++;
    else if (FERMANTS[c]) prof--;
    else if (prof === 0 && c === '=' && masque[j + 1] === '>') return j;
  }
  return -1;
}

/**
 * Fonctions NOMMÉES d'une source, où qu'elles soient déclarées — `function nom(…) {…}` et
 * `const|let|var nom = [async] (…) => …` / `= [async] function (…) {…}`. Une fonction
 * nommée ne s'exécute qu'appelée : son corps est retiré du balayage linéaire et relu à
 * chaque appel.
 *
 * @returns {{ nom: string, declaration: number, corps: [number, number] }[]}
 */
function fonctionsNommees(masque) {
  const out = [];
  for (const m of masque.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g)) {
    const p = m.index + m[0].length - 1;
    const fp = finGroupe(masque, p);
    if (fp < 0) continue;
    const acc = accoladeDuCorps(masque, fp + 1);
    if (acc < 0) continue;
    const f = finGroupe(masque, acc);
    if (f < 0) continue;
    out.push({ nom: m[1], declaration: m.index, corps: [acc + 1, f] });
  }
  const affectation = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=\s*(?:async\s+)?(?:(function)\b[^(]*\(|(\()|([A-Za-z_$][\w$]*)\s*=>)/g;
  for (const m of masque.matchAll(affectation)) {
    const [, nom, motFunction, parenthese, parametreSeul] = m;
    if (motFunction) {
      const p = m.index + m[0].length - 1;
      const fp = finGroupe(masque, p);
      if (fp < 0) continue;
      const acc = accoladeDuCorps(masque, fp + 1);
      if (acc < 0) continue;
      const f = finGroupe(masque, acc);
      if (f < 0) continue;
      out.push({ nom, declaration: m.index, corps: [acc + 1, f] });
    } else if (parenthese) {
      const p = m.index + m[0].length - 1;
      const fp = finGroupe(masque, p);
      if (fp < 0) continue;
      // `(…)` suivi d'une flèche, annotation de retour permise : une fonction. Sinon une
      // expression parenthésée ordinaire (`const x = (a + b)`), qu'on ignore.
      let j = fp + 1;
      while (j < masque.length && /\s/.test(masque[j])) j++;
      let fleche = -1;
      if (masque[j] === '=' && masque[j + 1] === '>') fleche = j;
      else if (masque[j] === ':') {
        const f2 = masque.indexOf('=>', j);
        if (f2 > 0 && !/[;\n]\s*(?:const|let|var|function|return)\b/.test(masque.slice(j, f2))) fleche = f2;
      }
      if (fleche < 0) continue;
      const corps = corpsFleche(masque, fleche);
      if (corps) out.push({ nom, declaration: m.index, corps });
    } else if (parametreSeul) {
      const fleche = masque.indexOf('=>', m.index + m[0].length - 2);
      const corps = corpsFleche(masque, fleche);
      if (corps) out.push({ nom, declaration: m.index, corps });
    }
  }
  return out.sort((a, b) => a.corps[0] - b.corps[0]);
}

/**
 * Le corps du gestionnaire passé à `serve(` / `Deno.serve(` : `{ debut, fin }` (accolades
 * exclues), ou `null` si l'appel est absent, multiple, ou d'une forme qu'on ne sait pas
 * lire — la porte refuse alors plutôt que de conclure sur rien. Formes lues : fonction
 * fléchée ou `function` écrite sur place, ou le nom d'une fonction du module.
 */
export function corpsGestionnaire(masque, fonctions = fonctionsNommees(masque)) {
  const appels = [...masque.matchAll(/(?:\bDeno\s*\.\s*serve|(?<![\w$.])serve)\s*\(/g)];
  if (appels.length !== 1) return null;
  const ouvrante = appels[0].index + appels[0][0].length - 1;
  const fermante = finGroupe(masque, ouvrante);
  if (fermante < 0) return null;
  const debutArg = ouvrante + 1;
  const fleche = flecheDansIntervalle(masque, debutArg, fermante);
  if (fleche >= 0) {
    const corps = corpsFleche(masque, fleche, fermante);
    return corps ? { debut: corps[0], fin: corps[1] } : null;
  }
  const arg = masque.slice(debutArg, fermante);
  const fn = /^\s*(?:async\s+)?function\b[^(]*\(/.exec(arg);
  if (fn) {
    const p = debutArg + fn.index + fn[0].length - 1;
    const fp = finGroupe(masque, p);
    const acc = fp < 0 ? -1 : accoladeDuCorps(masque, fp + 1);
    const f = acc < 0 ? -1 : finGroupe(masque, acc);
    return f < 0 ? null : { debut: acc + 1, fin: f };
  }
  const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(arg);
  if (ident) {
    const cible = fonctions.find((f) => f.nom === ident[1]);
    return cible ? { debut: cible.corps[0], fin: cible.corps[1] } : null;
  }
  return null;
}

// ── Modules lus ─────────────────────────────────────────────────────────────

/** Chemin posix, sans `./` initial — la clé d'un module. */
const normaliser = (chemin) => String(chemin ?? '').replace(/\\/g, '/').replace(/^\.\//, '');

/** `from '../_shared/x.ts'` résolu depuis le fichier qui importe. */
function resoudre(depuis, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = normaliser(depuis).split('/').slice(0, -1);
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') base.pop();
    else base.push(seg);
  }
  return base.join('/');
}

/** Imports d'un module LOCAL : nom local → `{ module, nom }` exporté. */
function importsLocaux(code, chemin) {
  const out = new Map();
  const re = /\bimport\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+([A-Za-z_$][\w$]*))?\s*from\s*(['"])([^'"\n]+)\4/g;
  for (const m of code.matchAll(re)) {
    const module = resoudre(chemin, m[5]);
    if (!module) continue;
    for (const part of (m[2] ?? '').split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (!p) continue;
      const [exporte, local] = p.split(/\s+as\s+/).map((x) => x.trim());
      out.set(local ?? exporte, { module, nom: exporte });
    }
  }
  return out;
}

/** `const NOM = '…'` (ou gabarit d'une ligne) : nom → valeurs, pour lire l'URL d'un `fetch(NOM)`. */
function constantesTexte(code) {
  const out = new Map();
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(['"`])((?:\\.|(?!\2)[^\\\n])*)\2/g)) {
    out.set(m[1], [...(out.get(m[1]) ?? []), m[3]]);
  }
  return out;
}

/**
 * Une source lue une fois : ses deux vues, ses fonctions nommées (exportées ou non), ses
 * imports locaux, ses constantes texte.
 */
export function lireModule(source, chemin) {
  const { code, masque } = lexer(source);
  const fonctions = fonctionsNommees(masque).map((f) => ({
    ...f,
    exportee: /\bexport\s+(?:default\s+)?(?:async\s+)?$/.test(masque.slice(Math.max(0, f.declaration - 40), f.declaration)),
  }));
  return {
    chemin: normaliser(chemin),
    source: String(source ?? ''),
    code,
    masque,
    fonctions,
    imports: importsLocaux(code, chemin),
    constantes: constantesTexte(code),
  };
}

// ── Sites : gardes, effets, appels ──────────────────────────────────────────

/** Les types d'effet, dans l'ordre de l'en-tête. */
export const TYPES_EFFET = Object.freeze([
  'ecriture', 'stockage', 'auth', 'rpc', 'envoi-email', 'envoi-whatsapp', 'invocation',
]);

/**
 * Primitives d'ENVOI dont l'URL ne se lit pas au site d'appel (construite ailleurs, ou passée
 * à un helper générique) : un appel qui les atteint est un envoi, sans les dérouler. Elles
 * complètent les motifs d'URL de `sitesDuModule`, et `check-edge-auth.mjs` vérifie à chaque
 * passage que chacune existe encore et porte encore son appel d'envoi (`canalNommePerime`) —
 * un canal renommé que la lecture ne suivrait plus rendrait ses expéditeurs invisibles.
 */
export const CANAUX_NOMMES = Object.freeze([
  // Le SEUL appel HTTP vers Meta : `sendOutboundGuarded` y aboutit, et
  // check-whatsapp-outbound.mjs interdit de construire une requête ailleurs.
  { module: 'supabase/functions/_shared/whatsapp-retry.ts', nom: 'sendWithRetry', type: 'envoi-whatsapp', marqueur: 'doFetch(' },
  // La boîte de l'AGENT (Messagerie, D10) : Gmail `messages.send`, Graph `…/send`.
  { module: 'supabase/functions/_shared/mail/gmail.ts', nom: 'gmailSend', type: 'envoi-email', canal: 'boite', marqueur: "'/messages/send'" },
  { module: 'supabase/functions/_shared/mail/graph.ts', nom: 'graphSend', type: 'envoi-email', canal: 'boite', marqueur: '/send`' },
].map((c) => Object.freeze(c)));

/** Mots suivis d'une parenthèse qui ne sont pas des appels. */
const MOTS_CLES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'await', 'new',
  'super', 'import', 'async', 'void', 'delete', 'throw', 'in', 'of', 'do', 'else', 'case',
]);

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Receveur d'un appel de méthode dont le point est en `iPoint`, lu à reculons sur le
 * masque : `admin.from('t')` pour `admin.from('t').insert(`, groupes, membres, `?.` et `!`
 * compris, sur autant de lignes que la chaîne en couvre. Rend l'index de son début.
 */
function receveur(masque, iPoint) {
  let j = iPoint - 1;
  if (masque[j] === '?') j--;
  let debut = iPoint;
  for (;;) {
    while (j >= 0 && /\s/.test(masque[j])) j--;
    if (j < 0) break;
    const c = masque[j];
    if (c === '!') { j--; continue; }
    if (c === ')' || c === ']') {
      const o = debutGroupe(masque, j);
      if (o < 0) break;
      debut = o;
      j = o - 1;
      continue;
    }
    if (/[\w$]/.test(c)) {
      let k = j;
      while (k >= 0 && /[\w$]/.test(masque[k])) k--;
      debut = k + 1;
      let t = k;
      while (t >= 0 && /\s/.test(masque[t])) t--;
      if (t >= 0 && masque[t] === '.') {
        j = t - 1;
        if (j >= 0 && masque[j] === '?') j--;
        continue;
      }
      break;
    }
    break;
  }
  return debut;
}

/** Identifiants qui portent un constructeur de requête (`let q = admin.from('t')…`). */
function requetesNommees(masque) {
  const out = new Set();
  for (const m of masque.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=(?![=>])/g)) {
    const debut = m.index + m[0].length;
    if (/\.\s*from\s*\(/.test(masque.slice(debut, finExpression(masque, debut)))) out.add(m[1]);
  }
  return out;
}

/** Premier argument chaîne d'un appel dont la parenthèse ouvrante est en `p` (vue `code`). */
function premiereChaine(code, p) {
  const m = /^\s*(['"`])([^'"`\n]*)\1/.exec(code.slice(p + 1, p + 200));
  return m ? m[2] : null;
}

/** Texte (vue `code`) du premier argument de l'appel ouvert en `p`, constantes du module résolues. */
function premierArgument(mod, p) {
  const f = finGroupe(mod.masque, p);
  if (f < 0) return '';
  let prof = 0;
  let fin = f;
  for (let j = p + 1; j < f; j++) {
    const c = mod.masque[j];
    if (OUVRANTS[c]) prof++;
    else if (FERMANTS[c]) prof--;
    else if (c === ',' && prof === 0) { fin = j; break; }
  }
  const brut = mod.code.slice(p + 1, fin).trim();
  if (/^[A-Za-z_$][\w$]*$/.test(brut)) return (mod.constantes.get(brut) ?? []).join(' ');
  return brut.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (tout, nom) => (mod.constantes.get(nom) ?? [tout]).join(' '));
}

/** À index égal : la garde, puis le périmètre, puis l'appel, puis l'effet. */
const RANG = { garde: 0, perimetre: 1, appel: 2, effet: 3 };
const parOrdre = (x, y) => x.index - y.index || RANG[x.genre] - RANG[y.genre];

/**
 * Sites d'une source, dans l'ordre du texte : appels de garde, garde de périmètre, appels
 * (candidats à une résolution locale ou `_shared`) et effets. Calculés une fois par module.
 */
function sitesDuModule(mod, { gardes, rpcLecture }) {
  const { code, masque } = mod;
  const requetes = requetesNommees(masque);
  // Les listes d'import et d'export NOMMENT des fonctions sans les appeler : `{ a, b, c }`
  // ressemble à trois passages par nom. Mesuré à la première exécution : 29 « effets au
  // chargement », tous des lignes d'import.
  const declaratifs = [
    ...code.matchAll(/\bimport\s+(?:type\s+)?(?:[\w$]+\s*,?\s*)?(?:\{[^}]*\}|\*\s+as\s+[\w$]+)?\s*from\s*(['"])[^'"\n]+\1/g),
    ...code.matchAll(/\bexport\s+(?:type\s+)?\{[^}]*\}/g),
  ].map((m) => [m.index, m.index + m[0].length]);
  const sites = [];
  const pousser = (site) => {
    if (!declaratifs.some(([a, b]) => site.index >= a && site.index < b)) sites.push(site);
  };

  for (const g of gardes) {
    for (const m of masque.matchAll(new RegExp(String.raw`(?<![\w$])${echapper(g)}\s*\(`, 'g'))) {
      pousser({ genre: 'garde', type: g, index: m.index });
    }
  }
  for (const m of masque.matchAll(/(?<![\w$])guardOutboundEmail\s*\(/g)) {
    pousser({ genre: 'perimetre', type: 'guardOutboundEmail', index: m.index });
  }

  // Arguments de type permis, collés au nom (`gcall<{ id: string }>(…)` dans les adaptateurs
  // de messagerie) : sans eux l'appel passait inaperçu. Collés seulement — `a < b > (c)` est
  // une comparaison.
  for (const m of masque.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*\(/g)) {
    if (MOTS_CLES.has(m[1]) || gardes.includes(m[1])) continue;
    if (/\bfunction\s*\*?\s*$/.test(masque.slice(Math.max(0, m.index - 16), m.index))) continue;
    pousser({ genre: 'appel', nom: m[1], index: m.index });
  }
  // Une fonction PASSÉE par son nom (`rows.map(envoyer)`) s'exécute là où elle est passée.
  for (const m of masque.matchAll(/([(,]\s*)([A-Za-z_$][\w$]*)(?=\s*[,)])/g)) {
    pousser({ genre: 'appel', nom: m[2], index: m.index + m[1].length, reference: true });
  }

  // Écritures de table et de stockage : la MÉTHODE ne suffit pas (`cache.delete(k)`,
  // `hash.update(b)`) — il faut que le receveur soit une requête (`.from(` dans sa chaîne,
  // ou un identifiant qui en porte une) ou le stockage.
  for (const m of masque.matchAll(/\.\s*(insert|upsert|update|delete|upload|remove|move|copy)\s*\(/g)) {
    const debut = receveur(masque, m.index);
    const chaine = masque.slice(debut, m.index);
    const tete = /^[\s(]*(?:await\s+)?([A-Za-z_$][\w$]*)/.exec(chaine)?.[1] ?? '';
    const table = /\.\s*from\s*\(\s*(['"`])([^'"`\n]*)\1/.exec(code.slice(debut, m.index))?.[2];
    if (/\bstorage\b/.test(chaine)) {
      pousser({ genre: 'effet', type: 'stockage', index: m.index, detail: `storage${table ? `(${table})` : ''}.${m[1]}` });
    } else if (['insert', 'upsert', 'update', 'delete'].includes(m[1]) && (/\.\s*from\s*\(/.test(chaine) || requetes.has(tete))) {
      pousser({ genre: 'effet', type: 'ecriture', index: m.index, detail: `${table ?? tete}.${m[1]}` });
    }
  }

  // Comptes d'authentification : tout `auth.admin.*` qui n'est pas une lecture. Et les
  // e-mails que GoTrue envoie lui-même, qui sont des envois comme les autres.
  for (const m of masque.matchAll(/\bauth\s*\.\s*admin\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!/^(?:get|list)/.test(m[1])) pousser({ genre: 'effet', type: 'auth', index: m.index, detail: `auth.admin.${m[1]}` });
  }
  for (const m of masque.matchAll(/\bauth\s*\.\s*(?:admin\s*\.\s*)?(inviteUserByEmail|resetPasswordForEmail|signInWithOtp)\s*\(/g)) {
    pousser({ genre: 'effet', type: 'envoi-email', canal: 'auth', index: m.index, detail: `auth.${m[1]}` });
  }

  // RPC : un effet, sauf les lectures NOMMÉES (dont la porte vérifie la volatilité).
  for (const m of masque.matchAll(/\.\s*rpc\s*\(/g)) {
    const nom = premiereChaine(code, m.index + m[0].length - 1);
    if (nom && rpcLecture.has(nom)) continue;
    pousser({ genre: 'effet', type: 'rpc', index: m.index, detail: nom ?? '(nom dynamique)' });
  }

  // Envois et invocations, lus sur l'URL du `fetch` (constantes du module résolues).
  for (const m of masque.matchAll(/(?<![\w$.])fetch\s*\(/g)) {
    const p = m.index + m[0].length - 1;
    const url = premierArgument(mod, p);
    const args = code.slice(p, finGroupe(masque, p) + 1);
    if (/api\.resend\.com/.test(url)) {
      pousser({ genre: 'effet', type: 'envoi-email', canal: 'resend', index: m.index, detail: 'api.resend.com' });
    } else if (/api\.twilio\.com/.test(url) || (/graph\.facebook\.com/.test(url) && (/\/messages\b/.test(url) || /method\s*:\s*['"`]POST/.test(args)))) {
      pousser({ genre: 'effet', type: 'envoi-whatsapp', index: m.index, detail: /twilio/.test(url) ? 'api.twilio.com' : 'graph.facebook.com' });
    } else if (/\/functions\/v1\//.test(url)) {
      pousser({ genre: 'effet', type: 'invocation', index: m.index, detail: /\/functions\/v1\/([\w-]+)/.exec(url)?.[1] ?? 'edge' });
    }
  }
  for (const m of masque.matchAll(/\bfunctions\s*\.\s*invoke\s*\(/g)) {
    pousser({ genre: 'effet', type: 'invocation', index: m.index, detail: premiereChaine(code, m.index + m[0].length - 1) ?? 'edge' });
  }

  return sites.sort(parOrdre);
}

// ── Analyse ─────────────────────────────────────────────────────────────────

/** Nombre d'effets rapportés avant la première garde — au-delà, le constat est fait. */
const EFFETS_RAPPORTES = 5;

/**
 * Analyse d'un ensemble de modules (les `index.ts` ET `_shared/**`), qui se lisent les uns
 * les autres par leurs imports.
 *
 * @param {Map<string, ReturnType<typeof lireModule>>} modules chemin normalisé → module lu
 * @param {{
 *   gardes: string[],
 *   rpcLecture?: Iterable<string>,
 *   canauxNommes?: { module: string, nom: string, type: string, canal?: string, marqueur: string }[],
 * }} regles
 */
export function creerAnalyse(modules, { gardes, rpcLecture = [], canauxNommes = [] }) {
  const reglesSites = { gardes: [...gardes], rpcLecture: new Set(rpcLecture) };
  const nommes = new Map(canauxNommes.map((c) => [`${normaliser(c.module)}#${c.nom}`, c]));
  const memoSites = new Map();
  const sitesDe = (mod) => {
    if (!memoSites.has(mod.chemin)) memoSites.set(mod.chemin, sitesDuModule(mod, reglesSites));
    return memoSites.get(mod.chemin);
  };

  /**
   * Sites DIRECTS de `[a, b[` — ceux des fonctions nommées imbriquées n'en sont pas (elles
   * ne s'exécutent qu'appelées), ni ceux des intervalles `exclus`. Les marqueurs sur mesure
   * s'y ajoutent comme gardes, bornés comme un identifiant quand ils en ont la forme.
   */
  function sitesDans(mod, a, b, marqueurs, exclus = []) {
    const imbriquees = [...mod.fonctions.filter((f) => f.corps[0] > a && f.corps[1] <= b).map((f) => f.corps), ...exclus];
    const hors = (i) => i >= a && i < b && !imbriquees.some(([x, y]) => i >= x && i < y);
    const directs = sitesDe(mod).filter((s) => hors(s.index));
    for (const marqueur of marqueurs) {
      const re = /^[\w$.]+$/.test(marqueur)
        ? new RegExp(String.raw`(?<![\w$])${echapper(marqueur)}(?![\w$])`, 'g')
        : new RegExp(echapper(marqueur), 'g');
      for (const m of mod.code.matchAll(re)) {
        if (hors(m.index)) directs.push({ genre: 'garde', type: marqueur, index: m.index });
      }
    }
    return directs.sort(parOrdre);
  }

  /** La fonction qu'un site d'appel désigne : locale (la plus proche qui précède), ou exportée d'un module local. */
  function cible(mod, site) {
    const locales = mod.fonctions.filter((f) => f.nom === site.nom && !(site.index >= f.declaration && site.index < f.corps[0]));
    if (locales.length) {
      const avant = locales.filter((f) => f.declaration <= site.index);
      return { mod, fn: avant.length ? avant[avant.length - 1] : locales[0] };
    }
    const imp = mod.imports.get(site.nom);
    if (!imp) return null;
    const autre = modules.get(imp.module);
    if (!autre) return null;
    const fn = autre.fonctions.find((f) => f.nom === imp.nom && f.exportee) ?? autre.fonctions.find((f) => f.nom === imp.nom);
    return fn ? { mod: autre, fn } : null;
  }

  const ligneTexte = (mod, index) => (mod.source.split('\n')[ligneDe(mod.source, index) - 1] ?? '').trim().slice(0, 140);
  const localiser = (mod, s) => ({
    genre: s.genre,
    type: s.type,
    canal: s.canal,
    detail: s.detail ?? s.type,
    chemin: mod.chemin,
    ligne: ligneDe(mod.source, s.index),
    texte: ligneTexte(mod, s.index),
    via: [],
  });
  const etape = (mod, s) => ({ nom: s.nom, chemin: mod.chemin, ligne: ligneDe(mod.source, s.index) });
  const canalNomme = (c) => nommes.get(`${c.mod.chemin}#${c.fn.nom}`);
  const effetNomme = (mod, s, nomme) => ({ ...localiser(mod, s), genre: 'effet', type: nomme.type, canal: nomme.canal, detail: `${nomme.nom}()` });

  const EN_COURS = Symbol('en cours');
  const cleDe = (c) => `${c.mod.chemin}#${c.fn.nom}#${c.fn.corps[0]}`;
  /** Mémoïse `calcul(c)` par fonction ; une récursion rend `vide()` au lieu de boucler. */
  const memoiser = (vide, calcul) => {
    const memo = new Map();
    return (c, ...args) => {
      const cle = cleDe(c);
      if (memo.get(cle) === EN_COURS) return vide();
      if (memo.has(cle)) return memo.get(cle);
      memo.set(cle, EN_COURS);
      const r = calcul(c, ...args);
      memo.set(cle, r);
      return r;
    };
  };

  /**
   * Effets atteints AVANT la première garde de `[a, b[` (au plus EFFETS_RAPPORTES), et cette
   * garde. Les appels sont déroulés : un appel qui garde avant d'écrire est une garde, un
   * appel qui écrit d'abord est un effet — rapporté au site de l'appel, avec son chemin.
   */
  function ordre(mod, a, b, marqueurs, exclus = []) {
    const effets = [];
    const noter = (e) => { if (effets.length < EFFETS_RAPPORTES) effets.push(e); };
    for (const s of sitesDans(mod, a, b, marqueurs, exclus)) {
      if (s.genre === 'garde') return { effets, garde: localiser(mod, s) };
      if (s.genre === 'effet') { noter(localiser(mod, s)); continue; }
      if (s.genre !== 'appel') continue;
      const c = cible(mod, s);
      if (!c) continue;
      const nomme = canalNomme(c);
      if (nomme) { noter(effetNomme(mod, s, nomme)); continue; }
      const r = ordreDe(c, c.mod === mod ? marqueurs : []);
      for (const e of r.effets) noter({ ...e, via: [etape(mod, s), ...e.via] });
      if (r.garde) return { effets, garde: { ...r.garde, via: [etape(mod, s), ...r.garde.via] } };
    }
    return { effets, garde: null };
  }
  const ordreDe = memoiser(() => ({ effets: [], garde: null }), (c, marqueurs) => ordre(c.mod, c.fn.corps[0], c.fn.corps[1], marqueurs));

  /** Le premier, dans l'ordre d'exécution, d'une garde de périmètre ou d'un envoi d'e-mail. */
  function premierEnvoi(mod, a, b) {
    for (const s of sitesDans(mod, a, b, [])) {
      if (s.genre === 'perimetre') return localiser(mod, s);
      if (s.genre === 'effet' && s.type === 'envoi-email') return localiser(mod, s);
      if (s.genre !== 'appel') continue;
      const c = cible(mod, s);
      if (!c) continue;
      const nomme = canalNomme(c);
      if (nomme) {
        if (nomme.type === 'envoi-email') return effetNomme(mod, s, nomme);
        continue;
      }
      const r = premierEnvoiDe(c);
      if (r) return { ...r, via: [etape(mod, s), ...r.via] };
    }
    return null;
  }
  const premierEnvoiDe = memoiser(() => null, (c) => premierEnvoi(c.mod, c.fn.corps[0], c.fn.corps[1]));

  /** Canaux d'e-mail ATTEIGNABLES depuis `[a, b[`, appels déroulés — une union, sans ordre. */
  function canaux(mod, a, b) {
    const out = new Set();
    for (const s of sitesDans(mod, a, b, [])) {
      if (s.genre === 'effet' && s.type === 'envoi-email') out.add(s.canal);
      if (s.genre !== 'appel') continue;
      const c = cible(mod, s);
      if (!c) continue;
      const nomme = canalNomme(c);
      if (nomme) {
        if (nomme.type === 'envoi-email') out.add(nomme.canal);
        continue;
      }
      for (const k of canauxDe(c)) out.add(k);
    }
    return out;
  }
  const canauxDe = memoiser(() => new Set(), (c) => canaux(c.mod, c.fn.corps[0], c.fn.corps[1]));

  return {
    /**
     * Ordre garde → effet du gestionnaire d'un `index.ts`. `lisible: false` si le
     * gestionnaire n'a pas pu être isolé — la porte refuse alors.
     * @returns {{ lisible: boolean, garde: object|null, effets: object[] }}
     */
    ordreGestionnaire(mod, marqueurs = []) {
      const g = corpsGestionnaire(mod.masque, mod.fonctions);
      if (!g) return { lisible: false, garde: null, effets: [] };
      return { lisible: true, ...ordre(mod, g.debut, g.fin, marqueurs) };
    },
    /**
     * Effets exécutés au CHARGEMENT du module, donc avant toute requête et toute garde : ceux
     * des instructions de premier niveau (hors de toute accolade), appels déroulés. Tout ce
     * qui vit entre accolades — gestionnaire, fonctions, classes, littéraux d'objet — n'est
     * lu que s'il est appelé : une méthode de classe qui écrit n'est pas un effet au
     * chargement, un `await warmup()` de premier niveau l'est.
     */
    effetsAuChargement(mod) {
      const blocs = [];
      let prof = 0;
      let debut = 0;
      for (let i = 0; i < mod.masque.length; i++) {
        if (mod.masque[i] === '{') { if (prof++ === 0) debut = i; }
        else if (mod.masque[i] === '}' && --prof === 0) blocs.push([debut, i + 1]);
      }
      return ordre(mod, 0, mod.masque.length, [], blocs).effets;
    },
    /** Canaux d'e-mail atteints par le gestionnaire, et le premier de « périmètre » ou « envoi ». */
    expeditionGestionnaire(mod) {
      const g = corpsGestionnaire(mod.masque, mod.fonctions);
      if (!g) return { lisible: false, canaux: new Set(), premier: null };
      return { lisible: true, canaux: canaux(mod, g.debut, g.fin), premier: premierEnvoi(mod, g.debut, g.fin) };
    },
  };
}

// ── Verdicts ────────────────────────────────────────────────────────────────
// Purs : la porte les appelle avec SES tables, le banc avec des tables de fixture — c'est ce
// qui permet d'éprouver « entrée périmée → rouge » sans toucher au script.

/**
 * Passe « ordre » sur des gestionnaires.
 *
 * @param {object} p
 * @param {ReturnType<typeof creerAnalyse>} p.analyse
 * @param {Map<string, object>} p.fonctions nom de fonction → module de son `index.ts`
 * @param {Record<string, string[]>} [p.marqueurs] gardes sur mesure, par fonction
 * @param {Iterable<string>} [p.ouvertes] fonctions publiques par conception (sautées)
 * @param {Record<string, unknown>} [p.exemptions] exemptions temporaires, par fonction
 */
export function verdictOrdre({ analyse, fonctions, marqueurs = {}, ouvertes = [], exemptions = {} }) {
  const sautees = new Set(ouvertes);
  const out = { lus: 0, illisibles: [], violations: [], exemptees: [], exemptionsPerimees: [], gardesNonAtteintes: [] };
  out.exemptionsPerimees.push(...Object.keys(exemptions).filter((d) => !fonctions.has(d)));
  for (const [dir, mod] of fonctions) {
    if (sautees.has(dir)) continue;
    out.lus++;
    const o = analyse.ordreGestionnaire(mod, marqueurs[dir] ?? []);
    if (!o.lisible) { out.illisibles.push(dir); continue; }
    if (o.effets.length) {
      if (dir in exemptions) out.exemptees.push(dir);
      else out.violations.push({ dir, effets: o.effets, garde: o.garde });
    } else if (dir in exemptions) {
      out.exemptionsPerimees.push(dir);
    }
    if (!o.garde && !o.effets.length) out.gardesNonAtteintes.push(dir);
  }
  return out;
}

/**
 * Passe « expéditeurs » : l'inventaire des fonctions qui envoient un e-mail, confronté à la
 * table des périmètres. Une fonction est en règle si `guardOutboundEmail` précède son premier
 * envoi, OU si la table la nomme avec les canaux qu'elle atteint réellement.
 *
 * @param {object} p
 * @param {ReturnType<typeof creerAnalyse>} p.analyse
 * @param {Map<string, object>} p.fonctions nom de fonction → module de son `index.ts`
 * @param {Record<string, { canaux: string[] }>} p.perimetres
 */
export function verdictExpediteurs({ analyse, fonctions, perimetres }) {
  const out = { expediteurs: [], sansPerimetre: [], superflus: [], perimes: [], canauxChanges: [] };
  for (const [dir, mod] of fonctions) {
    const exp = analyse.expeditionGestionnaire(mod);
    if (!exp.canaux.size) continue;
    const canaux = [...exp.canaux].sort();
    const parPerimetre = exp.premier?.genre === 'perimetre';
    out.expediteurs.push({ dir, canaux, parPerimetre, premier: exp.premier });
    const declare = perimetres[dir];
    if (parPerimetre) {
      if (declare) out.superflus.push(dir);
    } else if (!declare) {
      out.sansPerimetre.push({ dir, canaux, premier: exp.premier });
    } else if ([...declare.canaux].sort().join() !== canaux.join()) {
      out.canauxChanges.push({ dir, declares: declare.canaux, atteints: canaux });
    }
  }
  const envoyeurs = new Set(out.expediteurs.map((x) => x.dir));
  for (const dir of Object.keys(perimetres)) {
    if (!envoyeurs.has(dir)) out.perimes.push({ dir, raison: fonctions.has(dir) ? "n'envoie plus aucun e-mail" : "la fonction n'existe plus" });
  }
  return out;
}

/**
 * Les exceptions de lecture tiennent-elles ? Déclarée STABLE ou IMMUTABLE dans sa dernière
 * définition, et encore appelée par une source edge.
 *
 * @param {Iterable<string>} noms
 * @param {ReturnType<typeof volatilitesSql>} volatilites
 * @param {Iterable<{ code: string }>} modules
 * @returns {{ nom: string, raison: string }[]}
 */
export function lecturesRpcInvalides(noms, volatilites, modules) {
  const codes = [...modules].map((m) => m.code);
  return [...noms].flatMap((nom) => {
    const v = volatilites.get(nom);
    if (!v) return [{ nom, raison: 'introuvable dans supabase/migrations' }];
    if (v.volatilite === 'volatile') return [{ nom, raison: `déclarée VOLATILE (${v.fichier}) : rien ne garantit qu'elle ne fait que lire` }];
    const appel = new RegExp(String.raw`\.rpc\(\s*(['"\`])${echapper(nom)}\1`);
    return codes.some((c) => appel.test(c)) ? [] : [{ nom, raison: "plus aucune source edge ne l'appelle" }];
  });
}

/**
 * Un canal nommé est-il encore ce que la porte croit ? La fonction doit exister dans son
 * module et son corps porter le marqueur de l'appel qui envoie. Rend la raison du refus,
 * ou `null`.
 */
export function canalNommePerime(modules, canal) {
  const mod = modules.get(normaliser(canal.module));
  if (!mod) return 'module introuvable';
  const fn = mod.fonctions.find((f) => f.nom === canal.nom);
  if (!fn) return `${canal.nom} n'y est plus définie`;
  if (!mod.code.slice(fn.corps[0], fn.corps[1]).includes(canal.marqueur)) return `son corps ne porte plus « ${canal.marqueur} »`;
  return null;
}

// ── Volatilité des fonctions SQL ────────────────────────────────────────────

/**
 * Instructions d'un fichier SQL, commentaires ôtés, chaînes et corps `$tag$…$tag$` réduits
 * à un jeton : ce qui reste est l'EN-TÊTE — nom, arguments, `returns`, langage, volatilité.
 */
function* instructionsSql(sql) {
  let cur = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { const f = sql.indexOf('\n', i); i = f < 0 ? n : f; continue; }
    if (c === '/' && sql[i + 1] === '*') { const f = sql.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; cur += ' '; continue; }
    if (c === "'") {
      let j = i + 1;
      for (; j < n; j++) {
        if (sql[j] === "'") { if (sql[j + 1] === "'") { j++; continue; } break; }
      }
      cur += "''";
      i = j + 1;
      continue;
    }
    if (c === '$') {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64))?.[0];
      if (tag) {
        const f = sql.indexOf(tag, i + tag.length);
        i = f < 0 ? n : f + tag.length;
        cur += ' $corps$ ';
        continue;
      }
    }
    if (c === ';') { yield cur; cur = ''; i++; continue; }
    cur += c;
    i++;
  }
  if (cur.trim()) yield cur;
}

const NOM_SQL = String.raw`(?:"?public"?\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;

/**
 * Volatilité DÉCLARÉE de chaque fonction SQL du schéma `public`, lue sur les migrations
 * dans l'ordre : la dernière définition l'emporte, `alter function … stable` la change,
 * `drop function` l'efface. Postgres refuse INSERT/UPDATE/DELETE dans une fonction STABLE
 * ou IMMUTABLE — c'est ce qui rend « cette RPC ne fait que lire » VÉRIFIABLE au lieu d'être
 * une promesse.
 *
 * @param {{ fichier: string, sql: string }[]} migrations dans l'ordre d'application
 * @returns {Map<string, { volatilite: 'volatile'|'stable'|'immutable', fichier: string }>}
 */
export function volatilitesSql(migrations) {
  const out = new Map();
  const creer = new RegExp(String.raw`^\s*create\s+(?:or\s+replace\s+)?function\s+${NOM_SQL}\s*\(`, 'i');
  const modifier = new RegExp(String.raw`^\s*alter\s+function\s+${NOM_SQL}`, 'i');
  const detruire = /^\s*drop\s+function\s+(?:if\s+exists\s+)?([\s\S]*)$/i;
  const volatilite = (texte) => /\b(immutable|stable|volatile)\b/i.exec(texte)?.[1]?.toLowerCase() ?? null;
  for (const { fichier, sql } of migrations) {
    for (const instr of instructionsSql(String(sql ?? ''))) {
      let m;
      if ((m = creer.exec(instr))) {
        out.set(m[1].toLowerCase(), { volatilite: volatilite(instr.slice(m[0].length)) ?? 'volatile', fichier });
      } else if ((m = modifier.exec(instr))) {
        const v = volatilite(instr.slice(m[0].length));
        const cle = m[1].toLowerCase();
        if (v && out.has(cle)) out.set(cle, { volatilite: v, fichier });
      } else if ((m = detruire.exec(instr))) {
        for (const cible of m[1].split(/,(?![^(]*\))/)) {
          const nom = new RegExp(`^\\s*${NOM_SQL}`).exec(cible)?.[1];
          if (nom) out.delete(nom.toLowerCase());
        }
      }
    }
  }
  return out;
}
