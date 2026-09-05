/**
 * Garde-fou de contraste et de couleur de la Messagerie.
 *
 * ── CE QU'ELLE A TROUVÉ EN NAISSANT (05.09.2026) ─────────────────────────────
 * ⛔ Trois jetons de `mailSurfaces` servaient à la fois d'APLAT et d'ENCRE, et
 * n'étaient mesurés que du côté aplat — la forme n° 37 de
 * `megga/gardes-vacuites`. Mesuré :
 *
 *   · `accent` (#424bfb) en TEXTE sur carte SOMBRE  : **3,44:1** ⛔
 *     Le cas que CLAUDE.md §3 nomme mot pour mot. Neuf sites, dont le bouton
 *     « Rapprocher » du bandeau de lecture — le seul endroit d'où une adresse
 *     inconnue entre au CRM.
 *   · `danger` (#fe566b) en TEXTE sur carte CLAIRE  : **3,11:1** ⛔
 *     Sept sites, tous des `role="alert"` : le message d'erreur d'un envoi, d'un
 *     classement, d'une connexion de boîte. Le texte qu'on lit quand quelque
 *     chose a échoué était le moins lisible de l'écran.
 *   · `success` (#adecbb) en GLYPHE sur carte CLAIRE : **1,35:1** ⛔
 *     La coche « pièce déjà classée au dossier », donc le signal qui évite de
 *     classer deux fois le même document.
 *
 * Les trois sont réparés par `accentText` / `dangerText` / `successText`
 * (voir `mailTokens.ts`). Cette spec est ce qui les empêche de revenir.
 *
 * ── CE QU'ELLE REFUSE DE FAIRE ───────────────────────────────────────────────
 * 1. Elle ne recopie AUCUNE couleur : les valeurs viennent de `mailSurfaces()`
 *    et de `crmPalette()`. Une spec qui compare une constante à elle-même est
 *    verte pour toujours.
 * 2. Elle REFUSE une couleur qu'elle ne sait pas lire au lieu de la sauter :
 *    `NaN < 4.5` est FAUX, donc une lecture ratée passerait au vert du bon côté
 *    du seuil (`gardes-vacuites` n° 14).
 * 3. Elle balaye le DOSSIER, pas huit fichiers nommés comme l'écrivait le plan :
 *    la Messagerie en compte vingt-quatre, et un fichier neuf doit être couvert
 *    sans que personne pense à l'ajouter.
 * 4. Elle dit combien de fichiers elle a lus. Un balayage qui ne trouve rien est
 *    parfaitement vert.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import { crmPalette } from '@/components/crm/tokens'
import { encreSur, MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { mailSurfaces } from '@/components/crm/messagerie/mailTokens'
import { FX_LABELS } from '@/components/crm/messagerie/fixtures'

const ZONE = 'src/components/crm/messagerie'
/** Texte courant. Aucun libellé de la zone n'atteint le palier « grand texte ». */
const AA = 4.5
/** Éléments NON textuels (WCAG 1.4.11) : un glyphe, un filet, une pastille. */
const AA_FORME = 3

/* ─────────────────────────── lecture de couleur ─────────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/
const canal = (hex: string): [number, number, number] =>
  [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16)) as [number, number, number]

function luminance(hex: string): number {
  return canal(hex)
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

/**
 * ⛔ Lève au lieu de rendre `NaN`. Une couleur illisible doit faire ROUGIR la
 * clause, pas la traverser.
 */
function contraste(a: string, b: string): number {
  for (const c of [a, b]) if (!HEX.test(c)) throw new Error(`couleur non lisible : ${JSON.stringify(c)}`)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/* ───────────────────────────── sources de la zone ───────────────────────── */

const FICHIERS = readdirSync(repoPath(ZONE))
  .filter((n) => /\.tsx?$/.test(n))
  .sort()
  .map((n) => ({ nom: n, code: readFileSync(repoPath(ZONE, n), 'utf8') }))

describe('Messagerie — couleur et contraste', () => {
  it('le balayage lit vraiment la zone', () => {
    // Témoin nommé plutôt qu'un simple compte : le compte se périme au premier
    // fichier ajouté, le témoin décrit ce qui doit être vu.
    expect(FICHIERS.length, 'la zone est vide — le balayage ne mesure rien').toBeGreaterThan(20)
    expect(FICHIERS.map((f) => f.nom)).toContain('MailListRow.tsx')
    expect(FICHIERS.map((f) => f.nom)).toContain('MailReader.tsx')
    expect(FICHIERS.map((f) => f.nom)).toContain('mailTokens.ts')
  })

  it('aucun blanc ni noir en dur, aucune police en dur', () => {
    const fautifs: string[] = []
    for (const { nom, code } of FICHIERS) {
      if (/#fff\b|#ffffff|#000\b|#000000|'white'|'black'/i.test(code)) fautifs.push(`${nom} → blanc ou noir en dur`)
      // ⚠ Les trois familles sont nommées EN TOUTES LETTRES parce que ce sont
      // celles que la maquette, le mobile et la face publique apportent avec
      // elles ; le CRM de bureau passe par `var(--crm-font)`.
      if (/Poppins|Manrope|Inter Tight/.test(code)) fautifs.push(`${nom} → police en dur`)
    }
    expect(fautifs, `couleur ou police en dur dans ${ZONE} :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('la pastille de libellé calcule son encre', () => {
    // La couleur d'un libellé est LIBRE (D12) : aucune encre ne peut être
    // supposée lisible dessus, elle se calcule.
    const row = FICHIERS.find((f) => f.nom === 'MailListRow.tsx')!.code
    expect(row).toMatch(/ms\.pillInk\(label\.color\)/)
    const reader = FICHIERS.find((f) => f.nom === 'MailReader.tsx')!.code
    expect(reader).toMatch(/ms\.pillInk\(p\.label\.color\)/)
  })

  /**
   * ⚠ CE QUE CETTE CLAUSE GARDE VRAIMENT, ET CE QU'ELLE NE GARDE PAS.
   *
   * Le plan écrivait ici `expect(typeof encreSur(bg)).toBe('string')` — vrai
   * pour toute entrée, donc jamais rouge. Mais la version « mesurer le ratio »
   * est à peine meilleure, et il faut le DIRE : `encreSur` choisit l'extrême le
   * plus éloigné de deux (n1000 ou n100), et le pire cas de ce choix est
   * **4,58:1**, atteint quand les deux se valent (luminance 0,179). Aucune
   * couleur de libellé ne peut donc faire tomber le ratio sous l'AA tant que
   * `encreSur` rend l'un des deux extrêmes.
   *
   * La clause garde donc trois choses RÉELLES : que les couleurs semées sont
   * lisibles (une notation `rgb()` ou un hex à trois chiffres fait LEVER
   * {@link contraste}, pas passer) ; que `encreSur` rend toujours un extrême de
   * l'échelle — c'est CETTE propriété qui rend l'AA automatique, et la perdre
   * repeindrait chaque pastille de l'écran ; et le seuil lui-même, pour que le
   * jour où l'un des deux extrêmes bouge on le voie ici.
   */
  it('l’encre des pastilles est un extrême de l’échelle, donc toujours AA', () => {
    const extremes = [MXC_COLOR.n1000, MXC_COLOR.n100]
    const sous: string[] = []
    for (const l of FX_LABELS) {
      const encre = encreSur(l.color)
      if (!extremes.includes(encre)) sous.push(`${l.name} ${l.color} → ${encre} n'est pas un extrême de l'échelle`)
      const r = contraste(encre, l.color)
      if (r < AA) sous.push(`${l.name} ${l.color} → ${encre} = ${r.toFixed(2)}:1`)
    }
    expect(sous, `encre de pastille hors garantie :\n  ${sous.join('\n  ')}`).toEqual([])
    expect(FX_LABELS.length, 'les libellés semés ont disparu — la clause ne mesure plus rien').toBe(6)
  })

  it('les encres de la zone tiennent l’AA sur les surfaces opaques, dans les deux thèmes', () => {
    const sous: string[] = []
    for (const dark of [false, true]) {
      const ms = mailSurfaces(crmPalette(dark), dark)
      const theme = dark ? 'sombre' : 'clair'
      // Les surfaces OPAQUES de l'écran. `hover2` et `dim` sont des voiles
      // translucides : on ne peut pas les composer sans connaître le dessous,
      // donc on ne prétend pas les mesurer.
      const surfaces: [string, string][] = [['carte', ms.card], ['creusée', ms.elev], ['bento', ms.side], ['flottante', ms.solid]]
      // rôle → [encre, seuil]. Un rôle ajouté à `MailSurfaces` sans entrée ici
      // est attrapé par la clause « l'inventaire couvre les encres » ci-dessous.
      const encres: [string, string, number][] = [
        ['ink', ms.ink, AA], ['txt2', ms.txt2, AA], ['txt3', ms.txt3, AA], ['mut', ms.mut, AA],
        ['accentText', ms.accentText, AA], ['dangerText', ms.dangerText, AA], ['successText', ms.successText, AA],
      ]
      for (const [nomS, bg] of surfaces) {
        for (const [nomE, fg, seuil] of encres) {
          const r = contraste(fg, bg)
          if (r < seuil) sous.push(`${theme} · ${nomE} (${fg}) sur ${nomS} (${bg}) = ${r.toFixed(2)}:1 < ${seuil}`)
        }
      }
      // Les APLATS et leur encre — l'autre sens du même couple (n° 37).
      for (const [nom, fg, bg] of [
        ['accent', ms.accentInk, ms.accent], ['danger', ms.dangerInk, ms.danger], ['succès', ms.successInk, ms.success],
      ] as [string, string, string][]) {
        const r = contraste(fg, bg)
        if (r < AA) sous.push(`${theme} · encre de l'aplat ${nom} (${fg} sur ${bg}) = ${r.toFixed(2)}:1`)
      }
    }
    expect(sous, `encre sous le seuil :\n  ${sous.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA CLAUSE QUI AURAIT ATTRAPÉ LES TROIS DÉFAUTS. Les trois jetons d'APLAT
   * ne doivent plus jamais servir d'encre : c'est en `color:` qu'ils échouaient,
   * pas en `background:`. La clause lit la SOURCE parce que le défaut est un
   * choix d'écriture, pas une valeur.
   */
  it('aucun jeton d’aplat n’est employé en encre', () => {
    const fautifs: string[] = []
    for (const { nom, code } of FICHIERS) {
      if (nom === 'mailTokens.ts') continue // c'est là que les jetons sont DÉFINIS
      for (const m of code.matchAll(/color(?::\s*|=\{)(?:[^,}\n]*\?\s*)?ms\.(accent|danger|success)\b(?!Ink|Text)/g)) {
        fautifs.push(`${nom} → ms.${m[1]} en encre ; utiliser ms.${m[1]}Text`)
      }
      for (const m of code.matchAll(/style\.color\s*=\s*(?:[^;\n]*\?\s*)?ms\.(accent|danger|success)\b(?!Ink|Text)/g)) {
        fautifs.push(`${nom} → ms.${m[1]} en encre (style impératif) ; utiliser ms.${m[1]}Text`)
      }
    }
    expect(
      fautifs,
      'un jeton d’aplat sert d’encre — mesuré le 05.09.2026 : accent 3,44:1 en sombre, ' +
        'danger 3,11:1 en clair, success 1,35:1 en clair :\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })

  /**
   * ⚠ EXEMPTION ÉCRITE, ET MESURÉE. L'étoile « suivi » est jaune (`yellow400`,
   * la valeur que la table de report du maître donne pour le `#f0a03c` de la
   * maquette) et rend **1,67:1** sur la carte claire : aucune teinte dorée
   * n'atteint 3:1 sur blanc sans virer au brun. Même arbitrage que les étoiles
   * de notation du rapport KYC (CLAUDE.md §3).
   *
   * Ce que la clause fige : la valeur, l'écart, ET la compensation — l'état
   * « suivi » ne se lit pas QUE par la couleur (le glyphe passe de contour à
   * plein) et il est nommé pour l'assistance (`aria-pressed` + `aria-label`).
   * Changer la couleur fait rougir ; retirer le nom accessible aussi.
   */
  it('l’étoile est une exemption écrite, pas un oubli', () => {
    const clair = mailSurfaces(crmPalette(false), false)
    expect(clair.star).toBe(MXC_SYSTEM.yellow400)
    expect(contraste(clair.star, clair.card)).toBeLessThan(AA_FORME)
    const row = FICHIERS.find((f) => f.nom === 'MailListRow.tsx')!.code
    expect(row, 'l’étoile a perdu son nom accessible').toMatch(/aria-label=\{row\.is_starred \? t\('mail\.row\.unstar'\) : t\('mail\.row\.star'\)\}/)
    expect(row, 'l’étoile a perdu son état accessible').toMatch(/aria-pressed=\{row\.is_starred\}/)
    expect(row, 'l’étoile ne se distingue plus que par la couleur').toMatch(/fill=\{row\.is_starred \? ms\.star : 'none'\}/)
  })
})
