/**
 * Les cinq phases du Pipeline (proposition du 27.09.2026) : le regroupement couvre-t-il la base,
 * et les montants et échéances se lisent-ils comme la carte le promet ?
 *
 * ⛔ UN STADE ORPHELIN NE SE VOIT PAS : `phaseDe` range l'inconnu en « Prospects ». Un stade ajouté
 * à la base sans être rangé ici tomberait au début de l'entonnoir sans un mot — d'où la clause de
 * couverture, confrontée à l'énumération réelle (`TRANSACTION_STAGES`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TRANSACTION_STAGES } from '@/lib/constants'
import {
  PHASES, echeanceDe, loyerCourt, montantCourt, phaseDe, stadeDEntree,
} from '@/components/crm/pipeline/phases'

describe('les phases du Pipeline', () => {
  it('chaque stade de la base a UNE phase, sauf « perdu » qui sort du board', () => {
    const ranges = PHASES.flatMap((p) => p.stades)
    expect(new Set(ranges).size, 'un stade rangé dans deux phases').toBe(ranges.length)
    for (const s of TRANSACTION_STAGES) {
      if (s === 'lost') expect(phaseDe(s)).toBeNull()
      else expect(ranges, `stade sans phase : ${s}`).toContain(s)
    }
  })

  it('un dépôt pose le PREMIER stade de la phase', () => {
    expect(PHASES.map((p) => stadeDEntree(p.id)))
      .toEqual(['new_lead', 'active_search', 'visit_planned', 'interest_confirmed', 'reserved'])
  })

  it('les montants : une écriture, le séparateur de la langue', () => {
    expect(montantCourt(3_200_000, 'fr')).toBe('3,2 M')
    expect(montantCourt(1_420_000, 'fr')).toBe('1,42 M')
    expect(montantCourt(1_420_000, 'de')).toBe('1.42 M')
    expect(montantCourt(820_000, 'fr')).toBe('820 k')
    expect(loyerCourt(2950)).toBe("2'950")
  })

  it('l’échéance se compte en jours CIVILS', () => {
    const midi = new Date(); midi.setHours(12, 0, 0, 0)
    const a = (jours: number, heure: number) => { const d = new Date(midi); d.setDate(d.getDate() + jours); d.setHours(heure); return d.toISOString() }
    expect(echeanceDe(a(-1, 23), midi)).toBe('retard')
    // Une relance de 9 h n'est pas en retard à midi : elle est « aujourd'hui ».
    expect(echeanceDe(a(0, 9), midi)).toBe('aujourdhui')
    expect(echeanceDe(a(1, 8), midi)).toBe('demain')
    expect(echeanceDe(a(3, 8), midi)).toBe('plus_tard')
  })

  it('chaque phase et chaque stade ont leur libellé dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const ns = JSON.parse(readFileSync(`src/i18n/locales/${langue}/pipeline.json`, 'utf-8')) as {
        phases: { noms: Record<string, string>; stades: Record<string, string> }
      }
      for (const p of PHASES) {
        expect(ns.phases.noms[p.id], `${langue} : phase ${p.id}`).toBeTruthy()
        for (const s of p.stades) expect(ns.phases.stades[s], `${langue} : stade ${s}`).toBeTruthy()
      }
    }
  })
})
