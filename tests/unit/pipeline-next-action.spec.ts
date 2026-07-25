// Unit test — « prochaine action » d'un deal = prochain reminder actif (Pipeline v2).
// Pinne le contrat de données introduit par la migration 20260721150000 :
//   - REMINDER_KIND_BY_TYPE : chaque type automation (8) retombe sur un kind UI,
//     et `kind` en colonne prime toujours sur ce repli.
//   - reminderToNextAction : trigger_at obligatoire (sinon null), note = message_template
//     trimé (vide accepté — l'UI retombe sur le libellé localisé du kind).
//   - Sélection « premier pending par transaction » : la liste arrive triée par
//     trigger_at ASC (usePipelineSugar), le premier rencontré gagne.
// Logique PURE : aucune dépendance Supabase/React → vitest jsdom.

import { describe, it, expect } from 'vitest'
import {
  REMINDER_KIND_BY_TYPE,
  reminderToNextAction,
  type PipelineReminderRow,
} from '@/lib/sugarAdapters'

const row = (over: Partial<PipelineReminderRow>): PipelineReminderRow => ({
  id: 'r-1',
  transaction_id: 'tx-1',
  type: 'custom',
  kind: null,
  trigger_at: '2026-07-23T10:00:00+00:00',
  message_template: 'Premier suivi',
  ...over,
})

describe('REMINDER_KIND_BY_TYPE — repli type → kind', () => {
  it('couvre les 8 types de reminders (aucun type sans kind)', () => {
    const types = [
      'follow_up_sent_property', 'post_visit_feedback', 'dormant_lead',
      'missing_document', 'price_change', 'custom', 'deal_stagnant', 'match_ignored',
    ]
    for (const t of types) {
      expect(REMINDER_KIND_BY_TYPE[t], `type sans kind: ${t}`).toBeTruthy()
    }
  })

  it('mappe vers les kinds UI attendus', () => {
    expect(REMINDER_KIND_BY_TYPE.follow_up_sent_property).toBe('match')
    expect(REMINDER_KIND_BY_TYPE.match_ignored).toBe('match')
    expect(REMINDER_KIND_BY_TYPE.post_visit_feedback).toBe('visit')
    expect(REMINDER_KIND_BY_TYPE.missing_document).toBe('kyc')
    expect(REMINDER_KIND_BY_TYPE.dormant_lead).toBe('call')
    expect(REMINDER_KIND_BY_TYPE.deal_stagnant).toBe('call')
    expect(REMINDER_KIND_BY_TYPE.price_change).toBe('note')
    expect(REMINDER_KIND_BY_TYPE.custom).toBe('note')
  })
})

describe('reminderToNextAction', () => {
  it('la colonne kind prime sur le repli type→kind', () => {
    const na = reminderToNextAction(row({ type: 'dormant_lead', kind: 'visit' }))
    expect(na?.kind).toBe('visit')
  })

  it('sans kind, retombe sur le mapping du type (inconnu → note)', () => {
    expect(reminderToNextAction(row({ type: 'deal_stagnant' }))?.kind).toBe('call')
    expect(reminderToNextAction(row({ type: 'type_futur_inconnu' }))?.kind).toBe('note')
  })

  it('sans trigger_at, pas de prochaine action (null)', () => {
    expect(reminderToNextAction(row({ trigger_at: null }))).toBeNull()
  })

  it('note = message_template trimé ; absent → chaîne vide (repli UI)', () => {
    expect(reminderToNextAction(row({ message_template: '  Rappeler Marie  ' }))?.note)
      .toBe('Rappeler Marie')
    expect(reminderToNextAction(row({ message_template: null }))?.note).toBe('')
  })

  it('porte reminderId et dueAt pour la replanification (Timeline)', () => {
    const na = reminderToNextAction(row({}))
    expect(na?.reminderId).toBe('r-1')
    expect(na?.dueAt).toBe('2026-07-23T10:00:00+00:00')
  })
})

describe('sélection premier-actif-par-transaction (contrat usePipelineSugar)', () => {
  it('sur une liste triée par trigger_at ASC, le premier rencontré par tx gagne', () => {
    // Reproduit la boucle de usePipelineSugar (Map.has → skip les suivants).
    const rows: PipelineReminderRow[] = [
      row({ id: 'r-early', transaction_id: 'tx-1', trigger_at: '2026-07-22T09:00:00+00:00' }),
      row({ id: 'r-late', transaction_id: 'tx-1', trigger_at: '2026-07-30T09:00:00+00:00' }),
      row({ id: 'r-other', transaction_id: 'tx-2', trigger_at: '2026-07-25T09:00:00+00:00' }),
      row({ id: 'r-no-tx', transaction_id: null }),
    ]
    const map = new Map<string, NonNullable<ReturnType<typeof reminderToNextAction>>>()
    for (const r of rows) {
      if (!r.transaction_id || map.has(r.transaction_id)) continue
      const na = reminderToNextAction(r)
      if (na) map.set(r.transaction_id, na)
    }
    expect(map.get('tx-1')?.reminderId).toBe('r-early')
    expect(map.get('tx-2')?.reminderId).toBe('r-other')
    expect(map.size).toBe(2)
  })
})
