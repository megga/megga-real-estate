/**
 * Empreinte des écrans que la régression visuelle photographie.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 * ⛔ Le 15 août 2026, la capture gardée de `/dashboard/pipeline` a survécu à un
 * redesign complet du kanban. Mesuré : le changement valait 1,09 % contre un
 * seuil de 1 % — un commit a rougi, le suivant est repassé au VERT contre la
 * MÊME référence périmée. Le mode d'échec est « VERTE ET FAUSSE » : la capture
 * décrit un écran qui n'existe plus, et la porte l'accepte. C'est pire qu'une
 * porte rouge — une porte rouge se regarde. Voir `megga/gardes-vacuites` n° 44.
 *
 * Aucun seuil ne répare ça : le seuil dit « de combien l'image a bougé », jamais
 * « la référence décrit-elle encore l'écran ». Il faut une seconde question, et
 * c'est celle-ci.
 *
 * ── POURQUOI PAS L'HISTORIQUE GIT ───────────────────────────────────────────
 * ⛔ La première idée — comparer la date du commit de la capture à celle du
 * dernier changement des sources — est VACUE en CI. Aucun workflow du dépôt ne
 * pose `fetch-depth`, donc `actions/checkout` clone à la profondeur 1 :
 * `git log -1 -- <fichier>` y rend TOUJOURS HEAD, pour tout fichier. La clause
 * aurait comparé HEAD à HEAD et serait passée au vert partout, y compris sur une
 * référence vieille de six mois. On commite donc une empreinte, qui ne dépend
 * d'aucune profondeur de clone.
 *
 * ── CE QU'ELLE MESURE, ET LE PARTI PRIS ─────────────────────────────────────
 * Le contenu des fichiers qui PEIGNENT l'écran, commentaires retirés et espaces
 * normalisés. Pas seulement les blocs de style : un `const PIPE_PAD_X = 34` ne
 * ressemble pas à du style et déplace pourtant tout le board.
 *
 * ⚠ C'EST DÉLIBÉRÉMENT CONSERVATEUR. Un changement qui ne touche pas au rendu —
 * un gestionnaire renommé, une prop réordonnée — fera rougir la porte et
 * demandera une régénération. Le parti pris est assumé et il est asymétrique :
 * un FAUX ROUGE coûte un commentaire de PR, un FAUX VERT a coûté la soirée du
 * 15 août. Les commentaires, eux, sont retirés — sans quoi la note qui explique
 * un correctif demanderait une régénération.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Où vit l'empreinte — DANS le dossier des captures, que le workflow commite déjà. */
export const CHEMIN_EMPREINTES = 'tests/e2e/visual-regression.spec.ts-snapshots/empreintes.json'

/**
 * Ce que chaque capture photographie, en SOURCES.
 *
 * ⚠ Inventaire, pas déduction : rien ne relie une route à ses fichiers
 * autrement qu'en le lisant. La clause `l'inventaire décrit encore le dépôt`
 * refuse un chemin qui n'existe plus, sinon une arborescence renommée viderait
 * l'empreinte en silence — et une empreinte de RIEN est stable pour toujours.
 *
 * `crm/tokens.ts` et `megga-x-crm/tokens.ts` en font partie : ils portent
 * `crmStageTint` et `crmPalette`, donc la couleur de chaque colonne.
 */
export const ECRANS = {
  'dashboard-pipeline': [
    'src/pages/agent/PipelinePage.tsx',
    'src/components/crm/pipeline',
    'src/components/crm/tokens.ts',
    'src/components/megga-x-crm/tokens.ts',
  ],
}

const sansCommentaires = (c) =>
  c.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** Rend les fichiers d'un chemin — un fichier, ou tout un dossier, trié. */
function fichiersDe(racine, base) {
  const abs = join(base, racine)
  const s = statSync(abs)
  if (!s.isDirectory()) return [racine]
  return readdirSync(abs)
    .filter((n) => /\.tsx?$/.test(n))
    .sort()
    .map((n) => `${racine}/${n}`)
}

/**
 * Calcule l'empreinte d'un écran. Rend aussi la liste des fichiers lus, pour
 * qu'une clause puisse vérifier que le balayage a vu quelque chose — une
 * empreinte de zéro fichier serait stable et ne dirait rien.
 */
export function empreinteEcran(nom, base = process.cwd()) {
  const chemins = ECRANS[nom]
  if (!chemins) throw new Error(`écran inconnu : ${nom}`)
  const fichiers = chemins.flatMap((c) => fichiersDe(c, base))
  const h = createHash('sha256')
  for (const f of fichiers) {
    h.update(f)
    h.update(sansCommentaires(readFileSync(join(base, f), 'utf8')).replace(/\s+/g, ' ').trim())
  }
  return { empreinte: h.digest('hex').slice(0, 16), fichiers }
}

/** Toutes les empreintes, dans la forme qu'on commite. */
export function empreintesCourantes(base = process.cwd()) {
  const out = {}
  for (const nom of Object.keys(ECRANS)) out[nom] = empreinteEcran(nom, base).empreinte
  return out
}
