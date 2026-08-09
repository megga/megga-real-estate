// Garde-fou de décision (étape 22, spec §5.2/§5.4/§5.9) : AUCUN export CSV dans la console.
//
// « Aucun export CSV — nulle part dans la console (décision actée 31 juil. 2026). Les seuls
// exports du produit : DSAR (JSON, §5.4) et extrait signé du registre (PDF, §5.9). »
//
// POURQUOI CE TEST EXISTE. La décision était actée et écrite DEUX fois dans la spec, et la
// console en portait quand même cinq — Agences, Utilisateurs, Modération, Conformité,
// Sécurité — via un helper partagé. Personne n'avait menti : les boutons étaient là avant la
// décision, et rien ne rougissait. Une décision qu'aucun test ne défend se re-prend toute
// seule, un bouton à la fois.
//
// Le contrôle est STATIQUE : un export CSV se reconnaît à son code, pas à son exécution.
//
// DÉTERMINISME. Le balayage passe par `tests/unit/helpers/fs-scan.ts` : racines ancrées sur
// le dépôt (et non sur `process.cwd()`), typage des entrées par `withFileTypes`, aléas FS
// classés en « disparu » (ignoré) vs « illisible » (signalé à part). Le pourquoi de chacun de
// ces trois points est documenté en tête de ce module.
//
// Ce que ça corrige ICI, mesuré. (1) Le walk d'origine visitait trois fois le même chemin
// (readdir → statSync → readFileSync) ; sous un écrivain concurrent, il partait au rouge
// 8 fois sur 10 avec un `ENOENT` anonyme — aucun fichier nommé, indiscernable d'une vraie
// fabrication de CSV. Le walk durci passe 10 fois sur 10 sous le même churn. (2) Les
// `existsSync` ci-dessous étaient cwd-relatifs, et `existsSync` ne jette JAMAIS : sous un
// mauvais répertoire il répond simplement « non ». L'assertion « le helper exportCsv a
// disparu » passait donc au vert en annonçant l'outil retiré, alors qu'elle n'avait fait que
// regarder au mauvais endroit — mesuré, c'est le seul vert FAUX de la famille. Ancrées sur
// le dépôt, ces trois vérifications d'existence disent enfin ce qu'elles prétendent dire.

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

/** Surfaces de la console super-admin. */
const RACINES = ['src/pages/admin', 'src/components/admin'] as const
/** Les hooks de la console ne sont pas dans un dossier à eux : on les prend par préfixe. */
const HOOKS = 'src/hooks'

/** Fichier témoin : si le scan ne le voit plus, il ne balaye plus la console. */
const TEMOIN = 'src/components/admin/AdminShell.tsx'

/** Motifs qui trahissent une fabrication de CSV, quel que soit l'outil employé. */
const MOTIFS: Array<{ re: RegExp; quoi: string }> = [
  { re: /exportToCsv/i, quoi: 'appel au helper exportToCsv' },
  { re: /text\/csv/i, quoi: 'type MIME text/csv' },
  { re: /\.csv['"`]/i, quoi: 'nom de fichier .csv' },
  { re: /\bcsvContent\b|\btoCsv\b|\bbuildCsv\b/i, quoi: 'fabrication de CSV' },
]

/** Retire les commentaires : le mot « CSV » dans une prose explicative n'est pas un export. */
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

const scan = scanRoots([
  ...RACINES.map((root) => ({
    root,
    keep: (n: string) => n.endsWith('.tsx') || n.endsWith('.ts'),
  })),
  { root: HOOKS, keep: (n: string) => /^useAdmin.*\.ts$/.test(n) || n === 'useChangelog.ts' },
])

describe('aucun export CSV dans la console (étape 22)', () => {
  it('le balayage porte sur un périmètre non vide (garde anti-test creux)', () => {
    // Sans cette assertion, un chemin devenu faux rendrait le test suivant vert sur zéro
    // fichier — le motif exact du vert sans assertion.
    const vides = emptyRoots(scan)
    expect(vides, `racine(s) vide(s) — arborescence déplacée ? : ${vides.join(', ')}`).toEqual([])

    expect(scan.files.length, 'aucun fichier de console balayé : les racines sont-elles bonnes ?')
      .toBeGreaterThan(20)
    expect(scan.files.map(rel), `${TEMOIN} hors périmètre — le scan ne voit plus la console`)
      .toContain(TEMOIN)
  })

  it('LA DÉCISION TIENT — aucune surface ne fabrique de CSV', () => {
    const unreadable = [...scan.unreadable]
    const fautifs: string[] = []

    for (const chemin of scan.files) {
      const brut = readFileSafely(chemin)
      // Disparu entre le listing et l'ouverture (écrivain concurrent) : rien à vérifier —
      // un export CSV ne se cache pas dans un fichier qui n'existe plus.
      if (brut.status === 'gone') continue
      if (brut.status === 'unreadable') {
        unreadable.push(`${rel(chemin)} — ${brut.error}`)
        continue
      }
      const source = sansCommentaires(brut.value)
      for (const { re, quoi } of MOTIFS) {
        if (re.test(source)) fautifs.push(`${rel(chemin)} — ${quoi}`)
      }
    }

    // Distinct du verdict : un chemin illisible dit « je n'ai pas pu vérifier », pas
    // « une surface fabrique du CSV ».
    expect(unreadable,
      `Lecture FS impossible (aléa d'environnement, PAS une infraction) : ${unreadable.join(' | ')}`)
      .toEqual([])

    expect(fautifs, [
      'Export(s) CSV retrouvé(s) dans la console :',
      ...fautifs.map((x) => `  · ${x}`),
      '',
      '§5.2 : « Aucun export CSV — nulle part dans la console (décision actée 31 juil. 2026). »',
      'Les seuls exports du produit sont le DSAR (JSON, §5.4) et l\'extrait signé du',
      'registre (PDF, §5.9). Si la décision a changé, elle doit changer dans la spec',
      'AVANT de revenir dans le code — pas l\'inverse.',
    ].join('\n')).toEqual([])
  })

  it('le helper partagé a bien disparu du dépôt', () => {
    // Le laisser en place, c'est laisser l'outil à portée : le prochain écran le
    // retrouverait par autocomplétion, sans jamais croiser la décision.
    expect(existsSync(repoPath('src/lib/exportCsv.ts')),
      'src/lib/exportCsv.ts existe encore : l\'outil reste à portée de main').toBe(false)
  })

  it('les DEUX exports autorisés, eux, sont toujours là', () => {
    // Un garde-fou qui se contenterait d'interdire pourrait être satisfait par une console
    // sans aucun export. Ce n'est pas la décision : elle en autorise deux, nommément.
    //
    // Ces deux-là valident du même coup l'ancrage : ils rougiraient les premiers si
    // `repoPath` cessait de désigner la racine du dépôt.
    expect(existsSync(repoPath('supabase/functions/admin-dsar-export/index.ts')),
      'l\'export DSAR (JSON, §5.4) doit rester').toBe(true)
    expect(existsSync(repoPath('supabase/functions/audit-pdf-export/index.ts')),
      'l\'export PDF de la piste d\'audit (§5.9) doit rester').toBe(true)
  })
})
