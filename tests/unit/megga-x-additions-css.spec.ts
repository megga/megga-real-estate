/**
 * Garde-fou : les TROIS feuilles de style qu'aucune garde n'ouvrait.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * Une feuille CSS est un système de jetons dans un LANGAGE que les gardes du
 * dépôt ne parlent pas. `megga-x-grammar` ne lit que les styles EN LIGNE ;
 * `megga-x-crm-tokens` s'arrête à `globals.css` et `megga-x.generated.css` ;
 * `graphite-scale` n'ouvre aucun `.css`. Le chantier Matching l'a découvert sur
 * `atelier.css` — 868 lignes, 29 variables à lui, trois règles abandonnées
 * survivantes —, le chantier Console l'a revu sur `admin-console.css`, où
 * Graphite a tenu quatre jours toutes portes vertes.
 *
 * Inventaire refait le 16 août 2026 : sur les huit feuilles de `src/`, cinq sont
 * gardées (`globals`, `megga-x.generated`, `admin-console`, `atelier`, `mrh`) et
 * TROIS ne l'étaient pas — celles-ci.
 *
 * ⚠ ET LE PLAN SE TROMPAIT SUR LA PLUS GROSSE. Il annonçait
 * `megga-x-additions.css` comme « le candidat sérieux, huit hex, il sert la
 * coquille d'identité ». Mesuré : les neuf hex sont TOUS dans des commentaires.
 * Hors commentaires la feuille porte ZÉRO hex, cinq `rgba()`, 128 blocs de
 * règles et 114 lectures de `var(--…)`. Elle est déjà tokenisée : il lui
 * manquait une garde, pas une passe de couleur. C'est précisément le genre
 * d'écart qu'une garde fige et qu'une relecture rate.
 *
 * ── CE QUE CETTE GARDE FAIT, ET CE QU'ELLE REFUSE DE FAIRE ───────────────────
 * Elle ne se contente pas d'INTERDIRE deux teintes : elle exige que toute
 * couleur écrite soit un barreau réel de l'échelle, DÉRIVÉ de `MXC_COLOR` — pas
 * une liste recopiée qui divergerait au premier ajout. Et elle REFUSE une
 * couleur qu'elle n'a pas su lire, au lieu de la sauter en silence : c'est cette
 * clause-là qui avait démasqué `tones.accent` sur la console, une valeur qui
 * n'existait qu'au rendu.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { repoPath } from './helpers/fs-scan'

/**
 * Les DEUX feuilles, et ce que chacune est censée porter.
 *
 * ⚠ Elles étaient trois. `crm-dossiers/responsive.css` a été RETIRÉE le 15 août
 * 2026 : neuf de ses quinze sélecteurs n'avaient aucun porteur, deux n'étaient
 * portés que par le wizard KYC — qui passe par `ResponsiveRoute` et ne rend
 * donc jamais sous 768 px —, et les trois derniers ne servaient qu'à
 * `AuditPage`, seule surface agent sans variante mobile. Ses règles
 * vivent désormais DANS la page, sur `useIsMobile()`. Une feuille chargée par
 * `main.tsx` sur TOUTES les pages pour trois règles utiles à une seule.
 */
const FEUILLES = [
  { chemin: 'src/styles/megga-x-additions.css', role: 'les ajouts de la coquille MEGGA X (identité, modales, champs)' },
  { chemin: 'src/styles/megga-x.css', role: 'le point d’entrée qui importe les deux autres' },
]

/**
 * Retire les commentaires en gardant le compte de lignes.
 *
 * ⛔ SANS ÇA CETTE GARDE SERAIT ROUGE SUR SA PROPRE DOCUMENTATION. Les neuf hex
 * de `megga-x-additions.css` sont dans des blocs `/* … *\/` qui EXPLIQUENT
 * pourquoi la base Webflow posait un `#eee` et pourquoi il a été remplacé. Une
 * garde qui trébuche sur la note expliquant un retrait se fait désarmer, pas
 * respecter — même défaut que `t.primary` sur `megga-x-crm-tokens`.
 */
function sansCommentaires(brut: string): string {
  return brut.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
}

const feuilles = FEUILLES.map((f) => {
  const brut = readFileSync(repoPath(f.chemin), 'utf-8')
  return { ...f, brut, css: sansCommentaires(brut) }
})

/** L'échelle réelle, dérivée — jamais recopiée. */
const ECHELLE = new Set(Object.values(MXC_COLOR).map((v) => v.toLowerCase()))

/** Les deux pôles admis pour un VOILE : l'encre de la direction, et son inverse. */
const POLES_DE_VOILE = [
  { rgb: [3, 3, 3], nom: 'n100 — l’encre MEGGA X' },
  { rgb: [255, 255, 255], nom: 'le blanc' },
  { rgb: [0, 0, 0], nom: 'le noir pur, admis pour une ombre' },
]

const GRIS_BLEU = /rgba?\(\s*15\s*,\s*23\s*,\s*42\b|#0F172A\b/i
const NOIR_SUGAR = /#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b/i

describe('Feuilles MEGGA X non gardées — additions, entrée, responsive', () => {
  /**
   * Contrôle POSITIF. Sans lui, un chemin cassé rendrait tout le fichier vert par
   * vacuité — et c'est le mode d'échec que trois garde-fous du dépôt ont déjà eu.
   */
  it('la garde voit les trois feuilles', () => {
    for (const f of feuilles) {
      expect(f.brut.length, `feuille vide ou introuvable : ${f.chemin}`).toBeGreaterThan(20)
    }
    // `megga-x-additions.css` est la seule qui porte des règles : si elle en
    // rendait zéro, le balayage regarderait au mauvais endroit.
    const additions = feuilles.find((f) => f.chemin.endsWith('megga-x-additions.css'))!
    expect((additions.css.match(/\{/g) ?? []).length,
      'aucun bloc de règle : le retrait des commentaires a trop mangé').toBeGreaterThan(50)
  })

  /**
   * ⛔ LES DEUX TEINTES QUE LE CHANTIER A PASSÉ SIX LOTS À RETIRER. Elles entrent
   * toujours par une fraction d'opacité, jamais par un `#hex` — et une feuille
   * est le dernier endroit où quelqu'un les relirait.
   */
  it('aucun noir de Sugar, aucun gris-bleu slate-900', () => {
    const fautifs: string[] = []
    for (const f of feuilles) {
      f.css.split('\n').forEach((l, i) => {
        if (NOIR_SUGAR.test(l)) fautifs.push(`${f.chemin}:${i + 1} (noir Sugar)`)
        if (GRIS_BLEU.test(l)) fautifs.push(`${f.chemin}:${i + 1} (gris-bleu)`)
      })
    }
    expect(fautifs, `teinte proscrite :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Toute couleur ÉCRITE doit être un barreau — la valeur attendue est DÉRIVÉE de
   * `MXC_COLOR`, pas recopiée : une liste en dur diverge au premier ajout.
   *
   * ⚠ Mesuré le 16 août 2026 : les trois feuilles portent ZÉRO hex hors
   * commentaires. Cette clause ne garde donc rien aujourd'hui — elle garde
   * demain, et le test suivant garantit qu'elle ne devienne pas vraie par
   * vacuité sans qu'on le remarque.
   */
  it('toute couleur hexadécimale est un barreau de l’échelle', () => {
    const fautifs: string[] = []
    for (const f of feuilles) {
      for (const m of f.css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const v = m[0].toLowerCase()
        // Une forme courte est étendue avant comparaison ; ce qu'on ne sait pas
        // lire est REFUSÉ, jamais sauté.
        const long = v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v
        if (long.length !== 7) { fautifs.push(`${f.chemin} : couleur illisible ${m[0]}`); continue }
        if (!ECHELLE.has(long)) fautifs.push(`${f.chemin} : ${m[0]} hors échelle`)
      }
    }
    expect(fautifs, `couleurs hors échelle :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET LA CLAUSE PRÉCÉDENTE PEUT ÊTRE VRAIE PAR VACUITÉ.
   *
   * Zéro hex aujourd'hui : elle passerait au vert même si le balayage était
   * cassé. On fige donc le COMPTE mesuré — hex ET `rgba()` —, ce qui fait rougir
   * aussi bien un ajout qu'une disparition du balayage. Troisième forme de
   * `megga/gardes-vacuites` appliquée à une feuille.
   */
  it('le compte de couleurs de chaque feuille est celui qui a été mesuré', () => {
    const ATTENDU: Record<string, { hex: number; rgba: number }> = {
      'src/styles/megga-x-additions.css': { hex: 0, rgba: 5 },
      'src/styles/megga-x.css': { hex: 0, rgba: 0 },
    }
    const reel = Object.fromEntries(feuilles.map((f) => [f.chemin, {
      hex: (f.css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length,
      rgba: (f.css.match(/rgba?\(/g) ?? []).length,
    }]))
    expect(reel).toEqual(ATTENDU)
  })

  /**
   * Un VOILE ne part que de deux pôles : l'encre de la direction, ou son inverse.
   * C'est la règle que `crmVoileEncre` applique côté TypeScript ; une feuille ne
   * peut pas appeler la fonction, mais elle doit respecter la même contrainte.
   *
   * ⚠ Exception NOMMÉE et mesurée : `rgba(127,127,127,.14)` — un gris neutre
   * médian, employé sur le champ en lecture seule de la coquille d'identité, là
   * où l'encre voilée disparaîtrait sur le canvas noir et où le blanc voilé
   * ferait un pavé. C'est un écart assumé, écrit ici, pas un oubli.
   */
  it('chaque voile part d’un pôle admis', () => {
    const NEUTRE_MEDIAN = [127, 127, 127]
    const fautifs: string[] = []
    for (const f of feuilles) {
      for (const m of f.css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        const rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
        const admis = [...POLES_DE_VOILE.map((p) => p.rgb), NEUTRE_MEDIAN]
        if (!admis.some((p) => p.every((v, i) => v === rgb[i]))) {
          fautifs.push(`${f.chemin} : voile hors pôle rgb(${rgb.join(',')})`)
        }
      }
    }
    expect(fautifs, `voiles hors pôle :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UNE POLICE EN DUR ÉCRASE `--crm-font`, donc la direction ne peut plus
   * changer la typographie de la région. Le défaut est invisible sous MEGGA X —
   * dont la police EST Inter Tight — et ne se voit qu'en changeant de police.
   * Même clause que `megga-x-crm-tokens`, portée au langage des feuilles.
   */
  it('aucune police écrite en dur', () => {
    const fautifs: string[] = []
    for (const f of feuilles) {
      f.css.split('\n').forEach((l, i) => {
        const sansJeton = l.replace(/var\(--[a-z0-9-]*font[^)]*\)/gi, 'VAR')
        if (/font-family\s*:[^;]*(Inter Tight|DM Sans)/i.test(sansJeton)) {
          fautifs.push(`${f.chemin}:${i + 1}`)
        }
      })
    }
    expect(fautifs, `police en dur :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
})
