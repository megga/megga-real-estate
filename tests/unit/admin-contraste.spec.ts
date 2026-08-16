/**
 * Garde-fou : dans la console super-admin, les huit `AdminTones` restent
 * lisibles — dans leurs DEUX rôles et dans les DEUX thèmes.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Mesuré le 14 août 2026 sur `/dev/admin` et à
 * la source. Aucune garde du dépôt ne lisait `useAdminSurfaces` : `megga-x-grammar`
 * ne connaît pas le mot « admin », `megga-x-crm-tokens` s'arrête aux barreaux de
 * la vitrine, et les gardes d'écran (`pipeline-contraste`, `matching-contraste`)
 * balayent d'autres dossiers.
 *
 * ── LES DEUX ASYMÉTRIES, INVERSES, ET C'EST CE QUI IMPOSE LES DEUX THÈMES ────
 * Treizième forme de `megga/gardes-vacuites`, et elle se présente ici dans les
 * deux sens à la fois — une garde d'un seul thème serait passée au vert quel que
 * soit celui qu'on aurait choisi :
 *
 *   · En CLAIR, c'est l'ENCRE qui tombe. `ok` 3,48:1, `cyan` 3,40:1,
 *     `accent` 3,91:1, `warn` 4,03:1 et `err` 4,46:1 sur la sous-carte. L'aplat,
 *     lui, tient presque partout.
 *   · En SOMBRE, c'est l'APLAT qui tombe, et il tombe ENTIÈREMENT : les six
 *     tons sont réglés CLAIRS pour rester lisibles en encre sur un canvas noir,
 *     et `onTone` posait dessus un blanc écrit en dur — 2,38:1 à 3,57:1, les six
 *     sous le seuil. L'encre, elle, ne descend jamais sous 5,35:1.
 *
 * C'est exactement la règle que `CLAUDE.md` §3 énonce — « un remplissage pâle
 * prend TOUJOURS l'encre sombre » — jamais appliquée à ce dossier.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * 1. Les tons employés comme ENCRE atteignent l'AA sur les trois surfaces de
 *    chaque thème, alpha COMPOSÉ (la carte sombre est un voile à 5 %).
 * 2. L'encre posée sur un aplat de ton est DÉRIVÉE (`encreSur`), et le résultat
 *    atteint l'AA sur les six tons × deux thèmes.
 * 3. `onTone` n'est plus une constante — une encre figée ne peut pas suivre un
 *    ton qui change de thème, et c'est précisément comme ça que le défaut est né.
 * 4. `tones.accent` n'est JAMAIS employé comme couleur de texte : il vaut
 *    l'accent MEGGA X, qui ne passe pas l'AA en encre sur fond sombre (3,30:1 —
 *    fait déjà figé par `megga-x-crm-tokens.spec.ts`).
 *
 * ⚠ ET UNE TROUVAILLE DE LA GARDE ELLE-MÊME : tant que `tones.accent` valait
 * `'rgb(var(--color-admin-accent))'`, AUCUNE garde statique ne pouvait le
 * mesurer — une couleur qui n'existe qu'au rendu échappe par construction à
 * toute lecture de source. La clause « le balayage lit chaque ton » refuse donc
 * toute couleur qu'elle n'a pas su lire, plutôt que de la sauter en silence
 * (`megga/gardes-vacuites` n° 14 : une garde qui ne sait pas lire une notation
 * rend un succès, pas une erreur).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { encreSur, MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { crmPalette } from '@/components/crm/tokens'
import { adminSurfaces, adminTones } from '@/hooks/useAdminSurfaces'

const AA = 4.5
/** Seuil WCAG 1.4.11 : un glyphe ou une pastille n'est pas du texte. */
const NON_TEXTE = 3

/* ─── Lecture de couleur : les DEUX notations ─────────────────────────────── */

/**
 * ⚠ Lit `#rgb`, `#rrggbb` ET `rgb()/rgba()`. Une garde qui ne connaît qu'une
 * notation rend `NaN`, et `NaN < 4.5` est FAUX : elle passe au vert sur le
 * défaut qu'elle prétend surveiller.
 */
function canal(couleur: string): [number, number, number, number] {
  const rgb = couleur.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((v) => Number(v.trim()))
    return [p[0]!, p[1]!, p[2]!, p[3] === undefined ? 1 : p[3]!]
  }
  const h = couleur.trim().replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [
    parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16),
    v.length === 8 ? parseInt(v.slice(6, 8), 16) / 255 : 1,
  ]
}

const lisible = (c: string) => canal(c).every((v) => Number.isFinite(v))

/** Compose une couleur translucide sur son fond — la carte sombre est un voile. */
function aplatir(couleur: string, dessous: string): string {
  const a = canal(couleur)
  if (a[3] === 1) return `rgb(${a[0]}, ${a[1]}, ${a[2]})`
  const b = canal(dessous)
  return `rgb(${[0, 1, 2].map((i) => a[i]! * a[3]! + b[i]! * (1 - a[3]!)).join(', ')})`
}

function luminance(couleur: string): number {
  const [r, g, b] = canal(couleur)
  const l = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!
}

function contraste(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const arrondi = (n: number) => Math.round(n * 100) / 100

/* ─── Les surfaces réelles de chaque thème ────────────────────────────────── */

/**
 * Les trois fonds sur lesquels la console pose du texte, dans l'ordre où on les
 * rencontre : le cadre, la carte, la sous-carte.
 *
 * ⚠ En sombre, `card` et `cardSub` sont des VOILES (`rgba(255,255,255,.05)` et
 * `.04`). Lus nus ils rendraient un blanc, donc un contraste faux dans le bon
 * sens. On les compose sur le canvas — piège de sonde (b).
 */
function surfaces(dark: boolean): { nom: string; fond: string }[] {
  const sp = crmPalette(dark)
  const surf = adminSurfaces(dark)
  return [
    { nom: 'cadre', fond: aplatir(sp.pageBg, sp.pageBg) },
    { nom: 'carte', fond: aplatir(surf.card, sp.pageBg) },
    { nom: 'sous-carte', fond: aplatir(surf.cardSub, sp.pageBg) },
  ]
}

/**
 * Rôle de chaque ton, NOMMÉ un par un.
 *
 * ⚠ C'est la leçon la plus chère du chantier Pipeline : « une garde ne mesure
 * que ce qu'on lui a nommé ». Sa garde de contraste listait `ink`/`soft`/`muted`
 * comme « les encres » d'une palette et laissait `err`/`ok` dehors — un vert
 * employé en ENCRE à 3,77:1 lui a échappé entièrement. Ici les huit tons sont
 * énumérés, et chacun dit dans quel(s) rôle(s) il est employé.
 */
const ROLES: { ton: keyof ReturnType<typeof adminTones>; encre: boolean; aplat: boolean; note?: string }[] = [
  { ton: 'ok', encre: true, aplat: true },
  { ton: 'warn', encre: true, aplat: true },
  { ton: 'err', encre: true, aplat: true },
  { ton: 'info', encre: true, aplat: true },
  { ton: 'cyan', encre: true, aplat: true },
  {
    ton: 'accent', encre: false, aplat: true,
    note: 'APLAT et GLYPHE seulement — l’accent MEGGA X ne passe pas l’AA en '
      + 'texte sur fond sombre (3,30:1). La clause « aucun texte peint en accent » '
      + 'est ce qui rend cette exemption vérifiable au lieu de la supposer.',
  },
  { ton: 'neutralInk', encre: true, aplat: false, note: 'encre de la pilule neutre' },
  { ton: 'neutralBg', encre: false, aplat: true, note: 'aplat de la pilule neutre, sous `neutralInk`' },
]

const SOURCE_KIT = 'src/components/admin/kit/adminKit.tsx'
const SOURCE_HOOK = 'src/hooks/useAdminSurfaces.ts'

/**
 * Les écrans qui posent eux-mêmes une encre sur un ton, hors du kit.
 *
 * ⚠ Liste écrite à part et vérifiée non vide : une clause qui itérerait les
 * fichiers TROUVÉS rétrécirait avec eux (`megga/gardes-vacuites` n° 15).
 */
const CONSOMMATEURS_ONTONE = ['src/pages/admin/AdminNpsPage.tsx']

/**
 * Les trois dossiers de la console, balayés en ENTIER.
 *
 * ⚠ On liste le DOSSIER, pas les fichiers : une clause qui itérerait les
 * fichiers connus rétrécirait avec eux. `emptyRoots` n'existe pas ici, d'où
 * l'assertion de peuplement dans « le balayage lit chaque ton ».
 */
function fichiersDuPerimetre(): string[] {
  const racines = ['src/pages/admin', 'src/components/admin', 'src/components/admin/kit']
  return racines.flatMap((r) =>
    readdirSync(r).filter((n) => /\.tsx?$/.test(n)).map((n) => `${r}/${n}`),
  )
}

const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
    .replace(/\/\/[^\n]*/g, ' ')

describe('Console admin — les tons restent lisibles dans les deux thèmes', () => {
  it('le balayage lit chaque ton, dans les deux thèmes', () => {
    // ⛔ Sans cette clause, un ton exprimé en variable CSS
    // (`rgb(var(--color-admin-accent))`) rendrait `NaN` partout et TOUTES les
    // clauses ci-dessous passeraient au vert sans avoir rien mesuré.
    const illisibles: string[] = []
    for (const dark of [false, true]) {
      const t = adminTones(dark)
      for (const { ton } of ROLES) {
        if (!lisible(t[ton])) illisibles.push(`${dark ? 'sombre' : 'clair'} · ${ton} = ${t[ton]}`)
      }
      for (const { nom, fond } of surfaces(dark)) {
        if (!lisible(fond)) illisibles.push(`${dark ? 'sombre' : 'clair'} · surface ${nom} = ${fond}`)
      }
    }
    expect(illisibles, `couleur non mesurable par la garde :\n  ${illisibles.join('\n  ')}`).toEqual([])
  })

  it('un ton employé en ENCRE atteint l’AA sur les trois surfaces de son thème', () => {
    const sous: string[] = []
    for (const dark of [false, true]) {
      const t = adminTones(dark)
      for (const { ton, encre } of ROLES) {
        if (!encre) continue
        for (const { nom, fond } of surfaces(dark)) {
          const r = contraste(t[ton], fond)
          if (r < AA) sous.push(`${dark ? 'sombre' : 'clair'} · ${ton} (${t[ton]}) sur ${nom} : ${arrondi(r)}:1`)
        }
      }
    }
    expect(sous, `encre sous l’AA :\n  ${sous.join('\n  ')}`).toEqual([])
  })

  it('l’encre posée sur un aplat de ton est DÉRIVÉE, et le résultat atteint l’AA', () => {
    const sous: string[] = []
    for (const dark of [false, true]) {
      const t = adminTones(dark)
      for (const { ton, aplat } of ROLES) {
        if (!aplat) continue
        const fond = aplatir(t[ton], crmPalette(dark).pageBg)
        // La pilule neutre porte `neutralInk`, pas l'encre dérivée : c'est le
        // seul ton qui dit « pas de signal », et il ne doit pas crier.
        const ink = ton === 'neutralBg' ? t.neutralInk : encreSur(fond)
        const r = contraste(ink, fond)
        if (r < AA) sous.push(`${dark ? 'sombre' : 'clair'} · aplat ${ton} (${t[ton]}) sous ${ink} : ${arrondi(r)}:1`)
      }
    }
    expect(sous, `aplat sous l’AA :\n  ${sous.join('\n  ')}`).toEqual([])
  })

  it('un ton employé en GLYPHE ou en PASTILLE atteint le seuil non-texte', () => {
    // `AdminStat` peint son icône avec le ton, `AdminSectionTitle` sa pastille
    // de 8 px : ni l'un ni l'autre n'est du texte, mais 3:1 reste exigé.
    const sous: string[] = []
    for (const dark of [false, true]) {
      const t = adminTones(dark)
      for (const { ton, aplat, encre } of ROLES) {
        if (!aplat && !encre) continue
        if (ton === 'neutralBg' || ton === 'neutralInk') continue
        for (const { nom, fond } of surfaces(dark)) {
          const r = contraste(t[ton], fond)
          if (r < NON_TEXTE) sous.push(`${dark ? 'sombre' : 'clair'} · ${ton} sur ${nom} : ${arrondi(r)}:1`)
        }
      }
    }
    expect(sous, `glyphe sous 3:1 :\n  ${sous.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ANCRÉE SUR LA VALEUR, PAS SUR LE NOM. Une garde qui exigerait
   * « `onTone` appelle `encreSur` » se casserait au premier renommage sans que
   * la règle ait bougé ; celle-ci refuse la CONSTANTE — c'est elle, le défaut.
   */
  it('`onTone` n’est pas une encre figée', () => {
    const code = sansCommentaires(readFileSync(SOURCE_HOOK, 'utf8'))
    const fige = code.match(/onTone:\s*['"]#[0-9a-fA-F]{3,8}['"]/)
    expect(
      fige?.[0] ?? null,
      'une encre écrite en dur ne peut pas suivre un ton qui change de thème — '
      + 'c’est exactement comme ça que les six aplats sombres sont tombés sous l’AA',
    ).toBeNull()
  })

  /**
   * ⛔ LA RÈGLE LIÉE AU SITE, pas seulement à la valeur — deuxième forme de
   * `megga/gardes-vacuites`. Vérifier que `accent` tient en aplat ne dit RIEN
   * de qui l'emploie : c'est son usage en ENCRE qui est interdit, et lui seul.
   *
   * ⚠ Ancrée sur le BLOC de style entier (`{ … }` appariés), pas sur une
   * fenêtre de lignes : une fenêtre se fait désarmer par le commentaire qui
   * explique le correctif (n° 16).
   */
  it('aucun texte de la console n’est peint avec le ton `accent`', () => {
    // ⛔ ELLE NE LISAIT QUE LE KIT, ET MON PROPRE CORRECTIF L'A CONTOURNÉE.
    // La migration d'`AdminKybReviewPage` a converti `text-admin-accent` en
    // `color: tones.accent` sur son badge « Admin MEGGA » : 3,57:1 sur le canvas
    // sombre, mesuré au RENDU alors que la garde restait verte. Onzième forme —
    // une garde qui ne regarde que là où on a rangé les valeurs ne voit pas
    // celles écrites à côté. Elle balaye désormais le PÉRIMÈTRE.
    const fautifs: string[] = []
    for (const f of fichiersDuPerimetre()) {
      sansCommentaires(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
        if (/\bcolor:\s*[^,;}\n]*\btones?\.accent\b/.test(l)) fautifs.push(`${f}:${i + 1}`)
      })
    }
    expect(fautifs, `texte peint en accent :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * L'état DÉSACTIVÉ, que NI la sonde de rendu NI les gardes de palette ne
   * voient : le bouton n'est désactivé qu'avant saisie, et aucune palette ne
   * décrit un `opacity`. Le Pipeline y avait trouvé son pire site (1,95:1).
   *
   * ⚠ Seuil `NON_TEXTE` et non `AA` : la WCAG 1.4.3 exempte explicitement les
   * commandes inactives. On refuse l'illisible, on n'invente pas une exigence.
   */
  it('un bouton désactivé reste distinguable dans les deux thèmes', () => {
    const code = sansCommentaires(readFileSync(SOURCE_KIT, 'utf8'))
    // ⚠ LITTÉRAL **OU** CONSTANTE NOMMÉE, et l'assertion « la clause ne mesure
    // rien » l'a prouvé sur ce chantier même : nommer le voile
    // (`VOILE_DESACTIVE`) a fait disparaître le littéral, la clause n'a plus
    // trouvé aucun alpha — et elle a rougi au lieu de passer au vert par
    // vacuité. C'est le seul comportement acceptable pour une garde qui perd sa
    // prise ; on résout donc l'identifiant au lieu d'exiger un chiffre en dur.
    const alphas = [...code.matchAll(/opacity:\s*disabled\s*\?\s*([\w.]+)/g)]
      .map((m) => {
        const brut = m[1]!
        if (/^[\d.]+$/.test(brut)) return Number(brut)
        const decl = code.match(new RegExp(`\\b${brut}\\s*=\\s*([\\d.]+)`))
        return decl ? Number(decl[1]) : NaN
      })
    expect(alphas.length, 'aucun état désactivé trouvé : la clause ne mesure rien').toBeGreaterThan(0)
    expect(
      alphas.filter((a) => !Number.isFinite(a)),
      'voile désactivé non résolu : la clause mesurerait NaN, et NaN < 3 est FAUX',
    ).toEqual([])

    const sous: string[] = []
    for (const dark of [false, true]) {
      const sp = crmPalette(dark)
      const surf = adminSurfaces(dark)
      // ⛔ LES DEUX APLATS, PAS UN. Une première version ne mesurait que le
      // bouton FANTÔME — surface de carte, encre d'encre — qui tenait déjà
      // (3,96:1 au pire). Le bouton PRINCIPAL porte l'accent sous encre
      // inversée, et c'est lui qui tombait : « Publier maintenant » sortait à
      // 2,56:1 sur `/changelog`, mesuré au rendu. Onzième forme de garde
      // vacuité — une garde qui ne regarde que là où on a rangé les valeurs ne
      // voit pas celles écrites à côté.
      const boutons: { nom: string; aplat: string; encre: string }[] = [
        { nom: 'fantôme', aplat: aplatir(surf.card, sp.pageBg), encre: sp.ink },
        { nom: 'principal', aplat: sp.accent, encre: sp.accentInk },
      ]
      // Le parent le plus CLAIR est le pire cas en clair, le plus sombre en
      // sombre : on prend les deux fonds que la console pose sous un bouton.
      for (const parent of [aplatir(surf.card, sp.pageBg), sp.pageBg]) {
        for (const { nom, aplat, encre } of boutons) {
          for (const a of alphas) {
            // `opacity` fond l'élément ENTIER dans son parent : l'encre ET
            // l'aplat se rapprochent du fond, chacun de son côté.
            const enc = aplatir(`rgba(${canal(encre).slice(0, 3).join(',')},${a})`, parent)
            const fnd = aplatir(`rgba(${canal(aplat).slice(0, 3).join(',')},${a})`, parent)
            const r = contraste(enc, fnd)
            if (r < NON_TEXTE) {
              sous.push(`${dark ? 'sombre' : 'clair'} · ${nom} · opacity ${a} sur ${parent} : ${arrondi(r)}:1`)
            }
          }
        }
      }
    }
    expect(sous, `désactivé sous 3:1 :\n  ${sous.join('\n  ')}`).toEqual([])
  })

  /**
   * Une garde qui ne mesure QUE des valeurs ne dit rien de ce qui rend. Celle-ci
   * lie les deux : partout où la console pose une encre sur un ton, elle doit la
   * DÉRIVER, sinon la clause d'aplat ci-dessus surveille une règle que plus
   * personne n'applique (`megga/gardes-vacuites` n° 2).
   *
   * ⛔ PREMIÈRE VERSION ANCRÉE SUR LE MAUVAIS ATOME, et elle est restée rouge
   * APRÈS le correctif : elle exigeait `encreSur(` dans le kit, alors que la
   * dérivation vit maintenant dans le hook (`onTone: encreSur`) et que le kit
   * l'APPELLE. Elle décrivait un chemin d'implémentation, pas la règle. La règle
   * est : l'encre est une FONCTION de l'aplat. D'où l'ancrage sur l'usage —
   * `onTone` appelé, jamais passé nu.
   */
  it('l’encre posée sur un ton est appelée, jamais passée nue', () => {
    const nus: string[] = []
    for (const f of [SOURCE_KIT, ...CONSOMMATEURS_ONTONE]) {
      const code = sansCommentaires(readFileSync(f, 'utf8'))
      code.split('\n').forEach((l, i) => {
        // `onTone` employé comme VALEUR (`ink: onTone`, `= onTone`) et non
        // appelé : c'est la forme exacte du défaut d'origine.
        if (/[:=]\s*onTone\s*(?![(\w])/.test(l)) nus.push(`${f}:${i + 1}`)
      })
    }
    expect(nus, `encre figée, non dérivée de son aplat :\n  ${nus.join('\n  ')}`).toEqual([])

    const kit = sansCommentaires(readFileSync(SOURCE_KIT, 'utf8'))
    expect(
      /onTone\s*\(/.test(kit),
      'le kit ne dérive plus l’encre de sa pilule : la clause d’aplat ne garde plus rien',
    ).toBe(true)

    // Et le blanc en dur ne doit pas revenir par la porte de service.
    const blancs = kit.split('\n')
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => /(?:color|ink)\s*[:=]\s*['"]#(?:fff|ffffff|FFF|FFFFFF)['"]/.test(l))
      .map(({ n }) => `${SOURCE_KIT}:${n}`)
    expect(blancs, `encre blanche écrite en dur :\n  ${blancs.join('\n  ')}`).toEqual([])
  })

  /** Le noir et le blanc de l'échelle restent les deux pôles d'`encreSur`. */
  it('les deux pôles de l’encre dérivée sont ceux de l’échelle', () => {
    expect([encreSur('#ffffff'), encreSur('#000000')]).toEqual([MXC_COLOR.n100, MXC_COLOR.n1000])
  })
})
