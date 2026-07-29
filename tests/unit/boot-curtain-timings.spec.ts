/**
 * Cohérence des durées de l'écran d'arrivée ([[BootCurtain]] + index.html).
 *
 * Pourquoi un test plutôt qu'un commentaire. Ces trois durées vivent dans DEUX
 * fichiers et deux langages, et aucune ne casse quoi que ce soit quand elle
 * dérive : l'app compile, les tests passent, l'écran s'affiche. Le défaut ne se
 * voit qu'à l'œil, à l'arrivée sur le CRM, sur une machine qui charge vite.
 *
 * Les deux dérives possibles, toutes deux silencieuses :
 *
 * 1. `MIN_VISIBLE_MS` passé au-dessus de `SAFETY_MS`. Le filet ne connaît pas le
 *    plancher et lève sans condition : le rideau part à `SAFETY_MS` et la valeur
 *    réglée dans `MIN_VISIBLE_MS` ne fait plus rien du tout. Piège vécu en
 *    réglant ce plancher — une mesure à 20 s « prouvait » que le plancher ne
 *    marchait pas, alors qu'elle mesurait le filet à 8 s.
 *
 * 2. `FADE_MS` désaligné de la transition CSS de `.megga-boot`. Le composant
 *    démonte le rideau après `FADE_MS` ; si le CSS est plus lent, le nœud
 *    disparaît d'un coup en plein fondu, et le raccord vitrine → CRM que tout ce
 *    dispositif existe pour lisser redevient une coupure.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CURTAIN = 'src/components/layout/BootCurtain.tsx'
const INDEX = 'index.html'

/** Valeur d'une constante `const NOM = <nombre>` du composant. */
function constant(name: string): number {
  const source = readFileSync(CURTAIN, 'utf8')
  const match = source.match(new RegExp(`^const ${name} = (\\d+)$`, 'm'))
  if (!match) throw new Error(`${name} introuvable dans ${CURTAIN} — constante renommée ou supprimée ?`)
  return Number(match[1])
}

describe('durées de l’écran d’arrivée', () => {
  it('garde le plancher sous le filet, fondu compris', () => {
    const min = constant('MIN_VISIBLE_MS')
    const fade = constant('FADE_MS')
    const safety = constant('SAFETY_MS')

    // Strict, et pas seulement `<` : la sortie complète (plancher + fondu) doit
    // tenir sous le filet, sinon celui-ci tranche au milieu du fondu.
    expect(min + fade).toBeLessThan(safety)
  })

  it('ne laisse pas le plancher devenir une punition', () => {
    // Un plancher est une transition, pas une salle d'attente. Au-delà de deux
    // secondes on ne soigne plus l'arrivée, on la subit.
    expect(constant('MIN_VISIBLE_MS')).toBeLessThanOrEqual(2000)
  })

  it('tient FADE_MS aligné sur la transition CSS de .megga-boot', () => {
    const html = readFileSync(INDEX, 'utf8')
    const match = html.match(/transition:\s*opacity\s+([\d.]+)s/)
    if (!match) throw new Error(`transition d’opacité introuvable dans ${INDEX}`)

    expect(Math.round(Number(match[1]) * 1000)).toBe(constant('FADE_MS'))
  })
})
