/**
 * Garde-fou : sur Analytics, l'encre reste lisible — dans les DEUX thèmes.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * ⛔ `AX` et `AX_DARK` n'étaient gardées par RIEN, et c'est STRUCTUREL, pas un
 * oubli. Les sept specs de contraste du dépôt gardent chacune une ZONE (admin,
 * biens, contacts, matching, pipeline, kyc, SugarV3). Un objet de jetons n'EST
 * pas une zone : il est lu PAR une zone, et tombe entre les mailles.
 * `graphite-scale` les NOMME — « `AX` et `AX_DARK` (Analytics) … dont AUCUNE
 * n'était couverte » — mais il cherche les barreaux de l'échelle Graphite, et
 * ceux d'`AX_DARK` n'en sont pas : il les déclare propres sans les mesurer. Le
 * cliquet de grammaire, lui, balaie `crm-sugar/analytics/` depuis longtemps et
 * rend 0 marqueur — il mesure la COMPOSITION, jamais la couleur.
 *
 * Résultat : le plus gros écran du CRM affichait « tout vert » avec cinq encres
 * sous le seuil. Voir `megga/gardes-vacuites` n° 38.
 *
 * ── CE QUE LA MESURE A TROUVÉ (16-17 août 2026) ──────────────────────────────
 * Les deux premiers étaient attendus ; les trois autres ne l'étaient pas.
 *
 *   · `muted` (#80858E clair / #7C818B sombre) — 15 emplois en `color:`, et il
 *     échoue dans les DEUX thèmes : 3,71:1 sur la carte claire, 4,41:1 sur la
 *     carte sombre. Une garde d'un seul thème serait passée au vert de toute
 *     façon.
 *   · `ghost` — 1,95:1 en clair, 1,91:1 en sombre. Un seul site, mais c'est le
 *     `::placeholder` du champ d'objectif : le mot qui dit quoi taper.
 *   · ⛔ `pillBehind.bg` EMPLOYÉ COMME ENCRE. `AxGate` peint son message
 *     d'erreur avec le FOND de la pilule « en retard » (#A0521E) — une teinte
 *     VIVE, réglée pour porter du blanc, pas pour être lue. C'est la forme n° 37
 *     par l'autre bout : là un jeton d'encre servait d'aplat, ici un jeton
 *     d'aplat sert d'encre. `CLAUDE.md` §3 et `megga/da-meggax-crm` donnent la
 *     règle — la teinte VIVE va sur l'APLAT, la FONCÉE sur le TEXTE.
 *   · ⛔ `goal` — la ligne d'OBJECTIF de la trajectoire, à 1,71:1 en clair et
 *     2,49:1 en sombre, sous le seuil non textuel. Ce n'est pas du chrome : sur
 *     un cockpit de commission, l'objectif est la référence que tout le reste
 *     sert à situer.
 *   · Et `muted` sert aussi de GLYPHE (4 sites) — au seuil 3, il passe.
 *
 * ── CE QUE LA GARDE FIGE, ET CE QU'ELLE REFUSE DE SUPPOSER ───────────────────
 * 1. L'inventaire des rôles est CONFRONTÉ à la source, par la LIAISON. Un jeton
 *    qui devient une encre fait rougir tant qu'on ne l'a pas mesuré (n° 15).
 * 2. Elle résout `const A = useAX()`, JAMAIS le nom de clé (n° 31). `muted` seul
 *    trouve 219 sites sous `tk.`, 89 sous `SugarV3.` — corriger sur cette
 *    lecture repeindrait la moitié du CRM depuis un lot qui regarde Analytics.
 * 3. Elle REFUSE une couleur qu'elle ne sait pas lire, au lieu de la sauter
 *    (n° 14/17) : `NaN < 4.5` est FAUX, donc une lecture ratée passerait au vert.
 * 4. Elle mesure le couple ACCENT dans les DEUX SENS (n° 37).
 * 5. Elle nomme les clés MORTES. Une clé sans lecteur n'est pas « hors
 *    direction », elle est morte — et une garde qui l'ignore laisse revenir un
 *    défaut par la porte de derrière.
 * 6. Elle dit COMBIEN de thèmes elle mesure, et rougit si l'écran en gagne un
 *    troisième sans qu'on l'ait inscrit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AX, AX_DARK, type AxTheme } from '@/components/crm-sugar/analytics/tokens'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { repoPath, rel } from './helpers/fs-scan'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11) — une forme, un filet, un tracé. */
const AA_FORME = 3

/* ─── Lecture de couleur : les DEUX notations, et le refus de ce qu'on ne lit pas ─ */

/**
 * ⛔ Une couleur qu'on ne sait pas lire rend `NaN`, et `NaN < 4.5` est FAUX : la
 * clause passerait au vert, silencieusement et du bon côté du seuil. Forme n° 14.
 * `canal` lit `#rgb`, `#rrggbb`, `rgb()` et `rgba()` ; {@link lisible} est ce qui
 * transforme une lecture ratée en ROUGE au lieu d'un succès muet.
 *
 * ⛔ ANCRÉE SUR LA CHAÎNE ENTIÈRE. Non ancrée, elle trouvait le `rgba(0,0,0,0.40)`
 * au MILIEU de `'0 4px 16px rgba(0,0,0,0.40)'` et déclarait une chaîne d'ombre
 * « lisible » — donc mesurable comme une encre, avec un ratio qui n'a aucun sens.
 * Une lecture partielle est pire qu'un refus : elle rend un nombre.
 */
function canal(couleur: string): [number, number, number, number] {
  const rgb = couleur.match(/^\s*rgba?\(([^)]+)\)\s*$/i)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1]
  }
  const h = couleur.trim().replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return [NaN, NaN, NaN, NaN]
  const p = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
  return [r!, g!, b!, 1]
}
const lisible = (c: string) => canal(c).every((v) => Number.isFinite(v))

/** ⚠ Un voile se COMPOSE sur son fond avant d'être mesuré. */
function aplatir(couleur: string, dessous: string): string {
  const [r, g, b, a] = canal(couleur)
  if (a >= 1) return couleur
  const [br, bg, bb] = canal(dessous)
  const mix = (f: number, k: number) => Math.round(f * a + k * (1 - a))
  return '#' + [mix(r, br!), mix(g, bg!), mix(b, bb!)].map((v) => v.toString(16).padStart(2, '0')).join('')
}
function luminance(c: string): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const [r, g, b] = canal(c)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contraste(encre: string, fond: string): number {
  const x = luminance(aplatir(encre, fond)), y = luminance(fond)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/* ─── Les deux thèmes, et les surfaces sur lesquelles leur encre se pose ──────── */

/**
 * ⚠ LE CANVAS N'APPARTIENT PAS À `AX`. `AX.pageBg` a zéro lecteur : la page
 * peint son fond avec `crmSugarPalette(dark).pageBg`, et `AxGate`, `AxFirstRun`
 * et l'état d'erreur posent leur texte DESSUS, sans carte. Le mesurer depuis la
 * palette qui le rend vraiment est la seule lecture honnête — sinon la garde
 * mesure une surface que personne n'affiche.
 */
const THEMES: { nom: string; dark: boolean; t: AxTheme; surfaces: Record<string, string> }[] = [
  { nom: 'CLAIR', dark: false, t: AX, surfaces: { card: AX.card, cardSubtle: AX.cardSubtle, canvas: crmSugarPalette(false).pageBg } },
  { nom: 'SOMBRE', dark: true, t: AX_DARK, surfaces: { card: AX_DARK.card, cardSubtle: AX_DARK.cardSubtle, canvas: crmSugarPalette(true).pageBg } },
]

/* ─── L'inventaire des rôles, confronté à la source par la LIAISON ───────────── */

const FICHIERS = [
  'src/components/crm-sugar/analytics/AxDashboard.tsx',
  'src/components/crm-sugar/analytics/AxFirstRun.tsx',
  'src/components/crm-sugar/analytics/AxGate.tsx',
]
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')
const SOURCE = FICHIERS.map((n) => ({ nom: rel(repoPath(n)), code: sansCommentaires(readFileSync(repoPath(n), 'utf-8')) }))

/**
 * Les rôles qu'une couleur peut tenir, et la propriété qui le dit.
 *
 * ⛔ ANCRÉ SUR LA PROPRIÉTÉ LA PLUS PROCHE, jamais sur « une propriété quelque
 * part avant ». Une première version testait les motifs dans un ordre fixe, sur
 * tout le début de ligne : `background: A.card, …, boxShadow: A.shadow` classait
 * `A.shadow` en APLAT, parce que le motif de `background` acceptait la virgule et
 * gagnait avant celui d'`ombre`. Six rôles sur trente étaient faux — dont
 * `pillAhead.sh` classé en TEXTE, qui aurait envoyé mesurer une OMBRE au seuil de
 * lisibilité. Cousine de la n° 16 : une clause ancrée sur une fenêtre plutôt que
 * sur une unité du langage.
 *
 * ⚠ La liste est une LISTE BLANCHE de propriétés colorantes. Un `\w+\s*:` naïf
 * prendrait le `:` d'un ternaire — `color: actif ? A.accentInk : A.muted` ferait
 * de `accentInk` la « propriété » de `A.muted`. Et `borderRadius` / `borderWidth`
 * en sont exclus : ils ne portent pas de couleur.
 */
const PROPRIETE = /\b(color|fill|stroke|background|backgroundColor|backgroundImage|borderColor|borderTopColor|borderBottomColor|border|borderTop|borderBottom|borderLeft|borderRight|outline|outlineColor|boxShadow|box-shadow|textShadow|filter|stopColor)\s*[:=]/g
const ROLE_PAR_PROPRIETE: Record<string, string> = {
  color: 'texte',
  fill: 'glyphe', stroke: 'glyphe', stopColor: 'glyphe',
  background: 'aplat', backgroundColor: 'aplat', backgroundImage: 'aplat',
  border: 'filet', borderTop: 'filet', borderBottom: 'filet', borderLeft: 'filet', borderRight: 'filet',
  borderColor: 'filet', borderTopColor: 'filet', borderBottomColor: 'filet', outline: 'filet', outlineColor: 'filet',
  boxShadow: 'ombre', 'box-shadow': 'ombre', textShadow: 'ombre', filter: 'ombre',
}

/**
 * Chemins de `AxTheme` employés, avec leur RÔLE — résolus sur la LIAISON.
 *
 * ⛔ UNE GARDE QUI CHERCHE UN NOM DE CLÉ TROUVE N'IMPORTE QUEL OBJET (n° 31).
 * Mesuré le 17 août 2026 sur tout `src/` : `.muted` apparaît 219 fois sous `tk.`,
 * 89 sous `SugarV3.`, 59 sous `SugarV2.`, 46 sous `SET.` — et 19 seulement sous
 * la liaison d'Analytics. Une première passe du plan cherchait `ax.muted` /
 * `AX.muted` / `t.muted` et rendait ZÉRO sur toute la palette, ce qui se lit
 * « rien à faire ».
 *
 * ⚠ Le chemin est lu jusqu'au SOUS-CHAMP (`pillBehind.bg`) : c'est là que vit le
 * défaut de `AxGate`, et une lecture qui s'arrêterait à `pillBehind` classerait
 * en « aplat » un jeton employé en `color:`.
 *
 * ⚠ ET LA LIAISON SE RELAIE. `AxfDelta` et `AxfHero` écrivent
 * `const p = up ? A.pillAhead : A.pillBehind`, puis `background: p.bg,
 * color: p.fg`. Ne suivre que `A.` aurait rendu `pillAhead.fg` et `pillBehind.bg`
 * INVISIBLES — c'est-à-dire l'aplat de pilule et son encre, le seul couple vivant
 * de cet objet. Un alias est résolu vers TOUS les jetons qu'il peut porter :
 * la branche non prise du ternaire compte, elle s'affiche un jour sur deux.
 */
function rolesEmployes(): Set<string> {
  const vus = new Set<string>()
  const CLES = Object.keys(AX)
  for (const { code } of SOURCE) {
    const liaisons = [...code.matchAll(/const\s+(\w+)\s*=\s*useAX\(\)/g)].map((m) => m[1]!)
    if (!liaisons.length) continue
    // Alias : `const x = … A.pillAhead … A.pillBehind …` → x porte les deux.
    const alias = new Map<string, string[]>()
    for (const n of liaisons) {
      for (const m of code.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*([^\\n]*\\b${n}\\.\\w+[^\\n]*)`, 'g'))) {
        const portes = [...m[2]!.matchAll(new RegExp(`\\b${n}\\.(\\w+)`, 'g'))].map((x) => x[1]!).filter((k) => CLES.includes(k))
        if (portes.length) alias.set(m[1]!, [...new Set([...(alias.get(m[1]!) ?? []), ...portes])])
      }
    }
    for (const ligne of code.split('\n')) {
      /** Rôle = la propriété colorante la plus PROCHE à gauche, ou `autre`. */
      const role = (i: number): string => {
        PROPRIETE.lastIndex = 0
        let dernier = ''
        let m: RegExpExecArray | null
        while ((m = PROPRIETE.exec(ligne)) !== null && m.index < i) dernier = m[1]!
        return ROLE_PAR_PROPRIETE[dernier] ?? 'autre'
      }
      for (const n of liaisons) {
        for (const m of ligne.matchAll(new RegExp(`\\b${n}\\.(\\w+)(?:\\.(\\w+))?`, 'g'))) {
          vus.add(`${role(m.index)}:${m[2] ? `${m[1]}.${m[2]}` : m[1]!}`)
        }
      }
      for (const [nom, portes] of alias) {
        for (const m of ligne.matchAll(new RegExp(`\\b${nom}\\.(\\w+)`, 'g'))) {
          for (const p of portes) {
            // ⚠ Un alias ne porte QUE les champs de l'objet aliasé. Sans ce
            // filtre, le `p` de `const p = up ? A.pillAhead : A.pillBehind`
            // capturait le `p` SANS RAPPORT de `AX_PERIODS.map(p => p.labelKey)`
            // — la portée n'est pas lisible à la ligne, la FORME de l'objet si.
            const forme = AX[p as keyof AxTheme]
            if (typeof forme !== 'object' || !(m[1]! in (forme as object))) continue
            vus.add(`${role(m.index)}:${p}.${m[1]!}`)
          }
        }
      }
    }
  }
  return vus
}

/**
 * ⛔ INVENTAIRE MESURÉ, PAS SUPPOSÉ — relevé le 17 août 2026 sur les trois
 * fichiers qui montent `useAX()`. La clause « l'inventaire décrit encore la
 * source » le confronte au code : il ne peut ni grossir ni maigrir en silence.
 * C'est elle qui rend SÛRE l'exemption des aplats et des ombres, qui ne portent
 * aucun seuil de texte.
 */
const ENCRES = ['ink', 'inkSoft', 'muted', 'ghost', 'errInk']
const GLYPHES = ['muted', 'inkSoft', 'goal', 'ink']

/**
 * Encres posées sur l'ACCENT — leur fond n'est pas une surface, c'est `accent`.
 * Le segment de période, le CTA de la porte et le bouton « Réessayer ».
 */
const ENCRES_SUR_ACCENT = ['accentInk']

/**
 * Encres posées sur une PILULE — leur fond est le `bg` de la pilule, pas une
 * carte. C'est le sens NORMAL du couple ; le sens inverse (`pillBehind.bg` en
 * `color:`) est dans {@link ENCRES}, et c'est lui qui rougit.
 */
const PILULES = ['pillAhead', 'pillBehind']

/**
 * ⛔ Rôles qui ne portent AUCUN seuil de texte, nommés un par un avec leur
 * raison. Une exemption qui nomme une famille exempte des sites par accident
 * (n° 21) : chaque ligne dit un CHEMIN et un RÔLE.
 *
 * ⚠ `glyphe:card` n'est pas une coquille. Les marqueurs de survol de la
 * trajectoire sont des `<circle fill={A.card} stroke={…}>` : le disque est un
 * TROU dans la courbe, il DOIT valoir la carte. Lui appliquer un seuil enverrait
 * corriger un écran sain — piège (g).
 */
const HORS_SEUIL: Record<string, string> = {
  'aplat:card': 'la surface elle-même',
  'aplat:cardSubtle': 'sous-surface (rail de la pace-bar, segment, encart)',
  'aplat:ink': 'repère de rythme — un trait de 2,5 px sur cardSubtle, à 19:1',
  'aplat:accent': 'aplat d’accent — mesuré comme couple avec accentInk',
  'aplat:pillAhead.bg': 'aplat de pilule — mesuré comme couple avec son fg',
  'aplat:hairline': 'filet de séparation, voile assumé',
  'aplat:skBase': 'dégradé de squelette — aucune information portée',
  'aplat:skShine': 'dégradé de squelette — aucune information portée',
  'glyphe:card': 'trou dans la courbe : le disque DOIT valoir la carte',
  'ombre:shadow': 'ombre',
  'ombre:shadowSm': 'ombre',
  'ombre:shadowLg': 'ombre',
  'ombre:ink': 'anneau de focus du champ d’objectif (inset 2 px), pas une encre',
  'ombre:pillAhead.sh': 'ombre de pilule',
  'ombre:pillBehind.sh': 'ombre de pilule',
  'filet:goal': 'contour du marqueur d’objectif — mesuré comme glyphe',
  'autre:pillAhead': 'objet de pilule, déréférencé par un alias',
  'autre:pillBehind': 'objet de pilule, déréférencé par un alias',
  'autre:ink': 'table de teintes du treemap, appliquée en `color:` plus bas',
}

/**
 * ⛔ LES CLÉS SANS LECTEUR. Une clé qui n'est lue nulle part n'est PAS « hors
 * direction » : elle est MORTE. Le chantier KYC en avait trouvé dix sur
 * trente-cinq, et les nommer avait supprimé le débat de direction sur toute une
 * famille.
 *
 * ⚠ CELLE-CI CONTIENT UNE LEÇON. `secured` / `probable` / `possible` ressemblent
 * à la décomposition de la commission — trois valeurs d'une même grandeur, donc
 * une famille qui ENCODE, donc hors direction. Mesuré, elles ne peignent RIEN :
 * la refonte fusion a déplacé la dataviz sur `AXF_ACCENTS` (périwinkle) et
 * `AXF_BUCKET_TONE`, qui vivent dans `AxDashboard.tsx`. Les jetons homonymes
 * d'`AX` sont restés derrière, inertes. C'est exactement la différence entre
 * « mort » et « lu autrement », et elle ne se voit qu'en résolvant la liaison.
 *
 * ⚠ `onAccent` valait la peine d'être regardée AVANT d'être retirée : en sombre
 * elle rendait `#030303` posé sur l'accent, soit 3,57:1 — le défaut EXACT que le
 * chantier KYC a corrigé sur `kycPalette.onAccent`. Ici il ne s'est jamais VU,
 * parce que personne ne la lisait. Il n'attendait qu'un lecteur.
 *
 * ⚠ ELLE EST VIDE DEPUIS LE LOT 3 (17 août 2026), et c'est l'état visé : les
 * treize clés ont été RETIRÉES plutôt qu'inscrites ici. Ce qu'elles étaient —
 * `appBlur`, `area`, `cardWhisper`, `grid`, `hairlineSt`, `line`, `onAccent`,
 * `pageBg`, `pillNeutral`, `possible`, `probable`, `scrim`, `secured` — reste
 * écrit dans l'en-tête de `tokens.ts`. La liste vide ne rouvre rien : c'est la
 * clause `orphelines` qui garde la porte, et elle rougit sur TOUTE clé sans
 * lecteur. `MORTES` n'existe que pour le cas où l'on voudrait en tolérer une, et
 * il faudrait alors écrire pourquoi.
 */
const MORTES: string[] = []

/**
 * ⛔ CE QUI N'EST PAS UNE COULEUR SIMPLE, nommé un par un. Tout le RESTE doit se
 * lire, sinon la clause rougit.
 *
 * ⚠ CETTE LISTE REMPLACE UN FILTRE, ET C'EST LA CORRECTION D'UNE VACUITÉ QUE CE
 * FICHIER PORTAIT LUI-MÊME. La première version sautait toute valeur ne
 * commençant pas par `#` ou `rgb(` — donc une couleur passée en `var(--x)`, une
 * indirection qui n'existe qu'au RENDU, sortait du balayage sans un mot. C'est
 * exactement la forme n° 17 (« la garde qui ne peut pas lire sa propre cible »),
 * et c'est le contrôle négatif qui l'a montrée : muter `muted` en
 * `var(--ax-muted)` laissait la clause au VERT. Le remède n'est pas de mieux
 * lire, c'est de REFUSER — et donc d'énumérer les exceptions au lieu de les
 * deviner par une forme.
 */
const NON_COULEURS: Record<string, string> = {
  pageBg: 'dégradé radial de la page — zéro lecteur, mesuré nulle part',
  shadow: 'chaîne de box-shadow', shadowSm: 'chaîne de box-shadow', shadowLg: 'chaîne de box-shadow',
}
/** Sous-champs de pilule qui ne sont pas des couleurs. */
const NON_COULEURS_PILULE = new Set(['sh'])

describe('Contraste Analytics — un objet de jetons que sept specs ont laissé passer', () => {
  /** Sans lui, tout le reste passerait par vacuité sur un balayage cassé. */
  it('le balayage voit la source, et lit toutes les couleurs', () => {
    expect(SOURCE.length, 'zone vide : chemin cassé, pas surface propre').toBe(3)
    for (const { nom, code } of SOURCE) {
      expect(/const\s+\w+\s*=\s*useAX\(\)/.test(code), `${nom} ne monte plus la palette : la liaison a changé`).toBe(true)
    }
    // ⚠ TÉMOINS NOMMÉS, pas un compte (n° 33) : un seuil décrit un ÉTAT et se
    // périme au premier retrait légitime ; un témoin décrit le BALAYAGE.
    const vus = rolesEmployes()
    for (const t of ['texte:ink', 'texte:muted', 'aplat:card', 'glyphe:goal', 'texte:accentInk']) {
      expect([...vus], `rôle non vu : le balayage ne lit plus la source (${t})`).toContain(t)
    }

    const illisibles: string[] = []
    const exemptionsMortes: string[] = []
    for (const { nom, t, surfaces } of THEMES) {
      for (const [cle, v] of Object.entries(t)) {
        if (typeof v === 'string') {
          if (NON_COULEURS[cle]) {
            // Une exemption qui couvre une VRAIE couleur est une exemption qui a
            // dérivé : elle doit rougir, pas protéger.
            if (lisible(v)) exemptionsMortes.push(`${nom}.${cle} = ${v} — lisible, l'exemption ne se justifie plus`)
            continue
          }
          if (!lisible(v)) illisibles.push(`${nom}.${cle} = ${v}`)
        } else if (v && typeof v === 'object') {
          for (const [sc, sv] of Object.entries(v as Record<string, string>)) {
            if (NON_COULEURS_PILULE.has(sc)) continue
            if (!lisible(sv)) illisibles.push(`${nom}.${cle}.${sc} = ${sv}`)
          }
        } else {
          illisibles.push(`${nom}.${cle} — valeur d'un type inattendu (${typeof v})`)
        }
      }
      for (const [cle, v] of Object.entries(surfaces)) if (!lisible(v)) illisibles.push(`${nom} surface ${cle} = ${v}`)
    }
    expect(illisibles, `couleur non lue — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ COMBIEN DE THÈMES ON MESURE, et ce qui arrive si l'écran en gagne un
   * troisième. La page choisit entre exactement deux objets ; le jour où elle en
   * monte un de plus, cette garde ne mesurerait plus que les deux tiers de la
   * vérité — en silence, comme `sugar-v3-contraste` avant sa clause mono-thème.
   */
  it('la page ne monte que les deux thèmes mesurés ici', () => {
    const page = sansCommentaires(readFileSync(repoPath('src/pages/agent/AnalyticsPage.tsx'), 'utf-8'))
    const montages = [...page.matchAll(/AXCtx\.Provider\s+value=\{(\w+)\}/g)].map((m) => m[1]!)
    expect(montages, 'aucun provider trouvé : la clause ne mesure rien').toHaveLength(1)
    const decl = new RegExp(`const\\s+${montages[0]}\\s*=\\s*([^\\n]+)`).exec(page)?.[1] ?? ''
    const cites = ['AX_DARK', 'AX'].filter((n) => new RegExp(`\\b${n}\\b`).test(decl))
    expect(cites.sort(), `le provider est alimenté par « ${decl.trim()} » — un thème non mesuré ?`).toEqual(['AX', 'AX_DARK'])
  })

  /**
   * Clause n° 1 : l'inventaire est confronté à la source. C'est ce qui rend sûres
   * les exemptions de {@link HORS_SEUIL} — le jour où un aplat devient une encre,
   * elle le dit en le nommant.
   */
  it('l’inventaire des rôles décrit encore la source', () => {
    const attendus = new Set<string>([
      ...ENCRES.map((c) => `texte:${c}`),
      ...GLYPHES.map((c) => `glyphe:${c}`),
      ...ENCRES_SUR_ACCENT.map((c) => `texte:${c}`),
      ...PILULES.map((c) => `texte:${c}.fg`),
      ...PILULES.map((c) => `aplat:${c}.bg`),
      ...Object.keys(HORS_SEUIL),
    ])
    const vus = rolesEmployes()
    const nouveaux = [...vus].filter((v) => !attendus.has(v)).sort()
    const morts = [...attendus].filter((a) => !vus.has(a)).sort()
    expect(nouveaux, `rôle employé sans être mesuré :\n  ${nouveaux.join('\n  ')}`).toEqual([])
    expect(morts, `inscrit mais plus employé — retirer :\n  ${morts.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LES CLÉS SANS LECTEUR SONT NOMMÉES, et la liste ne peut pas dériver : une
   * clé morte qui gagne un lecteur rougit ici, une clé vivante qui le perd aussi.
   *
   * ⚠ Le contrôle est écrit À PART de l'ensemble surveillé (n° 15) : il lit les
   * clés de `AX` à la source et les confronte à {@link MORTES}. Itérer `MORTES`
   * seul ferait disparaître la clé ET son assertion du même geste.
   */
  it('les clés sans lecteur sont nommées, et ne se réveillent pas en silence', () => {
    const cles = Object.keys(AX)
    const lues = new Set([...rolesEmployes()].map((r) => r.split(':')[1]!.split('.')[0]!))
    const inconnues = MORTES.filter((m) => !cles.includes(m))
    expect(inconnues, `inscrite comme morte mais absente de AX :\n  ${inconnues.join('\n  ')}`).toEqual([])
    const reveillees = MORTES.filter((m) => lues.has(m))
    expect(reveillees, `clé morte qui a gagné un lecteur — la mesurer :\n  ${reveillees.join('\n  ')}`).toEqual([])
    const orphelines = cles.filter((c) => !lues.has(c) && !MORTES.includes(c))
    expect(orphelines, `clé sans lecteur, non inscrite — morte ou lue autrement ?\n  ${orphelines.join('\n  ')}`).toEqual([])
  })

  /* ─── Les seuils, thème par thème ────────────────────────────────────────── */

  for (const { nom, t, surfaces } of THEMES) {
    it(`les encres tiennent l’AA sur les surfaces — ${nom}`, () => {
      const faibles: string[] = []
      for (const [liste, seuil, role] of [[ENCRES, AA, 'texte'], [GLYPHES, AA_FORME, 'glyphe']] as const) {
        for (const chemin of liste) {
          const encre = chemin.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], t) as string
          expect(lisible(encre), `${chemin} illisible en ${nom} : ${encre}`).toBe(true)
          for (const [nomSurf, fond] of Object.entries(surfaces)) {
            const r = contraste(encre, fond)
            if (r < seuil) faibles.push(`${chemin} (${encre}) sur ${nomSurf} (${fond}) = ${arrondi(r)}:1 — seuil ${role} ${seuil}`)
          }
        }
      }
      expect(faibles, `sous le seuil en ${nom} :\n  ${faibles.join('\n  ')}`).toEqual([])
    })

    /**
     * ⛔ LE COUPLE, DANS LES DEUX SENS (n° 37). `accentInk` est « l'encre posée
     * sur l'accent » : on la mesure contre `accent`. Mais `accent` est AUSSI une
     * forme posée sur une carte, et `CLAUDE.md` §3 dit que l'aplat ne tient que
     * « parce que c'est l'encre BLANCHE qui porte le contraste » — une clause qui
     * ne regarderait qu'un sens laisserait casser la propriété sur laquelle la
     * règle s'appuie.
     */
    it(`le couple accent × son encre tient dans les deux sens — ${nom}`, () => {
      const faibles: string[] = []
      for (const chemin of ENCRES_SUR_ACCENT) {
        const r = contraste(t[chemin as keyof AxTheme] as string, t.accent)
        if (r < AA) faibles.push(`${chemin} (${String(t[chemin as keyof AxTheme])}) sur accent (${t.accent}) = ${arrondi(r)}:1`)
      }
      for (const p of PILULES) {
        const pl = t[p as keyof AxTheme] as { bg: string; fg: string }
        const r = contraste(pl.fg, pl.bg)
        if (r < AA) faibles.push(`${p}.fg (${pl.fg}) sur son aplat ${p}.bg (${pl.bg}) = ${arrondi(r)}:1`)
      }
      expect(faibles, `encre illisible sur son aplat en ${nom} :\n  ${faibles.join('\n  ')}`).toEqual([])
    })
  }

  /**
   * ⛔ EN SOMBRE, LA SÉPARATION EST UN FILET — PAS UNE OMBRE (lot 2).
   *
   * `mxCrmPalette(true)` rend `shadow: 'none'` : sur un canvas `#030303`, une
   * ombre noire ne dessine rien. Mesuré au rendu avant ce lot, la carte sortait
   * à `#191B1F` avec `borderWidth: 0px` — l'écart de luminance de 1,13:1 était le
   * SEUL séparateur, et descendre l'échelle sans poser le filet l'aurait ramené
   * à 1,04:1.
   *
   * ⚠ Aucune clause de contraste ne peut l'attraper : les encres restent
   * lisibles pendant que la CARTE disparaît. C'est la forme n° 32 appliquée non
   * plus à une pastille mais à la surface entière.
   */
  it('en sombre, chaque ombre est un filet tiré d’un barreau réel', () => {
    const fautes: string[] = []
    for (const cle of ['shadow', 'shadowSm', 'shadowLg'] as const) {
      const v = AX_DARK[cle]
      if (!/^inset 0 0 0 1px /.test(v)) { fautes.push(`${cle} n'est pas un filet : ${v}`); continue }
      const teinte = v.replace('inset 0 0 0 1px ', '').trim()
      if (!Object.values(MXC_COLOR).includes(teinte as never)) fautes.push(`${cle} tire son filet hors de l'échelle : ${teinte}`)
      const r = contraste(teinte, AX_DARK.card)
      if (r < 1.1) fautes.push(`${cle} : filet ${teinte} sur la carte ${AX_DARK.card} = ${arrondi(r)}:1 — il ne sépare pas`)
    }
    // …et le CLAIR garde ses ombres douces : l'inverse doit rougir aussi, sinon
    // la clause laisserait passer un filet posé là où l'idiome est l'ombre.
    for (const cle of ['shadow', 'shadowSm', 'shadowLg'] as const) {
      if (/inset/.test(AX[cle])) fautes.push(`CLAIR.${cle} porte un filet : l'idiome clair est l'ombre douce sans bordure`)
    }
    expect(fautes, `la séparation sombre a changé de nature :\n  ${fautes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA PALETTE DESCEND DE MEGGA X — sauf ce qui ENCODE ou n'a pas de barreau,
   * et les deux sont nommés (lot 3).
   *
   * ⚠ CE QUI RESTE DEHORS EST MESURÉ, PAS SUPPOSÉ. `inkSoft` et le chatoiement du
   * squelette n'ont pas de barreau : entre l'encre et le texte secondaire,
   * `n400` sort à 1,16:1 de `n100` en clair — un DOUBLON, pas un cran ; et en
   * sombre `n400 → n500` rend 3,19:1, un éclair au lieu d'un chatoiement. Les
   * pilules et `errInk`, elles, ENCODENT.
   */
  it('chaque couleur descend de MEGGA X, sauf celles qui sont nommées', () => {
    const HORS_ECHELLE: Record<string, string> = {
      inkSoft: 'aucun barreau entre l’encre et le texte secondaire — mesuré 1,16:1 en clair, 1,06 en sombre',
      skBase: 'chatoiement : l’échelle ne porte pas deux paliers adjacents en sombre (3,19:1)',
      skShine: 'idem skBase',
      hairline: 'voile composé, pas un aplat — dérive de sgVoileEncre',
      pillAhead: 'ENCODE « en avance » sur l’objectif',
      pillBehind: 'ENCODE « en retard » sur l’objectif',
      errInk: 'ENCODE une ERREUR — teinte foncée pour le texte, cf. da-meggax-crm',
    }
    const BARREAUX = new Set<string>(Object.values(MXC_COLOR))
    const nus: string[] = []
    const exemptionsMortes: string[] = []
    for (const { nom, t } of THEMES) {
      for (const [cle, v] of Object.entries(t)) {
        if (HORS_ECHELLE[cle]) continue
        if (typeof v !== 'string') { nus.push(`${nom}.${cle} — objet non exempté`); continue }
        // Une ombre/filet est jugée sur la teinte qu'elle porte, pas sur la chaîne.
        const teintes = v.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []
        if (!teintes.length) continue
        for (const teinte of teintes) if (!BARREAUX.has(teinte)) nus.push(`${nom}.${cle} = ${v.slice(0, 60)}`)
      }
    }
    for (const cle of Object.keys(HORS_ECHELLE)) {
      if (!(cle in AX)) exemptionsMortes.push(`${cle} — exemptée mais absente de AX`)
    }
    // ⚠ TÉMOINS NOMMÉS, pas un compte : un `> 15 clés lues` s'était périmé le
    // jour même où dix clés mortes ont été retirées, au chantier KYC.
    for (const t of ['card', 'muted', 'goal', 'accent']) {
      expect(Object.keys(AX), `clé non lue : le découpage a changé (${t})`).toContain(t)
    }
    expect(nus, `couleur écrite à la main, hors inventaire :\n  ${nus.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CE QUE CETTE GARDE NE MESURE PAS, ET POURQUOI C'EST ÉCRIT.
   *
   * L'APLAT des pilules contre la carte. En sombre, `pillAhead.bg` (#15643F)
   * rend 2,40:1 sur la carte : la forme se détache mal. Mais l'exiger à 3:1
   * CONTREDIRAIT la direction — `CLAUDE.md` §3 dit qu'en sombre « la séparation
   * vient de la BORDURE », et l'écart canvas↔carte de MEGGA X lui-même est de
   * 1,036:1. Le texte blanc de la pilule sort à 7,18:1 : elle se lit.
   *
   * ⚠ C'est la question ANTÉRIEURE déjà tranchée quatre fois — les familles qui
   * ENCODENT restent hors direction — et la rouvrir depuis un lot qui répare des
   * ENCRES repeindrait des pastilles que personne n'a signalées (piège (g) : 31
   * défauts annoncés pour 18 réels sur le Matching). Elle reste dehors, NOMMÉE :
   * l'effacer effacerait la raison avec elle.
   */
  it.skip('l’aplat des pilules contre la carte — hors périmètre, voir le commentaire', () => {})
})
