/**
 * Garde-fou : `admin-console.css` suit la direction MEGGA X — et c'est la
 * SECONDE garde du dépôt qui ouvre une feuille de style, après
 * `matching-atelier-css.spec.ts`.
 *
 * ⛔ POURQUOI ELLE MANQUAIT, ET CE QUE ÇA A COÛTÉ. La feuille est un SECOND
 * système de jetons — 14 variables déclarées deux fois, 17 hex distincts — dans
 * un LANGAGE qu'aucune garde du dépôt ne lisait : `megga-x-grammar` ne balaye
 * que les styles EN LIGNE des `.tsx` et ne connaît pas le mot « admin »,
 * `megga-x-crm-tokens` s'arrête à `globals.css` et `megga-x.generated.css`,
 * `graphite-scale` n'ouvre aucun `.css` (zéro `readFileSync`). L'échelle
 * GRAPHITE — retirée du CRM le 10 août 2026 — y a donc survécu intacte, toutes
 * portes vertes, jusqu'au 14 août.
 *
 * ⚠ ET LA FEUILLE ÉNONÇAIT ELLE-MÊME SA NORME. Sa docstring disait : « Les
 * valeurs viennent de `CRM_TOKENS` […] elles y sont dupliquées à la main parce
 * que le CSS ne lit pas le JS ; toute évolution de tokens.ts doit être reportée
 * ici. » C'était vrai, et personne ne l'a fait. Un fichier qui déclare sa règle
 * et son arriéré se relit MOINS qu'un fichier négligé — il a l'air tenu. C'est
 * la dixième forme de `megga/gardes-vacuites`, sous sa version la plus franche.
 *
 * ── CE QUE CETTE GARDE FAIT, ET QUI N'AVAIT PAS DE PRÉCÉDENT ─────────────────
 * Elle ne se contente pas d'interdire les valeurs proscrites : elle DÉRIVE de
 * `mxCrmPalette()` la valeur attendue de chaque variable et la compare. La
 * duplication que la feuille assume ne peut donc plus DÉRIVER — c'est le seul
 * remède à « toute évolution de tokens.ts doit être reportée ici », qui est une
 * consigne qu'aucune machine ne faisait respecter.
 *
 * ⚠ LA FEUILLE ÉCRIT SES COULEURS EN TRIPLETS `R G B`, pas en hexadécimal
 * (`--color-bg-page: 250 251 253`) — c'est la forme qu'exige `rgb(var(…))` de
 * Tailwind. Une garde qui ne chercherait que `#rrggbb` n'y trouverait RIEN et
 * passerait au vert sur une feuille entièrement fautive : quatorzième forme de
 * garde vacuité, celle qui rend un succès au lieu d'une erreur.
 *
 * ── LA TROISIÈME SOURCE, FERMÉE AU LOT SUIVANT ──────────────────────────────
 * `adminSurfaces()` (`src/hooks/useAdminSugar.ts`) écrivait ses cinq valeurs à
 * la main — transcription de `galSurfaces` du temps de Sugar Pure. La feuille
 * pouvait donc être vérifiée et juste pendant que le JS disait autre chose.
 *
 * ⛔ Et ce n'est pas resté théorique : ses cartes sombres étaient des VOILES
 * (5 % et 4 %), et le tiroir de revue KYB les empilait DEUX fois. La pile
 * rendait `#323232`, une couleur d'aucune échelle, sur laquelle « Valider »
 * tombait à 4,06:1 et « Rejeter » à 4,31:1 — mesuré au rendu, tiroir ouvert.
 * Une duplication non gardée finit toujours par produire une valeur que
 * personne n'a choisie.
 *
 * Les deux langages descendent maintenant de `mxCrmPalette()`, et la clause
 * « les surfaces JS descendent de la palette » est ce qui les empêche de
 * re-diverger.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { adminSurfaces } from '@/hooks/useAdminSugar'

const FEUILLE = 'src/styles/admin-console.css'
const brut = readFileSync(FEUILLE, 'utf-8')

/** Commentaires retirés AVANT analyse — sinon la note qui explique un retrait
 *  fait rougir la garde. Quatrième occurrence du piège dans le dépôt. */
const css = brut.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))

/** Le bloc clair (sélecteur nu) ou le bloc sombre (`[data-admin-dark='true']`). */
function blocs(sombre: boolean): string {
  const motif = sombre
    ? /\.megga-admin-console\[data-admin-dark='true'\]\s*\{([^}]*)\}/g
    : /\.megga-admin-console\s*\{([^}]*)\}/g
  return [...css.matchAll(motif)].map((m) => m[1]).join('\n')
}

/** `--nom: 12 34 56` → `#0c2238`. Rend `null` si la valeur n'est pas un triplet. */
function triplet(bloc: string, variable: string): string | null {
  const m = bloc.match(new RegExp(`${variable}:\\s*(\\d{1,3})\\s+(\\d{1,3})\\s+(\\d{1,3})\\s*;`))
  if (!m) return null
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
}

/**
 * La correspondance VARIABLE → RÔLE de la palette, écrite une fois.
 *
 * ⚠ Par RÔLE, pas par numéro de palier : Graphite MONTAIT ses sous-surfaces,
 * MEGGA X les CREUSE. Recopier « S1 → S1 » aurait gardé la logique de Graphite
 * sous les valeurs de MEGGA X — l'erreur exacte que `CLAUDE.md` §3 décrit.
 */
const ROLES: { variable: string; cle: keyof ReturnType<typeof crmSugarPalette>; role: string }[] = [
  { variable: '--color-bg-page', cle: 'pageBg', role: 'canvas' },
  { variable: '--color-bg-card', cle: 'cardBg', role: 'carte' },
  { variable: '--color-bg-section', cle: 'cardSubBg', role: 'sous-carte CREUSÉE' },
  { variable: '--color-bg-sidebar', cle: 'frameBg', role: 'cadre / rail' },
  { variable: '--color-bg-elevated', cle: 'solidBg', role: 'surface flottante' },
  { variable: '--color-bg-input', cle: 'cardSubBg', role: 'champ de saisie' },
  { variable: '--color-bg-hover', cle: 'focusSurface', role: 'survol ÉLEVÉE' },
  { variable: '--color-bg-active', cle: 'focusSurface', role: 'état actif' },
  { variable: '--color-text-primary', cle: 'ink', role: 'encre' },
  { variable: '--color-text-secondary', cle: 'soft', role: 'encre douce' },
  { variable: '--color-text-tertiary', cle: 'sub', role: 'encre faible' },
  { variable: '--color-text-muted', cle: 'sub', role: 'encre faible (alias)' },
  { variable: '--color-border', cle: 'cardBorder', role: 'bordure' },
]

/**
 * `--color-border-subtle` n'a PAS de rôle dans `SugarPalette` — la palette ne
 * porte qu'une bordure. On fige donc le barreau, et le fait qu'il soit un cran
 * plus discret que `cardBorder` dans chaque thème.
 */
const BORDURE_DISCRETE = { clair: MXC_COLOR.n800, sombre: MXC_COLOR.n300 }

/**
 * Accents admis hors échelle neutre : l'accent de la direction et le violet du
 * repère de contexte, ce dernier écrit en triplet dans `globals.css` et
 * seulement RÉFÉRENCÉ ici.
 */
const ACCENTS = new Set([MXC_COLOR.accent.toLowerCase()])

/** Tous les barreaux de l'échelle, en minuscules. */
const ECHELLE = new Set(Object.values(MXC_COLOR).map((v) => v.toLowerCase()))

/** L'échelle GRAPHITE, retirée du CRM le 10 août 2026 — en hex ET en triplet. */
const GRAPHITE = ['#12161c', '#161a21', '#1a1d26', '#1d212a', '#252a36']
const GRAPHITE_TRIPLETS = [
  /\b18\s+22\s+28\b/, /\b22\s+26\s+33\b/, /\b26\s+29\s+38\b/,
  /\b29\s+33\s+42\b/, /\b37\s+42\s+54\b/,
]

describe('admin-console.css — la feuille suit MEGGA X', () => {
  it('la garde voit la feuille et ses DEUX blocs', () => {
    // Sans ça, un sélecteur renommé rendrait toutes les clauses vraies par
    // vacuité — et une feuille entièrement fautive passerait au vert.
    expect(brut.length, 'feuille vide ou chemin cassé').toBeGreaterThan(500)
    expect(blocs(false).length, 'bloc CLAIR introuvable').toBeGreaterThan(100)
    expect(blocs(true).length, 'bloc SOMBRE introuvable').toBeGreaterThan(100)
    // Et chaque variable surveillée est bien PRÉSENTE dans les deux blocs :
    // une variable retirée ferait disparaître la surface ET son assertion.
    const absentes: string[] = []
    for (const { variable } of ROLES) {
      for (const sombre of [false, true]) {
        if (triplet(blocs(sombre), variable) === null) {
          absentes.push(`${variable} (${sombre ? 'sombre' : 'clair'})`)
        }
      }
    }
    expect(absentes, `variable non lue par la garde :\n  ${absentes.join('\n  ')}`).toEqual([])
  })

  it('aucune valeur de l’échelle Graphite ne subsiste', () => {
    const bas = css.toLowerCase()
    const trouves = [
      ...GRAPHITE.filter((g) => bas.includes(g)),
      ...GRAPHITE_TRIPLETS.filter((m) => m.test(css)).map((m) => `triplet ${m.source}`),
    ]
    expect(trouves, `Graphite vivant dans la feuille :\n  ${trouves.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA CLAUSE QUI FERME LA DUPLICATION. La feuille recopie à la main des
   * valeurs de `tokens.ts` ; jusqu'ici rien ne vérifiait la copie, et elle a
   * dérivé pendant quatre jours sans qu'une porte bouge.
   */
  it('chaque variable ÉGALE le rôle correspondant de mxCrmPalette', () => {
    const ecarts: string[] = []
    for (const sombre of [false, true]) {
      const sp = crmSugarPalette(sombre)
      const bloc = blocs(sombre)
      for (const { variable, cle, role } of ROLES) {
        const lu = triplet(bloc, variable)
        const attendu = String(sp[cle]).toLowerCase()
        if (lu !== attendu) {
          ecarts.push(`${sombre ? 'sombre' : 'clair'} · ${variable} (${role}) = ${lu} au lieu de ${attendu} (sp.${cle})`)
        }
      }
      const subtile = triplet(bloc, '--color-border-subtle')
      const attendueSubtile = (sombre ? BORDURE_DISCRETE.sombre : BORDURE_DISCRETE.clair).toLowerCase()
      if (subtile !== attendueSubtile) {
        ecarts.push(`${sombre ? 'sombre' : 'clair'} · --color-border-subtle = ${subtile} au lieu de ${attendueSubtile}`)
      }
    }
    expect(ecarts, `la feuille a dérivé de la palette :\n  ${ecarts.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA TROISIÈME SOURCE. `adminSurfaces()` écrivait ses cinq valeurs à la
   * main — transcription de `galSurfaces` du temps de Sugar Pure. La feuille
   * pouvait donc être vérifiée et juste pendant que le JS disait autre chose,
   * ce qui est arrivé : ses cartes sombres étaient des VOILES, et empilées deux
   * fois dans le tiroir de revue elles produisaient `#323232`, une couleur
   * d'aucune échelle, sur laquelle deux boutons d'action tombaient sous l'AA.
   *
   * Les deux langages disent maintenant la même chose, et cette clause est ce
   * qui les empêche de re-diverger.
   */
  it('les surfaces JS descendent de la palette, comme la feuille', () => {
    const ecarts: string[] = []
    for (const sombre of [false, true]) {
      const sp = crmSugarPalette(sombre)
      const surf = adminSurfaces(sombre)
      const attendu: Record<string, string> = {
        card: sp.cardBg,
        cardSub: sp.cardSubBg,
        hairline: `1px solid ${sp.cardBorder}`,
        shadow: sp.shadow,
        shadowHov: sp.focusShadow,
      }
      for (const [cle, valeur] of Object.entries(attendu)) {
        const lu = surf[cle as keyof typeof surf]
        if (lu !== valeur) ecarts.push(`${sombre ? 'sombre' : 'clair'} · surf.${cle} = ${lu} au lieu de ${valeur}`)
      }
      // Et aucune des cinq n'est un VOILE : une surface de la console est un
      // palier opaque, sinon elle dérive dès qu'on l'empile.
      for (const [cle, v] of Object.entries(surf)) {
        if (cle.startsWith('shadow')) continue
        if (/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(v)) {
          ecarts.push(`${sombre ? 'sombre' : 'clair'} · surf.${cle} est un voile : ${v}`)
        }
      }
    }
    expect(ecarts, `les surfaces JS ont dérivé :\n  ${ecarts.join('\n  ')}`).toEqual([])
  })

  it('toute couleur de la feuille est un barreau de l’échelle', () => {
    // Les triplets de variable sont déjà couverts ci-dessus ; ici on attrape ce
    // qui est écrit AILLEURS dans la feuille — un `background:` de règle, un
    // repli. C'est la onzième forme : une garde qui ne regarde que là où on a
    // RANGÉ les valeurs ne voit pas celles écrites à côté.
    const hors: string[] = []
    for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const v = m[0].toLowerCase()
      const plein = v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v
      if (!ECHELLE.has(plein) && !ACCENTS.has(plein)) hors.push(m[0])
    }
    expect([...new Set(hors)], `couleur hors échelle :\n  ${[...new Set(hors)].join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE GRIS-BLEU SLATE-900 ENTRE TOUJOURS PAR UNE FRACTION D'OPACITÉ.
   * Personne ne relit `rgba(15, 23, 42, 0.035)` en cherchant une couleur : c'est
   * un réglage de transparence à l'œil, et la teinte passe avec. Ici il peignait
   * le survol de `.adm-row`, lu par HUIT fichiers — septième dossier après le
   * Pipeline.
   */
  it('aucun gris-bleu, aucun noir Sugar', () => {
    const fautifs: string[] = []
    css.split('\n').forEach((l, i) => {
      if (/rgba?\(\s*15\s*,\s*23\s*,\s*42\b|#0F172A\b/i.test(l)) fautifs.push(`${FEUILLE}:${i + 1} (gris-bleu)`)
      if (/#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b/i.test(l)) fautifs.push(`${FEUILLE}:${i + 1} (noir Sugar)`)
    })
    expect(fautifs, `teinte proscrite :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * En sombre, MEGGA X sépare par la BORDURE : `sp.shadow` vaut `'none'`. Une
   * ombre portée sur une surface sombre est un vestige de Sugar.
   */
  it('aucune ombre portée sur une surface sombre', () => {
    const fautifs = [...css.matchAll(/\.megga-admin-console\[data-admin-dark='true'\][^{]*\{([^}]*)\}/g)]
      .filter((m) => /box-shadow:\s*(?!none)/.test(m[1]!))
      .map((m) => m[0].replace(/\s+/g, ' ').slice(0, 80))
    expect(fautifs, `ombre en sombre :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ON CHANGE LA COULEUR DE L'ANNEAU, JAMAIS SON EXISTENCE. `outline: none`
   * est ce qui avait privé le rail, la palette ⌘K et les listes de tout repère
   * de focus au clavier ; la feuille le dit, et cette clause l'empêche de
   * revenir par mégarde en même temps qu'on retouche la teinte.
   */
  it('l’anneau de focus existe, porte l’accent, et aucun `outline: none` ne revient', () => {
    expect(/outline:\s*none/i.test(css), '`outline: none` réintroduit').toBe(false)
    const anneau = css.match(/:focus-visible\s*\{([^}]*)\}/)
    expect(anneau, 'plus aucune règle `:focus-visible` — le repère clavier a disparu').not.toBeNull()
    expect(
      /outline:\s*2px solid/.test(anneau![1]!),
      'l’anneau a perdu son épaisseur ou son style',
    ).toBe(true)
    expect(
      anneau![1]!.toLowerCase().includes(MXC_COLOR.accent.toLowerCase()),
      `l’anneau ne porte pas l’accent ${MXC_COLOR.accent} : ${anneau![1]!.trim()}`,
    ).toBe(true)
  })
})
