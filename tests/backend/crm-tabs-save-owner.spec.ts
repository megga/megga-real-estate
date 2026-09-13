// crm_tabs_save — une pile ne s'écrit que dans la ligne de SON compte, sous SON
// agence (20260913160500, audit S11).
//
// Deux fenêtres d'erreur que ce paramètre ferme : une page restée sur A alors que
// le jeton du stockage est déjà celui de B (p_owner), et un compte qui a changé
// d'agence et dont la page réécrirait la pile de l'ancienne (p_agency). Chaque
// refus a son contrôle positif (la même écriture, bien adressée, passe), et
// l'appel historique sans ces paramètres reste accepté.
//
// La migration est aussi REJOUÉE deux fois : deploy.yml réapplique toute
// migration du jour à chaque push, et un `create function` nu y lèverait 42723.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PILE = [{ id: 't1', path: '/dashboard/contacts', search: '', label: 'Contacts', section: 'contacts' }]

describe.skipIf(!HAS_KEYS)('crm_tabs_save — p_owner / p_agency', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await service.from('crm_open_tabs').delete().in('user_id', [setup.agentAId, setup.agentBId])
    await setup.cleanup()
  })

  it('la migration se rejoue deux fois sans erreur (une seule signature en sortie)', () => {
    // Chemin relatif à la racine du dépôt : vitest tourne avec le cwd à la racine.
    const sql = readFileSync('supabase/migrations/20260913160500_crm_tabs_save_owner.sql', 'utf8')
    expect(() => execSql(sql)).not.toThrow()
    expect(() => execSql(sql)).not.toThrow()
  })

  it('CONTRÔLE POSITIF : A écrit sa pile avec p_owner = A et p_agency = son agence', async () => {
    const { error } = await setup.clientA.rpc('crm_tabs_save', {
      p_tabs: PILE, p_active: 0, p_owner: setup.agentAId, p_agency: setup.agencyAId,
    })
    expect(error).toBeNull()
    const { data } = await service.from('crm_open_tabs').select('tabs').eq('user_id', setup.agentAId).single()
    expect(JSON.stringify(data?.tabs)).toContain('Contacts')
  })

  it('p_owner d’un AUTRE compte : 42501, et la ligne de B n’est pas touchée', async () => {
    const avant = await service.from('crm_open_tabs').select('tabs, revision').eq('user_id', setup.agentBId).maybeSingle()
    const { error } = await setup.clientA.rpc('crm_tabs_save', {
      p_tabs: [{ id: 'x', path: '/dashboard/contacts/intrus', search: '', label: 'Intrus' }], p_active: 0, p_owner: setup.agentBId,
    })
    expect(error?.code).toBe('42501')
    const apres = await service.from('crm_open_tabs').select('tabs, revision').eq('user_id', setup.agentBId).maybeSingle()
    expect(apres.data).toEqual(avant.data)
  })

  it('p_agency d’une AUTRE agence : 42501 ; la bonne agence passe', async () => {
    const refus = await setup.clientA.rpc('crm_tabs_save', {
      p_tabs: PILE, p_active: 0, p_owner: setup.agentAId, p_agency: setup.agencyBId,
    })
    expect(refus.error?.code).toBe('42501')
    const ok = await setup.clientA.rpc('crm_tabs_save', {
      p_tabs: PILE, p_active: 0, p_owner: setup.agentAId, p_agency: setup.agencyAId,
    })
    expect(ok.error).toBeNull()
  })

  it('l’appel historique, sans p_owner ni p_agency, reste accepté (client antérieur)', async () => {
    const { error } = await setup.clientB.rpc('crm_tabs_save', { p_tabs: PILE, p_active: 0 })
    expect(error).toBeNull()
  })
})
