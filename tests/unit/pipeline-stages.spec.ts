// Unit test — machine à états du pipeline (mapping 14 stades DB → 8 colonnes UI).
// Avant ce test, les transitions de stade n'étaient couvertes QUE comme effet de
// bord d'audit (tests/backend/instrumentation-structural.spec.ts : un UPDATE émet
// 'stage_change'). Rien ne pinnait l'enum des 14 stades, le collapse 14→8, ni la
// couverture exhaustive (zéro trou / zéro doublon). C'est de la logique PURE :
// aucune dépendance Supabase/React → vitest jsdom.
//
// Deux mappings parallèles co-existent et DIVERGENT volontairement :
//   - mapStage (Kanban, src/lib/sugarAdapters.ts) : 8 colonnes + 'lost' hors-grille,
//     to_recontact → 'to-qualify'.
//   - mapTransactionStageToStepper (fiche Deal v3, dealStepper.ts) : 8 cercles SANS
//     'lost', to_recontact → 'searching'.
// On pinne chacun avec ses propres attendus.

import { describe, it, expect } from 'vitest'
import { TRANSACTION_STAGES, type TransactionStage } from '@/lib/constants'
import { CRM_STAGES, CRM_STAGE_ORDER, type StageId } from '@/components/crm-sugar/tokens'
import { mapStage } from '@/lib/sugarAdapters'
import {
  mapTransactionStageToStepper,
  DEAL_STEPPER_ORDER,
  type DealStepperStage,
} from '@/components/crm-sugar-v3/dealStepper'

// ── Attendu canonique : chaque stade DB → colonne Kanban (mapStage) ──
// 14 stades. 'lost' sort de la grille des 8 colonnes mais reste un StageId valide.
const KANBAN_EXPECTED: Record<TransactionStage, StageId> = {
  new_lead:           'new-lead',
  to_qualify:         'to-qualify',
  active_search:      'searching',
  visit_planned:      'visit-scheduled',
  visit_done:         'visit-done',
  interest_confirmed: 'interest-confirmed',
  offer:              'offer',
  negotiation:        'offer',
  reserved:           'offer',
  financing:          'offer',
  notary:             'offer',
  signed:             'signed',
  lost:               'lost',
  to_recontact:       'to-qualify',
}

// ── Attendu canonique : chaque stade DB → cercle stepper (fiche Deal v3) ──
const STEPPER_EXPECTED: Record<TransactionStage, DealStepperStage> = {
  new_lead:           'new-lead',
  to_qualify:         'to-qualify',
  active_search:      'searching',
  visit_planned:      'visit-scheduled',
  visit_done:         'visit-done',
  interest_confirmed: 'interest-confirmed',
  offer:              'offer',
  negotiation:        'offer',
  reserved:           'offer',
  financing:          'offer',
  notary:             'offer',
  signed:             'signed',
  lost:               'new-lead',   // pas de cercle 'lost' → repli new-lead
  to_recontact:       'searching',  // DIVERGENCE volontaire vs Kanban
}

describe('enum des stades DB', () => {
  it('contient exactement les 14 stades canoniques', () => {
    expect(TRANSACTION_STAGES).toHaveLength(14)
  })

  it('n\'a aucun doublon', () => {
    expect(new Set(TRANSACTION_STAGES).size).toBe(TRANSACTION_STAGES.length)
  })

  it('expose 8 colonnes Kanban (CRM_STAGE_ORDER)', () => {
    expect(CRM_STAGE_ORDER).toHaveLength(8)
    expect(new Set(CRM_STAGE_ORDER).size).toBe(8)
  })

  it('chaque colonne Kanban est une clé connue de CRM_STAGES', () => {
    for (const col of CRM_STAGE_ORDER) {
      expect(CRM_STAGES).toHaveProperty(col)
    }
  })
})

describe('mapStage — 14 stades DB → colonne Kanban', () => {
  it.each(TRANSACTION_STAGES)('%s mappe vers la bonne colonne', (stage) => {
    expect(mapStage(stage)).toBe(KANBAN_EXPECTED[stage])
  })

  it('chaque résultat est un StageId valide (clé de CRM_STAGES)', () => {
    for (const stage of TRANSACTION_STAGES) {
      expect(CRM_STAGES).toHaveProperty(mapStage(stage))
    }
  })

  it('les 8 colonnes Kanban sont toutes atteintes par au moins un stade DB', () => {
    const reached = new Set(TRANSACTION_STAGES.map(mapStage))
    for (const col of CRM_STAGE_ORDER) {
      expect(reached.has(col)).toBe(true)
    }
  })

  it('aucun stade non-lost ne tombe hors des 8 colonnes (seul lost sort de la grille)', () => {
    for (const stage of TRANSACTION_STAGES) {
      if (stage === 'lost') continue
      expect(CRM_STAGE_ORDER).toContain(mapStage(stage))
    }
    expect(CRM_STAGE_ORDER).not.toContain(mapStage('lost'))
  })

  it('collapse de négociation : offer/negotiation/reserved/financing/notary → "offer"', () => {
    for (const s of ['offer', 'negotiation', 'reserved', 'financing', 'notary'] as const) {
      expect(mapStage(s)).toBe('offer')
    }
  })
})

describe('mapTransactionStageToStepper — 14 stades DB → cercle stepper', () => {
  it.each(TRANSACTION_STAGES)('%s mappe vers le bon cercle', (stage) => {
    expect(mapTransactionStageToStepper(stage)).toBe(STEPPER_EXPECTED[stage])
  })

  it('stepper = 8 cercles sans doublon', () => {
    expect(DEAL_STEPPER_ORDER).toHaveLength(8)
    expect(new Set(DEAL_STEPPER_ORDER).size).toBe(8)
  })

  it('chaque cercle du stepper est atteint par un stade DB', () => {
    const reached = new Set(TRANSACTION_STAGES.map(mapTransactionStageToStepper))
    for (const circle of DEAL_STEPPER_ORDER) {
      expect(reached.has(circle)).toBe(true)
    }
  })

  it('entrées hors-enum tolérées (null/undefined/legacy) → repli new-lead', () => {
    expect(mapTransactionStageToStepper(null)).toBe('new-lead')
    expect(mapTransactionStageToStepper(undefined)).toBe('new-lead')
    expect(mapTransactionStageToStepper('closed')).toBe('new-lead') // legacy DB
  })
})

describe('divergence assumée entre les deux mappings', () => {
  it('to_recontact : Kanban → to-qualify, stepper → searching', () => {
    expect(mapStage('to_recontact')).toBe('to-qualify')
    expect(mapTransactionStageToStepper('to_recontact')).toBe('searching')
  })

  it('lost : Kanban garde "lost", stepper retombe sur new-lead', () => {
    expect(mapStage('lost')).toBe('lost')
    expect(mapTransactionStageToStepper('lost')).toBe('new-lead')
  })
})
