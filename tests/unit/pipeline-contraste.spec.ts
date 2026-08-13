/**
 * Garde-fou : sur le « Pipeline » et la fiche deal, l'encre reste lisible.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Sonde de rendu passée sur `/dev/pipeline` le
 * 13 août 2026, dans les DEUX thèmes, sur les trois vues, les quatre états et
 * les quatre modales. Elle a trouvé six familles, et aucune garde du dépôt n'en
 * couvrait une seule : `megga-x-grammar` ne lit ni ce dossier ni ces pages,
 * `matching-contraste` ne lit que `atelier.css`.
 *
 * ── LES DEUX ASYMÉTRIES, ET POURQUOI ELLES IMPOSENT DE MESURER LES DEUX THÈMES ─
 * C'est le cas d'école de `megga/gardes-vacuites` n° 13 : une garde qui
 * n'énumère les surfaces que d'UN thème passe au vert sur un écran cassé.
 *
 *   · Les pilules d'étape échouent en SOMBRE seulement (2,34:1 à 4,48:1 sur
 *     sept teintes) — en clair `sgStagePillBg` assombrit de 0,32 et tient.
 *   · Les totaux de colonne échouent en CLAIR seulement (4,39 et 4,49 sur les
 *     deux teintes les plus froides) — en sombre le plancher est 5,63.
 *
 * Mesurer un seul thème aurait donc raté l'une ou l'autre, dans les deux sens.
 *
 * ── L'INVARIANT DOCUMENTÉ ET FAUX ────────────────────────────────────────────
 * ⛔ `sgStagePillBg` PROMET dans sa docstring « contraste ≥ 4.5:1 » et ne le
 * tient qu'en clair : sa branche sombre rend la teinte brute, sur laquelle
 * l'encre blanche descend à 2,34:1. C'est la forme la plus dure de la n° 10 —
 * un code aligné sur une norme qu'il énonce lui-même se relit moins qu'un code
 * négligé, parce qu'il a l'air vérifié.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * 1. Les paliers d'encre des TROIS palettes parallèles du périmètre
 *    (`DsLIGHT/DsDARK` de la fiche, `OM_LIGHT/OM_DARK` de la modale d'offre,
 *    `ndPalette` de « Nouveau deal ») atteignent l'AA sur leurs propres
 *    surfaces, dans les deux thèmes.
 * 2. Toute encre posée sur un aplat venu de la DONNÉE la DÉRIVE (`encreSur`) au
 *    lieu de la choisir — l'avatar (hachage d'id sur `AVATAR_PALETTE`) et la
 *    pilule d'étape (`SG_STAGE_HUE`). Personne ne relit ces aplats avant qu'ils
 *    s'affichent.
 * 3. Les huit teintes d'étape et les huit teintes d'avatar restent lisibles
 *    SOUS l'encre dérivée — sinon on aurait déplacé la règle sans la satisfaire.
 *
 * ⚠ Le point 2 est ancré sur l'ATOME — le nom de la fonction dans la même
 * déclaration de style que l'aplat — et non sur l'expression du jour. Une garde
 * ancrée sur `background: hue` serait désarmée par le correctif lui-même dès que
 * l'aplat passerait par une variable locale (`megga/gardes-vacuites` n° 5).
 *
 * ⚠ Et elle balaye le DOSSIER, pas les fichiers où le défaut a été remarqué :
 * la sonde de rendu ne montrait l'avatar que dans deux vues sur quatre — les
 * deux surfaces de création ne sont rendues qu'après un geste.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { encreSur, MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { CRM_STAGE_ORDER, crmSugarPalette, sgStagePillBg, sgStageTint } from '@/components/crm-sugar/tokens'
import { AVATAR_PALETTE } from '@/lib/sugarAdapters'
import { dsPalette } from '@/components/crm-sugar-v3/dealTokens'
import { omPalette } from '@/components/crm-sugar-v3/offer-modal/omTokens'
import { ndPalette } from '@/components/crm-sugar/pipeline/ndTokens'

const AA = 4.5

/**
 * ⛔ CETTE GARDE EST PASSÉE AU VERT SANS RIEN MESURER — quatorzième forme de
 * garde vacuité, trouvée en écrivant cette garde-ci, et cousine de la n° 1.
 *
 * `sgMix` — donc `sgStageTint().panel`, le fond des colonnes du kanban — rend
 * `rgb(224, 227, 250)`, PAS un `#hex`. Une première version de `canal` ne lisait
 * que l'hexadécimal : `parseInt('rg', 16)` vaut `NaN`, la luminance vaut `NaN`,
 * le contraste vaut `NaN`, et `NaN < 4.5` est **faux**. La clause des totaux de
 * colonne passait donc au vert pendant que la sonde de rendu mesurait 4,39:1 sur
 * la même surface.
 *
 * Là où la n° 1 ne connaissait qu'une notation de GUILLEMET et n'attrapait rien,
 * celle-ci ne connaissait qu'une notation de COULEUR et rendait un succès. Le
 * mode d'échec est pire : silencieux, et du bon côté du seuil.
 *
 * D'où `canal` qui lit les DEUX notations, et une clause qui refuse toute
 * couleur qu'il n'a pas su lire — voir « le balayage voit l'arbre ».
 */
const canal = (couleur: string): [number, number, number] => {
  const rgb = couleur.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const p = rgb[1].split(',').map((s) => parseFloat(s.trim()))
    return [p[0], p[1], p[2]] as [number, number, number]
  }
  const h = couleur.replace('#', '')
  const p = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16)) as [number, number, number]
}
/** Une couleur que `canal` n'a pas su lire rendrait NaN, donc un faux succès. */
const lisible = (c: string) => canal(c).every((v) => Number.isFinite(v))
function luminance(hex: string): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = canal(hex)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** ⚠ N'accepte que des couleurs OPAQUES — un voile se compose avant d'entrer. */
function contraste(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * ⛔ PIÈGE (b) DE `megga/gardes-vacuites`, EN VERSION SOURCE. Les surfaces
 * sombres de la fiche et de « Nouveau deal » sont des VOILES
 * (`rgba(255,255,255,0.05)`), pas des paliers opaques. Les mesurer nues
 * donnerait un blanc quasi pur — donc « aucun défaut » sur une carte qui est en
 * réalité presque noire. On les compose sur leur canvas avant de mesurer.
 */
function aplatir(couleur: string, dessous: string): string {
  const m = couleur.match(/rgba?\(([^)]+)\)/)
  if (!m) return couleur
  const p = m[1].split(',').map((s) => parseFloat(s.trim()))
  const a = p.length > 3 ? p[3] : 1
  const [br, bg, bb] = canal(dessous)
  const mix = (f: number, b: number) => Math.round(f * a + b * (1 - a))
  return '#' + [mix(p[0], br), mix(p[1], bg), mix(p[2], bb)]
    .map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * Le dossier du pipeline et les deux pages, balayés en entier.
 *
 * ⚠ `emptyRoots` en esprit : une racine qui rendrait zéro fichier ferait passer
 * les tests d'atome par VACUITÉ. On l'affirme explicitement plus bas.
 */
const DOSSIER = 'src/components/crm-sugar/pipeline'
const SOURCES = [
  ...readdirSync(DOSSIER).filter((n) => /\.tsx$/.test(n)).map((n) => `${DOSSIER}/${n}`),
  // ⚠ Le périmètre n'est PAS un dossier : la fiche deal et la modale d'offre
  // vivent ailleurs et portent la même dette. Les omettre aurait laissé la
  // pastille « Refusée » (3,00:1 en sombre) hors de toute garde.
  'src/pages/agent/DealDetailSugarV4Page.tsx',
  'src/components/crm-sugar-v3/offer-modal/OfferModalSugar.tsx',
].map((nom) => ({ nom, code: readFileSync(nom, 'utf-8') }))

/** Retire les commentaires : sinon la note qui explique un retrait fait rougir. */
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
   .replace(/\/\/[^\n]*/g, ' ')

/**
 * ⛔ DEUX DE MES PROPRES CLAUSES ONT ÉTÉ DÉSARMÉES, ET LE CONTRÔLE NÉGATIF L'A
 * MONTRÉ — sans lui elles seraient parties vertes.
 *
 * Toutes deux lisaient une FENÊTRE DE LIGNES autour du `background:` :
 *
 *  · celle de l'avatar cherchait `background: …avatarBg`. Le correctif range
 *    l'aplat dans `const av = c.avatarBg || nd.ink` puis écrit `background: av` :
 *    plus aucun `avatarBg` sur la ligne. C'est la n° 5 de
 *    `megga/gardes-vacuites` — la garde qu'on désarme en écrivant le correctif —
 *    rencontrée cette fois SUR la garde qu'on venait d'écrire pour l'éviter.
 *  · celle de la pilule cherchait `color:` dans `i-3 … i+5`. Le commentaire de
 *    quatre lignes qui EXPLIQUE le correctif devient quatre lignes blanches
 *    après `sansCommentaires`, et pousse `color:` hors de la fenêtre. La garde
 *    désarmée par sa propre documentation.
 *
 * D'où ce découpage : on isole le BLOC DE STYLE entier (`style={{ … }}`, accolades
 * appariées). Un bloc est une unité du langage, il ne bouge pas quand on ajoute
 * un commentaire ni quand on nomme une variable.
 */
function blocsDeStyle(code: string): string[] {
  const blocs: string[] = []
  const re = /style=\{\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let profondeur = 2
    let i = m.index + m[0].length
    while (i < code.length && profondeur > 0) {
      if (code[i] === '{') profondeur++
      else if (code[i] === '}') profondeur--
      i++
    }
    blocs.push(code.slice(m.index, i))
  }
  return blocs
}

/** Noms locaux qui portent un aplat venu de la donnée (alias compris). */
function aplatsDeDonnee(code: string): RegExp {
  const alias = new Set<string>(['avatarBg', 'hue'])
  for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*[^\n]*\b(?:avatarBg|sgStagePillBg)\b/g)) {
    alias.add(m[1])
  }
  return new RegExp(`background:\\s*(?:[\\w.]*\\.)?(?:${[...alias].join('|')})\\b`)
}

/**
 * Les TROIS palettes parallèles du périmètre, encres et surfaces nommées.
 *
 * ⚠ Chaque encre est mesurée sur CHACUNE des surfaces de SON thème — jamais sur
 * une seule : `muted` échoue à 3,98 sur la carte blanche ET à 3,75 sur la
 * sous-carte, et un correctif qui ne viserait que la première laisserait la
 * seconde sous le plancher.
 *
 * ⛔ `ghost` n'est PAS une encre ici : c'est le pouce d'ascenseur et un fond de
 * pastille. L'entrer ferait rougir la garde sur un élément qui ne porte aucun
 * texte — une garde qui refuse du code correct se fait désarmer, pas corriger.
 */
/**
 * ⚠ LES PALETTES S'IMPORTENT — DEPUIS LE LOT 2, ET C'ÉTAIT L'INTÉRÊT DE
 * L'EXTRACTION.
 *
 * Cette garde lisait le LITTÉRAL dans le fichier de page : les exporter depuis
 * un fichier de composant faisait rougir `react-refresh/only-export-components`
 * (cinq erreurs eslint sur une base à zéro). Le lot 2 les a sorties dans des
 * modules de jetons — `dealTokens`, `omTokens` — et elles sont devenues des
 * FONCTIONS de la palette MEGGA X. On mesure donc les valeurs réellement
 * rendues, sans parseur intermédiaire.
 *
 * ⛔ Et le passage l'a prouvé au bon moment : la garde a LEVÉ quand les
 * littéraux ont disparu, au lieu de passer au vert sur une palette qu'elle ne
 * trouvait plus. C'est ce que `litPalette` exigeait, et c'est ce qui a évité
 * qu'un refactor la neutralise en silence.
 */
const dsClair = dsPalette(false, crmSugarPalette(false))
const dsSombre = dsPalette(true, crmSugarPalette(true))
const omClair = omPalette(false, crmSugarPalette(false))
const omSombre = omPalette(true, crmSugarPalette(true))
const ndClair = ndPalette(false, crmSugarPalette(false))
const ndSombre = ndPalette(true, crmSugarPalette(true))
const CANVAS_SOMBRE = crmSugarPalette(true).pageBg

const PALETTES: { nom: string; encres: string[]; surfaces: string[] }[] = [
  {
    nom: 'fiche deal · clair (DsLIGHT)',
    encres: [dsClair.ink, dsClair.soft, dsClair.muted],
    surfaces: [dsClair.card, dsClair.sub],
  },
  {
    nom: 'fiche deal · sombre (DsDARK)',
    encres: [dsSombre.ink, dsSombre.soft, dsSombre.muted],
    surfaces: [aplatir(dsSombre.card, CANVAS_SOMBRE), aplatir(dsSombre.sub, CANVAS_SOMBRE)],
  },
  {
    nom: 'modale d’offre · clair (OM_LIGHT)',
    encres: [omClair.ink, omClair.inkSoft, omClair.muted],
    surfaces: [omClair.card, omClair.cardSubtle, omClair.bg],
  },
  {
    nom: 'modale d’offre · sombre (OM_DARK)',
    encres: [omSombre.ink, omSombre.inkSoft, omSombre.muted],
    surfaces: [omSombre.card, omSombre.cardSubtle, omSombre.bg],
  },
  {
    nom: 'nouveau deal · clair (ndPalette)',
    encres: [ndClair.ink, ndClair.inkSoft, ndClair.muted],
    surfaces: [ndClair.card, ndClair.cardSubtle, ndClair.bg],
  },
  {
    nom: 'nouveau deal · sombre (ndPalette)',
    encres: [ndSombre.ink, ndSombre.inkSoft, ndSombre.muted],
    surfaces: [aplatir(ndSombre.card, ndSombre.bg), aplatir(ndSombre.cardSubtle, ndSombre.bg), ndSombre.bg],
  },
]

describe('Pipeline — l’encre reste lisible dans les deux thèmes', () => {
  it('le balayage voit l’arbre', () => {
    expect(SOURCES.length).toBeGreaterThan(8)
    expect(SOURCES.map((s) => s.nom)).toContain(`${DOSSIER}/PipelineList.tsx`)
    expect(SOURCES.every((s) => s.code.length > 0)).toBe(true)
    // Sans ça, un import cassé rendrait les tests de palette vrais par vacuité.
    expect(AVATAR_PALETTE.length).toBe(8)
    expect(CRM_STAGE_ORDER.length).toBe(8)
    for (const { nom, encres, surfaces } of PALETTES) {
      expect(encres.length, `${nom} : aucune encre`).toBeGreaterThan(2)
      expect(surfaces.length, `${nom} : aucune surface`).toBeGreaterThan(1)
      // Toute couleur entrée dans la mesure doit être OPAQUE : un `rgba(` qui
      // aurait échappé à `aplatir` se mesurerait comme du blanc pur.
      for (const c of [...encres, ...surfaces]) {
        expect(c, `${nom} : couleur non aplatie ${c}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
    // ⛔ Le verrou de la quatorzième forme : TOUTE couleur qui entre dans une
    // mesure doit être lisible par `canal`. Sans lui, `sgMix` — qui rend
    // `rgb(…)` — rendait NaN, et NaN passe TOUS les seuils.
    const illisibles: string[] = []
    for (const dark of [false, true]) {
      for (const stage of CRM_STAGE_ORDER) {
        for (const c of [sgStageTint(stage, dark).panel, sgStagePillBg(stage, dark)]) {
          if (!lisible(c)) illisibles.push(`${dark ? 'sombre' : 'clair'} ${stage} : ${c}`)
        }
      }
    }
    for (const c of AVATAR_PALETTE) if (!lisible(c)) illisibles.push(`avatar ${c}`)
    expect(illisibles, `couleurs que la sonde ne sait pas lire :\n  ${illisibles.join('\n  ')}`).toEqual([])
  })

  /**
   * FAMILLE A — le gris `#7a8088`, copié dans TROIS palettes.
   *
   * ⛔ C'est le défaut le plus nombreux du périmètre, et de loin : 25 textes sous
   * l'AA dans la seule modale d'offre, 15 sur la fiche, 8 dans « Nouveau deal ».
   * Tous la même valeur. Il descend de l'échelle grise de `SugarV3`, recopiée
   * telle quelle dans chaque palette d'écran — un jeton, quatre exemplaires.
   *
   * ⚠ On mesure chaque encre sur CHACUNE des surfaces de son propre thème, pas
   * sur une seule : `muted` échoue à 3,98 sur la carte blanche ET à 3,75 sur la
   * sous-carte, et un correctif qui ne viserait que la première laisserait la
   * seconde sous le plancher.
   */
  for (const { nom, encres, surfaces } of PALETTES) {
    it(`${nom} — chaque encre atteint l’AA sur ses surfaces`, () => {
      const fautes: string[] = []
      for (const encre of encres) {
        for (const surface of surfaces) {
          const rc = contraste(encre, surface)
          if (rc < AA) fautes.push(`${encre} sur ${surface} → ${arrondi(rc)}:1`)
        }
      }
      expect(fautes, `sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
    })
  }

  /**
   * FAMILLE B — l'initiale d'avatar.
   *
   * L'aplat vient du HACHAGE DE L'ID du contact : personne ne le relit avant
   * qu'il s'affiche. Une encre figée à `#fff` ne peut donc pas être juste pour
   * les huit teintes — mesuré : cinq échouent, de 2,15:1 à 4,47:1.
   *
   * ⚠ Même défaut, même correctif que sur « Matching » et « Contacts » : c'est
   * la SIXIÈME occurrence du motif. `encreSur` existe depuis le 12 août et
   * n'était employé nulle part dans ce périmètre.
   */
  it('toute encre posée sur un aplat de donnée est DÉRIVÉE', () => {
    const fautifs: string[] = []
    let blocsVus = 0
    for (const { nom, code } of SOURCES) {
      const src = sansCommentaires(code)
      const estAplatDonnee = aplatsDeDonnee(src)
      for (const bloc of blocsDeStyle(src)) {
        if (!estAplatDonnee.test(bloc)) continue
        blocsVus++
        // Un bloc qui pose un aplat de donnée SANS y écrire de texte n'a pas
        // d'encre à dériver — c'est le cas des pastilles et des barres.
        if (!/\bcolor:/.test(bloc)) continue
        if (!/encreSur\(/.test(bloc)) {
          fautifs.push(`${nom} → ${bloc.replace(/\s+/g, ' ').slice(0, 96)}`)
        }
      }
    }
    // ⛔ Sans ce compteur, un `blocsDeStyle` cassé rendrait la clause verte sur
    // zéro bloc — la vacuité que ce fichier entier essaie d'éviter.
    expect(blocsVus, 'aucun aplat de donnée vu : le découpage en blocs est cassé').toBeGreaterThanOrEqual(6)
    expect(fautifs, `encre figée sur un aplat de donnée :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('les huit teintes d’avatar restent lisibles sous l’encre dérivée', () => {
    const fautes = AVATAR_PALETTE
      .map((t) => ({ t, rc: contraste(encreSur(t), t) }))
      .filter((x) => x.rc < AA)
      .map((x) => `${x.t} → ${arrondi(x.rc)}:1`)
    expect(fautes, `teintes d’avatar sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * FAMILLE C — la pilule d'étape.
   *
   * ⛔ `sgStagePillBg` PROMET « contraste ≥ 4.5:1 » et ne le tient qu'en clair.
   * En sombre elle rend la teinte brute et l'encre blanche tombe à 2,34:1 sur
   * « Intérêt confirmé ». On fige donc la promesse au lieu de la croire.
   *
   * ⚠ On teste la fonction sur les DEUX thèmes ET les HUIT étapes : la sonde de
   * rendu n'en voyait que sept, faute d'un deal en « Visite effectuée ». Une
   * garde calée sur ce que la fixture montrait aurait laissé la huitième passer.
   */
  it('la pilule d’étape est lisible sur les huit étapes, dans les deux thèmes', () => {
    const fautes: string[] = []
    for (const dark of [false, true]) {
      for (const stage of CRM_STAGE_ORDER) {
        const fond = sgStagePillBg(stage, dark)
        const rc = contraste(encreSur(fond), fond)
        if (rc < AA) fautes.push(`${dark ? 'sombre' : 'clair'} ${stage} (${fond}) → ${arrondi(rc)}:1`)
      }
    }
    expect(fautes, `pilules sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ AUCUNE ENCRE BLANCHE EN DUR, ET AUCUNE EXEMPTION.
   *
   * `#fff` posé à la main est toujours un pari sur un fond qu'on n'a pas mesuré.
   * Cette clause, écrite plus large que la pilule qui l'avait motivée, a trouvé
   * DEUX sites de plus qu'aucune sonde de rendu n'avait montrés — la modale
   * « perdu » et l'avatar d'équipe des actions rapides.
   *
   * ⚠ ET ELLE A RÉFUTÉ MON PROPRE PROJET D'EXEMPTION. J'allais exempter la
   * célébration « Scellé » de la carte de deal en l'annonçant à 3,16:1, donc
   * au-dessus du seuil de GRAND texte. Mesure faite : blanc sur
   * `SG_STAGE_HUE.signed` (#E8892A) rend **2,61:1**. Le chiffre était écrit
   * avant d'être mesuré — exactement ce que la fiche `matching-meggax` reproche
   * à `--ink-soft`. Il n'y a donc pas d'exemption : les six sites dérivent.
   */
  it('aucune encre blanche écrite en dur', () => {
    const fautifs: string[] = []
    for (const { nom, code } of SOURCES) {
      sansCommentaires(code).split('\n').forEach((ligne, i) => {
        if (/color:\s*'#(?:fff|ffffff)'/i.test(ligne)) fautifs.push(`${nom}:${i + 1}`)
      })
    }
    expect(fautifs, `encre blanche en dur :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * FAMILLE D — le total de colonne, sur le voile d'étape.
   *
   * ⚠ Ici le fond est un VOILE, pas un aplat : `sgStageTint().panel` mélange la
   * teinte à la surface. `encreSur` s'y tromperait (sa docstring le dit) — on
   * mesure donc l'encre réelle contre le panneau composé, sans la dériver.
   *
   * Deux teintes sur huit échouent en clair (indigo 4,39 · bleu 4,49) et la
   * famille entière tient dans 0,4 du plancher : ce n'est pas deux colonnes
   * malchanceuses, c'est un dégradé qui traverse le seuil.
   */
  it('l’encre du panneau d’étape atteint l’AA sur les huit voiles', () => {
    const fautes: string[] = []
    for (const dark of [false, true]) {
      for (const stage of CRM_STAGE_ORDER) {
        const { panel, tintInk } = sgStageTint(stage, dark)
        const rc = contraste(tintInk, panel)
        if (rc < AA) fautes.push(`${dark ? 'sombre' : 'clair'} ${stage} : ${tintInk} sur ${panel} → ${arrondi(rc)}:1`)
      }
    }
    expect(fautes, `encre de panneau sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET LA MESURE QUI JUSTIFIE LE CHANGEMENT D'ENCRE — gardée pour qu'on ne
   * revienne pas à `sp.sub` en croyant simplifier.
   *
   * `sp.sub` plafonne à 4,39:1 sur l'indigo et 4,49:1 sur le bleu. La famille
   * entière tient dans 0,4 du plancher sur les huit teintes : ce ne sont pas
   * deux colonnes malchanceuses, c'est un dégradé qui traverse le seuil. En
   * sombre elle passerait (5,63:1) — d'où l'obligation de mesurer les DEUX
   * thèmes, sans quoi la clause serait verte et l'écran faux.
   */
  it('sp.sub ne suffit PAS sur le voile d’étape — la raison du reciblage', () => {
    const sousAA = CRM_STAGE_ORDER
      .filter((s) => contraste(crmSugarPalette(false).sub, sgStageTint(s, false).panel) < AA)
    expect(sousAA.length, 'si ceci devient 0, la note ci-dessus a cessé d’être vraie').toBe(2)
  })

  /**
   * Atome : le total de colonne prend l'encre du PANNEAU, pas l'encre secondaire
   * générique. Ancré sur la fonction, pas sur l'expression du jour.
   */
  it('le total de colonne ne reprend pas l’encre secondaire générique', () => {
    const col = SOURCES.find((s) => s.nom.endsWith('SugarStageColumn.tsx'))
    expect(col, 'fichier introuvable : la clause serait vraie par vacuité').toBeTruthy()
    const src = sansCommentaires(col!.code)
    const ligne = src.split('\n').find((l) => /crm-text-sm.*fontWeight: 600, color:/.test(l))
    expect(ligne, 'la ligne du total a changé de forme — revérifier').toBeTruthy()
    expect(ligne, `le total doit dériver du panneau :\n  ${ligne}`).toMatch(/color:\s*tint\.tintInk/)
  })

  /**
   * ENCRE TRANSLUCIDE COMPOSÉE — la forme de garde héritée du Matching, où le
   * motif s'est présenté TROIS fois (`--ink-muted`, `--ink-dim`, le séparateur
   * « · »). Il s'en présente une QUATRIÈME ici : `axisText`, les en-têtes de la
   * timeline, à 1,85:1 en clair et 2,93:1 en sombre.
   *
   * ⛔ Un jeton qui n'existe QUE pour être plus faible que ses voisins finit
   * toujours sous le plancher : rien ne l'arrête en chemin. On cherche donc la
   * FAMILLE — toute constante de thème employée comme `color:` — et on COMPOSE
   * son alpha avant de mesurer. Lue nue, une encre à 34 % paraît blanche.
   */
  it('aucune encre de thème sous l’AA, alpha composé', () => {
    const SURFACES = {
      clair: ['#FFFFFF', '#F9F9F9'],
      sombre: [crmSugarPalette(true).pageBg, aplatir(crmSugarPalette(true).cardBg, crmSugarPalette(true).pageBg)],
    }
    const fautes: string[] = []
    let paires = 0
    for (const { nom, code } of SOURCES) {
      const src = sansCommentaires(code)
      const blocs = blocsDeStyle(src)
      for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*dark\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) {
        const [, id, sombre, clair] = m
        paires++
        const commeEncre = new RegExp(`color:\\s*${id}\\b`)
        if (!commeEncre.test(src)) continue
        // ⚠ FAUX POSITIF ÉCARTÉ, ET IL COMPTE : `avFg` est l'encre de l'avatar,
        // posée sur SA PROPRE plaque, pas sur la carte. La mesurer contre les
        // surfaces génériques rendait 1,05:1 sur du code parfaitement juste — et
        // une garde qui refuse du code correct se fait désarmer, pas corriger.
        // On ne retient donc que les encres dont AU MOINS un site n'apporte pas
        // son propre fond ; celles qui en ont un relèvent d'`encreSur`.
        const sansAplat = blocs.some((b) => commeEncre.test(b) && !/background:/.test(b))
        if (!sansAplat) continue
        for (const [theme, encre] of [['sombre', sombre], ['clair', clair]] as const) {
          for (const surface of SURFACES[theme]) {
            const composee = aplatir(encre, surface)
            const rc = contraste(composee, surface)
            if (rc < AA) fautes.push(`${nom} · ${id} (${theme}) : ${encre} sur ${surface} → ${arrondi(rc)}:1`)
          }
        }
      }
    }
    // ⚠ Le témoin porte sur le MOTIF, pas sur le nombre de fautes : après
    // correctif il ne reste légitimement aucune encre de thème sans aplat, et
    // exiger « au moins une mesurée » ferait rougir la clause sur un code sain.
    // Ce qu'il faut prouver, c'est que le balayage voit encore des paires.
    expect(paires, 'plus aucune paire de thème : le motif ne matche plus rien').toBeGreaterThanOrEqual(2)
    expect(fautes, `encre de thème sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ L'ÉTAT DÉSACTIVÉ, QUE LES DEUX SONDES ONT MANQUÉ.
   *
   * Un CTA désactivé change de FOND sans changer d'encre. Ni la sonde de rendu
   * (le bouton n'est désactivé qu'avant saisie, et les bancs l'ouvrent
   * pré-rempli) ni les clauses de palette ci-dessus (`ghost` y est classé
   * non-encre, à juste titre — mais il sert ici de SURFACE) ne le voyaient.
   *
   * Mesuré : « Créer le deal » rendait 2,04:1, et 2,86:1 même après le
   * reciblage de l'encre secondaire ; « Enregistrer » de la modale d'offre,
   * 1,95:1 — le pire site du périmètre. Les DEUX thèmes échouaient.
   */
  it('l’aplat « ghost » reste lisible sous encre dérivée', () => {
    const fautes: string[] = []
    for (const [nom, ghost] of [
      ['nouveau deal · clair', ndClair.ghost], ['nouveau deal · sombre', ndSombre.ghost],
      ['modale d’offre · clair', omClair.ghost], ['modale d’offre · sombre', omSombre.ghost],
    ] as const) {
      const rc = contraste(encreSur(ghost), ghost)
      if (rc < AA) fautes.push(`${nom} : ${ghost} → ${arrondi(rc)}:1`)
    }
    expect(fautes, `aplat désactivé sous l’AA :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  it('aucun état désactivé ne fige son encre', () => {
    const fautifs: string[] = []
    let vus = 0
    for (const { nom, code } of SOURCES) {
      for (const bloc of blocsDeStyle(sansCommentaires(code))) {
        // ⚠ BORNER SUR LA VIRGULE, PAS SUR LE POINT-VIRGULE. Un littéral d'objet
        // JS sépare ses propriétés par des VIRGULES : `[^;]*` courait jusqu'au
        // bout du bloc et attrapait le `ghost` d'un `boxShadow` inset comme s'il
        // était un fond. Faux positif sur du code juste — donc une garde qu'on
        // finit par désarmer.
        if (!/background:[^,\n]*\bghost\b/.test(bloc)) continue
        vus++
        if (!/color:[^,\n]*encreSur\(/.test(bloc)) fautifs.push(`${nom} → ${bloc.replace(/\s+/g, ' ').slice(0, 90)}`)
      }
    }
    // ⚠ UN seul site, pas deux : la modale d'offre range son fond dans
    // `fondCta` avant de le poser, donc `background:` n'y nomme plus `ghost`.
    // Elle reste couverte par la clause de VALEUR ci-dessus et par « aucune
    // encre blanche en dur » — mais le compter ici serait faux.
    expect(vus, 'aucun aplat « ghost » vu : le motif ne matche plus').toBeGreaterThanOrEqual(1)
    expect(fautifs, `encre figée sur un aplat désactivé :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /** `encreSur` bascule bien d'une encre à l'autre — sinon tout ce qui précède
   *  serait vrai par construction avec une fonction constante. */
  it('encreSur bascule bien d’une encre à l’autre', () => {
    expect(encreSur('#ffffff')).toBe('#030303')
    expect(encreSur('#030303')).toBe('#ffffff')
  })
})
