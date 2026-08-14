/**
 * Garde-fou : la palette du CRM MOBILE descend de MEGGA X, dans les deux thèmes.
 *
 * ⛔ POURQUOI ELLE ÉTAIT LA DERNIÈRE. `crm-mobile/tokens.ts` peint SEIZE
 * dossiers d'écrans — Today, Pipeline, Contacts, Agenda, Matching, KYC,
 * Réglages, « Mes biens »… — et il était resté dans l'état exact du wizard
 * avant le 11 août 2026 :
 *
 * · en CLAIR, du Sugar de bout en bout — canvas `#EEF1F5` en dégradé radial,
 *   encre `#0B0C0E`, et surtout `accent: '#0B0C0E'` : l'accent ÉTAIT l'encre,
 *   la règle que la décision du 10 août a remplacée ;
 * · en SOMBRE, un hybride — les sept surfaces venaient déjà de `MXC_COLOR`,
 *   mais les encres restaient bleutées (`#ECEDF3`, `#B5B7C4`, `#878B99`) et
 *   l'accent s'inversait en near-white `#F2F2F6`.
 *
 * Ça se VOYAIT : la pastille de filtre active et le bouton flottant de « Mes
 * biens » étaient noirs en clair et near-white en sombre, jamais `#424bfb`.
 *
 * ⚠ CE QUI RESTE VOLONTAIREMENT HORS ÉCHELLE est nommé dans `SEMANTIQUES` —
 * même idiome que les palettes du wizard, de la fiche et du calendrier : figer
 * l'écart plutôt que l'interdire. En ajouter un demande de l'écrire ici.
 */
import { describe, it, expect } from 'vitest'
import { MXC_COLOR, MXC_SYSTEM, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { MT_LIGHT, MT_DARK, type MobileTokens } from '@/components/crm-mobile/tokens'

const ECHELLE = new Set(
  [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)].map((v) => v.toLowerCase()),
)

/**
 * Jetons qui portent un SENS que la vitrine ne sait pas dire :
 *
 * - `danger` / `dangerInk` / `dangerBg` / `dangerFg` : le retard et la
 *   confirmation destructive. `MXC_SYSTEM.red400` est réglé pour le canvas
 *   `#030303` et ne tient pas en encre sur fond clair.
 * - `riskBg` / `riskFg` : le risque, même raison.
 * - `goal` : l'objectif atteint — c'est un état, pas une décoration.
 * - `kycSeal` : le sceau de vérification. Il doit se distinguer de l'accent
 *   PRÉCISÉMENT parce qu'un bien accentué n'est pas un bien vérifié ; les
 *   confondre ferait lire une vérification là où il n'y en a pas.
 * - `hair` / `overlay` / `cardBorder` / `headerBg` / `tabBg` : des VOILES
 *   (rgba), pas des couleurs — ils se posent sur la surface au lieu de la
 *   remplacer.
 * - `shadow*` / `tabBarShadow` : des ombres.
 * - `relanceBorder` : `transparent`.
 */
const SEMANTIQUES = new Set([
  'danger', 'dangerInk', 'dangerBg', 'dangerFg',
  'riskBg', 'riskFg', 'goal', 'kycSeal',
  'hair', 'overlay', 'cardBorder', 'headerBg', 'tabBg', 'relanceBorder',
  'shadowSm', 'shadow', 'shadowLg', 'tabBarShadow',
  'mode',
])

/** Les couleurs sous LEURS DEUX notations — `rgba()` est du hex en décimal. */
function couleursDe(v: string): string[] {
  const hex = (v.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toLowerCase())
  const rgb = [...v.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].map(
    (m) => '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join(''),
  )
  return [...hex, ...rgb]
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PALETTES: [string, MobileTokens][] = [['clair', MT_LIGHT], ['sombre', MT_DARK]]

describe('CRM mobile — la palette descend de MEGGA X', () => {
  // Sans ça, une palette vidée rendrait tout le reste vrai par vacuité.
  it('les deux thèmes rendent une palette fournie', () => {
    for (const [, p] of PALETTES) expect(Object.keys(p).length).toBeGreaterThan(25)
    expect(MT_LIGHT.mode).toBe('light')
    expect(MT_DARK.mode).toBe('dark')
  })

  it.each(PALETTES)('aucune couleur hors échelle (%s)', (_nom, p) => {
    const fautifs: string[] = []
    for (const [jeton, valeur] of Object.entries(p)) {
      if (typeof valeur !== 'string' || SEMANTIQUES.has(jeton)) continue
      for (const c of couleursDe(valeur)) if (!ECHELLE.has(c)) fautifs.push(`${jeton} = ${c}`)
    }
    expect(fautifs, `hors de l'échelle : ${fautifs.join(', ')}`).toEqual([])
  })

  /**
   * Les surfaces et les encres viennent de `mxCrmPalette`, pas d'une copie qui
   * coïncide. `card: '#FFFFFF'` passait déjà le test précédent sans en descendre.
   */
  it.each([false, true])('surfaces et encres sortent de mxCrmPalette (sombre=%s)', (dark) => {
    const mx = mxCrmPalette(dark)
    const p = dark ? MT_DARK : MT_LIGHT
    expect(p.pageBg).toBe(mx.pageBg)
    expect(p.card).toBe(mx.cardBg)
    expect(p.cardSubtle).toBe(mx.cardSubBg)
    expect(p.ink).toBe(mx.ink)
    expect(p.inkSoft).toBe(mx.soft)
    expect(p.muted).toBe(mx.sub)
  })

  /**
   * ⛔ L'ACCENT NE S'INVERSE PLUS. Il valait `#0B0C0E` en clair et `#F2F2F6` en
   * sombre — Sugar Pure faisait de l'accent l'encre. Même correction qu'au
   * calendrier, aux Réglages, au wizard et à la fiche.
   */
  it.each(PALETTES)('l’accent est celui de la marque (%s)', (_nom, p) => {
    expect(p.accent).toBe(MXC_COLOR.accent)
    expect(p.accentInk).toBe(MXC_COLOR.n1000)
    expect(contraste(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5)
  })

  /** La pastille suit l'accent : c'est le même rôle sous un autre nom. */
  it.each(PALETTES)('la pastille ne diverge pas de l’accent (%s)', (_nom, p) => {
    expect(p.pillBg).toBe(p.accent)
    expect(p.pillInk).toBe(p.accentInk)
  })

  /**
   * Le bloc de relance reste un bento IMMERSIF sombre dans les DEUX thèmes —
   * idiome accepté (cf. Facturation aux Réglages). Ce qu'on verrouille, c'est
   * qu'il descende de l'échelle et que son CTA reste lisible dessus.
   */
  it.each(PALETTES)('le bloc de relance est lisible (%s)', (_nom, p) => {
    expect(contraste(p.relanceInk, p.relanceBg)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(p.ctaInk, p.ctaBg)).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * ⛔ Le sceau KYC ne doit PAS se confondre avec l'accent : un bien accentué
   * n'est pas un bien vérifié. Il est exempté de l'échelle pour cette raison ;
   * encore faut-il qu'il reste distinct.
   */
  it.each(PALETTES)('le sceau KYC se distingue de l’accent (%s)', (_nom, p) => {
    expect(p.kycSeal.toLowerCase()).not.toBe(p.accent.toLowerCase())
  })

  /**
   * Plus de dégradé de canvas. Il en portait un en clair
   * (`radial-gradient(… #CFDAE4 …)`) : une seconde source de lumière que la
   * direction ne connaît pas, et que le wizard a perdue le même jour.
   */
  it('aucun dégradé de canvas', () => {
    for (const [nom, p] of PALETTES) {
      expect(p.canvas, `${nom} garde un dégradé`).not.toMatch(/gradient/)
    }
  })

  /**
   * ⛔ `ghost` ÉCHOUE L'AA DANS LES DEUX THÈMES — c'est un TRAIT, pas une encre.
   *
   * Mesuré sur les surfaces de carte : `#a3a3a3` sur `#ffffff` rend 2,52:1 en
   * clair, `#686868` sur `#090909` rend 3,57:1 en sombre. Le seuil du texte
   * courant est 4,5. `muted` — l'autre bout de la même échelle, `#686868` en
   * clair et `#a3a3a3` en sombre — rend 5,57 et 7,89 : c'est LUI le jeton du
   * texte secondaire.
   *
   * Huit composants mobiles l'employaient en encre, dont la gouttière d'heures
   * de l'agenda : exactement le défaut que la refonte du calendrier avait
   * corrigé côté BUREAU (#1199) en laissant le mobile derrière. Deuxième fois
   * que ce correctif ne traverse qu'un des deux dossiers de la même surface.
   *
   * ⚠ Ce test ne peut pas distinguer un contrôle DÉSACTIVÉ, que la WCAG exempte
   * du seuil (1.4.3) et où `ghost` reste le bon jeton — le grisé EST le signal.
   * Il n'interdit donc `ghost` en encre que là où aucun `disabled` ne
   * l'accompagne.
   */
  it('ghost ne sert jamais d’encre à du contenu lisible', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const racine = 'src/components/crm-mobile'
    const fichiers = readdirSync(racine, { recursive: true, encoding: 'utf-8' })
      .filter((f) => f.endsWith('.tsx'))
    const fautifs: string[] = []
    for (const f of fichiers) {
      readFileSync(`${racine}/${f}`, 'utf-8').split('\n').forEach((ligne, i) => {
        if (!/\b(?:color|stroke|fill):[^,}\n]*\btk\.ghost\b/.test(ligne)) return
        if (/disabled/.test(ligne)) return
        fautifs.push(`${f}:${i + 1}`)
      })
    }
    expect(fautifs.length, `contenu lisible en ghost :\n  ${fautifs.join('\n  ')}`).toBe(0)
  })

  /**
   * Les jetons SÉMANTIQUES qui servent d'ENCRE passent l'AA sur les trois
   * surfaces où le CRM mobile les pose.
   *
   * `SEMANTIQUES` (plus haut) exempte ces jetons de l'échelle MEGGA X parce
   * qu'ils disent un état que la vitrine ne sait pas dire. Cette exemption
   * portait sur la PROVENANCE de la couleur, et rien ne vérifiait qu'elle
   * restait LISIBLE — deux questions distinctes qu'un seul test couvrait à
   * moitié.
   *
   * ⛔ Ce qu'il a trouvé le 12 août 2026 : `goal` valait `#059669`, soit
   * **3,58:1** sur la page claire, quand le seuil du texte courant est 4,5. Il
   * ne peint pas qu'une jauge — il peint le libellé « Vérifié » du KYC, la
   * probabilité d'achat de la fiche deal et le témoin de brouillon du wizard.
   * Porté à `#047857`, le vert que le témoin du wizard BUREAU emploie déjà, il
   * rend 5,21:1.
   *
   * ⚠ Le seuil est celui du TEXTE (4,5), pas celui des grands caractères (3,0)
   * ni des objets graphiques : ces jetons peignent des libellés de 11 à 13 px.
   * Un jeton qui ne servirait QUE de remplissage n'a rien à faire dans cette
   * liste — l'y mettre lui imposerait une contrainte que la WCAG ne lui pose
   * pas, et la première correction ferait perdre la teinte pour rien.
   */
  it('les jetons sémantiques employés en encre passent l’AA', () => {
    /** Jetons posés en `color` / `stroke` / `fill` sur du contenu lisible. */
    const ENCRES = ['goal', 'riskFg', 'dangerFg', 'danger', 'kycSeal'] as const
    /** Les trois surfaces sur lesquelles le mobile pose du texte. */
    const SURFACES = ['pageBg', 'card', 'cardSubtle'] as const
    const AA = 4.5

    const faibles: string[] = []
    for (const [nom, p] of PALETTES) {
      for (const encre of ENCRES) {
        for (const surface of SURFACES) {
          const r = contraste(p[encre], p[surface])
          if (r < AA) faibles.push(`${nom} · ${encre} (${p[encre]}) sur ${surface} (${p[surface]}) = ${r.toFixed(2)}:1`)
        }
      }
      // Le bento de relance est sombre dans les DEUX thèmes : ses encres se
      // mesurent sur LUI, jamais sur la page.
      for (const encre of ['relanceInk', 'relanceMuted'] as const) {
        const r = contraste(p[encre], p.relanceBg)
        if (r < AA) faibles.push(`${nom} · ${encre} (${p[encre]}) sur relanceBg = ${r.toFixed(2)}:1`)
      }
    }
    expect(faibles.length, `encres sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toBe(0)
  })

  /**
   * ⛔ LA RAMPE DE COMPOSITION D'ANALYTICS — les DEUX branches, et c'est
   * l'ASYMÉTRIE qui était le défaut.
   *
   * `MobileAnalyticsScreen` peint « De quoi est fait le projeté » avec trois
   * crans d'une rampe monochrome. Sa branche CLAIRE dérivait déjà
   * (`n100 / n500 / n700`) ; sa branche SOMBRE portait trois littéraux
   * `#F3F4F6 / #878D98 / #41454D` — des copies faites à la main de l'ancienne
   * `AX_DARK` du bureau, dont le chantier « Analytics en MEGGA X » a supprimé la
   * SOURCE. Elles ne pointaient donc plus vers rien.
   *
   * ⚠ AUCUNE GARDE NE POUVAIT LES VOIR. Ce fichier ne lit que
   * `crm-mobile/tokens.ts` ; les autres specs de contraste gardent une ZONE du
   * BUREAU. Un littéral écrit dans un ÉCRAN mobile tombe entre les deux — c'est
   * la forme n° 38 (« l'objet de jetons partagé n'a de garde nulle part ») prise
   * un cran plus bas : ici il n'y a même pas d'objet, juste des valeurs en dur.
   *
   * ⛔ ET LE MIROIR DU CLAIR N'ÉTAIT PAS LA RÉPONSE. `n1000 / n600 / n400` — la
   * transposition littérale — donne un cran de queue à **1,12:1** sur la carte
   * (la pastille disparaît) et une rampe très irrégulière : 2,52 puis 7,04.
   * L'échelle MEGGA X n'est pas régulière dans sa moitié claire, et le clair ne
   * marche que parce que `n100/n500/n700` tombe par chance sur trois crans bien
   * espacés (3,70 / 3,47). Le balayage des dix barreaux ne laisse que TROIS
   * triplets qui tiennent les deux contraintes ; `n800/n600/n500` est le plus
   * régulier (2,15 / 2,21).
   *
   * ⛔ CE QUE CETTE CLAUSE N'ASSERTE PAS, ET LA MESURE QUI L'EXPLIQUE. Une
   * première version exigeait de chaque cran 3:1 contre sa carte — le seuil des
   * objets graphiques. Elle rougissait sur la branche CLAIRE, qui est pourtant
   * la référence. Mesuré : sur une carte blanche, cinq barreaux seulement
   * passent 3:1 (`n100`…`n500`) et quatre d'entre eux sont tassés entre 20,62 et
   * 17,76 — **zéro** triplet dérivé peut tenir ce seuil ET rester lisible cran
   * par cran. La contrainte était donc INFAISABLE en clair, et l'imposer aurait
   * envoyé repeindre un écran que personne n'a signalé (piège (g)).
   *
   * ⚠ Et le seuil n'était pas le bon instrument : chaque ligne de la rampe porte
   * son NOM, son MONTANT et son POURCENTAGE en toutes lettres. La pastille est
   * redondante avec son libellé, c'est-à-dire exactement le cas que la WCAG
   * 1.4.11 laisse dehors. Retiré, avec sa mesure — l'effacer effacerait la raison.
   *
   * La clause garde donc trois choses, toutes vérifiables : la rampe DÉRIVE de
   * l'échelle, ses crans se distinguent l'un de l'autre, et elle est RÉGULIÈRE.
   * Ce dernier point n'est pas cosmétique : trois valeurs d'une même grandeur
   * qui progressent par pas inégaux font lire la valeur du milieu comme
   * appartenant à l'un des deux bouts.
   */
  it('la rampe de composition d’Analytics dérive de l’échelle, dans les deux thèmes', async () => {
    const { readFileSync } = await import('node:fs')
    const F = 'src/components/crm-mobile/analytics/MobileAnalyticsScreen.tsx'
    const src = readFileSync(F, 'utf-8')

    /**
     * ⚠ Ancrée sur l'UNITÉ DU LANGAGE — la déclaration `const ramp`, de son `=`
     * à la fin du second objet du ternaire — jamais sur une fenêtre de lignes.
     * Un commentaire inséré au-dessus, ou un retour à la ligne différent, ne
     * doit pas désarmer la clause (forme n° 16).
     */
    const i = src.indexOf('const ramp')
    expect(i, `déclaration \`const ramp\` introuvable dans ${F}`).toBeGreaterThan(-1)
    const bloc = src.slice(i, src.indexOf('\n  return', i))
    const branches = [...bloc.matchAll(/\{([^{}]*secured[^{}]*)\}/g)].map((m) => m[1]!)
    expect(branches, 'les DEUX branches du ternaire doivent être lues').toHaveLength(2)

    /** Rend la valeur d'un cran : un littéral, ou une référence `MXC_COLOR.nX`. */
    const valeur = (branche: string, cle: string): string | null => {
      const m = new RegExp(`${cle}:\\s*([^,}]+)`).exec(branche)
      if (!m) return null
      const brut = m[1]!.trim()
      const ref = /^MXC_COLOR\.(\w+)$/.exec(brut)
      if (ref) return (MXC_COLOR as Record<string, string>)[ref[1]!] ?? null
      return /^'#[0-9a-fA-F]{3,6}'$/.test(brut) ? brut.slice(1, -1) : null
    }

    const CRANS = ['secured', 'probable', 'possible'] as const
    const fautes: string[] = []
    // La première branche du ternaire est celle de `mode === 'dark'`.
    for (const [nom, branche] of [['sombre', branches[0]!], ['clair', branches[1]!]] as const) {
      const vals: string[] = []
      for (const cle of CRANS) {
        const v = valeur(branche, cle)
        // ⛔ REFUSER ce qu'on ne sait pas lire, jamais le sauter (forme n° 14).
        expect(v, `${nom} · ${cle} : valeur non lue dans « ${branche.trim()} »`).not.toBeNull()
        if (!ECHELLE.has(v!.toLowerCase())) fautes.push(`${nom} · ${cle} = ${v} — hors de l'échelle`)
        vals.push(v!)
      }
      // Chaque cran se distingue du SUIVANT, sans quoi la rampe ne dit plus
      // trois valeurs mais deux.
      const pas: number[] = []
      for (let k = 0; k < vals.length - 1; k++) {
        const r = contraste(vals[k]!, vals[k + 1]!)
        pas.push(r)
        if (r < 1.8) fautes.push(`${nom} · ${CRANS[k]}↔${CRANS[k + 1]} = ${r.toFixed(2)}:1 — les deux crans se confondent`)
      }
      // …et les pas restent COMPARABLES : une rampe qui fait un petit pas puis
      // un gouffre fait lire la valeur du milieu comme un des deux bouts.
      // Mesuré : le clair actuel rend 3,70 / 3,47 (rapport 1,07) ; le miroir
      // littéral `n1000/n600/n400` rendrait 2,52 / 7,04 (rapport 2,80).
      const rapport = Math.max(...pas) / Math.min(...pas)
      if (rapport > 2) fautes.push(`${nom} · pas ${pas.map((p) => p.toFixed(2)).join(' / ')} — rapport ${rapport.toFixed(2)}, rampe irrégulière`)
    }
    expect(fautes, `la rampe de composition ne tient plus :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE CLIQUET DES NEUTRES ÉCRITS À LA MAIN, hors `tokens.ts`.
   *
   * La clause précédente garde UNE rampe. Celle-ci empêche la même chose de
   * recommencer ailleurs : un gris écrit en dur dans un écran mobile ne descend
   * de rien, ne suit aucun changement d'échelle, et n'est vu par aucune garde —
   * ni celle-ci (qui lisait `tokens.ts` seul), ni les huit specs de contraste
   * (qui gardent des zones du BUREAU).
   *
   * ⚠ C'EST UN CLIQUET, PAS UNE INTERDICTION. Quinze valeurs héritées existent ;
   * les interdire d'un coup enverrait repeindre dix fichiers hors de tout lot en
   * cours. L'inventaire ne peut que RÉTRÉCIR : une valeur neuve fait rougir, une
   * valeur retirée de la source AUSSI (sinon la liste se périme en silence et
   * finit par décrire un dépôt qui n'existe plus).
   *
   * ⚠ LE MOTIF EST VOLONTAIREMENT LARGE — chroma ≤ 24, ce qui ramasse aussi
   * quelques teintes PÂLES. Un motif serré à ≤ 12 ratait `#878D98`, l'un des
   * trois qu'on venait corriger : le seuil qui décrit « un gris » n'existe pas.
   * Un motif large avec un inventaire ÉNUMÉRÉ et confronté est sûr ; un motif
   * serré qui laisse passer sa propre cible ne l'est pas (forme n° 21).
   *
   * ⚠ La clé est le FICHIER, pas la ligne : une ligne bouge au premier commentaire.
   */
  it('aucun neutre neuf écrit à la main dans un écran mobile', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const RACINE = 'src/components/crm-mobile'

    /** Dette héritée, relevée le 15 août 2026. Ne peut que rétrécir. */
    const ASSUMES: Record<string, string[]> = {
      'agenda/AgTimeGrid.tsx': ['#D2D7DF'],
      'bien/shared.ts': ['#111827', '#6B7280'],
      'contacts/MobileContactDetailScreen.tsx': ['#07060B', '#0C091A'],
      'contacts/detailShared.ts': ['#7A8088'],
      'deal/MobileDealDetailScreen.tsx': ['#1A1B22', '#7A8088'],
      'matching/MmKyc.tsx': ['#DCF1E6'],
      'matching/MmMatchCard.tsx': ['#E4E7EC'],
      'pipeline/MobilePipelineScreen.tsx': ['#E0F1F5'],
      'today/MobileFocusHero.tsx': ['#1A1B22'],
    }

    const sansCommentaires = (c: string) =>
      c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')
    const canaux = (h: string) => {
      const x = h.replace('#', '')
      const p = x.length === 3 ? [...x].map((c) => c + c).join('') : x
      return [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
    }
    const chroma = (h: string) => { const c = canaux(h); return Math.max(...c) - Math.min(...c) }

    const fichiers = readdirSync(RACINE, { recursive: true, encoding: 'utf-8' })
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('tokens.ts'))
    expect(fichiers.length, 'balayage vide : chemin cassé, pas dossier propre').toBeGreaterThan(30)

    const vus: Record<string, Set<string>> = {}
    for (const f of fichiers) {
      const code = sansCommentaires(readFileSync(`${RACINE}/${f}`, 'utf-8'))
      for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        const h = m[0]
        const plein = h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h
        if (ECHELLE.has(plein.toLowerCase())) continue   // déjà un barreau
        if (chroma(h) > 24) continue                     // teinte CHROMATIQUE : elle encode, hors sujet
        ;(vus[f] ??= new Set()).add(h)
      }
    }

    const neufs: string[] = []
    const morts: string[] = []
    for (const [f, set] of Object.entries(vus)) {
      for (const v of set) if (!(ASSUMES[f] ?? []).includes(v)) neufs.push(`${f} — ${v}`)
    }
    for (const [f, vals] of Object.entries(ASSUMES)) {
      for (const v of vals) if (!vus[f]?.has(v)) morts.push(`${f} — ${v}`)
    }
    expect(neufs, `neutre écrit à la main, hors inventaire — le tirer d'un barreau :\n  ${neufs.join('\n  ')}`).toEqual([])
    expect(morts, `inscrit dans l'inventaire mais absent de la source — retirer la ligne :\n  ${morts.join('\n  ')}`).toEqual([])
  })
})
