/**
 * Garde-fou : les encres d'ÉTAT sur blanc ont UNE source — `STATUT_CLAIR`
 * (`src/components/megga-x-crm/statut.ts`).
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * Le 13 septembre 2026, les trois encres d'erreur, d'alerte et de succès du
 * thème clair étaient écrites en dur à VINGT-CINQ endroits, dans seize fichiers
 * — chacun avec son commentaire expliquant qu'il reprenait « la valeur que le
 * dépôt possède déjà ». Vingt-trois ont été rebranchées sur `STATUT_CLAIR`.
 * Sans cliquet, la vingt-sixième copie reviendrait au prochain écran, avec le
 * même commentaire, et la prochaine divergence de teinte avec elle.
 *
 * ⚠ LA BORNE EST LE RÔLE, PAS LA VALEUR. Deux littéraux gardent la même teinte
 * sans être la même chose, et ils sont NOMMÉS ci-dessous avec leur motif :
 * rebrancher un fond ou une information sur une encre d'état les ferait bouger
 * le jour où l'encre bouge, pour une raison qui n'est pas la leur.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

const ENCRES = {
  errInk: '--color-danger-dark',
  warnInk: '--color-warning-dark',
  okInk: '--color-success-dark',
} as const

/** Fichier → motif. Une exemption qui ne couvre plus aucun littéral fait rougir. */
const EXEMPTIONS: Record<string, string> = {
  'src/components/ai-copilot/panel/DeleteContactReviewModal.tsx':
    '`DANGER_HOVER` est le FOND de survol d’un bouton destructif sous encre blanche, apparié à ' +
    '`#DC2626` — un aplat, pas une encre d’état posée sur une surface.',
  'src/components/matching-recherche/mrhCtx.ts':
    '`MRH_PRICE_DROP` dit « le prix a baissé », pas une erreur ni une alerte, et sert aussi ' +
    'd’aplat sous encre blanche. Même teinte, autre information.',
}

const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
    .replace(/\/\/[^\n]*/g, ' ')

const luminance = (hex: string): number => {
  const v = [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const SOURCE_STATUT = 'src/components/megga-x-crm/statut.ts'
const scan = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }])
const SOURCES = scan.files
  .map((abs) => ({ chemin: rel(abs), lu: readFileSafely(abs) }))
  .filter((s) => s.chemin !== SOURCE_STATUT)
  .map((s) => ({ chemin: s.chemin, code: s.lu.status === 'ok' ? sansCommentaires(s.lu.value) : '' }))

/** Littéraux des trois encres, par fichier. */
function copies(): Map<string, string[]> {
  const cherche = new RegExp(Object.keys(ENCRES).map((k) => STATUT_CLAIR[k as keyof typeof ENCRES]).join('|'), 'gi')
  const vu = new Map<string, string[]>()
  for (const { chemin, code } of SOURCES) {
    code.split('\n').forEach((ligne, i) => {
      for (const m of ligne.matchAll(cherche)) vu.set(chemin, [...(vu.get(chemin) ?? []), `${i + 1}: ${m[0]}`])
    })
  }
  return vu
}

describe('STATUT_CLAIR — une source pour les encres d’état sur blanc', () => {
  it('le balayage voit l’arbre', () => {
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas dépôt propre').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(SOURCES.length, 'le balayage ne voit plus src/').toBeGreaterThan(300)
    // ⛔ TÉMOIN : sans lecteur connu, un motif cassé rendrait zéro copie et la
    // clause passerait au vert pour la mauvaise raison.
    expect(SOURCES.find((s) => s.chemin === 'src/components/crm/EtatVide.tsx')?.code ?? '')
      .toContain('STATUT_CLAIR.errInk')
  })

  /** La valeur vient de la feuille, jamais d'une troisième copie. */
  it('les trois encres sont les tons clairs que globals.css déclare', () => {
    const css = readFileSync(repoPath('src/styles/globals.css'), 'utf-8')
    for (const [cle, variable] of Object.entries(ENCRES)) {
      // ⚠ Le PREMIER bloc (`:root`, clair) : la surcharge sombre redéclare les
      // mêmes noms plus bas, et c'est elle qu'un motif non ancré trouverait.
      const m = new RegExp(`${variable}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(css)
      expect(m, `${variable} absent de globals.css`).not.toBeNull()
      const hex = '#' + m!.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('')
      expect(STATUT_CLAIR[cle as keyof typeof ENCRES].toLowerCase(), `${cle} ≠ ${variable}`).toBe(hex)
    }
  })

  it('chaque encre tient l’AA sur la carte blanche', () => {
    const faibles = Object.keys(ENCRES)
      .map((cle) => [cle, ratio(STATUT_CLAIR[cle as keyof typeof ENCRES], MXC_COLOR.n1000)] as const)
      .filter(([, r]) => r < 4.5)
      .map(([cle, r]) => `${cle} : ${r.toFixed(2)}:1`)
    expect(faibles, `encre d'état sous l'AA :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  it('aucune copie en dur hors de statut.ts, sauf les rôles nommés', () => {
    const fautifs = [...copies()]
      .filter(([chemin]) => !(chemin in EXEMPTIONS))
      .map(([chemin, sites]) => `${chemin} → ${sites.join(', ')}`)
    expect(
      fautifs,
      'encre d’état recopiée — importer `STATUT_CLAIR`, ou nommer le RÔLE qui la distingue :\n  ',
    ).toEqual([])
  })

  it('chaque exemption couvre encore un littéral, et dit pourquoi', () => {
    const vu = copies()
    const mortes: string[] = []
    for (const [chemin, motif] of Object.entries(EXEMPTIONS)) {
      expect(motif.length, `${chemin} : exemption sans motif écrit`).toBeGreaterThan(60)
      if (!vu.has(chemin)) mortes.push(`${chemin} : plus aucun littéral — retirer l'exemption`)
    }
    expect(mortes, `exemption sans support :\n  ${mortes.join('\n  ')}`).toEqual([])
  })
})
