// GRANTS — `TRUNCATE` hors de portée d'`anon` et d'`authenticated`, et journal
// d'audit réellement inaltérable.
//
// Régression du §7 de l'audit RLS du 03.08.2026. Ce fichier ne teste PAS la RLS :
// il teste la couche EN DESSOUS. `TRUNCATE` n'est pas une opération
// ligne-à-ligne — aucune policy ne le filtre, et le trigger d'immutabilité
// `enforce_activity_events_immutability()` étant FOR EACH ROW, il ne le voit pas
// passer non plus. Les deux verrous censés protéger le journal LBA sont aveugles
// à la seule commande capable de le vider d'un coup.
//
// D'où des tests par CAPACITÉ RÉELLE (SET ROLE + tentative, en transaction
// annulée) plutôt que par lecture du catalogue : ce qui compte est ce que le rôle
// peut faire, pas ce que information_schema en dit.
//
// Corrigé par 20260803160000_revoke_truncate_journal_audit.sql.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

/** Tente une commande sous un rôle donné, toujours annulée. */
function attemptAs(role: string, sql: string): void {
  execSql(`begin; set local role ${role}; ${sql}; rollback;`)
}

describe('GRANTS — TRUNCATE et journal d’audit', () => {
  it('authenticated NE PEUT PAS truncate activity_events (RLS et trigger sont aveugles à TRUNCATE)', () => {
    expect(() =>
      attemptAs('authenticated', 'truncate table public.activity_events'),
    ).toThrow()
  })

  it('anon NE PEUT PAS truncate activity_events', () => {
    expect(() => attemptAs('anon', 'truncate table public.activity_events')).toThrow()
  })

  // CONTRÔLE POSITIF — sans lui, les deux tests ci-dessus passeraient tout aussi
  // bien si TRUNCATE échouait pour une raison étrangère (une FK référençant la
  // table, par exemple). Il prouve que la commande est bien exécutable en soi, et
  // que seul le privilège distingue les cas.
  it('service_role PEUT truncate activity_events — le refus vient du privilège, pas de la commande', () => {
    expect(() => attemptAs('service_role', 'truncate table public.activity_events')).not.toThrow()
  })

  it('authenticated NE PEUT PAS update ni delete activity_events, au niveau privilège', () => {
    expect(() =>
      attemptAs('authenticated', "update public.activity_events set action = 'tampered'"),
    ).toThrow()
    expect(() => attemptAs('authenticated', 'delete from public.activity_events')).toThrow()
  })

  it('authenticated GARDE select et insert — ce dont events_select et events_insert ont besoin', () => {
    // Assertion de catalogue ici, et non de capacité : une tentative réelle
    // échouerait sur la RLS (auth.uid() nul sous un simple SET ROLE), pas sur le
    // privilège — elle ne dirait donc rien du GRANT, qui est l'objet du test.
    expect(() =>
      execSql(`
        do $$
        begin
          if not exists (
            select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'activity_events'
               and grantee = 'authenticated' and privilege_type = 'SELECT'
          ) then raise exception 'authenticated a perdu SELECT sur activity_events'; end if;
          if not exists (
            select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'activity_events'
               and grantee = 'authenticated' and privilege_type = 'INSERT'
          ) then raise exception 'authenticated a perdu INSERT sur activity_events'; end if;
        end $$;
      `),
    ).not.toThrow()
  })

  it('anon n’a plus AUCUN privilège sur activity_events', () => {
    expect(() =>
      execSql(`
        do $$
        declare v_count int;
        begin
          select count(*) into v_count
            from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'activity_events'
             and grantee = 'anon';
          if v_count > 0 then
            raise exception 'anon détient encore % privilège(s) sur activity_events', v_count;
          end if;
        end $$;
      `),
    ).not.toThrow()
  })

  it('la révocation de TRUNCATE couvre le reste du schéma, pas seulement le journal', () => {
    for (const table of ['contacts', 'kyc_cases', 'documents', 'seller_leads', 'subscriptions']) {
      expect(
        () => attemptAs('authenticated', `truncate table public.${table}`),
        `authenticated peut encore truncate ${table}`,
      ).toThrow()
    }
  })
})
