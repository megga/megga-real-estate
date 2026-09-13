// JETONS D'AGENDA — les colonnes secrètes hors de portée des rôles clients
// (20260913160600, audit du 13.09.2026, point S12).
//
// Deux couches, deux preuves :
//   1. le CATALOGUE : `has_column_privilege` / `has_table_privilege` disent ce qu'un
//      rôle peut tenter — c'est la couche que la migration change ;
//   2. le COMPORTEMENT : l'agent A, sur SA propre ligne (la RLS le laisse passer —
//      c'est le contrôle positif qui rend les refus non vacants), reçoit 42501 sur
//      refresh_token, sur select('*') et sur toute écriture. Un `[]` ne prouverait
//      rien : c'est la réponse d'une RLS, pas d'un GRANT.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSql } from './helpers/local-sql'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

/** Lève (via ON_ERROR_STOP) si l'assertion SQL est fausse, en nommant les coupables. */
function assertSql(sql: string): void {
  execSql(`do $$ declare v_list text; begin ${sql} end $$;`)
}

describe('JETONS D’AGENDA — catalogue', () => {
  it('aucun rôle client ne lit ni n’écrit access_token / refresh_token, ni n’écrit dans les tables', () => {
    expect(() =>
      assertSql(`
        select string_agg(r.rl || ':' || t.tb || '.' || c.col || ':' || p.pv, ', ') into v_list
          from (values ('google_calendar_tokens'), ('outlook_calendar_tokens')) t(tb)
          cross join (values ('refresh_token'), ('access_token')) c(col)
          cross join (values ('anon'), ('authenticated')) r(rl)
          cross join (values ('SELECT'), ('INSERT'), ('UPDATE')) p(pv)
         where has_column_privilege(r.rl, 'public.' || t.tb, c.col, p.pv);
        if v_list is not null then raise exception 'jeton à portée d''un rôle client : %', v_list; end if;
        select string_agg(r.rl || ':' || t.tb || ':' || p.pv, ', ') into v_list
          from (values ('google_calendar_tokens'), ('outlook_calendar_tokens')) t(tb)
          cross join (values ('anon'), ('authenticated')) r(rl)
          cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(pv)
         where has_table_privilege(r.rl, 'public.' || t.tb, p.pv);
        if v_list is not null then raise exception 'écriture ouverte à un rôle client : %', v_list; end if;`),
    ).not.toThrow()
  })

  it('CONTRÔLE POSITIF — authenticated lit l’état de sa connexion (user_id, *_email, sync_enabled)', () => {
    expect(() =>
      assertSql(`
        if not (has_column_privilege('authenticated', 'public.google_calendar_tokens', 'user_id', 'SELECT')
            and has_column_privilege('authenticated', 'public.google_calendar_tokens', 'google_email', 'SELECT')
            and has_column_privilege('authenticated', 'public.outlook_calendar_tokens', 'outlook_email', 'SELECT')
            and has_column_privilege('authenticated', 'public.outlook_calendar_tokens', 'sync_enabled', 'SELECT')) then
          raise exception 'l''état de connexion n''est plus lisible par l''agent';
        end if;`),
    ).not.toThrow()
  })

  it('les politiques d’écriture « own » ont disparu ; la lecture « own » reste', () => {
    expect(() =>
      assertSql(`
        select string_agg(policyname, ', ') into v_list from pg_policies
         where schemaname = 'public' and tablename in ('google_calendar_tokens', 'outlook_calendar_tokens')
           and cmd in ('INSERT', 'UPDATE', 'DELETE');
        if v_list is not null then raise exception 'politique d''écriture restante : %', v_list; end if;
        if (select count(*) from pg_policies where schemaname = 'public'
              and tablename in ('google_calendar_tokens', 'outlook_calendar_tokens') and cmd = 'SELECT') < 2 then
          raise exception 'la lecture own a disparu : l''agent ne verrait plus sa connexion';
        end if;`),
    ).not.toThrow()
  })
})

describe('JETONS D’AGENDA — comportement', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const { error } = await service.from('google_calendar_tokens').insert({
      user_id: setup.agentAId,
      access_token: 'AT_SECRET',
      refresh_token: 'RT_SECRET',
      // NOT NULL sans défaut, comme les trois colonnes ci-dessus.
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      google_email: 'agent-a@example.org',
      sync_enabled: true,
    })
    if (error) throw new Error(`seed google_calendar_tokens: ${error.message}`)
  })

  afterAll(async () => {
    await service.from('google_calendar_tokens').delete().eq('user_id', setup.agentAId)
    await setup.cleanup()
  })

  it('CONTRÔLE POSITIF — l’agent lit l’état de SA ligne (la RLS le laisse passer)', async () => {
    const { data, error } = await setup.clientA
      .from('google_calendar_tokens')
      .select('id, google_email, sync_enabled, last_sync_at')
      .eq('user_id', setup.agentAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.google_email).toBe('agent-a@example.org')
  })

  it('refresh_token et select(*) répondent 42501 — un refus de GRANT, pas un tableau vide', async () => {
    const rt = await setup.clientA.from('google_calendar_tokens').select('refresh_token').eq('user_id', setup.agentAId)
    expect(rt.error?.code).toBe('42501')
    const tout = await setup.clientA.from('google_calendar_tokens').select('*').eq('user_id', setup.agentAId)
    expect(tout.error?.code).toBe('42501')
  })

  it('l’agent ne peut ni insérer ni réécrire un jeton, même sur sa propre ligne', async () => {
    // Toutes les colonnes obligatoires fournies : seul le DROIT peut refuser cet INSERT.
    const ins = await setup.clientA.from('outlook_calendar_tokens').insert({
      user_id: setup.agentAId, access_token: 'X', refresh_token: 'Y',
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    expect(ins.error?.code).toBe('42501')
    const upd = await setup.clientA.from('google_calendar_tokens')
      .update({ refresh_token: 'RT_TIERS' }).eq('user_id', setup.agentAId)
    expect(upd.error?.code).toBe('42501')
    // Et la ligne n'a pas bougé.
    const { data } = await service.from('google_calendar_tokens').select('refresh_token').eq('user_id', setup.agentAId).single()
    expect(data?.refresh_token).toBe('RT_SECRET')
  })

  it('anon ne lit rien du tout', async () => {
    const { error } = await anonClient().from('google_calendar_tokens').select('id')
    expect(error?.code).toBe('42501')
  })

  it('CONTRÔLE POSITIF — le service_role (les edges d’agenda) lit toujours le jeton', async () => {
    const { data, error } = await service.from('google_calendar_tokens').select('refresh_token').eq('user_id', setup.agentAId).single()
    expect(error).toBeNull()
    expect(data?.refresh_token).toBe('RT_SECRET')
  })
})
