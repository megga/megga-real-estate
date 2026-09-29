/**
 * Garde-fou : sur la Recherche de « Matching » (la page 1 du pager), l'encre reste lisible.
 *
 * ⛔ POURQUOI UNE GARDE À PART. `megga-x-grammar.spec.ts` compte des littéraux, il ne mesure pas un contraste. Ce que
 * cette garde tient ne se voit qu'en MESURANT : la pastille de baisse de prix, qu'une mesure au rendu a trouvée sous
 * l'AA (`#C45A00`, 4,37:1 sur la carte blanche), une encre translucide, qu'on ne mesure pas si on la lit nue, et la
 * marque des régies, qu'une seconde implémentation chargerait sans ses garde-fous.
 *
 * ⚠ Jusqu'au 27.09.2026, elle lisait aussi la feuille de l'atelier de bureau (`atelier.css` : ses quatre paliers
 * d'encre, dans les deux thèmes) et les initiales d'avatar de ses composants — partis avec l'atelier (lot E1). Ce qui
 * reste est la Recherche.
 *
 * ⚠ PIÈGE DE MESURE, coûté une demi-heure : `getComputedStyle` lu pendant que le volet du navigateur est masqué rend
 * la valeur de DÉPART d'une transition en cours — les images ne sont pas composées, donc la transition n'avance
 * jamais. Forcer une image avant de lire.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/** Les composants de la Recherche, carte GELÉE exclue (voir le cliquet). */
const RECHERCHE = readdirSync('src/components/matching-recherche')
  .filter((n) => n.endsWith('.tsx') && n !== 'MrhMapView.tsx')
  .map((n) => ({ nom: `src/components/matching-recherche/${n}`, code: readFileSync(`src/components/matching-recherche/${n}`, 'utf-8') }))

const canal = (hex: string): [number, number, number] =>
  [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [number, number, number]

function luminance(hex: string): number {
  return canal(hex)
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Seuil 4,5 partout, et non 3 : le palier « grand texte » de WCAG commence à 18,66 px en gras, et les textes que
 * peignent ces encres n'y arrivent pas.
 */
const AA = 4.5

describe('Matching — sur la Recherche, l’encre reste lisible', () => {
  /**
   * Sans ce témoin, un dossier renommé rendrait une liste VIDE, et les boucles ci-dessous passeraient par vacuité.
   */
  it('la garde voit bien les composants de la Recherche', () => {
    expect(RECHERCHE.length, 'aucun composant de la Recherche lu — la garde ne mesure plus rien').toBeGreaterThan(5)
    expect(RECHERCHE.map((r) => r.nom)).toContain('src/components/matching-recherche/MrhCard.tsx')
  })

  /**
   * ⛔ LA PASTILLE DE BAISSE DE PRIX — le seul écart que le reciblage ait laissé
   * sous l'AA, et le seul défaut de contraste que la sonde au rendu ait trouvé
   * hors de l'atelier : `#C45A00` rendait 4,37:1 sur la carte blanche et 4,15:1
   * sur la sous-carte.
   *
   * ⚠ CE N'EST PAS UN RECIBLAGE. `--sys-yellow` reste une couleur FONCTIONNELLE
   * — elle dit « le prix a baissé », une information que les neutres ne savent
   * pas porter. On ne la remplace pas par un gris : on l'ASSOMBRIT dans sa propre
   * famille, jusqu'à ce qu'elle passe. Même geste que `tk.goal`, monté de
   * `#059669` à `#047857` sur « Mes biens » — et comme là-bas, la valeur retenue
   * EXISTE DÉJÀ dans le dépôt (`--color-warning-dark` de `globals.css`, `warnFg`
   * du rapport KYC) plutôt que d'être inventée pour l'occasion.
   *
   * ⚠ La teinte sert dans les DEUX rôles — encre sur la carte, et aplat sous une
   * encre blanche. Le contraste étant symétrique, un seul seuil couvre les deux ;
   * ce test le dit explicitement pour que personne ne « corrige » un seul rôle.
   */
  it('la pastille de baisse de prix est lisible dans ses deux rôles', () => {
    const src = readFileSync('src/components/matching-recherche/mrhCtx.ts', 'utf-8')
    const aplatTeinte = /MRH_PRICE_DROP\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(src)?.[1]
    // ⚠ Ancré sur la VALEUR, pas sur la signature : un motif qui décrivait le
    // typage (`(dark: boolean): string =>`) se casse au premier refactor de
    // forme sans que la règle ait changé — une garde qui rougit pour rien se
    // fait désarmer, pas corriger.
    const encreSombre = /mrhPriceDropInk[\s\S]*?dark \? '(#[0-9a-fA-F]{6})'/.exec(src)?.[1]
    expect(aplatTeinte, 'MRH_PRICE_DROP introuvable — la garde ne mesure plus rien').toMatch(/^#/)
    expect(encreSombre, 'encre sombre introuvable — la garde ne mesure plus rien').toMatch(/^#/)

    const faibles: string[] = []
    // ── rôle ENCRE, sur les surfaces pleines de CHAQUE thème ──
    // ⛔ C'est ici que la première version de cette garde était trop courte : elle
    // ne mesurait que le clair. Assombrir la teinte pour passer sur blanc l'a
    // fait tomber à 3,97:1 sur la carte sombre — un correctif qui déplace le
    // défaut d'un thème à l'autre, et une garde qui l'aurait laissé passer.
    for (const [theme, encre, surfaces] of [
      ['clair', aplatTeinte as string, { carte: '#ffffff', 'sous-carte': '#f9f9f9' }],
      ['sombre', encreSombre as string, { carte: '#090909', 'sous-carte': '#050505' }],
    ] as const) {
      for (const [nom, surface] of Object.entries(surfaces)) {
        const r = contraste(encre, surface)
        if (r < AA) faibles.push(`encre ${theme} sur ${nom} = ${r.toFixed(2)}:1`)
      }
    }
    // ── rôle APLAT : encre blanche par-dessus, donc INVARIANT — l'aplat porte
    // son propre fond, il ne dépend pas du thème de la page. Une seule valeur
    // suffit, et c'est pour ça que les deux rôles ne peuvent pas partager la
    // même constante.
    const aplat = contraste('#ffffff', aplatTeinte as string)
    if (aplat < AA) faibles.push(`blanc sur l'aplat = ${aplat.toFixed(2)}:1`)
    expect(faibles, `sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ UNE SEULE VALEUR POUR UN SEUL SENS. La teinte vivait en QUATRE exemplaires
   * — trois littéraux dans les composants de la Recherche et `--sys-yellow` dans
   * la feuille de l'atelier. Sur cette surface, une valeur dupliquée a toujours
   * fini par diverger (la table des statuts l'a fait trois fois). Les composants
   * lisent la constante : aucun ne la recopie.
   */
  it('la teinte de baisse de prix n’existe qu’en un exemplaire', () => {
    const src = readFileSync('src/components/matching-recherche/mrhCtx.ts', 'utf-8')
    const teinte = (/MRH_PRICE_DROP\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(src)?.[1] ?? '').toLowerCase()
    expect(teinte, 'MRH_PRICE_DROP introuvable — la garde ne mesure plus rien').toMatch(/^#/)
    const litteraux: string[] = []
    for (const { nom, code } of RECHERCHE) {
      for (const m of code.matchAll(/#[0-9a-fA-F]{6}/g)) {
        if (m[0].toLowerCase() === teinte) litteraux.push(`${nom} — ${m[0]}`)
      }
    }
    expect(litteraux, `teinte recopiée au lieu d'être lue :\n  ${litteraux.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UNE ENCRE TRANSLUCIDE N'EST PAS UNE ENCRE FAIBLE, C'EST UNE ENCRE QU'ON NE
   * MESURE PAS.
   *
   * `MrhExtDetail` déclarait `dot = dark ? 'rgba(255,255,255,.22)' : …` pour un
   * séparateur « · » — 1,68:1 en clair, 1,89:1 en sombre : un jeton qui n'existe
   * QUE pour être plus faible que ses voisins, et « plus faible » finit toujours
   * sous le plancher.
   *
   * ⚠ La garde compose l'ALPHA sur la surface — une valeur lue nue mentirait,
   * c'est le piège (b) du catalogue de sondes. Et elle ne vise que ce qui sert
   * d'ENCRE : `line` et `mapLine` sont des FILETS, ils n'ont pas à passer un
   * seuil de texte.
   */
  it('aucune encre translucide sous l’AA', () => {
    const compose = (rgba: string, fond: string): string => {
      const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(rgba)
      if (!m) return rgba
      const a = m[4] === undefined ? 1 : Number(m[4])
      const f = canal(fond)
      const v = [1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + f[k] * (1 - a)))
      return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('')
    }
    const faibles: string[] = []
    for (const { nom, code } of RECHERCHE) {
      for (const m of code.matchAll(/const (\w+) = dark \? '(rgba\([^']+\))' : '(rgba\([^']+\))'/g)) {
        const [, id, sombre, clair] = m
        // Seulement si la variable est employée comme ENCRE quelque part.
        if (!new RegExp(`color:\\s*${id}\\b`).test(code)) continue
        for (const [theme, valeur, surface] of [
          ['clair', clair, '#ffffff'],
          ['sombre', sombre, '#090909'],
        ] as const) {
          const r = contraste(compose(valeur, surface), surface)
          if (r < AA) faibles.push(`${nom} — ${id} (${theme}) = ${r.toFixed(2)}:1`)
        }
      }
    }
    expect(faibles, `encre translucide sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN SEUL CHEMIN POUR CHARGER LA MARQUE D'UNE RÉGIE.
   *
   * `MrhAgencyLogo` porte trois choses qui ne se voient pas dans une capture et
   * qu'une seconde implémentation perdrait en silence : le mémo d'échec PAR URL
   * (un booléen bloquerait une carte recyclée sur le repli), `referrerPolicy` à
   * `no-referrer` (le CDN est tiers, on ne lui envoie pas l'URL de l'app) et
   * `loading="lazy"` (la grille monte jusqu'à 400 cartes sans virtualisation).
   *
   * ⚠ La règle n'est donc pas « il faut un logo » mais « il n'y a qu'un endroit
   * qui en charge un ». Sur cette surface, une valeur ou une mécanique dupliquée
   * a toujours fini par diverger — la table des statuts l'a fait trois fois.
   */
  it('la marque des régies ne se charge qu’à un seul endroit', () => {
    const porteurs: string[] = []
    for (const { nom, code } of RECHERCHE) {
      if (nom.endsWith('MrhAgencyLogo.tsx')) continue
      // Une balise `img` dont la source est un logo de régie, écrite ailleurs
      // que dans le composant partagé.
      if (/<img[^>]*agency_logo_url/.test(code)) porteurs.push(nom)
      if (/agency_logo_url/.test(code) && !/MrhAgencyLogo/.test(code)) porteurs.push(`${nom} (lit la colonne sans passer par le composant)`)
    }
    expect(porteurs, `chargement de logo hors du composant partagé :\n  ${porteurs.join('\n  ')}`).toEqual([])
  })
})
