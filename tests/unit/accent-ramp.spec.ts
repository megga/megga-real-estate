/**
 * Garde-fou : la RAMPE D'ACCENT de la feuille — un jeton par RÔLE, mesuré dans
 * les deux thèmes.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * ⛔ `--color-accent` N'ÉTAIT GARDÉE PAR RIEN. Ni sa valeur, ni sa branche
 * sombre, ni le couple qu'elle forme avec l'encre blanche. `megga-x-crm-tokens`
 * verrouille l'accent de MEGGA X (`#424bfb`) et l'échelle CSS ; personne ne
 * regardait la SECONDE rampe, celle des utilitaires Tailwind — 80 emplois dans
 * dix fichiers, plus les anneaux de focus de `globals.css`.
 *
 * ── CE QUE LA MESURE A TROUVÉ (15 août 2026) ─────────────────────────────────
 * ⛔ UN SEUL JETON POUR DEUX RÔLES INCOMPATIBLES, et aucune valeur ne peut les
 * tenir tous les deux en sombre :
 *
 *   `--color-accent` sombre = #3B82F6 → APLAT sous encre blanche **3,68:1** (⛔),
 *                                       TEXTE sur la page sombre 4,63:1 (✅)
 *   la même mise à #2563EB          → APLAT 5,17:1 (✅),
 *                                       TEXTE **3,30:1** (⛔)
 *
 * Les deux rôles sont VIVANTS : douze `bg-accent` et neuf `text-accent` sur des
 * surfaces qui suivent le thème. Corriger la valeur DÉPLACE donc le défaut —
 * c'est la forme n° 13, prise non plus entre deux thèmes mais entre deux RÔLES.
 *
 * Le dépôt possédait déjà la règle : « la teinte VIVE va sur l'APLAT, la FONCÉE
 * va sur le TEXTE » (`CLAUDE.md` §3, `megga/da-meggax-crm`). Ce qui manquait,
 * c'est le second JETON. D'où `--color-accent-solid`.
 *
 * ── PUIS LES DEUX RAMPES ONT ÉTÉ UNIFIÉES (15 août 2026, même journée) ───────
 * ⛔ Il y avait DEUX accents dans le dépôt, et rien ne le disait : `#424bfb`
 * (MEGGA X, 328 sites, 123 fichiers, styles en ligne) et `#2563EB` (cette rampe,
 * 10 fichiers). À 1,12:1 l'un de l'autre — presque indiscernables — et ils se
 * rencontraient sur six surfaces CRM, le chrome peint de l'un et le contenu de
 * l'autre. La rampe adopte donc l'accent de MARQUE :
 *
 *   `accent-solid` (APLAT) = #424bfb dans les DEUX thèmes — 5,78:1 sous blanc
 *   `accent` (ENCRE)       = #424bfb en clair (5,78 sur blanc)
 *                          = #8dc1ff en sombre — `MXC_SYSTEM.blue300`, 9,09:1
 *
 * ⚠ L'ENCRE SOMBRE N'EST PAS UNE VALEUR TROUVÉE : `#424bfb` rend **2,95:1** sur
 * la page sombre, sous l'AA et même sous le seuil des FILETS — donc l'anneau de
 * focus serait tombé avec. `blue300` est le barreau que le dépôt avait déjà
 * nommé pour ce cas exact.
 *
 * ⛔ ET UN PIÈGE QUI SE SERAIT VU TOUT DE SUITE, MAIS TROP TARD : le rail
 * `[data-sidebar-style="colored"]` — une préférence VIVE, posée par
 * `usePreferences` — peignait son fond avec `--color-accent` en forçant du texte
 * BLANC. Le jeton devenant PÂLE en sombre, ce rail serait passé à **1,87:1**. Il
 * lit maintenant l'aplat, et une clause l'exige.
 *
 * ⚠ `--color-accent-hover` et `--color-accent-light` sont PARTIS : zéro lecteur,
 * en CSS comme en utilitaires. Une clé sans lecteur n'est pas « hors direction »,
 * elle est morte.
 *
 * ⚠ ET LE DÉFAUT SE RENDAIT VRAIMENT. `data-theme="dark"` est posé sur `<html>`
 * et il est GLOBAL : il survit à une navigation SPA, y compris vers les pages
 * publiques. Mesuré au rendu sur `/reset-password`, transition neutralisée :
 * 5,17:1 en clair, 3,68:1 dès que l'attribut est là.
 */
import { describe, it, expect } from 'vitest'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11) — un anneau de focus, un filet. */
const AA_FORME = 3

const FEUILLE = 'src/styles/globals.css'
const lu = readFileSafely(repoPath(FEUILLE))
const CSS = lu.status === 'ok' ? lu.value : ''

/* ─── Lecture ────────────────────────────────────────────────────────────────── */

/** `37 99 235` → `#2563eb`. La feuille stocke les canaux nus, pour `rgb(var(…) / α)`. */
function hex(canaux: string): string {
  const p = canaux.trim().split(/\s+/).map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return ''
  return '#' + p.map((n) => n.toString(16).padStart(2, '0')).join('')
}
function luminance(c: string): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16))
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
}
function contraste(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * Les jetons d'un bloc de thème.
 *
 * ⛔ ANCRÉ SUR LE BLOC, PAS SUR LE FICHIER. `:root` et `[data-theme="dark"]`
 * déclarent les MÊMES noms ; un balayage global rendrait la dernière valeur lue
 * et mesurerait un thème en croyant en mesurer deux.
 */
function bloc(selecteur: string): Record<string, string> {
  const i = CSS.indexOf(selecteur)
  if (i < 0) return {}
  // Fin du bloc : la première accolade fermante en début de ligne après lui.
  const j = CSS.indexOf('\n  }', i)
  const corps = CSS.slice(i, j < 0 ? undefined : j)
  const out: Record<string, string> = {}
  for (const m of corps.matchAll(/--color-(accent[a-z-]*|bg-page):\s*([0-9\s]+);/g)) out[m[1]!] = m[2]!.trim()
  return out
}
const CLAIR = bloc(':root {')
const SOMBRE = bloc('[data-theme="dark"] {')

describe('Rampe d’accent — un jeton par rôle, dans les deux thèmes', () => {
  /** Sans lui, tout le reste passerait par vacuité sur une feuille non lue. */
  it('la feuille est lue, et les deux blocs sont distincts', () => {
    expect(lu.status, `${FEUILLE} illisible : la spec ne mesure rien`).toBe('ok')
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      expect(Object.keys(b).length, `bloc ${nom} vide : l'ancre a bougé`).toBeGreaterThan(4)
      for (const cle of ['accent', 'accent-solid', 'accent-fg', 'accent-dark', 'bg-page']) {
        expect(Object.keys(b), `${nom} : ${cle} absent`).toContain(cle)
      }
    }
    // ⚠ Les deux blocs déclarent les MÊMES noms : s'ils rendaient la même chose,
    // l'ancre du bloc sombre matcherait le clair et la spec mesurerait deux fois
    // le même thème sans le dire.
    expect(CLAIR['bg-page'], 'les deux blocs rendent le même fond : l’ancre est fausse').not.toBe(SOMBRE['bg-page'])
    // Et toute valeur doit se lire : un canal hors bornes rendrait '' et la
    // comparaison de seuil l'avalerait (n° 14).
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      for (const [k, v] of Object.entries(b)) {
        expect(hex(v), `${nom}.${k} illisible : « ${v} »`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  /**
   * ⛔ L'APLAT PORTE DE L'ENCRE BLANCHE — c'est tout ce qu'on lui demande, et
   * c'est ce que `--color-accent` ne tenait pas en sombre.
   */
  it('l’aplat d’accent porte son encre dans les deux thèmes', () => {
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const aplat = hex(b['accent-solid']!)
      const encre = hex(b['accent-fg']!)
      const r = contraste(encre, aplat)
      if (r < AA) faibles.push(`${nom} : accent-fg (${encre}) sur accent-solid (${aplat}) = ${arrondi(r)}:1`)
    }
    expect(faibles, `l'encre de l'aplat est illisible :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET L'ENCRE D'ACCENT SE LIT SUR SA PAGE — le rôle inverse, et c'est lui
   * qu'une correction naïve de l'aplat aurait cassé (9 sites `text-accent`).
   */
  it('l’encre d’accent se lit sur la page, dans les deux thèmes', () => {
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const encre = hex(b['accent']!)
      const page = hex(b['bg-page']!)
      const r = contraste(encre, page)
      if (r < AA) faibles.push(`${nom} : accent (${encre}) en TEXTE sur bg-page (${page}) = ${arrondi(r)}:1`)
    }
    expect(faibles, `l'encre d'accent est illisible sur sa page :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ L'ENCRE SOMBRE EST UN BARREAU NOMMÉ, pas une valeur trouvée. `#424bfb` rend
   * 2,95:1 sur la page sombre — sous l'AA et même sous le seuil des filets. Le
   * dépôt avait déjà tranché : `MXC_SYSTEM.blue300`, « le barreau de la vitrine
   * qui répond », cité dans `megga-x-crm/tokens.ts` et dans `CLAUDE.md` §3.
   */
  it('l’encre sombre est le barreau que le dépôt a nommé', () => {
    const attendu = MXC_SYSTEM.blue300.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16)).join(' ')
    expect(SOMBRE['accent'], `l'encre sombre doit rester MXC_SYSTEM.blue300 (${MXC_SYSTEM.blue300})`).toBe(attendu)
  })

  /**
   * L'anneau de focus est tiré de `--color-accent` (`globals.css`, `:focus-visible`
   * et `.focus-ring`) : un tracé, donc le seuil NON textuel.
   */
  it('l’anneau de focus se voit sur la page, dans les deux thèmes', () => {
    expect(/outline:\s*2px solid rgb\(var\(--color-accent\)\)/.test(CSS),
      'l’anneau de focus ne vient plus de --color-accent : la clause ne mesure rien').toBe(true)
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const r = contraste(hex(b['accent']!), hex(b['bg-page']!))
      if (r < AA_FORME) faibles.push(`${nom} : anneau ${hex(b['accent']!)} sur ${hex(b['bg-page']!)} = ${arrondi(r)}:1`)
    }
    expect(faibles, `anneau de focus invisible :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LES DEUX RÔLES NE SE CONFONDENT PAS À NOUVEAU.
   *
   * Le défaut d'origine est qu'UN jeton servait d'aplat ET d'encre. La clause
   * refuse donc qu'un `bg-accent` réapparaisse là où le thème peut basculer : les
   * surfaces qui suivent le thème peignent leur aplat avec `bg-accent-solid`.
   *
   * ⚠ Les pages PUBLIQUES sont mono-thème, mais `data-theme` est GLOBAL et
   * survit à une navigation SPA : elles emploient le même jeton d'aplat. La
   * clause ne fait donc aucune exception — c'est l'attribut qui voyage, pas la
   * page.
   */
  it('aucune surface ne peint son aplat avec le jeton d’ENCRE', () => {
    const scan = readFileSafely(repoPath('tests/unit/helpers/fs-scan.ts'))
    expect(scan.status, 'helper illisible').toBe('ok')
    // ⛔ DÉRIVÉ DE LA SOURCE, PAS RECOPIÉ : l'aplat DOIT être l'accent de marque
    // de MEGGA X. Figer le littéral ici laisserait les deux rampes redivergaer
    // sans que rien ne rougisse — c'est exactement ce qui s'était produit.
    const marque = MXC_COLOR.accent.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16)).join(' ')
    expect(CLAIR['accent-solid'], `l'aplat n'est plus l'accent de marque (${MXC_COLOR.accent})`).toBe(marque)
    expect(SOMBRE['accent-solid'], 'l’aplat doit être la MÊME valeur dans les deux thèmes : c’est un rôle, pas un ton').toBe(marque)
    // ⛔ ET LE RAIL COLORÉ EST UN APLAT. Il force du texte BLANC ; lire le jeton
    // d'ENCRE le peindrait en #8dc1ff au thème sombre — 1,87:1. `data-sidebar-style`
    // est une préférence VIVE, posée par `usePreferences`.
    expect(/\[data-sidebar-style="colored"\] aside \{[\s\S]{0,400}?background-color: rgb\(var\(--color-accent-solid\)\)/.test(CSS),
      'le rail coloré ne lit plus le jeton d’APLAT — il forcerait du blanc sur une encre pâle').toBe(true)
  })

  /**
   * ⛔ LE FILET ET L'ANNEAU SUIVENT L'ENCRE — ils ne portent pas leur propre ton.
   *
   * Ils avaient divergé, et rien ne pouvait le dire : `--color-border-focus` et
   * `--color-ring` gardaient #2563EB / #3B82F6 — l'accent d'AVANT l'unification
   * du 15 août — pendant que `applyPreferences` les réécrivait au rendu. Le
   * défaut était donc masqué par un SECOND défaut ; retirer la réécriture l'a
   * exposé, et `ring-1` sans couleur (`ui/Toast.tsx`) tire bien d'ici.
   *
   * ⚠ La clause exige la RÉFÉRENCE, pas l'égalité des valeurs. Deux littéraux
   * identiques rediverger aient au premier changement d'encre — c'est exactement
   * ce qui s'est produit. `var(--color-accent)` fait qu'il n'y a plus qu'une
   * valeur à changer, donc plus rien à synchroniser.
   */
  it('le filet et l’anneau lisent l’encre, dans les deux thèmes', () => {
    const manquants: string[] = []
    for (const [nom, ancre] of [['CLAIR', ':root {'], ['SOMBRE', '[data-theme="dark"] {']] as const) {
      const i = CSS.indexOf(ancre)
      expect(i, `${nom} : ancre introuvable, la clause ne mesure rien`).toBeGreaterThan(-1)
      const j = CSS.indexOf('\n  }', i)
      const corps = CSS.slice(i, j < 0 ? undefined : j)
      for (const jeton of ['--color-border-focus', '--color-ring']) {
        const m = new RegExp(`${jeton}:\\s*([^;]+);`).exec(corps)
        if (!m) { manquants.push(`${nom} : ${jeton} absent`); continue }
        if (m[1]!.trim() !== 'var(--color-accent)') manquants.push(`${nom} : ${jeton} = « ${m[1]!.trim() }» au lieu de var(--color-accent)`)
      }
    }
    expect(
      manquants,
      'un filet ou un anneau porte son propre ton : il rediverge de l’encre au premier ' +
        'changement d’accent, et personne ne le verra :\n  ',
    ).toEqual([])
  })

  /**
   * ⛔ ET TOUT CE QUI PRÉCÈDE MESURE UNE FEUILLE QUI NE PEIGNAIT PAS.
   *
   * Les six clauses au-dessus lisent `globals.css`. Elles étaient VERTES pendant
   * que `applyPreferences` (`usePreferences.ts`) réécrivait `--color-accent` en
   * style EN LIGNE sur `<html>`, à chaque montage du `ThemeProvider` — et un
   * style en ligne bat la feuille. La rampe gardée n'était donc pas la rampe
   * rendue : `bg-accent` sortait en `#3461D1` (preset « sapphire ») pendant que
   * `bg-accent-solid`, lui, n'était pas réécrit et restait `#424bfb`. Deux bleus
   * à 1,04:1 sur la même page — exactement le défaut que l'unification du
   * 15 août avait clos, revenu par une autre porte.
   *
   * ⚠ CE N'EST PAS UNE FAUTE DE CONTRASTE, ET C'EST CE QUI LE RENDAIT INVISIBLE.
   * Le sapphire passe l'AA dans les deux thèmes (5,56:1 et 6,38:1) : aucune des
   * dix specs de contraste ne pouvait le voir. C'est une faute d'IDENTITÉ, et
   * seule une clause sur le MÉCANISME l'attrape.
   *
   * ⛔ POURQUOI LE RETRAIT, ET NON UN PRESET RÉALIGNÉ. Un preset porte UNE valeur
   * par thème ; la direction porte DEUX RÔLES (l'aplat `#424bfb` dans les deux
   * thèmes, l'encre `#8dc1ff` en sombre). Le système de presets ne sait pas
   * exprimer cette scission — lui donner les bonnes valeurs corrigerait le clair
   * et casserait le sombre. S'ajoute qu'aucun ÉCRIVAIN de préférences n'existe
   * dans le dépôt depuis le retrait d'`AgentLayout` : le preset ne peut être que
   * son défaut. L'accent est une décision de DIRECTION, pas une préférence par
   * agent — `CLAUDE.md` §3 : « il n'y a plus de choix ».
   *
   * ⚠ LA CLAUSE VISE LE GESTE, PAS LE FICHIER. Ancrée sur `usePreferences.ts`,
   * elle serait contournée par un `setProperty` écrit ailleurs — c'est la vacuité
   * n° 22 (« la couverture ne repose plus sur rien »). Elle balaye donc tout
   * `src/`, et son contrôle POSITIF exige que le balayage voie encore des
   * écritures légitimes : sans lui, un scan cassé rendrait zéro et la clause
   * passerait au vert sur un dépôt qu'elle ne lit plus.
   */
  it('aucun code ne réécrit la rampe d’accent au RENDU', () => {
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }])
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas dépôt propre').toEqual([])
    expect(scan.files.length, 'le balayage ne voit plus src/').toBeGreaterThan(100)

    /** Les jetons que la FEUILLE tranche par rôle — nul ne les réécrit au rendu. */
    const RESERVES = /^--color-(accent|border-focus|ring)/
    const ecritures: { site: string; jeton: string }[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      // Sans commentaires : la note qui EXPLIQUE le retrait ne doit pas le rouvrir (n° 16).
      const code = lu.value
        .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
        .replace(/\/\/[^\n]*/g, ' ')
      code.split('\n').forEach((ligne, i) => {
        for (const m of ligne.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) {
          ecritures.push({ site: `${rel(abs)}:${i + 1}`, jeton: m[1]! })
        }
      })
    }

    // ⛔ CONTRÔLE POSITIF. `--content-zoom` et les rayons de préférence sont des
    // écritures LÉGITIMES (densité, corps de texte, arrondi) : elles prouvent que
    // le motif reconnaît bien un `setProperty`. Sans elles, « zéro accent » ne
    // vaudrait rien — ce serait « zéro lecture ».
    expect(
      ecritures.length,
      'aucune écriture de variable CSS trouvée dans src/ — le motif ne reconnaît plus rien, ' +
        'la clause est vacue',
    ).toBeGreaterThan(0)

    const fautives = ecritures.filter((e) => RESERVES.test(e.jeton))
    expect(
      fautives.map((e) => `${e.site} → ${e.jeton}`),
      'la rampe d’accent est réécrite au rendu : un style en ligne sur <html> bat la feuille, ' +
        'donc les six clauses ci-dessus mesurent une rampe qui ne peint pas. L’accent est une ' +
        'décision de DIRECTION, pas une préférence par agent :\n  ',
    ).toEqual([])
  })
})
