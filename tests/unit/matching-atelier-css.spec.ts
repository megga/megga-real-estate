/**
 * Garde-fou : `atelier.css` suit la direction MEGGA X — et c'est la PREMIÈRE
 * garde du dépôt qui lise la grammaire d'une feuille de style.
 *
 * ⛔ POURQUOI. `atelier.css` (868 lignes) est un SECOND système de jetons :
 * 29 variables à lui, 39 blocs de thème sombre, et aucune garde ne l'ouvrait.
 * `megga-x-grammar.spec.ts` ne lit que les styles EN LIGNE des `.tsx` ;
 * `megga-x-crm-tokens.spec.ts` lit `megga-x.generated.css` et `globals.css` ;
 * `graphite-scale.spec.ts` n'ouvre aucun `.css`. Trois règles abandonnées y
 * avaient donc survécu intactes à deux campagnes de retrait, toutes portes
 * vertes : le noir de Sugar `#0B0C0E`, la règle « l'accent EST l'encre »
 * (`--black` qui s'inversait en blanc au sombre) et l'échelle Graphite.
 *
 * ⚠ Un fait qui explique le reste : le bloc sombre portait un commentaire disant
 * « valeurs de CLAUDE.md ». Il disait VRAI — pour la version de `CLAUDE.md` de
 * l'époque, celle de Graphite. La référence a bougé le 10 août, la feuille non.
 * Ce n'est donc pas un dossier négligé, c'est un dossier aligné sur une norme
 * périmée : plus difficile à voir, et invisible à toute garde qui ne lit pas le
 * CSS. Sans ce fichier, tout le reciblage peut se défaire au premier commit
 * suivant sans qu'une porte bouge.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

const FEUILLE = 'src/components/matching-atelier/atelier.css'
const css = readFileSync(FEUILLE, 'utf-8')

/** Retire les commentaires : sinon la note qui EXPLIQUE un retrait le fait
 *  rougir. Troisième occurrence du piège dans le dépôt. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))

const bloc = (sombre: boolean): string => {
  const motif = sombre
    ? /\.sga\[data-theme="dark"\]\s*\{([^}]*)\}/g
    : /(?<!\])\.sga\s*\{([^}]*)\}/g
  return [...code.matchAll(motif)].map((m) => m[1]).join('\n')
}

/**
 * Teintes SÉMANTIQUES admises hors de l'échelle neutre — elles ENCODENT une
 * information que les neutres ne savent pas porter, exactement comme
 * `SG_STAGE_HUE` du pipeline. La feuille les documente elle-même : « couleurs
 * fonctionnelles — données métier, jamais d'accent UI ».
 *
 * ⚠ Liste FERMÉE et nommée. Une exemption par famille (« tout ce qui est
 * coloré ») laisserait rentrer n'importe quoi ; c'est l'écart qu'on fige, pas la
 * catégorie.
 */
const SEMANTIQUES = new Set([
  '#059669', '#C0453B', '#B45309', '#1E5BC6', // --sys-* (clair) — le jaune assombri pour l'AA
  '#34D399', '#F0857A', '#E89B5A', '#7FA8FF', // leurs pendants sombres
  '#0041D9', '#6F8CFF',                       // --sga-kyc-seal, aligné sur le token mobile
])

/** L'accent et son survol dérivé — mesurés, pas choisis. Voir le test dédié. */
const ACCENTS = new Set(['#424bfb', '#3a42dd', '#5961fb'])

const ECHELLE = new Set(Object.values(MXC_COLOR).map((v) => v.toLowerCase()))

/** Barreaux de rayon de la grammaire (`globals.css`). */
const RAYONS = new Set([2, 4, 8, 12, 16, 20, 24, 999])

/**
 * ⛔ LA SECONDE FEUILLE DU PÉRIMÈTRE, que personne ne lisait non plus.
 * `mrh.css` (93 lignes) est petite, et c'est exactement pour ça qu'elle passait
 * sous le radar : elle n'a pas de bloc de jetons, seulement quelques replis de
 * `var()` et un rayon. Un fichier qu'aucune garde n'ouvre ne devient pas propre
 * en étant court.
 */
const MRH = 'src/components/matching-recherche/mrh.css'
const mrh = readFileSync(MRH, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('mrh.css — la seconde feuille du périmètre', () => {
  it('la garde voit bien la feuille', () => {
    expect(mrh).toContain('.mrh-root')
  })

  /**
   * ⛔ LE GRIS-BLEU. `rgba(15,23,42,…)` est le slate-900 de Tailwind (B−R = 27).
   * `atelier.css` portait déjà, dans son propre en-tête, la note « jamais de
   * gris-bleu » et l'avait neutralisé chez lui — il avait survécu dans le
   * dossier VOISIN, 17 fois. Un correctif qui ne traverse qu'un des deux
   * dossiers d'un même écran : cinquième occurrence documentée.
   */
  it('aucun gris-bleu', () => {
    const restes = mrh.match(/rgba?\(\s*15\s*,\s*23\s*,\s*42/g) ?? []
    expect(restes, `slate-900 vivant : ${restes.length}`).toEqual([])
  })

  it('tous les rayons sont des barreaux de l’échelle', () => {
    const hors = [...mrh.matchAll(/border-radius\s*:\s*([0-9.]+)px/g)]
      .map((m) => Number(m[1]))
      .filter((v) => !RAYONS.has(v))
    expect(hors, `rayons hors échelle : ${hors.join(', ')}`).toEqual([])
  })

  /**
   * Les replis de `var(--x, repli)` ne sont pas décoratifs : ils PEIGNENT dès que
   * l'appelant oublie de poser la variable, et c'est le cas le moins surveillé
   * qui soit. Ils doivent donc sortir de l'échelle comme le reste.
   *
   * ⚠ Le halo conique de MEGGA AI est exempté NOMMÉMENT : ses quatre teintes
   * SONT la signature de la marque, pas une décoration neutre.
   */
  it('les replis de var() sortent de l’échelle', () => {
    const HALO = new Set(['#7c63f0', '#c44fb8', '#2a6fdb', '#0891b2'])
    const FOCUS = new Set(['#0041d9', '#8da4ff'])
    const hors = [...mrh.matchAll(/var\(--[a-z-]+,\s*(#[0-9a-fA-F]{6})\s*\)/g)]
      .map((m) => m[1].toLowerCase())
      .filter((h) => !ECHELLE.has(h) && !HALO.has(h) && !FOCUS.has(h))
    expect(hors, `replis hors échelle : ${hors.join(', ')}`).toEqual([])
  })
})

describe('atelier.css — la feuille suit MEGGA X', () => {
  it('la garde voit bien la feuille et ses deux blocs', () => {
    expect(code.length, 'feuille vide ou illisible').toBeGreaterThan(10_000)
    expect(bloc(false)).toContain('--ink')
    expect(bloc(true)).toContain('--ink')
    expect(bloc(false)).not.toBe(bloc(true))
  })

  /**
   * ⛔ L'ÉCHELLE GRAPHITE NE PEINT PLUS LE CRM (`CLAUDE.md` §3). Elle avait
   * survécu ici neuf fois — `#17181A` ×4, `#121213` ×2, `#1E1F21` ×2, `#12161C`
   * — parce que `graphite-scale.spec.ts` n'inspecte que des objets JS.
   */
  it('aucune valeur de l’échelle Graphite', () => {
    const restes = code.match(/#17181A|#121213|#1E1F21|#12161C|#26272A/gi) ?? []
    expect(restes, `Graphite vivant : ${restes.join(', ')}`).toEqual([])
  })

  /**
   * ⛔ LE NOIR DE SUGAR, SOUS SES DEUX ALPHABETS — `#0B0C0E` et
   * `rgba(11,12,14,…)`. C'est sous la seconde forme qu'il avait traversé la
   * relecture ailleurs dans le dépôt.
   */
  it('aucun noir Sugar', () => {
    const restes = code.match(/#0B0C0E\b|#0A0B0D\b|#0A0A0F\b|rgba?\(\s*11\s*,\s*12\s*,\s*14/gi) ?? []
    expect(restes, `noir Sugar vivant : ${restes.join(', ')}`).toEqual([])
  })

  /**
   * Chaque couleur DÉCLARÉE dans les deux blocs de jetons est un barreau réel de
   * l'échelle MEGGA X, un accent mesuré, ou une teinte sémantique nommée.
   */
  it.each([['clair', false], ['sombre', true]] as const)('les jetons sortent de l’échelle (%s)', (_nom, sombre) => {
    const hors: string[] = []
    for (const m of bloc(sombre).matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
      const [, nom, hex] = m
      if (ECHELLE.has(hex.toLowerCase())) continue
      if (SEMANTIQUES.has(hex) || SEMANTIQUES.has(hex.toUpperCase())) continue
      if (ACCENTS.has(hex.toLowerCase())) continue
      hors.push(`${nom}: ${hex}`)
    }
    expect(hors, `hors échelle :\n  ${hors.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ « L'ACCENT EST L'ENCRE » EST MORTE (10 août 2026). `--black` valait
   * `#0B0C0E` en clair et `#FFFFFF` en SOMBRE : l'élément actif était peint en
   * encre inversée, donc en non-couleur. La règle est désormais « l'élément
   * ACTIF porte `#424bfb` » — et un accent qui s'inverserait encore avec le
   * thème serait le retour de la règle retirée, sous un autre nom.
   */
  it('l’accent ne s’inverse plus avec le thème', () => {
    const clair = /--accent\s*:\s*(#[0-9a-fA-F]{6})/.exec(bloc(false))?.[1]?.toLowerCase()
    const sombre = /--accent\s*:\s*(#[0-9a-fA-F]{6})/.exec(bloc(true))?.[1]?.toLowerCase()
    expect(clair, '--accent absent du bloc clair').toBe(MXC_COLOR.accent)
    // Absent du bloc sombre = INVARIANT, ce qui est le comportement voulu. S'il
    // y est, il doit valoir la même chose.
    if (sombre) expect(sombre, '--accent s’inverse encore au sombre').toBe(MXC_COLOR.accent)
  })

  /**
   * ⛔ LA POLICE. `"Manrope"` écrasait `--crm-font` (Inter Tight) sur toute la
   * surface. Les deux piles MONOSPACE restent : elles servent des références et
   * un cartouche, où l'alignement des caractères est le propos.
   */
  it('aucune famille de police en dur, hors monospace assumé', () => {
    const fautives = [...code.matchAll(/font-family\s*:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((v) => !/^inherit$/.test(v))
      .filter((v) => !/ui-monospace/.test(v))
      .filter((v) => !/var\(--crm-font/.test(v))
    expect(fautives, `police en dur :\n  ${fautives.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ LES RAYONS SONT DEUX POPULATIONS, et le plan n'en voyait qu'une. Les sept
   * variables `--r-*` (10 · 12 · 14 · 16 · 18 · 22 · 999) ET dix-neuf
   * `border-radius` LITTÉRAUX, qui contournent les variables — douze valeurs
   * distinctes, dont 7, 9, 11, 15, 26 et 28.
   *
   * L'échelle est verrouillée par `megga-x-crm-tokens.spec.ts` : on descend sur
   * un barreau existant, on n'en ajoute pas pour faire coïncider un dossier.
   */
  it('tous les rayons sont des barreaux de l’échelle', () => {
    const hors: string[] = []
    for (const m of code.matchAll(/border-radius\s*:\s*([0-9.]+)px/g)) {
      if (!RAYONS.has(Number(m[1]))) hors.push(`border-radius: ${m[1]}px`)
    }
    for (const m of code.matchAll(/(--r-[a-z0-9]+)\s*:\s*([0-9.]+)px/g)) {
      if (!RAYONS.has(Number(m[2]))) hors.push(`${m[1]}: ${m[2]}px`)
    }
    expect(hors, `rayons hors échelle :\n  ${[...new Set(hors)].join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ EN SOMBRE, LA SÉPARATION VIENT DE LA BORDURE, PAS DE L'OMBRE.
   * `sp.shadow` vaut `'none'` en sombre (`CLAUDE.md` §3). Recibler les trois
   * niveaux d'ombre naïvement en garderait trois là où il ne doit y en avoir
   * aucune.
   *
   * ⚠ Les ombres INTERNES (`inset`) sont autre chose : elles dessinent un filet,
   * pas une élévation. Elles restent.
   */
  it('aucune ombre portée sur une surface sombre', () => {
    // ⚠ PREMIÈRE VERSION TROP ÉTROITE, et elle est passée AU VERT : elle ne
    // lisait que le bloc de jetons. Quatre règles sombres portent leur ombre
    // ailleurs dans la feuille — la feuille annonce, la mini-carte, le pied de
    // feuille, la pastille de succès. Une garde qui ne regarde que là où on a
    // rangé les valeurs ne voit pas celles qu'on a écrites à côté : c'est le
    // même angle mort que le cliquet qui ne lit que les styles en ligne.
    const portees: string[] = []
    for (const m of code.matchAll(/([^{}]*\[data-theme="dark"\][^{}]*)\{([^}]*)\}/g)) {
      const [, selecteur, corps] = m
      for (const d of corps.matchAll(/(?:box-shadow|--sh[a-z-]*)\s*:\s*([^;]+);?/g)) {
        const v = d[1].trim()
        if (v === 'none' || /^inset/.test(v)) continue
        // Un anneau à flou NUL est un FILET, pas une élévation — et le filet est
        // précisément ce qui sépare en sombre. Il reste.
        if (/^0 0 0 [\d.]+px/.test(v)) continue
        portees.push(`${selecteur.trim()} → ${v}`)
      }
    }
    expect(portees, `ombres portées au sombre :\n  ${portees.join('\n  ')}`).toEqual([])
  })
})
