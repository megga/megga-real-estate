// Backend integration spec (live CI) — étape 23 : le contrat des GESTES, balayé.
//
// §10.7 demande « tests par RPC : nominal · chaque garde-fou · idempotence (2 appels = 1
// effet) · ligne admin_log présente · refus JWT agent ». Écrire neuf jeux à la main les
// couvrirait AUJOURD'HUI et laisserait le dixième geste sans filet. Ce fichier DÉCOUVRE les
// gestes au lieu de les lister : celui qu'on ajoutera demain entre automatiquement dans le
// balayage, et y échoue s'il rompt le contrat.
//
// ── POURQUOI CE FICHIER EXISTE, ET CE QU'IL AURAIT ATTRAPÉ ──────────────────────────
// Un défaut est parti en production le 01.08 : trois gestes réservaient leur clé
// d'idempotence AVANT des contrôles qui pouvaient répondre `admin_error`. Or un `return`
// COMMITTE — la clé restait consommée alors que rien n'avait eu lieu, et le réessai rendait
// `already_done` : un FAUX SUCCÈS. L'utilisateur croyait son geste fait, il ne l'était pas.
//
// Les specs de chaque étape testaient pourtant l'idempotence. Elles testaient le chemin
// HEUREUX (deux appels identiques réussis), jamais le chemin de REFUS. C'est exactement
// l'angle mort qu'un balayage générique ferme : il ne teste pas ce qu'on a pensé à tester,
// il teste une PROPRIÉTÉ sur tout le monde.
//
// Le contrôle est STATIQUE : ces gestes ont des effets (invalider un lien, publier une
// nouveauté). On ne les déclenche pas en boucle pour éprouver un invariant que leur SOURCE
// suffit à établir.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/**
 * Un GESTE de console = une fonction qui écrit dans le registre. C'est la définition la
 * plus fidèle : §10.7 parle des RPC mutantes, et le dépôt les reconnaît à ce qu'elles
 * laissent une trace. Les fonctions de LECTURE (get_admin_*) n'écrivent pas et sortent
 * naturellement du périmètre, sans avoir à les nommer.
 */
const GESTES = `(
  n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and p.prosrc like '%admin_log_write%'
  and p.proname <> 'admin_log_write'
  and p.proname !~ '^admin_log_chain'
  -- ⚠ AJOUTÉ par la revue du Lot 2, et c'est une PROPRIÉTÉ, pas une exemption nommée.
  -- Les quatre contrats balayés ici — enveloppe §10.1, clé d'idempotence, scellement,
  -- garde — décrivent ce que la CONSOLE appelle. Un cron n'a pas d'écran à qui rendre une
  -- enveloppe et ne reçoit pas de double-clic : il rend un compte à pg_cron. Faire entrer
  -- changelog_publish_due dans ce périmètre (ce que sa journalisation, correcte, a
  -- provoqué) lui aurait imposé un contrat qui ne le concerne pas.
  --
  -- Il reste couvert ailleurs, et mieux : sa garde est éprouvée par
  -- admin-rpc-guard-sweep, son inaccessibilité à \`authenticated\` est asservie dans
  -- admin-changelog-workflow, et sa ligne de registre y est vérifiée par comportement.
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
)`

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('contrat des gestes de console (étape 23)', () => {
  it('le balayage porte sur un périmètre non vide (garde anti-test creux)', () => {
    // Sans cette assertion, un prédicat qui ne matcherait plus rien rendrait tout le
    // fichier vert sur zéro fonction — le motif exact du vert sans assertion, rencontré
    // deux fois sur ce chantier.
    assertSql(`
    declare v_n int;
    begin
      select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where ${GESTES};
      if v_n < 8 then
        raise exception 'perimetre suspect : % gestes trouves (>= 8 attendus)', v_n;
      end if;
    `)
  })

  it('LA CLÉ D\'IDEMPOTENCE N\'EST JAMAIS BRÛLÉE PAR UN REFUS', () => {
    // LE test de ce fichier. Un `return public.admin_error(...)` situé APRÈS
    // `admin_receipt_try` committe la transaction en laissant la clé consommée : le réessai
    // rend `already_done` alors que RIEN n'a eu lieu. C'est le défaut du 01.08.
    //
    // L'ordre imposé est donc : contrôles d'abord, réservation ensuite. Une fois la clé
    // prise, un geste ne peut plus que réussir ou LEVER (ce qui annule tout).
    assertSql(`
    declare v_fautifs text;
    begin
      select string_agg(p.proname || ' (' || n_refus || ' refus apres reservation)', ', ' order by p.proname)
        into v_fautifs
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral (
          select count(*) as n_refus
            from regexp_matches(
              substr(p.prosrc, position('admin_receipt_try' in p.prosrc)),
              'return\\s+public\\.admin_error', 'g')
        ) r(n_refus)
       where ${GESTES}
         and position('admin_receipt_try' in p.prosrc) > 0
         and n_refus > 0;

      if v_fautifs is not null then
        raise exception E'Cle d idempotence BRULEE par un refus metier : %\\n'
          '  Un "return admin_error" apres "admin_receipt_try" COMMITTE : la cle reste\\n'
          '  consommee alors que le geste n a pas eu lieu, et le reessai rend un FAUX\\n'
          '  SUCCES (already_done). Ordre impose : controles PUIS reservation.', v_fautifs;
      end if;
    `)
  })

  it('tout geste qui réserve une clé la SCELLE aussi', () => {
    // Un reçu sans empreinte ne dit pas ce qui a été fait : il ne prouve que « quelque
    // chose a eu lieu ». §4.2 demande un result_hash, pas un jeton nu.
    assertSql(`
    declare v_fautifs text;
    begin
      select string_agg(p.proname, ', ' order by p.proname) into v_fautifs
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where ${GESTES}
         and p.prosrc like '%admin_receipt_try%'
         and p.prosrc not like '%admin_receipt_seal%';
      if v_fautifs is not null then
        raise exception 'geste(s) reservant une cle sans jamais la sceller : %', v_fautifs;
      end if;
    `)
  })

  it('tout geste est GARDÉ', () => {
    // Volontairement STATIQUE et rien de plus. Vérifier ici que la garde est « la première
    // instruction » demanderait une heuristique de position dans le source — fragile, et
    // qui rougirait sur une mise en forme plutôt que sur un défaut. Le fait qu'une garde
    // REFUSE réellement est déjà prouvé, comportementalement, par
    // admin-rpc-guard-sweep.spec.ts, qui appelle chaque RPC sous un rôle sans JWT.
    // Dupliquer ce contrôle ici en moins bon n'aurait ajouté que du bruit.
    assertSql(`
    declare v_nues text;
    begin
      select string_agg(p.proname, ', ' order by p.proname) into v_nues
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where ${GESTES}
         and p.prosrc not like '%is_super_admin%'
         and p.prosrc not like '%is_service_role%';
      if v_nues is not null then
        raise exception 'geste(s) SANS garde : %', v_nues;
      end if;
    `)
  })

  it('aucune RPC admin n\'écrit HORS du registre — hors dette nommée', () => {
    // ⚠ CE TEST A ÉCHOUÉ À SA PREMIÈRE EXÉCUTION, et ce qu'il a trouvé est RÉEL : huit RPC
    // super-admin écrivent sans laisser de ligne au registre MEGGA. Mesuré : elles
    // journalisent toutes, mais dans `activity_events`. Or c'est l'autre journal — celui
    // qui raconte ce que font les AGENCES. Ces huit-là sont des actions de MEGGA SUR une
    // agence (changer un plan, des quotas, un rôle, trancher un dossier KYB). Les écrire
    // là :
    //   · les laisse HORS de la chaîne d'empreintes (activity_events n'en a pas) ;
    //   · les rend invisibles à l'écran Sécurité, qui lit admin_log ;
    //   · verse une action MEGGA dans le flux propre de l'agence.
    //
    // Le plan le sait déjà : les cinq KYB sont l'étape 19b (« + écriture admin_log famille
    // kyb »), `set_role` l'étape 18, les deux réglages d'agence la famille 17. Toutes
    // bloquées par des décisions PO. Ce n'est donc pas à l'étape 23 de les corriger — mais
    // ce n'était pas non plus une raison d'affaiblir le test jusqu'à ce qu'il se taise.
    //
    // D'où un CLIQUET plutôt qu'une exemption : la dette est nommée, et le test rougit dans
    // les DEUX sens. Un neuvième geste clandestin le fait échouer ; un remboursement laissé
    // dans la liste aussi. La liste ne peut que rétrécir.
    const DETTE = [
      // étape 19b — décisions KYB, famille `kyb`
      'admin_validate_agency_review', 'admin_reject_agency_review',
      'admin_request_agency_correction', 'admin_relaunch_agency_review',
      'admin_resolve_agency_id_document',
      // étape 18 — utilisateurs
      'admin_set_user_role',
      // famille étape 17 — réglages d'agence
      'admin_set_agency_plan', 'admin_set_agency_quotas',
    ]
    assertSql(`
    declare v_nouveaux text; v_rembourses text;
    begin
      with dette(nom) as (values ${DETTE.map((n) => `('${n}')`).join(', ')}),
      clandestins as (
        select p.proname
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
           -- ⚠ ELARGI par la revue du Lot 2. Ce predicat portait sur le seul prefixe du
           -- NOM, alors que tout le reste de ce fichier definit ses perimetres par une
           -- PROPRIETE. Le cout etait reel et mesure : changelog_publish_due publie une
           -- nouveaute a TOUS les agents sans laisser de ligne au registre, et passait
           -- sous le cliquet parce qu elle ne s appelle pas admin_*. Une fonction de la
           -- console se reconnait a ce qu elle TOUCHE, pas a la facon dont on l a nommee.
           and (p.proname ~ '^admin_'
                or p.prosrc ~* '(insert into|update) public\\.(admin_|rpc_receipts|outbox_jobs)')
           and p.prosrc ~* '(insert into|update) public\\.'
           and p.prosrc not like '%admin_log_write%'
           -- Le registre lui-meme et ses outils : ils SONT le journal, ils ne s y ecrivent pas.
           and p.proname !~ '^admin_log'
           and p.proname not in ('admin_receipt_try', 'admin_receipt_seal',
                                 'admin_outbox_enqueue', 'admin_outbox_claim', 'admin_outbox_settle')
      )
      select (select string_agg(proname, ', ' order by proname) from clandestins
               where proname not in (select nom from dette)),
             (select string_agg(nom, ', ' order by nom) from dette
               where nom not in (select proname from clandestins))
        into v_nouveaux, v_rembourses;

      if v_nouveaux is not null then
        raise exception E'RPC admin qui ECRIT sans laisser de ligne au registre MEGGA : %\\n'
          '  activity_events ne compte pas : il raconte ce que font les AGENCES, et il n a\\n'
          '  pas de chaine d empreintes. Une action de MEGGA passe par admin_log_write.', v_nouveaux;
      end if;

      if v_rembourses is not null then
        raise exception E'DETTE REMBOURSEE — retire ces noms de la liste DETTE du spec : %\\n'
          '  Elles journalisent desormais (ou n existent plus). Une liste d exceptions qui\\n'
          '  ne retrecit pas finit par exempter du code qui n en a plus besoin.', v_rembourses;
      end if;
    `)
  })

  it('tout geste rend l\'enveloppe §10.1, jamais une valeur nue', () => {
    // `{ ok, … }` partagé : l'appelant teste une seule clé. Un geste qui rendrait un uuid
    // ou un booléen nu obligerait l'écran à connaître sa forme particuliere.
    assertSql(`
    declare v_fautifs text;
    begin
      select string_agg(p.proname || ' -> ' || pg_get_function_result(p.oid), ', ' order by p.proname)
        into v_fautifs
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where ${GESTES}
         and pg_get_function_result(p.oid) <> 'jsonb'
         -- UNE seule exception, mesuree : admin_log_console_entry est anterieure au contrat
         -- 10.1 (Lot 0) et rend l uuid de la ligne ecrite. 10.1 dit explicitement que les
         -- RPC EXISTANTES gardent leur contrat d origine. Une premiere version de ce test
         -- en listait ONZE : les dix autres ne sont meme pas dans le perimetre, et une
         -- liste d exceptions qui s allonge sans raison vide le test de son sens.
         and p.proname <> 'admin_log_console_entry';
      if v_fautifs is not null then
        raise exception 'geste(s) hors enveloppe 10.1 : %', v_fautifs;
      end if;
    `)
  })

  it('les exceptions restent RARES — sinon le balayage ne prouve plus rien', () => {
    // Le garde-fou du garde-fou. Une exception s ajoute consciemment ou pas du tout.
    assertSql(`
    declare v_hors_enveloppe int;
    begin
      select count(*) into v_hors_enveloppe
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where ${GESTES} and pg_get_function_result(p.oid) <> 'jsonb';
      if v_hors_enveloppe > 1 then
        raise exception '% gestes hors enveloppe : le contrat 10.1 se delite', v_hors_enveloppe;
      end if;
    `)
  })
})
