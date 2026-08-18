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
const SPLASH = 'src/components/layout/BootSplash.tsx'

/** Le bloc `<style id="megga-boot-style">` d'index.html, hors mouvement réduit. */
function feuilleDeLEcran(): string {
  const html = readFileSync(INDEX, 'utf8')
  const bloc = html.match(/<style id="megga-boot-style">([\s\S]*?)<\/style>/)
  if (!bloc) throw new Error(`bloc de style de l’écran d’arrivée introuvable dans ${INDEX}`)
  // La requête `prefers-reduced-motion` coupe toutes les animations : elle n’a
  // pas de retard à décaler, et l’y exiger ferait rougir un test pour rien.
  return bloc[1].replace(/@media \(prefers-reduced-motion[\s\S]*$/, '')
}

/** Règles CSS (`sélecteur { corps }`) d’un fragment de feuille, commentaires ôtés. */
function regles(css: string): { selecteur: string, corps: string }[] {
  const propre = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: { selecteur: string, corps: string }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(propre)) !== null) out.push({ selecteur: m[1].trim(), corps: m[2] })
  return out
}

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

/**
 * L'HORLOGE PARTAGÉE de l'écran d'arrivée.
 *
 * Sur le trajet d'arrivée, le MÊME écran est monté jusqu'à quatre fois de suite —
 * jumeau HTML d'index.html, `AuthCallbackPage`, le gate `loading` de
 * `ProtectedRoute`, puis `BootCurtain`. Un élément neuf redémarre toujours ses
 * animations CSS à zéro : sans horloge commune, chaque relais refait apparaître le
 * logo, remet la barre à gauche et réarme le retard de la mention — au point que
 * « Ouverture de votre espace » pouvait ne jamais s'afficher avant que le rideau
 * ne se lève.
 *
 * Le mécanisme tient à trois pièces dans trois fichiers, et aucune ne casse quoi
 * que ce soit en disparaissant : l'app compile, les tests passent, l'écran
 * s'affiche. Seul le raccord redevient un saut, ce qui ne se voit qu'à l'œil, une
 * fois, à la connexion.
 */
describe('horloge partagée de l’écran d’arrivée', () => {
  it('retranche l’horloge du retard de CHAQUE animation', () => {
    const animees = regles(feuilleDeLEcran())
      .filter((r) => /animation:\s*megga-boot-/.test(r.corps))

    // Quatre temps : halo, logo, barre, mention. Si ce compte change, le test
    // doit être relu — pas contourné.
    expect(animees.length).toBeGreaterThanOrEqual(4)

    for (const { selecteur, corps } of animees) {
      expect(corps, `${selecteur} : animation sans horloge partagée`)
        .toMatch(/animation-delay:\s*calc\([^;]*var\(--megga-boot-t/)
      // Un retard laissé DANS le raccourci `animation` écraserait le
      // `animation-delay` qui suit… ou serait écrasé par lui, selon l'ordre.
      // Les deux sont des pièges silencieux : le raccourci n'en porte aucun.
      expect(corps.match(/animation:\s*megga-boot-[^;]*/)?.[0], `${selecteur} : retard resté dans le raccourci`)
        .not.toMatch(/\d(\.\d+)?s\s+[\d.]+s/)
    }
  })

  it('estampille l’origine de l’horloge avant que le corps ne se peigne', () => {
    const html = readFileSync(INDEX, 'utf8')
    const tete = html.slice(0, html.indexOf('</head>'))
    // Dans le <head>, avec la classe qui borne l'écran au trajet d'arrivée :
    // une origine posée plus tard daterait d'après la première frame.
    expect(tete).toContain('__MEGGA_BOOT_T0')
    expect(tete.indexOf('megga-booting')).toBeLessThan(tete.indexOf('__MEGGA_BOOT_T0'))
  })

  it('précharge le halo sur le trajet d’arrivée, et là seulement', () => {
    const html = readFileSync(INDEX, 'utf8')
    const tete = html.slice(0, html.indexOf('</head>'))

    // Image de FOND : sans préchargement, sa requête ne part qu'une fois
    // `.megga-boot__glow` mis en page, donc après l'analyse du corps.
    expect(tete, 'le halo n’est plus préchargé').toMatch(/rel\s*=\s*'preload'/)
    expect(tete).toMatch(/megga-boot-glow\.png/)

    // ⚠ Conditionnel : une balise <link rel=preload> STATIQUE téléchargerait
    // 294 Ko sur chaque page publique, où cet écran n'existe pas, et signalerait
    // un « preloaded but not used » dans une console que 35 tests E2E veulent vierge.
    expect(html, 'préchargement statique : il partirait sur toutes les pages')
      .not.toMatch(/<link[^>]*rel="preload"[^>]*megga-boot-glow/)
    // Dans le même bloc que le gate, donc sous la même condition de chemin.
    expect(tete.indexOf('megga-booting')).toBeLessThan(tete.indexOf('megga-boot-glow.png'))
  })

  it('fait lire l’horloge au jumeau React', () => {
    const source = readFileSync(SPLASH, 'utf8')
    expect(source).toContain('__MEGGA_BOOT_T0')
    expect(source).toMatch(/'--megga-boot-t'/)
    // Gelée au montage : recalculée à chaque rendu, elle ferait repartir les
    // animations quand `BootCurtain` passe `is-done` — le saut, à la dernière image.
    expect(source).toMatch(/useState\(ecouleDepuisLaPremiereFrame\)/)
  })

  it('laisse la mention s’afficher avant que le rideau ne se lève', () => {
    const mention = feuilleDeLEcran()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\.megga-boot__hint\s*\{[^}]*animation-delay:\s*calc\(([\d.]+)s/)
    if (!mention) throw new Error(`retard de .megga-boot__hint introuvable dans ${INDEX}`)

    const retardMs = Number(mention[1]) * 1000
    // Le plancher tient l'écran au moins MIN_VISIBLE_MS ; la mention doit
    // apparaître AVANT, et rester assez longtemps pour être lue. 400 ms est la
    // durée de son propre fondu : moins que ça, elle n'a pas fini d'arriver
    // qu'elle repart déjà.
    expect(retardMs + 400).toBeLessThan(constant('MIN_VISIBLE_MS'))
  })
})
