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

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Surfaces de la console super-admin. */
const RACINES = ['src/pages/admin', 'src/components/admin']
/** Les hooks de la console ne sont pas dans un dossier à eux : on les prend par préfixe. */
const HOOKS = 'src/hooks'

/** Motifs qui trahissent une fabrication de CSV, quel que soit l'outil employé. */
const MOTIFS: Array<{ re: RegExp; quoi: string }> = [
  { re: /exportToCsv/i, quoi: 'appel au helper exportToCsv' },
  { re: /text\/csv/i, quoi: 'type MIME text/csv' },
  { re: /\.csv['"`]/i, quoi: 'nom de fichier .csv' },
  { re: /\bcsvContent\b|\btoCsv\b|\bbuildCsv\b/i, quoi: 'fabrication de CSV' },
]

function fichiers(dossier: string, filtre: (n: string) => boolean, acc: string[] = []): string[] {
  if (!existsSync(dossier)) return acc
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) fichiers(chemin, filtre, acc)
    else if (filtre(entree)) acc.push(chemin)
  }
  return acc
}

/** Retire les commentaires : le mot « CSV » dans une prose explicative n'est pas un export. */
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

describe('aucun export CSV dans la console (étape 22)', () => {
  const cibles = [
    ...RACINES.flatMap((r) => fichiers(r, (n) => n.endsWith('.tsx') || n.endsWith('.ts'))),
    ...fichiers(HOOKS, (n) => /^useAdmin.*\.ts$/.test(n) || n === 'useChangelog.ts'),
  ]

  it('le balayage porte sur un périmètre non vide (garde anti-test creux)', () => {
    // Sans cette assertion, un chemin devenu faux rendrait le test suivant vert sur zéro
    // fichier — le motif exact du vert sans assertion.
    expect(cibles.length, 'aucun fichier de console balayé : les racines sont-elles bonnes ?')
      .toBeGreaterThan(20)
  })

  it('LA DÉCISION TIENT — aucune surface ne fabrique de CSV', () => {
    const fautifs: string[] = []
    for (const f of cibles) {
      const source = sansCommentaires(readFileSync(f, 'utf8'))
      for (const { re, quoi } of MOTIFS) {
        if (re.test(source)) fautifs.push(`${f} — ${quoi}`)
      }
    }
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
    expect(existsSync('src/lib/exportCsv.ts'),
      'src/lib/exportCsv.ts existe encore : l\'outil reste à portée de main').toBe(false)
  })

  it('les DEUX exports autorisés, eux, sont toujours là', () => {
    // Un garde-fou qui se contenterait d'interdire pourrait être satisfait par une console
    // sans aucun export. Ce n'est pas la décision : elle en autorise deux, nommément.
    expect(existsSync('supabase/functions/admin-dsar-export/index.ts'),
      'l\'export DSAR (JSON, §5.4) doit rester').toBe(true)
    expect(existsSync('supabase/functions/audit-pdf-export/index.ts'),
      'l\'export PDF de la piste d\'audit (§5.9) doit rester').toBe(true)
  })
})
