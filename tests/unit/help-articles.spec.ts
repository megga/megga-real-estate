/**
 * Garde-fou : une clé du catalogue d'aide n'existe que si une surface la produit.
 *
 * Pourquoi un test. `HELP_ARTICLES` est un `Record<string, string>` : TypeScript
 * accepte n'importe quelle clé, `openHelpFor` prend une `string`, et une entrée
 * que personne n'émet n'est du code mort qu'AUCUNE porte ne voit — ni `tsc`, ni
 * `lint:deadcode` (qui raisonne sur les exports, pas sur le contenu d'un objet).
 *
 * Ce n'est pas une hypothèse. Au 17 août 2026, QUATRE des treize clés étaient
 * injoignables depuis leur écriture : `billing`, `whatsapp` et `agence` visaient
 * des sections de réglages qui n'avaient aucun moyen de se nommer (la TopNav ne
 * recevait que `'settings'`), et `portail` visait une fonctionnalité supprimée du
 * produit le 26 juillet 2026. Trois articles publiés restaient donc inatteignables,
 * et le quatrième décrivait un écran qui n'existait plus — sans que rien ne le dise.
 *
 * Le test mesure les ÉMETTEURS dans le code source plutôt que de lister à la main
 * ce qui est censé exister : une liste à jour se périmerait exactement comme le
 * catalogue qu'elle garde.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { HELP_ARTICLES } from '@/lib/help-articles'

const SRC = 'src'
const SHELL = 'src/components/crm/CrmShell.tsx'

function fichiersTsx(racine: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(racine)) {
    const chemin = join(racine, nom)
    if (statSync(chemin).isDirectory()) fichiersTsx(chemin, acc)
    else if (/\.tsx?$/.test(chemin)) acc.push(chemin)
  }
  return acc
}

/**
 * Les clés qu'une surface peut réellement produire, relevées dans le code :
 *  - les membres du type `CrmScreenId` (tout onglet peut être `active`, et
 *    `openHelpFor(helpKey ?? active)` passe `active` à défaut de `helpKey`) ;
 *  - les valeurs littérales passées à `active=` — les pages sans onglet propre
 *    y castent une clé hors union (`'kyc' as CrmScreenId`) ;
 *  - les valeurs littérales passées à `helpKey=` ;
 *  - les appels directs `openHelpFor('…')`.
 */
function clesEmises(): Set<string> {
  const emises = new Set<string>()

  const shell = readFileSync(SHELL, 'utf-8')
  const union = shell.match(/export type CrmScreenId =([\s\S]*?)\n\n/)
  expect(union, `${SHELL} : type CrmScreenId introuvable — le relevé serait creux`).toBeTruthy()
  for (const [, id] of union![1].matchAll(/'([a-z-]+)'/g)) emises.add(id)

  for (const fichier of fichiersTsx(SRC)) {
    const code = readFileSync(fichier, 'utf-8')
    for (const [, id] of code.matchAll(/\bactive=(?:\{)?'([a-z-]+)'/g)) emises.add(id)
    for (const [, id] of code.matchAll(/\bactive="([a-z-]+)"/g)) emises.add(id)
    for (const [, id] of code.matchAll(/\bhelpKey=(?:\{)?'([a-z-]+)'/g)) emises.add(id)
    for (const [, id] of code.matchAll(/\bhelpKey="([a-z-]+)"/g)) emises.add(id)
    for (const [, id] of code.matchAll(/openHelpFor\('([a-z-]+)'\)/g)) emises.add(id)
    // Table de correspondance section → clé (SettingsPage) : `agency: 'agence',`
    for (const [, id] of code.matchAll(/^\s{2}[a-z]+: '([a-z-]+)',\s*$/gm)) {
      if (/SECTION_HELP/.test(code)) emises.add(id)
    }
  }
  return emises
}

describe('catalogue HELP_ARTICLES', () => {
  const emises = clesEmises()

  it('relève bien des émetteurs (sinon le reste ne prouve rien)', () => {
    // Sans ce garde-fou, une regex cassée rendrait l'ensemble vide et le test
    // suivant passerait au vert en n'ayant rien mesuré.
    expect(emises.size).toBeGreaterThan(8)
    expect(emises.has('pipeline'), 'un onglet de la TopNav doit être relevé').toBe(true)
  })

  it("n'a aucune clé qu'aucune surface ne produit", () => {
    const mortes = Object.keys(HELP_ARTICLES).filter(k => !emises.has(k))
    expect(
      mortes,
      `clé(s) d'aide injoignables — l'article existe, rien ne peut l'ouvrir :\n` +
        mortes.map(k => `  ${k} → article ${HELP_ARTICLES[k]}`).join('\n') +
        `\nBrancher la surface (prop \`helpKey\` de CrmTopNav) ou retirer la clé.`,
    ).toEqual([])
  })

  it('ne mappe que des identifiants Intercom plausibles', () => {
    // Un identifiant tronqué ou un titre collé par mégarde ouvrirait une page
    // vide dans le Messenger, sans erreur côté agent.
    const suspects = Object.entries(HELP_ARTICLES).filter(([, id]) => !/^\d{8}$/.test(id))
    expect(suspects, `identifiant(s) hors format : ${JSON.stringify(suspects)}`).toEqual([])
  })
})
