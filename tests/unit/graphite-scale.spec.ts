/**
 * Garde-fou : l'échelle sombre reste étanche et vivante.
 *
 * ⚠ Ce fichier éprouvait aussi le CHOIX de teinte (Graphite / Noir pur), retiré
 * avec la direction Sugar le 9 août 2026 : ces tests sont partis avec lui. Ce
 * qui reste a survécu pour une raison précise, notée sur chaque bloc.
 *
 * `CRM_GRAPHITE` n'est PAS la palette du CRM — celle-ci vient de `mxCrmPalette`
 * et se garde dans `megga-x-crm-tokens.spec.ts`. Les 110 appels à `crmStep` qui
 * la lisaient ont tous été repris ; `crmStep` a été supprimée avec son dernier
 * lecteur. Il ne reste que `CRM_TOKENS.graphite`, le thème legacy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'
import { CRM_GRAPHITE, CRM_TOKENS, crmPalette } from '@/components/crm/tokens'
import { mxCrmPalette, MXC_CARD_SHADOW, MXC_COLOR, MXC_DARK_SURFACE } from '@/components/megga-x-crm/tokens'
import { TK, applyTK } from '@/components/crm/today/tk'
import { SET_PALETTE, applySetTheme } from '@/components/crm/settings/data'
import { buildCalPalette } from '@/components/crm/calendar/data'
import { VxSP_DARK } from '@/components/crm-dossiers/vitrine/vitrineTokens'
import { MT_DARK } from '@/components/crm-mobile/tokens'
import { adminSurfaces } from '@/hooks/useAdminSurfaces'
import { deriveAiPalette } from '@/components/ai-copilot/panel/aiPanel'

/** Luminance relative WCAG — sert à vérifier la monotonie de l'échelle. */
function luminance(hex: string): number {
  const c = hex.replace('#', '')
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = channel(parseInt(c.slice(0, 2), 16))
  const g = channel(parseInt(c.slice(2, 4), 16))
  const b = channel(parseInt(c.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('échelle Graphite — ce qu\'il en reste', () => {
  it('monte strictement de s0 à s4', () => {
    const steps = [CRM_GRAPHITE.s0, CRM_GRAPHITE.s1, CRM_GRAPHITE.s2, CRM_GRAPHITE.s3, CRM_GRAPHITE.s4]
    const lums = steps.map(luminance)
    expect(lums).toEqual([...lums].sort((a, b) => a - b))
    expect(new Set(steps).size).toBe(5)
  })

  /**
   * ⛔ CETTE CLAUSE ÉTAIT CREUSE, ET SA JUSTIFICATION PÉRIMÉE D'UN FACTEUR 28.
   *
   * Elle mesurait le contraste de `CRM_TOKENS.graphite.muted` au motif que
   * « `CrmTheme` n'est pas parti avec Sugar : 28 fichiers le lisent encore ».
   * Mesuré le 16 août 2026 : `CrmTheme` n'est nommé que dans UN fichier — celui
   * qui le définit — et `CRM_TOKENS` n'a qu'un seul lecteur de rendu,
   * `kyc/kycPalette.ts:158`, qui en lit exactement UN champ : `dangerSoft`.
   * `muted` n'en a AUCUN. On assertait donc un seuil sur une teinte que plus
   * personne ne peint : verte à jamais, quelle que soit la valeur.
   *
   * ⚠ CE QUI LA REMPLACE GARDE LA SURFACE D'EXPOSITION de la direction morte,
   * et rien d'autre : un thème legacy dont on remettrait à lire les champs
   * cesserait d'être legacy sans que rien ne le dise. Le compte ne peut que
   * baisser. ⛔ Le titre dit exactement cela — pas « il est lisible » : une
   * clause dont l'intitulé promet plus que ce qu'elle mesure est la même vacuité
   * que celle qu'on répare ici, déplacée du corps vers le nom.
   */
  it('le thème legacy n’a qu’UN champ vivant', () => {
    const lu = readFileSafely(repoPath('src/components/crm-dossiers/kyc/kycPalette.ts'))
    expect(lu.status, 'kycPalette illisible : la clause ne mesure rien').toBe('ok')
    const lus = [...new Set(
      ((lu.status === 'ok' ? lu.value : '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .match(/\bt\.[a-zA-Z]+/g) ?? []),
    )].sort()
    expect(
      lus,
      'le thème Graphite legacy a gagné (ou perdu) des lecteurs de champ — une direction ' +
        'morte dont la surface d’exposition remonte cesse d’être morte : trancher, puis ' +
        'mettre cette liste à jour',
    ).toEqual(['t.dangerSoft'])

    // ⛔ ET ON N'Y AJOUTE PAS DE SEUIL DE CONTRASTE, alors que c'était le réflexe.
    // `dangerSoft` est consommé comme `errSoft` : un REMPLISSAGE de pastille, pas
    // une encre. Mesuré contre la carte sombre, il rend 1,25:1 — et c'est normal,
    // c'est l'encre POSÉE dessus qui porte le contraste, pas le fond. Lui imposer
    // les 3:1 des éléments non textuels serait appliquer un seuil à un rôle qu'on
    // n'a pas qualifié : la faute exacte que ce dépôt a déjà commise sur les
    // pilules à teinte vive, et qu'il a écrite hors périmètre dans
    // `sugar-v3-contraste.spec.ts`. La lisibilité de ce qui s'écrit SUR `errSoft`
    // est gardée là-bas, sur la palette KYC, avec les bons fonds.
  })


  /**
   * Le vrai garde-fou désormais : plus AUCUNE surface du CRM ne doit sortir de
   * cette échelle. Elle n'alimente que le thème `CrmTheme` legacy.
   */
  it('n’alimente plus que le thème legacy', () => {
    expect(CRM_TOKENS.graphite.bg).toBe(CRM_GRAPHITE.s0)
    expect(mxCrmPalette(true).pageBg).not.toBe(CRM_GRAPHITE.s0)
  })
})

describe('palette du CRM — MEGGA X, plus aucune direction alternative', () => {
  it('rend MEGGA X dans les deux modes', () => {
    for (const dark of [false, true]) {
      expect(crmPalette(dark)).toEqual(mxCrmPalette(dark))
    }
  })

  /**
   * ⛔ CETTE CLAUSE DISAIT L'INVERSE — « creuse les sous-surfaces flottantes au
   * lieu de les élever », propriété héritée de Graphite. Elle est morte avec la
   * décision du 20.09.2026 : le CRM sombre n'a plus de PILE de surfaces du tout.
   * Canvas, cadre, rail, carte, sous-carte et surfaces flottantes rendent le
   * MÊME gris ; ce qui sépare est le filet. Creuser ou élever revenaient au même
   * défaut — un palier de plus à lire.
   *
   * Ce que la clause garde désormais : qu'aucun palier ne revienne. Un
   * `cardBg` remonté d'un cran « pour faire ressortir la carte » la fait rougir.
   */
  it('ne pose AUCUN palier : toutes les surfaces rendent le même gris', () => {
    const p = mxCrmPalette(true)
    const surfaces = [
      p.pageBg, p.frameBg, p.cardBg, p.cardSubBg,
      p.solidBg, p.solidBgSub, p.solidBgSub2, p.tableHeadBg, p.iconRailBg,
    ]
    expect(new Set(surfaces).size, `${new Set(surfaces).size} gris de surface au lieu d’un`).toBe(1)
  })

  it('le filet se détache assez du gris unique pour porter seul', () => {
    const p = mxCrmPalette(true)
    // Sans écart de fond, c'est lui OU rien. Sous ce seuil la structure s'efface
    // sans qu'aucune autre garde ne le voie.
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    // ⚠ 1,5 → 1,24 le 20.09.2026 : le filet a été rendu DISCRET (ΔL* 16,45 →
    // 10,13, soit un ratio de 1,285). 1,24 est le bord mesuré — c'est ce que
    // rend un voile de 0,08, la dernière opacité encore franche.
    expect(ratio(p.cardBorder, p.pageBg)).toBeGreaterThanOrEqual(1.24)
  })

  it('le dock MEGGA AI ne pose AUCUNE ombre portée en sombre', () => {
    /**
     * ⛔ IL EN POSAIT DEUX, ET ELLES ÉTAIENT INVISIBLES. `rgba(0,0,0,.7)` sur
     * 70 px de flou et `rgba(0,0,0,.55)` sur 22 px : sur un canvas `#030303` on
     * ne voit pas du noir sur du noir. Le plancher monté à `#16181c`, elles
     * peignaient une ZONE D'OMBRE autour du panneau — repéré à l'œil par Julien
     * le 20.09.2026, par aucune porte.
     *
     * La règle existait pourtant déjà (`CLAUDE.md` §3 : en sombre on sépare par
     * la bordure, `shadow` vaut `'none'`), elle n'était simplement mesurée
     * nulle part pour ce panneau. Elle l'est ici.
     */
    const p = deriveAiPalette(mxCrmPalette(true), true)
    expect(p.panelShadow, 'une ombre portée est revenue sur le dock')
      .not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/)
    // …et il doit garder son filet, sinon il flotte sans contour.
    expect(p.panelShadow, 'le dock a perdu son filet').toContain('0 0 0 1px')
  })

  it('AUCUNE palette sombre ne pose d’ombre portée noire', () => {
    /**
     * ⛔ LA CLAUSE DU DOCK NE GARDAIT QUE LE DOCK, et le défaut était partout.
     * Après l'avoir réparé, le PAGER en portait encore une — `TK.shadowLg`,
     * 70 px de flou à 75 % de noir sous un panneau de 1128×822 — plus deux sur
     * les cartes du cockpit et une sur chaque bloc d'agenda. Cinq au total,
     * relevées AU RENDU par Julien, par aucune porte.
     *
     * Toutes invisibles sur l'ancien canvas `#030303` : on ne voit pas du noir
     * sur du noir. Le plancher monté à `#16181c`, chacune assombrit le canvas
     * autour de ce qu'elle borde. C'est le mode d'échec propre à ce chantier —
     * il ne CRÉE pas ces ombres, il les RÉVÈLE.
     *
     * La règle est écrite depuis toujours (`CLAUDE.md` §3 : en sombre on sépare
     * par la bordure). Elle est désormais mesurée sur toutes les palettes
     * sombres, pas sur une seule.
     *
     * ⚠ Un RING (`0 0 0 1px`, flou nul) n'est pas une ombre portée : c'est un
     * filet dessiné en `box-shadow` pour ne pas décaler la mise en page. Seul
     * un flou strictement positif est refusé.
     */
    const sombres: Record<string, string> = {
      'mxCrmPalette.shadow': mxCrmPalette(true).shadow,
      'mxCrmPalette.shadowSm': mxCrmPalette(true).shadowSm,
      'dock.panelShadow': deriveAiPalette(mxCrmPalette(true), true).panelShadow,
    }
    applyTK(true)
    for (const k of ['shadow', 'shadowSm', 'shadowLg'] as const) {
      sombres[`TK.${k}`] = TK[k]
    }
    // Une ombre PORTÉE : une couleur sombre suivie de décalages puis d'un flou > 0.
    const PORTEE = /rgba?\(\s*0\s*,\s*0\s*,\s*0[^)]*\)/
    const fautes = Object.entries(sombres)
      .filter(([, v]) => typeof v === 'string' && PORTEE.test(v.replace(/inset[^,]*/g, '')))
      .map(([k, v]) => `${k} : ${v.slice(0, 60)}`)
    expect(fautes, `ombre portée noire en sombre :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  it('TOUS les filets sombres rendent la MÊME valeur sur le canvas', () => {
    /**
     * ⛔ CINQ FORCES POUR UN SEUL RÔLE, ET RIEN NE LE MESURAIT. Relevé au rendu
     * le 20.09.2026 sur un SEUL écran : ΔL* 16,45 (le jeton), 15,43 et 9,04
     * (deux voiles), 7,95 (un anneau). Plus du simple au double. Aucune porte
     * ne comparait les filets ENTRE EUX — chacun était plausible isolément.
     *
     * ⚠ Deux notations coexistent, et c'est voulu : un OPAQUE pour une surface
     * neutre, un VOILE pour une surface teintée (où un aplat ferait une tache).
     * Elles doivent donc être comparées APRÈS composition sur le canvas, jamais
     * sur leur écriture — c'est le même piège que sur `encreSur`.
     */
    const canvas = mxCrmPalette(true).pageBg
    const canaux = (c: string): number[] => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number)
      if (c.startsWith('#')) {
        return [0, 2, 4].map((i) => parseInt(c.slice(1).slice(i, i + 2), 16))
      }
      const a = n[3] ?? 1
      const f = [0, 2, 4].map((i) => parseInt(canvas.slice(1).slice(i, i + 2), 16))
      return [0, 1, 2].map((i) => n[i] * a + f[i] * (1 - a))
    }
    applyTK(true)
    const filets: Record<string, string> = {
      'MXC_DARK_SURFACE.line': MXC_DARK_SURFACE.line,
      'mxCrmPalette.cardBorder': mxCrmPalette(true).cardBorder,
      'mxCrmPalette.frameBorder': mxCrmPalette(true).frameBorder,
      'TK.border': TK.border,
      'TK.borderHi': TK.borderHi,
      'TK.cardBorder': TK.cardBorder,
      'CAL.line': buildCalPalette(true).line,
    }
    const vus = Object.entries(filets).map(([k, v]) => ({ k, v, rgb: canaux(v) }))
    // Sans cette assertion, une valeur illisible rendrait NaN et passerait tout.
    for (const f of vus) {
      expect(f.rgb.every(Number.isFinite), `${f.k} illisible : ${f.v}`).toBe(true)
    }
    const ref = vus[0].rgb
    const ecarts = vus
      .filter((f) => f.rgb.some((c, i) => Math.abs(c - ref[i]) > 2))
      .map((f) => `${f.k} : ${f.v} → rgb(${f.rgb.map((c) => Math.round(c)).join(',')})`)
    expect(
      ecarts,
      `filets désaccordés (référence ${vus[0].k}) :\n  ${ecarts.join('\n  ')}`,
    ).toEqual([])
  })

  it('en CLAIR, aucune ombre n’est plus large que la gouttière qui la reçoit', () => {
    /**
     * ⛔ LA CLAUSE VOISINE NE GARDAIT QUE LE SOMBRE, et le clair avait le même
     * défaut sous une autre forme : trois ombres sur mesure, de 22 à 70 px de
     * flou, plus le halo de 80 px du dock. Entre le pager et le dock il n'y a
     * que 12 px — les deux halos s'y recouvraient et peignaient une bande
     * sombre (relevé par Julien le 20.09.2026).
     *
     * ⚠ Le clair GARDE une ombre : c'est sa grammaire. Ce qui est interdit,
     * c'est une valeur sur mesure — la direction n'en connaît qu'une,
     * `MXC_CARD_SHADOW`, et son flou de 6 px tient dans la gouttière.
     */
    applyTK(false)
    const clairs: Record<string, string> = {
      'TK.shadow': TK.shadow,
      'TK.shadowLg': TK.shadowLg,
      'mxCrmPalette.shadow': mxCrmPalette(false).shadow,
      'dock.panelShadow': deriveAiPalette(mxCrmPalette(false), false).panelShadow,
    }
    // Le flou le plus large de chaque ombre, `inset` exclu (un ring ne floute pas).
    const flou = (v: string): number => {
      // ⚠ UN OFFSET PEUT S'ÉCRIRE `0`, SANS UNITÉ — et `MXC_CARD_SHADOW` le fait
      // (`0 2px 6px #15086b21`). Une sonde qui exige `0px` rend 0 partout, donc
      // un seuil de 0, donc une clause vraie par vacuité. C'est l'assertion de
      // lisibilité juste en dessous qui l'a dit, comme prévu.
      const nb = String.raw`(?:[-\d.]+px|0)`
      const re = new RegExp(`${nb}\\s+${nb}\\s+(\\d+)px`, 'g')
      const m = [...v.replace(/inset[^,]*/g, '').matchAll(re)]
      return m.length ? Math.max(...m.map((x) => Number(x[1]))) : 0
    }
    const reference = flou(MXC_CARD_SHADOW)
    expect(reference, 'MXC_CARD_SHADOW illisible : la clause ne mesure rien').toBeGreaterThan(0)
    const trop = Object.entries(clairs)
      .filter(([, v]) => flou(v) > reference)
      .map(([k, v]) => `${k} : flou ${flou(v)}px > ${reference}px — ${v.slice(0, 44)}`)
    expect(trop, `ombre plus large que celle de la direction :\n  ${trop.join('\n  ')}`).toEqual([])
  })

  it('le survol reste un ÉTAT, pas un palier de plus', () => {
    const p = mxCrmPalette(true)
    // Il doit se voir…
    expect(luminance(p.focusSurface)).toBeGreaterThan(luminance(p.cardBg))
    // …sans se relire comme une surface : il reste sous le filet.
    expect(luminance(p.focusSurface)).toBeLessThan(luminance(p.cardBorder))
  })

  it('ne pose aucun blanc translucide en REMPLISSAGE', () => {
    const p = mxCrmPalette(true)
    const fonds = [
      p.pageBg, p.frameBg, p.cardBg, p.cardSubBg,
      p.solidBg, p.solidBgSub, p.solidBgSub2,
      p.tableHeadBg, p.iconBtnBg, p.iconRailBg, p.kbdBg,
    ]
    for (const f of fonds) expect(f).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('n’expose plus de rampe : `crmStep(sp, …)` doit retomber sur son littéral', () => {
    expect('ramp' in crmPalette(true)).toBe(false)
    expect('ramp' in crmPalette(false)).toBe(false)
  })
})

describe('palettes d’écran dérivées', () => {
  /**
   * Sept écrans montent leur PROPRE palette — cockpit, wizard, calendrier,
   * fiche bien, mobile… — au lieu de recevoir `sp`. Elles empruntaient toutes
   * l'échelle Graphite par `crmStep`. Ce test garde le sens inverse de celui
   * qu'il portait : il vérifie qu'elles rendent bien un neutre MEGGA X, et
   * donc qu'aucune ne retombe sur Graphite.
   */
  /**
   * ⚠ DEUX ÉCHELLES DEPUIS LE 20.09.2026. Les surfaces SOMBRES du CRM sortent
   * des barreaux de la vitrine — décision écrite sur `MXC_DARK_SURFACE`. Ce
   * test garde donc l'union des deux, et rien d'autre : une valeur hors de ces
   * deux jeux reste un gris inventé.
   */
  const NEUTRES = [...Object.values(MXC_COLOR), ...Object.values(MXC_DARK_SURFACE)] as string[]

  const cases: { name: string; read: () => string; attendu: string }[] = [
    // (Le wizard de création avait sa palette ici ; il est retiré depuis le 16.09.2026 —
    // « Nouveau bien » peint avec `crmPalette`, déjà gardé plus haut.)
    { name: 'cockpit TK.frame', read: () => { applyTK(true); return TK.frame }, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'cockpit TK.cardHi', read: () => { applyTK(true); return TK.cardHi }, attendu: MXC_DARK_SURFACE.s1 },
    { name: 'calendrier popBg', read: () => buildCalPalette(true).popBg, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'fiche bien VxSP.cardSub', read: () => VxSP_DARK.cardSub, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'mobile MT.pageBg', read: () => MT_DARK.pageBg, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'mobile MT.card', read: () => MT_DARK.card, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'mobile MT.tabBarBg', read: () => MT_DARK.tabBarBg, attendu: MXC_DARK_SURFACE.s0 },
    // ⛔ AJOUTÉ LE 20.09.2026 APRÈS UNE FUITE MESURÉE AU RENDU. `relanceBg`
    // valait `n200` (#050505) : une fois le canvas monté à #16181c, le bento de
    // relance rendait PLUS SOMBRE que la page — un trou noir de 232k px² sur le
    // banc `/dev/mobile`. Cette clause ne l'a pas vu parce qu'elle n'énumérait
    // que `pageBg`, `card` et `tabBarBg` : exactement l'avertissement écrit plus
    // bas dans ce fichier, « les clauses n'énumèrent que ce qu'on leur a nommé ».
    { name: 'mobile MT.relanceBg', read: () => MT_DARK.relanceBg, attendu: MXC_DARK_SURFACE.s0 },
    // ⛔ LA CONSOLE ADMIN EST LA SEULE SURFACE QUI Y ÉTAIT RESTÉE, et ce test ne
    // pouvait pas le voir : ses cinq paliers ne vivaient pas dans une palette JS
    // mais dans `admin-console.css`, que ce fichier n'ouvre pas (zéro
    // `readFileSync`). Graphite y a survécu quatre jours, toutes portes vertes.
    // Depuis le 14 août 2026 `adminSurfaces()` DÉSCEND de `mxCrmPalette()`, donc
    // elle entre ici comme les autres — et `admin-console-css.spec.ts` tient
    // l'autre langage.
    { name: 'console admin surf.card', read: () => adminSurfaces(true).card, attendu: MXC_DARK_SURFACE.s0 },
    { name: 'console admin surf.cardSub', read: () => adminSurfaces(true).cardSub, attendu: MXC_DARK_SURFACE.s0 },
  ]

  it.each(cases)('$name rend un neutre MEGGA X', ({ read, attendu }) => {
    const v = read()
    expect(v).toBe(attendu)
    expect(NEUTRES, `${v} hors palette`).toContain(v)
  })

  /**
   * ⛔ LES CLAUSES DE CE FICHIER N'ÉNUMÈRENT QUE CE QU'ON LEUR A NOMMÉ.
   *
   * Onze palettes y sont importées une par une. Le chantier « CRM agent » en a
   * traversé six de plus — `AX` et `AX_DARK` (Analytics), `KYC_LIGHT`, `DossierTokens`,
   * `pfKitCore`, `journeyData` — dont AUCUNE n'était couverte. Mesurées le 16
   * août 2026, elles sont toutes propres ; mais « propre aujourd'hui » et
   * « gardée » sont deux choses, et c'est exactement l'écart que ce chantier a
   * passé huit lots à combler ailleurs.
   *
   * Ce balayage remplace l'énumération par une RÈGLE : aucun fichier de `src/`
   * n'écrit un barreau de l'échelle Graphite. Une palette qui naîtra demain est
   * couverte sans que personne pense à l'ajouter — c'est la différence entre une
   * garde qui liste et une garde qui décrit.
   *
   * ⚠ Seul le fichier qui DÉFINIT l'échelle en porte les valeurs. L'exemption
   * est nominative, pas un motif : elle ne peut pas s'étendre par accident.
   */
  it('aucun fichier de src/ n’écrit un barreau de l’échelle Graphite', () => {
    const DEFINITION = 'src/components/crm/tokens.ts'
    // ⛔ VALEURS FIGÉES, PAS DÉRIVÉES — et c'est un contrôle négatif qui l'a
    // exigé. En lisant la rampe dans `CRM_GRAPHITE`, la clause cherchait ce que
    // le fichier exempté contient : changer un palier changeait AUSSI le motif,
    // et la garde restait verte. Un test qu'on ne peut pas faire rougir en
    // cassant sa cible est vrai par construction — la troisième forme de
    // `megga/gardes-vacuites`. L'échelle Graphite est HISTORIQUE : elle ne
    // bougera plus, donc la figer ne coûte rien et rend la clause falsifiable.
    const rampe = ['#12161c', '#161a21', '#1a1d26', '#1d212a', '#21242f']
    // …et si elle bougeait quand même, on veut le savoir ICI plutôt que de
    // garder un motif qui ne décrit plus rien.
    expect((Object.values(CRM_GRAPHITE) as string[]).map((v) => v.toLowerCase()),
      'l’échelle Graphite a changé : reprendre les valeurs figées ci-dessus').toEqual(rampe)
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }])
    expect(scan.files.length, 'balayage vide : chemin cassé, pas arbre propre').toBeGreaterThan(400)
    const fautifs: string[] = []
    let vuDansLaDefinition = 0
    for (const abs of scan.files) {
      const chemin = rel(abs)
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      lu.value.split('\n').forEach((ligne, i) => {
        const sans = ligne.replace(/\/\/.*$/, '')
        for (const g of rampe) {
          if (!sans.toLowerCase().includes(g)) continue
          if (chemin === DEFINITION) { vuDansLaDefinition++; continue }
          fautifs.push(`${chemin}:${i + 1} → ${g}`)
        }
      })
    }
    // ⚠ Contrôle POSITIF de l'exemption : si la définition cessait de porter ses
    // cinq paliers, le motif ne matcherait plus rien nulle part et la clause
    // passerait au vert par vacuité — la troisième forme de gardes-vacuités.
    expect(vuDansLaDefinition, 'l’échelle n’est plus définie où on la cherche').toBeGreaterThanOrEqual(5)
    expect(fautifs, `barreau Graphite écrit hors de sa définition :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('aucune de ces surfaces n’est restée sur Graphite', () => {
    const rampe = Object.values(CRM_GRAPHITE) as string[]
    for (const { name, read } of cases) expect(rampe, name).not.toContain(read())
  })

  // Le voile de chrome mobile se dérive du palier CADRE : un quasi-noir figé se
  // verrait comme une bande posée sur la surface au lieu de la prolonger.
  it('le voile de chrome mobile suit le palier du cadre', () => {
    expect(MT_DARK.headerBg).toBe('rgba(5,5,5,0.82)')
  })

  /**
   * Les Réglages ne passent PLUS par `crmStep` : leur palette est dérivée de
   * `mxCrmPalette` depuis la bascule. C'est le premier écran migré — le test le
   * fige pour que personne ne le ramène à l'échelle Graphite.
   */
  it('les Réglages sont déjà sortis de l’échelle Graphite', () => {
    applySetTheme(true)
    const rampe = Object.values(CRM_GRAPHITE) as string[]
    for (const s of [SET_PALETTE.bg, SET_PALETTE.card, SET_PALETTE.cardSubtle, SET_PALETTE.heroBg]) {
      expect(rampe).not.toContain(s)
    }
  })
})
