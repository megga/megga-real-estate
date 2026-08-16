/**
 * Garde-fou — un voile PLEIN ÉCRAN ne se peint jamais avec le voile d'encre.
 *
 * ⛔ CE QUI EST ARRIVÉ. Le port MEGGA X a remplacé des noirs écrits en dur par
 * `crmVoileEncre(dark, …)`, qui rend « ce qui s'oppose à la surface » — donc du
 * BLANC en thème sombre. Juste pour un survol ou un filet, faux pour un voile de
 * modale : les cinq modales de revue du copilote et le panneau « Signé » du
 * pipeline noyaient l'écran sous un drap blanc à 55 % au lieu de l'assombrir.
 *
 * Le défaut est invisible là où l'on développe : en thème CLAIR, les deux
 * fonctions rendent exactement le même noir. Il ne se voit qu'en sombre, et
 * aucune capture de référence ne couvrait ces modales.
 *
 * ── POURQUOI CETTE RÈGLE-LÀ, ET PAS UN SEUIL D'OPACITÉ ───────────────────────
 * Le premier réflexe est d'interdire `crmVoileEncre(dark, α)` au-delà d'un α.
 * Mesuré le 16 août 2026, ça ne marche pas : `LiquidGlassRail` l'emploie à 0,62
 * et 0,92 pour l'ENCRE des glyphes du rail (légitime — un glyphe doit se
 * détacher), et `PipelineTimeline` à 0,25 pour un trait de glisser d'un pixel
 * (légitime aussi, pour la même raison). L'opacité ne dit rien de l'intention.
 *
 * Ce qui la dit, c'est la GÉOMÉTRIE : un élément `position: fixed` + `inset: 0`
 * couvre la fenêtre entière. Un tel élément ne cherche jamais à se détacher de la
 * surface — il la repousse. Sa couleur doit donc être `crmVoileAssombrissant`,
 * qui ne dépend pas du thème.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/** Fenêtre remontée depuis le `background:` pour retrouver la géométrie du bloc. */
const PORTEE = 320

interface Coupable {
  fichier: string
  ligne: number
  extrait: string
}

function voilesPleinEcran(): { coupables: Coupable[], fichiersLus: number } {
  const scan = scanRoots([
    { root: 'src', keep: (n) => n.endsWith('.ts') || n.endsWith('.tsx') },
  ])
  const coupables: Coupable[] = []
  let fichiersLus = 0

  for (const abs of scan.files) {
    const lu = readFileSafely(abs)
    if (lu.status !== 'ok') continue
    fichiersLus += 1
    const code = lu.value
    // On ne cherche QUE le rôle « fond » : la même fonction en `color`, en `border`
    // ou stockée dans une const d'encre est hors sujet — c'est là que vivent les
    // emplois légitimes à forte opacité.
    for (const m of code.matchAll(/background:\s*crmVoileEncre\(\s*dark\b/g)) {
      const debut = Math.max(0, m.index - PORTEE)
      const contexte = code.slice(debut, m.index)
      // `inset: 0` seul suffit à désigner un recouvrement complet ; on exige en plus
      // le `position: fixed`/`absolute` qui lui donne son effet, pour ne pas compter
      // une propriété homonyme dans une chaîne CSS quelconque.
      if (!/inset:\s*0\b/.test(contexte)) continue
      if (!/position:\s*'(fixed|absolute)'/.test(contexte)) continue
      coupables.push({
        fichier: rel(abs),
        ligne: code.slice(0, m.index).split('\n').length,
        extrait: code.slice(m.index, m.index + 60).split('\n')[0],
      })
    }
  }
  return { coupables, fichiersLus }
}

describe('voile plein écran', () => {
  const { coupables, fichiersLus } = voilesPleinEcran()

  // Contrôle positif : un scan vide rendrait la clause verte pour la pire des
  // raisons — c'est le mode de panne que ce dépôt a déjà rencontré ailleurs.
  it('a bien lu l\'arbre des sources', () => {
    expect(fichiersLus, 'scan vide : racine cassée ou cwd inattendu').toBeGreaterThan(400)
  })

  it('aucun n\'est peint avec le voile d\'ENCRE', () => {
    const liste = coupables.map((c) => `  ${c.fichier}:${c.ligne} — ${c.extrait}`).join('\n')
    expect(
      coupables,
      'Un élément `position: fixed` + `inset: 0` couvre toute la fenêtre : il REPOUSSE '
        + 'l\'arrière-plan au lieu de s\'en détacher, donc il doit rester sombre dans les '
        + 'deux thèmes. `crmVoileEncre(dark, …)` y rend du BLANC en thème sombre — un drap '
        + 'clair sur toute la page. Employer `crmVoileAssombrissant(α)`.\n' + liste,
    ).toEqual([])
  })
})
