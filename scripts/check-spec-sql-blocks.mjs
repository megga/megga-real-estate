#!/usr/bin/env node
/**
 * Équilibre des blocs plpgsql écrits DANS les specs backend.
 *
 * POURQUOI CE CONTRÔLE EXISTE — un défaut réel, coûteux, et invisible de tous les autres.
 * Le banc du registre de consentement enveloppe ses corps SQL dans `do $$ … $$;`. Quinze
 * assertions « ce SQL doit être REFUSÉ » se contentaient de `toThrow()`, et leurs corps
 * refermaient un `end` que le wrapper posait déjà. Le SQL levait donc
 * `syntax error at or near "end"` — une erreur qui fait échouer N'IMPORTE QUEL SQL, et donc
 * passer n'importe quel refus. Quinze tests verts, zéro propriété prouvée.
 *
 * ⚠ CE QUE libpg-query NE PEUT PAS FAIRE, et c'est la raison de ce script maison : le corps
 * d'un `do $$ … $$` est un LITTÉRAL pour le parser de PostgreSQL. Il accepte
 * `begin … end end` sans broncher — mesuré. Un contrôle bâti dessus est vert avant comme
 * après le défaut, ce qui est pire qu'aucun contrôle.
 *
 * La propriété vérifiée : après retrait des littéraux et des commentaires, tout `begin` a
 * son `end`, et tout `if`/`loop`/`case` le sien.
 *
 * ⚠ PORTÉE VOLONTAIREMENT RESTREINTE — seuls les specs portant le marqueur
 * `@sql-blocks-check` sont analysés. Le compteur ne survit PAS à l'entrelacement des
 * apostrophes SQL et JavaScript : sur quatre specs de la console admin, un `'${'$'}{X}'`
 * ou un `'{"role":"service_role"}'` dépareille le retrait des littéraux et invente des
 * blocs. Les signaler serait crier au loup, et un garde-fou qui crie sans raison finit
 * ignoré — donc muet le jour où il a raison. Élargir la portée demande d'abord un
 * compteur robuste à ce quoting, pas un ajout de fichiers à la liste.
 *
 * Usage : node scripts/check-spec-sql-blocks.mjs [fichier…]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'tests/backend';

/** Retire chaînes, dollar-quotes et commentaires — leurs mots-clés sont du texte. */
function strip(sql) {
  return sql
    .replace(/\$([A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function balance(sql) {
  const s = strip(sql).toLowerCase();
  const n = (re) => (s.match(re) ?? []).length;
  const endIf = n(/\bend\s+if\b/g);
  const endLoop = n(/\bend\s+loop\b/g);
  // `end` NU = fermeture de bloc ; les `end if|loop|case` sont comptés à part.
  const endBlock = n(/\bend\b(?!\s+(if|loop|case)\b)/g);
  return {
    begin: n(/\bbegin\b/g),
    endBlock,
    if: n(/\bif\b/g) - endIf - n(/\belsif\b/g),
    endIf,
    loop: n(/\bloop\b/g) - endLoop,
    endLoop,
  };
}

/**
 * Corps passés aux helpers SQL d'un spec, et le nombre d'`end` que son wrapper AJOUTE.
 *
 * Le wrapper est lu dans le fichier lui-même : un banc qui change de convention doit voir
 * ce contrôle le suivre, pas rester vert sur une supposition périmée.
 */
const MARQUEUR = '@sql-blocks-check';

function analyser(chemin) {
  const src = readFileSync(chemin, 'utf8');
  if (!src.includes(MARQUEUR)) return { fautes: [], corps: 0, analyse: false };
  const helpers = [...src.matchAll(/const\s+(\w+)\s*=\s*\(\s*body\s*:\s*string\s*\)\s*=>\s*execSql\(`([\s\S]*?)`\)/g)];
  if (!helpers.length) return { fautes: [], corps: 0, analyse: false };

  // `do $$\n${body}\nend $$;` ⇒ le wrapper ferme lui-même : 1 `end` de plus.
  //
  // ⚠ Les échappements sont LITTÉRAUX ici : on lit du code source, où `\n` vaut deux
  // caractères. Sans cette normalisation, `\bend\b` ne matche pas `\nend` — le `n` de
  // l'échappement est un caractère de mot — et le contrôle croit que le wrapper ne ferme
  // rien. Il criait alors sur TOUS les specs voisins, ce qui est la façon la plus sûre de
  // se faire ignorer le jour où il a raison.
  const denoter = (t) => t.replace(/\\[nrt]/g, ' ');
  const wrapperEnds = helpers.reduce((max, h) => {
    const apres = h[2].slice(h[2].indexOf('${body}') + '${body}'.length);
    return Math.max(max, balance(denoter(apres)).endBlock);
  }, 0);

  const fautes = [];
  let corps = 0;
  for (const m of src.matchAll(/\b(?:assertSql|refuseSql|runSql)\(`([\s\S]*?)`\s*[,)]/g)) {
    corps++;
    // ⚠ Neutraliser les interpolations AVANT `strip`, et les IMBRIQUÉES d'abord :
    // `${'$'}{X}` est un `$` échappé suivi d'un `{X}` littéral, et le traiter comme une
    // interpolation simple laissait une apostrophe orpheline — de quoi dépareiller tout
    // le reste du corps et inventer des blocs qui n'existent pas.
    const corpsNeutre = m[1]
      .replace(/\$\{\s*'\$'\s*\}/g, 'X')
      .replace(/\$\{[^}]*\}/g, '000000000');
    const b = balance(corpsNeutre);
    b.endBlock += wrapperEnds;
    const p = [];
    if (b.begin !== b.endBlock) p.push(`begin=${b.begin} vs end=${b.endBlock}`);
    if (b.if !== b.endIf) p.push(`if=${b.if} vs end if=${b.endIf}`);
    if (b.loop !== b.endLoop) p.push(`loop=${b.loop} vs end loop=${b.endLoop}`);
    if (p.length) {
      fautes.push({ ligne: src.slice(0, m.index).split('\n').length, quoi: p.join(', ') });
    }
  }
  return { fautes, corps, analyse: true };
}

const args = process.argv.slice(2);
const fichiers = args.length
  ? args
  : readdirSync(DIR).filter((f) => f.endsWith('.ts')).map((f) => join(DIR, f));

let total = 0;
let casses = 0;
let analyses = 0;
for (const f of fichiers) {
  const { fautes, corps, analyse } = analyser(f);
  if (analyse) analyses++;
  total += corps;
  if (!fautes.length) continue;
  casses += fautes.length;
  console.error(`\n✗ ${f} — bloc(s) plpgsql déséquilibré(s) :`);
  for (const { ligne, quoi } of fautes) console.error(`    ligne ${ligne} : ${quoi}`);
}

if (casses) {
  console.error('\nUn corps mal fermé lève `syntax error`, ce qui fait ÉCHOUER le SQL —');
  console.error('donc PASSER toute assertion qui se contente d\'attendre un échec.');
  console.error('Vérifier que le corps ne referme pas un `end` que le wrapper pose déjà.\n');
  process.exit(1);
}

if (!analyses) {
  console.error(`✗ Aucun spec ne porte ${MARQUEUR} — le contrôle ne vérifierait RIEN.`);
  process.exit(1);
}
console.log(`✓ Blocs SQL équilibrés — ${total} corps dans ${analyses} spec(s) marqué(s) ${MARQUEUR}.`);
