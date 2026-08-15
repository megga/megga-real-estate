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
import { CRM_GRAPHITE, CRM_TOKENS, crmSugarPalette } from '@/components/crm-sugar/tokens'
import { mxCrmPalette, MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { SugarV2, setSugarV2Dark } from '@/components/crm-sugar-wizard/tokens'
import { TK, applyTK } from '@/components/crm-sugar/today/tk'
import { SET_PALETTE, applySetTheme } from '@/components/crm-sugar/settings/data'
import { buildCalPalette } from '@/components/crm-sugar/calendar/data'
import { VxSP_DARK } from '@/components/crm-sugar-v3/vitrine/vitrineTokens'
import { MT_DARK } from '@/components/crm-mobile/tokens'
import { adminSurfaces } from '@/hooks/useAdminSugar'

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
    const lu = readFileSafely(repoPath('src/components/crm-sugar-v3/kyc/kycPalette.ts'))
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
      expect(crmSugarPalette(dark)).toEqual(mxCrmPalette(dark))
    }
  })

  it('creuse les sous-surfaces flottantes au lieu de les élever', () => {
    // Propriété conservée de Graphite : une sous-surface de modale se CREUSE.
    const p = mxCrmPalette(true)
    expect(luminance(p.solidBgSub)).toBeLessThan(luminance(p.solidBg))
    expect(luminance(p.solidBgSub2)).toBeLessThan(luminance(p.solidBgSub))
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
    expect('ramp' in crmSugarPalette(true)).toBe(false)
    expect('ramp' in crmSugarPalette(false)).toBe(false)
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
  const NEUTRES = Object.values(MXC_COLOR) as string[]

  const cases: { name: string; read: () => string; attendu: string }[] = [
    { name: 'wizard SugarV2.card', read: () => { setSugarV2Dark(true); return SugarV2.card }, attendu: MXC_COLOR.n300 },
    { name: 'wizard SugarV2.rail', read: () => { setSugarV2Dark(true); return SugarV2.rail }, attendu: MXC_COLOR.n200 },
    { name: 'cockpit TK.frame', read: () => { applyTK(true); return TK.frame }, attendu: MXC_COLOR.n200 },
    { name: 'cockpit TK.cardHi', read: () => { applyTK(true); return TK.cardHi }, attendu: MXC_COLOR.n400 },
    { name: 'calendrier popBg', read: () => buildCalPalette(true).popBg, attendu: MXC_COLOR.n300 },
    { name: 'fiche bien VxSP.cardSub', read: () => VxSP_DARK.cardSub, attendu: MXC_COLOR.n200 },
    { name: 'mobile MT.pageBg', read: () => MT_DARK.pageBg, attendu: MXC_COLOR.n100 },
    { name: 'mobile MT.card', read: () => MT_DARK.card, attendu: MXC_COLOR.n300 },
    { name: 'mobile MT.tabBarBg', read: () => MT_DARK.tabBarBg, attendu: MXC_COLOR.n300 },
    // ⛔ LA CONSOLE ADMIN EST LA SEULE SURFACE QUI Y ÉTAIT RESTÉE, et ce test ne
    // pouvait pas le voir : ses cinq paliers ne vivaient pas dans une palette JS
    // mais dans `admin-console.css`, que ce fichier n'ouvre pas (zéro
    // `readFileSync`). Graphite y a survécu quatre jours, toutes portes vertes.
    // Depuis le 14 août 2026 `adminSurfaces()` DÉSCEND de `mxCrmPalette()`, donc
    // elle entre ici comme les autres — et `admin-console-css.spec.ts` tient
    // l'autre langage.
    { name: 'console admin surf.card', read: () => adminSurfaces(true).card, attendu: MXC_COLOR.n300 },
    { name: 'console admin surf.cardSub', read: () => adminSurfaces(true).cardSub, attendu: MXC_COLOR.n200 },
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
   * traversé six de plus — `AX` et `AX_DARK` (Analytics), `KYC_LIGHT`, `SugarV3`,
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
    const DEFINITION = 'src/components/crm-sugar/tokens.ts'
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
   * Le wizard en clair descend de MEGGA X, et pas de Graphite.
   *
   * Cette assertion figeait `'#FFFFFF'` en littéral, pour vérifier que la
   * bascule Graphite — qui ne visait que le SOMBRE — n'avait pas débordé sur la
   * branche claire du wizard. Le 11 août 2026 cette branche a été migrée
   * exprès : elle vaut la même couleur, mais elle la tient désormais de
   * `mxCrmPalette`. Le littéral ne disait plus d'où venait la valeur, seulement
   * qu'elle coïncidait. Ce que la palette du wizard doit respecter est
   * verrouillé par `wizard-palette.spec.ts` ; ici on garde ce que ce fichier-ci
   * a pour rôle de dire — aucune surface n'est restée sur Graphite.
   */
  it('le wizard en clair descend de MEGGA X, pas de Graphite', () => {
    setSugarV2Dark(false)
    expect(SugarV2.card).toBe(mxCrmPalette(false).cardBg)
    expect(Object.values(CRM_GRAPHITE) as string[]).not.toContain(SugarV2.card)
    setSugarV2Dark(null)
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
