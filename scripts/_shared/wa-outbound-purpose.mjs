/**
 * Lecture statique de la FINALITÉ d'un envoi WhatsApp — le cœur de `check-whatsapp-outbound.mjs`.
 *
 * Extrait ici pour une seule raison : la porte ne valait que ce que valait sa lecture, et sa
 * lecture n'avait aucun banc. Un helper de `scripts/` vit dans `scripts/_shared/` (CLAUDE.md
 * §4) ; le banc est `tests/unit/wa-outbound-purpose.spec.ts`.
 *
 * ⛔ CE QUE LA VERSION PRÉCÉDENTE LAISSAIT PASSER, et qui est l'inverse du reproche fait en
 * revue. Elle lisait le ternaire par une regex, `^(.+?)\?([^?:]+):([^?:]+)$`. Sur un ternaire
 * IMBRIQUÉ — `a ? 'opt_out_ack' : b ? 'utility' : 'marketing'` — le retour arrière la faisait
 * s'accrocher au DERNIER `?`, si bien qu'elle rendait `['utility','marketing']` : la première
 * branche disparaissait, avec elle le contrôle de réservation, et `opt_out_ack` s'émettait
 * depuis n'importe quel fichier. Une porte de conformité qui rend un verdict VERT sur ce
 * qu'elle n'a pas lu est pire qu'absente.
 *
 * (Mesuré : les deux causes citées en revue — `?.` dans la condition, `:` dans une chaîne de
 * la condition — ne cassaient PAS cette regex ; le retour arrière les absorbait. Le vrai
 * défaut était un laissez-passer, pas un blocage.)
 *
 * On remplace donc la regex par un découpage RÉEL : on saute les chaînes et les groupements,
 * on trouve le `?` de premier niveau, puis le `:` qui lui répond, et on recommence sur chaque
 * branche. Sur-inclusif par construction — toute forme qu'on ne sait pas lire est REFUSÉE.
 */

/** Domaine fermé de `OutboundPurpose` (whatsapp-outbound-guard.ts). */
export const PURPOSES = ['service', 'utility', 'marketing', 'lpd_notice', 'opt_out_ack'];

/** Fin d'une chaîne ouverte en `i`. -1 si elle n'est jamais refermée (expression illisible). */
function finChaine(e, i) {
  const q = e[i];
  for (let j = i + 1; j < e.length; j++) {
    if (e[j] === '\\') { j++; continue; }
    if (e[j] === q) return j;
  }
  return -1;
}

/**
 * Caractères de PREMIER NIVEAU : hors chaînes (y compris gabarits, traités en bloc opaque)
 * et hors `()`, `[]`, `{}`. C'est ce qui rend le découpage insensible à une virgule dans un
 * appel, à un `:` dans une chaîne, ou à un objet passé en argument.
 */
function* premierNiveau(e) {
  let prof = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (c === "'" || c === '"' || c === '`') {
      const f = finChaine(e, i);
      if (f < 0) return;   // chaîne non close : on cesse de lire, donc on refusera
      i = f; continue;
    }
    if (c === '(' || c === '[' || c === '{') { prof++; continue; }
    if (c === ')' || c === ']' || c === '}') { prof--; continue; }
    if (prof === 0) yield [i, c];
  }
}

/** Un `?` d'OPÉRATEUR TERNAIRE ? Ni `?.` (chaînage optionnel), ni `??` (coalescence). */
const ternaireIci = (e, i) => e[i] === '?' && e[i + 1] !== '.' && e[i + 1] !== '?' && e[i - 1] !== '?';

/**
 * `cond ? A : B` → `[cond, A, B]`, en respectant l'imbrication. `null` si ce n'est pas un
 * ternaire, ou si le `:` qui répond au `?` est introuvable.
 */
function decoupeTernaire(e) {
  let q = -1;
  for (const [i] of premierNiveau(e)) {
    if (ternaireIci(e, i)) { q = i; break; }
  }
  if (q < 0) return null;

  // Le `:` qui RÉPOND à ce `?`. Chaque ternaire ouvert en chemin en consomme un d'abord —
  // c'est ce comptage qui manquait, et qui faisait perdre une branche entière.
  let ouverts = 0, deuxPoints = -1;
  for (const [i, c] of premierNiveau(e)) {
    if (i <= q) continue;
    if (ternaireIci(e, i)) ouverts++;
    else if (c === ':') {
      if (ouverts === 0) { deuxPoints = i; break; }
      ouverts--;
    }
  }
  if (deuxPoints < 0) return null;
  return [e.slice(0, q), e.slice(q + 1, deuxPoints), e.slice(deuxPoints + 1)];
}

const estLitteral = (s) => new RegExp(`^'(${PURPOSES.join('|')})'$`).test(s.trim());

/**
 * Toutes les finalités qu'une expression peut prendre, ou `null` si elle n'est pas lisible.
 *
 * Accepté : `'service'` · `cond ? 'marketing' : 'utility'` · les ternaires imbriqués, dont
 * TOUTES les branches sont alors rendues. Un ternaire de littéraux ÉNUMÈRE ses valeurs
 * possibles, ce qui est exactement la propriété que la porte protège ; l'interdire n'aurait
 * forcé qu'à dupliquer l'appel.
 * Refusé : `p` · `opts.purpose` · `PURPOSES[i]` · `cond ? p : 'service'`.
 */
export function purposeLisible(expr) {
  const e = String(expr ?? '').trim();
  if (!e) return null;
  if (estLitteral(e)) return [e.replace(/'/g, '')];
  const t = decoupeTernaire(e);
  if (!t) return null;
  const a = purposeLisible(t[1]);
  if (!a) return null;
  const b = purposeLisible(t[2]);
  if (!b) return null;
  return [...a, ...b];
}

/** Propriétés de PREMIER NIVEAU d'un corps d'objet, découpées sur ses virgules à elle. */
function* proprietes(corps) {
  let debut = 0;
  for (const [i, c] of premierNiveau(corps)) {
    if (c === ',') { yield corps.slice(debut, i); debut = i + 1; }
  }
  yield corps.slice(debut);
}

/**
 * Valeur d'une propriété dans le CORPS d'un littéral d'objet (accolades exclues).
 *
 * ⛔ LA PROPRIÉTÉ EST CHERCHÉE AU PREMIER NIVEAU SEULEMENT. Une simple regex sur tout le
 * corps s'accroche au PREMIER `purpose:` de n'importe quelle profondeur : il suffisait
 * d'écrire `meta: { purpose: 'service' }, purpose: 'opt_out_ack'` pour que la porte valide
 * le leurre et ne voie jamais la finalité réservée. Mesuré : elle rendait vert.
 *
 * ⚠ Et la valeur court jusqu'à la virgule de PREMIER NIVEAU. L'ancienne capture, `[^\n,}]+`,
 * coupait au premier saut de ligne, à la première virgule et à la première accolade
 * fermante — d'où un refus sur `purpose: f(a, b) ? 'x' : 'y'` et sur tout ternaire mis en
 * forme sur plusieurs lignes. Un blocage de code correct fait contourner la porte ; c'est la
 * seconde façon de la perdre.
 */
export function valeurDe(corps, cle) {
  const re = new RegExp(`^\\s*${cle}\\s*:\\s*`);
  for (const seg of proprietes(corps)) {
    const m = seg.match(re);
    if (m) return seg.slice(m[0].length).trim();
  }
  return null;
}

/**
 * Commentaires blanchis — un `buildSendTextRequest` CITÉ dans une note n'est pas un appel.
 *
 * ⛔ SAUTE LES CHAÎNES, et ce n'est pas un raffinement. Un blanchiment naïf de `//` jusqu'en
 * fin de ligne détruit le guillemet fermant de `'https://cdn.megga.ch/a.jpg'` ; l'ancien
 * compteur d'accolades, aveugle aux chaînes, l'enjambait sans dommage, mais un lecteur qui
 * SAIT lire les chaînes tombe alors sur une chaîne non close et refuse un appel correct.
 * Mesuré : le premier envoi d'image avec une URL aurait fait rougir la porte.
 */
export function sansCommentaires(src) {
  const blanc = (m) => m.replace(/[^\n]/g, ' ');
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const f = finChaine(src, i);
      if (f < 0) { out += src.slice(i); break; }
      out += src.slice(i, f + 1); i = f; continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const fin = src.indexOf('\n', i);
      const j = fin < 0 ? src.length : fin;
      out += blanc(src.slice(i, j)); i = j - 1; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const fin = src.indexOf('*/', i + 2);
      const j = fin < 0 ? src.length : fin + 2;
      out += blanc(src.slice(i, j)); i = j - 1; continue;
    }
    out += c;
  }
  return out;
}

/**
 * Bloc d'arguments d'un appel : de l'accolade ouvrante à celle qui l'équilibre, CORPS SEUL.
 * `null` si l'appel ne passe pas un littéral d'objet en ligne — auquel cas la finalité
 * n'est pas lisible sur place, ce que la porte doit refuser plutôt qu'ignorer.
 */
export function corpsArguments(txt, depuis) {
  let i = depuis;
  while (i < txt.length && /\s/.test(txt[i])) i++;
  if (txt[i] !== '{') return null;
  let prof = 0;
  for (let j = i; j < txt.length; j++) {
    const c = txt[j];
    if (c === "'" || c === '"' || c === '`') {
      const f = finChaine(txt, j);
      if (f < 0) return null;
      j = f; continue;
    }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return txt.slice(i + 1, j); }
  }
  return null;
}
