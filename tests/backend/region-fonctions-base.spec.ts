// Backend integration spec (live CI) — la base appelle les Edge Functions dans SA région.
//
// Mesuré en production le 13.09.2026 : 8 des 3 945 appels partis de la base en 24 h se sont
// exécutés à Francfort ou à Zurich, dont une synchronisation de la Messagerie — sans épingle,
// une fonction tourne dans la région la plus proche de l'appelant, pas forcément la sienne.
// 20260914080000 épingle les 27 sites (16 commandes pg_cron, 11 fonctions SQL).
//
// Ce fichier est le CLIQUET côté base fraîche : une migration future qui recrée une de ces
// fonctions depuis un ancien fichier — ou en ajoute une — avec une URL de fonction sans
// `?forceFunctionRegion=` fait rougir la CI.
//
// ⚠ pg_cron n'est pas installé sur la base de CI : les commandes cron y sont comptées s'il
// apparaît un jour, mais elles ne s'éprouvent aujourd'hui qu'en production (sonde de la PR,
// oracle d'après fusion).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Bloc PL/pgSQL qui range dans `n` le nombre d'URL de fonction sans épingle de la base. */
const COMPTER = `
  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and case when p.prokind in ('f', 'p') then pg_get_functiondef(p.oid) ~ '/functions/v1/[a-z0-9-]+''' else false end;
  if to_regclass('cron.job') is not null then
    execute 'select $1 + count(*)::int from cron.job where command ~ $2' into n using n, '/functions/v1/[a-z0-9-]+''';
  end if;`

describe.skipIf(!HAS_KEYS)('région des Edge Functions — les appels de la base', () => {
  it('aucune fonction SQL ni commande cron ne remet à pg_net une URL de fonction sans épingle', () => {
    expect(() => execSql(`do $bloc$
declare n int;
begin
  ${COMPTER}
  if n > 0 then
    raise exception '% appel(s) de fonction sans ?forceFunctionRegion= dans la base migrée', n;
  end if;
end $bloc$;`)).not.toThrow()
  })

  it('contrôle positif : le compte voit une URL de fonction sans épingle', () => {
    // La fonction-sonde naît et meurt dans le même bloc : l'exception finale annule tout.
    // Balises nommées : `$b$$f$` contiendrait `$$`, qui refermerait un bloc `do $$`.
    expect(() => execSql(`do $bloc$
declare n int;
begin
  execute $f$ create function public.zz_region_sonde() returns text language sql as $b$ select '/functions/v1/sonde'::text $b$ $f$;
  ${COMPTER}
  raise exception 'SONDE >>> %', n;
end $bloc$;`)).toThrow(/SONDE >>> [1-9]/)
  })
})
