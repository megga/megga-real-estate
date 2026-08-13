/**
 * Garde-fou : sur « Matching », l'encre reste lisible — et la garde LIT LE CSS.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE, et pourquoi il est d'une espèce nouvelle.
 * `atelier.css` (868 lignes) déclare son PROPRE jeu de jetons — 29 variables,
 * dont quatre paliers d'encre et cinq surfaces — et **aucune garde du dépôt ne
 * l'ouvre**. Vérifié fichier par fichier : `megga-x-grammar.spec.ts` ne lit que
 * les styles EN LIGNE des `.tsx`, `megga-x-crm-tokens.spec.ts` lit
 * `megga-x.generated.css` et `globals.css`, `graphite-scale.spec.ts` n'ouvre
 * aucun `.css` du tout. C'est pour ça que Sugar Pure et l'échelle Graphite y ont
 * survécu à deux campagnes de retrait, toutes portes vertes.
 *
 * C'est une DIXIÈME forme de garde vacuité, distincte de la sixième
 * (`megga/gardes-vacuites` n° 6, « la garde muette prise pour un verdict ») :
 * là, l'instrument ne voyait pas un FICHIER ; ici, il ne voit pas un LANGAGE.
 *
 * ⛔ ET LA SONDE AU RENDU NE SUFFISAIT PAS. Mesuré sur `/dev/matching-atelier`
 * dans les deux thèmes : 18 textes sous l'AA en clair, 5 en sombre. `--ink-dim`
 * n'y figurait PAS — ses instances (placeholder de champ, libellés de
 * progression, cartouche vide) n'étaient rendues dans aucun des états
 * atteignables. Il échoue pourtant dans les DEUX thèmes, jusqu'à 1,95:1. Une
 * sonde au rendu ne voit que ce qui est rendu ; c'est la lecture du SOURCE qui
 * l'a trouvé.
 *
 * ⚠ PIÈGE DE MESURE, coûté une demi-heure : `getComputedStyle` lu pendant que le
 * volet du navigateur est masqué rend la valeur de DÉPART d'une transition en
 * cours — les images ne sont pas composées, donc la transition n'avance jamais.
 * Après une bascule de thème, la ligne sélectionnée de la file ressortait à
 * 1,01:1 (encre sombre sur la surface CLAIRE d'avant la bascule) : un défaut
 * spectaculaire et entièrement faux. Forcer une image avant de lire.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * 1. Les quatre paliers d'encre d'`atelier.css` atteignent l'AA sur chacune des
 *    surfaces où du texte peut se poser, dans les DEUX thèmes.
 * 2. L'initiale d'avatar DÉRIVE son encre de son aplat (`encreSur`) au lieu de
 *    la choisir. L'aplat vient de la donnée : personne ne le relit avant qu'il
 *    s'affiche.
 *
 * ⚠ Le point 2 est ancré sur l'ATOME — le nom de la fonction, dans la même
 * déclaration de style que l'aplat — et non sur l'expression du jour. Une garde
 * ancrée sur `background: b.av` serait désarmée par le correctif lui-même, dès
 * que l'aplat passerait par une variable locale (`megga/gardes-vacuites` n° 5).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { encreSur } from '@/components/megga-x-crm/tokens'

const FEUILLE = 'src/components/matching-atelier/atelier.css'

const css = readFileSync(FEUILLE, 'utf-8')

/**
 * ⛔ SEPT SITES, SIX FICHIERS — pas deux.
 *
 * La première version de cette garde ne lisait que `SgaQueue.tsx`, les deux
 * initiales que la sonde au rendu avait montrées. Elle serait passée au VERT
 * pendant que cinq autres avatars — le mode acheteur, la confirmation, la
 * feuille d'envoi, le « pourquoi ça matche », la vue annonce — gardaient leur
 * encre figée. Une garde qui ne balaye que l'endroit où le défaut a été REMARQUÉ
 * mesure l'anecdote, pas la règle : on balaye donc le dossier.
 */
/** Les composants de la Recherche, carte GELÉE exclue (voir le cliquet). */
const RECHERCHE = readdirSync('src/components/matching-recherche')
  .filter((n) => n.endsWith('.tsx') && n !== 'MrhMapView.tsx')
  .map((n) => ({ nom: `src/components/matching-recherche/${n}`, code: readFileSync(`src/components/matching-recherche/${n}`, 'utf-8') }))

const AVATARS = readdirSync('src/components/matching-atelier')
  .filter((n) => n.endsWith('.tsx'))
  .map((n) => ({ nom: `src/components/matching-atelier/${n}`, code: readFileSync(`src/components/matching-atelier/${n}`, 'utf-8') }))

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
 * Seuil 4,5 partout, et non 3 : le palier « grand texte » de WCAG commence à
 * 18,66 px en gras. Les textes que peignent ces paliers vont de 10,5 px
 * (sur-titres) à 14,5 px (nom de la file) — aucun n'y arrive.
 */
const AA = 4.5

/**
 * Corps de TOUS les blocs `.sga{…}` (clair) ou `.sga[data-theme="dark"]{…}`
 * (sombre) — la feuille en ouvre plusieurs, dont un tout en bas pour le sceau
 * KYC. N'en lire qu'un laisserait des variables hors de la garde.
 */
function blocs(sombre: boolean): string {
  const motif = sombre
    ? /\.sga\[data-theme="dark"\]\s*\{([^}]*)\}/g
    : /(?<!\])\.sga\s*\{([^}]*)\}/g
  return [...css.matchAll(motif)].map((m) => m[1]).join('\n')
}

/** `--nom: #rrggbb` → { nom: '#rrggbb' }, pour un thème donné. */
function jetons(sombre: boolean): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of blocs(sombre).matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
    out[m[1]] = m[2]
  }
  return out
}

const THEMES = { clair: jetons(false), sombre: jetons(true) }

/** Les paliers d'encre. Tous les quatre portent du TEXTE. */
const ENCRES = ['--ink', '--ink-soft', '--ink-muted', '--ink-dim']

/**
 * Les surfaces sur lesquelles ce texte se pose.
 *
 * ⚠ `--field` en fait partie : `--ink-dim` y peint le placeholder, et un
 * placeholder porte une information — saisi / pas encore saisi. Même arbitrage
 * que l'encre du VIDE de l'aperçu de Contacts, descendue sur l'échelle plutôt
 * qu'alignée sur l'encre pleine.
 */
const SURFACES = ['--surface', '--surface-2', '--surface-solid', '--cardsub', '--field']

describe('Matching — l’encre reste lisible, et la garde lit le CSS', () => {
  /**
   * Sans ce témoin, une feuille renommée ou un motif de bloc cassé rendrait des
   * dictionnaires VIDES, et toutes les boucles ci-dessous passeraient par
   * vacuité — la forme de garde verte que ce fichier existe pour interdire.
   */
  it('la garde voit bien les deux blocs de thème', () => {
    for (const [nom, t] of Object.entries(THEMES)) {
      for (const v of [...ENCRES, ...SURFACES]) {
        expect(t[v], `${v} introuvable dans le bloc ${nom} de ${FEUILLE}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
    // Les deux thèmes doivent DIFFÉRER : un motif qui capterait deux fois le
    // même bloc rendrait la moitié de la garde inopérante sans rien casser.
    expect(THEMES.clair['--ink']).not.toBe(THEMES.sombre['--ink'])
  })

  it.each(Object.entries(THEMES))('les quatre paliers d’encre passent l’AA (%s)', (theme, t) => {
    const faibles: string[] = []
    for (const encre of ENCRES) {
      for (const surface of SURFACES) {
        const r = contraste(t[encre], t[surface])
        if (r < AA) faibles.push(`${encre} (${t[encre]}) sur ${surface} (${t[surface]}) = ${r.toFixed(2)}:1`)
      }
    }
    expect(faibles, `sous ${AA}:1 en ${theme} :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ L'AVATAR CHOISIT SON ENCRE AU LIEU DE LA DÉRIVER.
   *
   * `.sga .av` posait `color:#fff` dans la feuille, sur un aplat qui vient de la
   * DONNÉE (`b.av`, la teinte du contact). Mesuré au rendu : 1,88:1 sur le vert
   * et 2,92:1 sur l'ocre, dans les deux thèmes — l'élément le moins lisible de
   * sa propre colonne. Défaut identique à celui de Contacts, corrigé là-bas le
   * 12 août ; qu'il réapparaisse ici confirme qu'aucune garde ne le tenait.
   */
  it('la feuille ne fige plus l’encre de l’avatar', () => {
    const regle = /\.sga\s+\.av\s*\{([^}]*)\}/.exec(css)
    expect(regle, `règle .sga .av introuvable dans ${FEUILLE}`).not.toBeNull()
    expect(regle?.[1], 'encre figée sur .sga .av — elle doit être dérivée de l’aplat')
      .not.toMatch(/color\s*:\s*#/)
  })

  /**
   * ⚠ Ancré sur l'ATOME. On exige `encreSur` DANS la même déclaration de style
   * que l'aplat de l'avatar, pas la présence de `background: b.av` : le
   * correctif lui-même range souvent l'aplat dans une variable, ce qui aurait
   * fait passer au vert une garde ancrée sur l'expression du jour.
   */
  it('chaque initiale d’avatar dérive son encre de son aplat', () => {
    const trouves: string[] = []
    const fautives: string[] = []
    for (const { nom, code } of AVATARS) {
      // ⚠ On lit la BALISE entière, pas le contenu de `style={{…}}`.
      // Un motif à accolades — `style=\{\{([^}]*)\}\}` — s'arrête au premier `}`
      // venu, donc il ne voit PAS les deux sites dont l'ombre porte un gabarit
      // (`0 0 0 6px ${b.av}1c`) : 5 trouvés sur 7, et les deux manquants étaient
      // les plus complexes. Même famille que le `fontWeight:\s*[789]00` qui ne
      // voyait pas `sel ? 700 : 600`.
      for (const m of code.matchAll(/className="av"[^>]*>/g)) {
        trouves.push(nom)
        if (!/encreSur\(/.test(m[0])) fautives.push(`${nom} — ${m[0].slice(0, 90)}`)
      }
    }
    // Sans ce plancher, un sélecteur qui ne matcherait plus rien rendrait la
    // garde verte par vacuité : sept sites sont connus, on en exige au moins
    // autant.
    expect(trouves.length, 'aucune initiale d’avatar trouvée — le motif ne matche plus').toBeGreaterThanOrEqual(7)
    expect(fautives, `encre non dérivée :\n  ${fautives.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CE N'ÉTAIT PAS DEUX RANGÉES MALCHANCEUSES : C'EST TOUTE LA PALETTE.
   *
   * `AV_PALETTE` (12 teintes, indexées par un hachage de l'id du contact —
   * personne ne les relit avant qu'elles s'affichent) est mesurée ici sous
   * l'encre DÉRIVÉE. Sous le blanc figé d'avant, les DOUZE échouaient : de
   * 1,88:1 (#74d184) à 4,39:1 (#c0566b), aucune n'atteignait l'AA. La sonde au
   * rendu n'en avait vu que quatre, celles dont le contact était affiché.
   *
   * ⚠ Plancher mesuré sous l'encre dérivée : 4,699:1 (#c0566b). La marge est
   * MINCE — ajouter une teinte de luminance moyenne la ferait passer sous l'AA,
   * et ce test est là pour le dire à ce moment-là plutôt qu'en production.
   */
  it('les douze teintes d’avatar restent lisibles sous l’encre dérivée', () => {
    const src = readFileSync('src/hooks/useAtelierMatching.ts', 'utf-8')
    const bloc = /const AV_PALETTE = \[([^\]]*)\]/.exec(src)
    expect(bloc, 'AV_PALETTE introuvable — la garde ne mesure plus rien').not.toBeNull()
    const teintes = [...(bloc?.[1] ?? '').matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1])
    expect(teintes.length, 'palette d’avatar vide').toBeGreaterThan(1)
    const faibles = teintes
      .map((t) => ({ t, r: contraste(encreSur(t), t) }))
      .filter(({ r }) => r < AA)
      .map(({ t, r }) => `${t} = ${r.toFixed(2)}:1`)
    expect(faibles, `teintes sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
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
   * `atelier.css`. Sur cette surface, une valeur dupliquée a toujours fini par
   * diverger (la table des statuts l'a fait trois fois). Les composants lisent
   * désormais la constante, et la feuille porte la même valeur.
   */
  it('la teinte de baisse de prix n’existe qu’en un exemplaire', () => {
    const src = readFileSync('src/components/matching-recherche/mrhCtx.ts', 'utf-8')
    const teinte = (/MRH_PRICE_DROP\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(src)?.[1] ?? '').toLowerCase()
    const litteraux: string[] = []
    for (const { nom, code } of AVATARS.concat(
      ['MrhCard.tsx', 'MrhExtDetail.tsx'].map((n) => ({
        nom: `src/components/matching-recherche/${n}`,
        code: readFileSync(`src/components/matching-recherche/${n}`, 'utf-8'),
      })),
    )) {
      if (nom.endsWith('mrhCtx.ts')) continue
      for (const m of code.matchAll(/#[0-9a-fA-F]{6}/g)) {
        if (m[0].toLowerCase() === teinte) litteraux.push(`${nom} — ${m[0]}`)
      }
    }
    expect(litteraux, `teinte recopiée au lieu d'être lue :\n  ${litteraux.join('\n  ')}`).toEqual([])
    // Et la feuille porte la MÊME valeur, sinon les deux moitiés de l'écran
    // diraient « prix baissé » de deux oranges différents.
    const feuille = readFileSync('src/components/matching-atelier/atelier.css', 'utf-8')
    const sys = /--sys-yellow\s*:\s*(#[0-9a-fA-F]{6})/.exec(feuille)?.[1]?.toLowerCase()
    expect(sys, '--sys-yellow diverge de MRH_PRICE_DROP').toBe(teinte)
  })

  /**
   * ⛔ UNE ENCRE TRANSLUCIDE N'EST PAS UNE ENCRE FAIBLE, C'EST UNE ENCRE QU'ON NE
   * MESURE PAS.
   *
   * `MrhExtDetail` déclarait `dot = dark ? 'rgba(255,255,255,.22)' : …` pour un
   * séparateur « · » — 1,68:1 en clair, 1,89:1 en sombre. Le motif est le même
   * que celui de `--ink-dim` : un jeton qui n'existe QUE pour être plus faible
   * que ses voisins, et « plus faible » finit toujours sous le plancher.
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
    for (const { nom, code } of RECHERCHE.concat(AVATARS)) {
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

  /**
   * Et que `encreSur` BASCULE. Une fonction qui répondrait toujours la même
   * encre passerait tout ce qui précède sans rien dériver.
   *
   * ⚠ Le test porte sur les PÔLES, pas sur `AV_PALETTE` : mesuré, les douze
   * teintes prennent toutes l'encre sombre, donc les balayer ne pourrait jamais
   * montrer une bascule — c'est un test vrai par construction, exactement la
   * troisième forme de garde vacuité.
   */
  it('encreSur bascule bien d’une encre à l’autre', () => {
    expect(encreSur('#ffffff')).not.toBe(encreSur('#030303'))
  })
})
