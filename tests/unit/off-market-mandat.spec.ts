/**
 * L'interrupteur Off-market d'un mandat (lot C, décision de Julien du 22.09.2026). « Réseau Off-market » dans
 * « Nouveau bien » écrit `off_market` — sur le brouillon automatique comme à la mise en service ; « Publier » ne
 * l'écrit pas.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_WIZARD } from '@/components/crm-wizard/tokens'
import { wizardPayload } from '@/components/crm-wizard/useWizardDraft'

describe('wizardPayload et l’off-market', () => {
  it('« Réseau Off-market » écrit off_market, brouillon compris', () => {
    const data = { ...EMPTY_WIZARD, addr: 'Route de Florissant 62', visibility: 'network' as const }
    expect(wizardPayload(data, 'active').off_market).toBe(true)
    expect(wizardPayload(data, 'draft').off_market).toBe(true)
  })
  it('« Publier » ne l’écrit pas', () => {
    expect(wizardPayload({ ...EMPTY_WIZARD, addr: 'Rue du Lac 14' }, 'active').off_market).toBe(false)
  })
})
