// Lecteur client de `admin_overview()` — ce que l'écran doit tenir SANS la base.
//
// Trois propriétés valent d'être éprouvées ici, parce que chacune correspond à un
// défaut qui a failli partir :
//   1. `sectionPath` : le serveur émet `kyb` quand la route s'appelle `kyb-review`,
//      et la modale de diagnostic renvoie vers `security`. Une cible fausse ne
//      lève rien — elle tombe sur `<Route path="*">`, donc sur une redirection
//      silencieuse. Un test « un jeton inconnu rend l'accueil » serait VERT sur
//      exactement ce défaut : il faut asserter chaque cible NOMMÉMENT.
//   2. le regroupement du journal : `last` doit être le maximum, pas la première
//      ligne rencontrée, sinon le tri par sévérité fait afficher une date arbitraire.
//   3. la lecture défensive : `mrr` est un `numeric`, que PostgREST peut rendre en
//      CHAÎNE — un `.toFixed()` direct dessus casserait la page.

import { describe, it, expect } from 'vitest'
import {
  readAdminOverview,
  sectionPath,
  groupJournal,
  journalDetail,
  rankTone,
  JOURNAL_ACTION_KEY,
  SIGNAL_LABEL_KEY,
  type OverviewJournalRow,
} from '@/lib/adminOverview'

const ligne = (o: Partial<OverviewJournalRow> & { action: string; ts: string }): OverviewJournalRow => ({
  id: `id-${o.ts}`,
  severity: 'info',
  category: null,
  agency_name: null,
  actor_label: null,
  actor_kind: null,
  entity_type: null,
  object_label: null,
  ...o,
})

describe('sectionPath — chaque cible est assertée nommément', () => {
  it('traduit le jeton serveur `kyb` vers la route réelle `kyb-review`', () => {
    expect(sectionPath('kyb')).toBe('/dashboard/admin/kyb-review')
  })

  it('connaît `security`, cible de la modale de diagnostic KYC', () => {
    expect(sectionPath('security')).toBe('/dashboard/admin/security')
  })

  it('connaît les trois autres jetons émis par le serveur', () => {
    expect(sectionPath('monitoring')).toBe('/dashboard/admin/monitoring')
    expect(sectionPath('plans')).toBe('/dashboard/admin/plans')
    expect(sectionPath('agencies')).toBe('/dashboard/admin/agencies')
  })

  it('replie un jeton inconnu sur l’accueil de la console, jamais sur une cible nue', () => {
    expect(sectionPath('inconnu')).toBe('/dashboard/admin')
    // La garde qui compte : le repli ne doit pas être la concaténation naïve.
    expect(sectionPath('kyb')).not.toBe('/dashboard/admin/kyb')
  })
})

describe('readAdminOverview — défensif sur une réponse partielle', () => {
  it('rend une forme complète sur `null`', () => {
    const o = readAdminOverview(null)
    expect(o.pulse.healthy).toBe(false)
    expect(o.kpis.agencies).toBe(0)
    expect(o.signals).toEqual([])
    expect(o.journal).toEqual([])
    expect(o.unavailable).toEqual([])
  })

  it('accepte un `mrr` rendu en CHAÎNE par PostgREST', () => {
    const o = readAdminOverview({ kpis: { mrr: '338.00' }, revenue: { mrr: '338.00', arpu: '169' } })
    expect(o.kpis.mrr).toBe(338)
    expect(o.revenue.arpu).toBe(169)
  })

  it('normalise les chaînes vides en null (jsonb_strip_nulls ne les couvre pas)', () => {
    const o = readAdminOverview({ journal: [{ id: 'a', ts: 'x', action: 'y', severity: 'info', agency_name: '' }] })
    expect(o.journal[0].agency_name).toBeNull()
  })
})

describe('groupJournal', () => {
  it('prend le MAXIMUM des horodatages, pas la première ligne rencontrée', () => {
    const familles = groupJournal([
      ligne({ action: 'match_suggested', ts: '2026-08-01T10:00:00Z' }),
      ligne({ action: 'match_suggested', ts: '2026-08-03T09:00:00Z' }),
    ])
    expect(familles).toHaveLength(1)
    expect(familles[0].count).toBe(2)
    expect(familles[0].last).toBe('2026-08-03T09:00:00Z')
  })

  it('dédoublonne les agences et retient la sévérité la plus grave', () => {
    const familles = groupJournal([
      ligne({ action: 'role_changed', ts: '2026-08-03T08:00:00Z', agency_name: 'A', severity: 'info' }),
      ligne({ action: 'role_changed', ts: '2026-08-03T09:00:00Z', agency_name: 'A', severity: 'critical' }),
      ligne({ action: 'role_changed', ts: '2026-08-03T07:00:00Z', agency_name: 'B', severity: 'info' }),
    ])
    expect(familles[0].agencies.sort()).toEqual(['A', 'B'])
    expect(familles[0].tone).toBe('critical')
  })

  it('classe le critique avant l’info, et la récence départage à sévérité égale', () => {
    const familles = groupJournal([
      ligne({ action: 'match_suggested', ts: '2026-08-03T10:00:00Z' }),
      ligne({ action: 'role_changed', ts: '2026-08-01T10:00:00Z', severity: 'critical' }),
      ligne({ action: 'agency_created', ts: '2026-08-03T11:00:00Z' }),
    ])
    expect(familles.map(f => f.action)).toEqual(['role_changed', 'agency_created', 'match_suggested'])
  })

  it('masque l’entrée en console, seule ligne `warn` que le filtre serveur laisse passer', () => {
    const rows = [
      ligne({ action: 'admin_console_entered', ts: '2026-08-03T12:00:00Z', severity: 'warn' }),
      ligne({ action: 'match_suggested', ts: '2026-08-03T09:00:00Z' }),
    ]
    expect(groupJournal(rows).map(f => f.action)).toEqual(['match_suggested'])
    expect(journalDetail(rows).map(r => r.action)).toEqual(['match_suggested'])
  })
})

describe('les clés de libellé visent les chaînes que la base porte RÉELLEMENT', () => {
  // Mesuré en production : ce sont les cinq familles du journal. Deux portent un
  // point, une porte le préfixe `whatsapp_agent_`. Une clé devinée s'afficherait
  // en brut, et aucune porte du dépôt ne le verrait.
  it.each([
    'match_suggested',
    'agency_created',
    'contact_scores.recompute',
    'property_scores.recompute',
    'whatsapp_agent_copilot_reply',
  ])('connaît « %s »', action => {
    expect(JOURNAL_ACTION_KEY[action]).toBeTruthy()
  })

  it('couvre les trois signaux que le serveur sait émettre', () => {
    for (const kind of ['functions_error', 'payments_failed', 'kyb_review']) {
      expect(SIGNAL_LABEL_KEY[kind]).toBeTruthy()
    }
  })
})

describe('rankTone', () => {
  it('ordonne critical < warn < info', () => {
    expect(rankTone('critical')).toBeLessThan(rankTone('warn'))
    expect(rankTone('warn')).toBeLessThan(rankTone('info'))
    expect(rankTone('inconnu')).toBe(rankTone('info'))
  })
})
