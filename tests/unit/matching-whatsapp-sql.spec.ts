/**
 * La migration du lot D2 (`…_matching_whatsapp.sql`), LUE — ses specs de base (`tests/backend/matching-whatsapp.spec.ts`)
 * ne tournent qu'en CI, contre une base locale.
 *
 * Ce que cette spec refuse, sans base :
 *   · une `matching_actions_agence` qui aurait divergé du corps de `matching_actions_du_jour` (lot D1) — deux
 *     définitions des actions du jour feraient dire deux choses au point du matin et à « Aujourd'hui » ;
 *   · une fonction d'écriture du copilote qui ne signerait pas MEGGA AI, qu'un utilisateur pourrait appeler, ou qui
 *     lirait ou écrirait hors de l'agence passée (match, acheteur, bien, profil) ;
 *   · une copie du fil (motifs de refus, référence du bien) qui aurait divergé de l'original — confrontée aux
 *     fonctions réelles importées (MOTIFS_REFUS, refBienInterne, refAnnonceMarche), jamais retapée ;
 *   · un verrou de ligne sur l'acheteur là où un verrou consultatif est requis (deux cycles d'interblocage
 *     établis à la lecture des déclencheurs, cf. le commentaire du SQL) ;
 *   · une désignation en base qui ne serait plus un sur-ensemble de `candidats` (un cas numérique qui perdrait
 *     l'attique « 4 p. »), ou qui lirait hors de l'agence, de l'acheteur ou des statuts passés ;
 *   · une migration qui passerait AVANT celle de D1 au redatage du jour de la fusion.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { MOTIFS_REFUS } from '@/components/matching-fil/filBoucle'
import { refAnnonceMarche, refBienInterne } from '@/lib/matchingGestes'
import { LIMITE_ECHO, STATUTS_COMPATIBLES, STATUTS_DE_DEPART, STATUT_D_ARRIVEE } from '../../supabase/functions/_shared/whatsapp-matching'

// Le module des gestes n'est importé ici que pour ses deux fonctions PURES (refBienInterne, refAnnonceMarche) — ni
// l'une ni l'autre ne touche `supabase`. Les mocks ne servent qu'à permettre le CHARGEMENT du module (mêmes noms que
// tests/unit/matching-fil-gestes.spec.ts, qui importe déjà ce module sous vitest).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))

const DOSSIER = join(process.cwd(), 'supabase/migrations')

function migration(suffixe: string): { nom: string; sql: string } {
  const noms = readdirSync(DOSSIER).filter((n) => n.endsWith(suffixe))
  expect(noms, suffixe).toHaveLength(1)
  return { nom: noms[0], sql: readFileSync(join(DOSSIER, noms[0]), 'utf8') }
}

/** L'en-tête et le corps d'une fonction : de sa création à `as $$`, puis jusqu'au `$$;` qui le ferme. */
function fonction(sql: string, nom: string): { entete: string; corps: string } {
  const i = sql.indexOf(`create or replace function public.${nom}(`)
  expect(i, `${nom} introuvable`).toBeGreaterThanOrEqual(0)
  const as = sql.indexOf('as $$', i)
  const fin = sql.indexOf('$$;', as + 5)
  return { entete: sql.slice(i, as), corps: sql.slice(as + 5, fin) }
}

/** Comme `fonction`, pour un corps délimité par `$function$` (log_match_reaction, 20260930140000_matching_boucle.sql). */
function fonctionDollarFunction(sql: string, nom: string): { entete: string; corps: string } {
  const i = sql.indexOf(`create or replace function public.${nom}(`)
  expect(i, `${nom} introuvable`).toBeGreaterThanOrEqual(0)
  const as = sql.indexOf('as $function$', i)
  expect(as, `${nom} : délimiteur $function$ introuvable`).toBeGreaterThanOrEqual(0)
  const fin = sql.indexOf('$function$;', as + 5)
  return { entete: sql.slice(i, as), corps: sql.slice(as + 'as $function$'.length, fin) }
}

/** Sans commentaires ni blancs superflus : deux corps se comparent sur ce qu'ils exécutent. */
const nu = (s: string) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()

describe('lot D2 — la migration : les actions du jour d’une agence', () => {
  const d1 = migration('_matching_surfaces.sql')
  const d2 = migration('_matching_whatsapp.sql')

  it('passe après la migration de D1 au redatage : son suffixe est postérieur', () => {
    // Le jour de la fusion, chaque lot garde son suffixe (HHMMSS) : c'est lui qui ordonne la pile.
    expect(d2.nom.slice(8, 14) > d1.nom.slice(8, 14)).toBe(true)
  })

  it('matching_actions_agence est le corps de D1, l’agence en paramètre — rien d’autre ne change', () => {
    const avant = nu(fonction(d1.sql, 'matching_actions_du_jour').corps)
    expect(avant).toContain('select public.get_user_agency_id() as id')
    expect(nu(fonction(d2.sql, 'matching_actions_agence').corps))
      .toBe(avant.replace('select public.get_user_agency_id() as id', 'select p_agency as id'))
    expect(fonction(d2.sql, 'matching_actions_agence').entete).toMatch(/security invoker/)
  })

  it('matching_actions_agence rend le même type que matching_actions_du_jour (D1), colonne à colonne', () => {
    // À partir de `returns` seulement : le nom de fonction et sa liste d'arguments diffèrent légitimement (l'agence
    // en paramètre) ; deux colonnes de même type permuté ne le seraient pas.
    const depuisReturns = (entete: string) => {
      const i = entete.indexOf('returns')
      expect(i).toBeGreaterThan(0)
      return nu(entete.slice(i))
    }
    expect(depuisReturns(fonction(d2.sql, 'matching_actions_agence').entete))
      .toBe(depuisReturns(fonction(d1.sql, 'matching_actions_du_jour').entete))
  })

  it('matching_actions_du_jour n’est plus que l’enveloppe, sur l’agence de l’appelant', () => {
    expect(nu(fonction(d2.sql, 'matching_actions_du_jour').corps))
      .toBe('select * from public.matching_actions_agence(public.get_user_agency_id(), p_limite);')
  })
})

/** Une fonction d'écriture du copilote : MEGGA AI signe, et le rôle de service seul l'appelle. */
function signeeEtReservee(sql: string, nom: string): void {
  const f = fonction(sql, nom)
  const corps = nu(f.corps)
  expect(f.entete).toMatch(/security definer/)
  expect(f.entete).toMatch(/set search_path to 'public', 'pg_temp'/)
  // Cherchés dans le corps NORMALISÉ (nu) : les autres fonctions d'écriture posent aussi ces trois réglages, avec
  // leurs propres commentaires et retours à la ligne autour — la forme brute ne doit pas y être sensible.
  expect(corps).toContain(`perform set_config('app.actor_kind', 'ai', true);`)
  expect(corps).toContain(`perform set_config('app.actor_via', 'whatsapp', true);`)
  expect(corps).toContain(`perform set_config('app.actor_profile_id', p_profile::text, true);`)
  expect(sql).toMatch(new RegExp(`revoke all on function public\\.${nom}\\([^)]*\\) from public, anon, authenticated;`))
  expect(sql).toMatch(new RegExp(`grant execute on function public\\.${nom}\\([^)]*\\) to service_role;`))
}

describe('lot D2 — la migration : consigner une réponse', () => {
  const d2 = migration('_matching_whatsapp.sql')

  it('wa_matching_consigner : MEGGA AI signe, et le rôle de service seul l’appelle', () => {
    signeeEtReservee(d2.sql, 'wa_matching_consigner')
  })

  it('le match et son acheteur se lisent dans l’agence passée, jamais ailleurs', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)
    expect(corps).toContain('where m.id = p_match and m.agency_id = p_agency for update')
    expect(corps).toContain('where c.id = v_match.contact_id and c.agency_id = p_agency')
  })

  it('le bien, le deal et la relance sont ancrés sur l’agence passée ; le profil aussi, avant toute écriture', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)
    // Le bien — la forme COMPLÈTE de la garde : la chaîne du WHERE seule apparaît aussi dans v_titre/v_ref,
    // donc retirer la garde (en gardant ces deux lectures) laisserait un `toContain` plus court vert à tort.
    expect(corps).toContain(
      "if v_match.property_id is not null and not exists ( select 1 from public.properties p where p.id = v_match.property_id and p.agency_id = p_agency ) then return jsonb_build_object('ok', false); end if;",
    )
    // Le profil (avant toute écriture).
    expect(corps).toContain('pr.id = p_profile and pr.agency_id = p_agency')
    // Le deal et la relance, revérifiés ici avec les deux nouveaux (le bien et le profil).
    expect(corps).toContain('t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id')
    expect(corps).toContain('r.agency_id = p_agency and r.contact_id = v_match.contact_id')
  })

  it('le statut de départ et le statut d’arrivée de chaque réponse (whatsapp-matching.ts) sont ceux que la fonction garde et écrit', () => {
    // Deux copies du SQL côté copilote : `STATUTS_DE_DEPART` choisit les matchs où le bien se cherche,
    // `STATUT_D_ARRIVEE` sépare « déjà consignée » de « a changé » quand la base n'écrit rien.
    const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)
    const liste = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(', ')
    expect(STATUTS_DE_DEPART.propose).toHaveLength(1)
    expect(corps).toContain(
      `update public.matches set status = '${STATUT_D_ARRIVEE.propose}', sent_via = 'agent', sent_at = now() where id = p_match and status = '${STATUTS_DE_DEPART.propose[0]}';`,
    )
    expect(STATUTS_DE_DEPART.interesse).toHaveLength(1)
    expect(corps).toContain(
      `update public.matches set status = '${STATUT_D_ARRIVEE.interesse}', reaction_motif = null, reaction_note = null, apprentissage_at = null where id = p_match and status = '${STATUTS_DE_DEPART.interesse[0]}';`,
    )
    expect(corps).toContain(`update public.matches set status = '${STATUT_D_ARRIVEE.pas_interesse}', reaction_motif = p_motif,`)
    expect(corps).toContain(`where id = p_match and status in (${liste(STATUTS_DE_DEPART.pas_interesse)});`)
    // « Pas encore » n'écrit aucun statut : sa garde est le seul endroit où il en lit un.
    expect(STATUT_D_ARRIVEE.pas_encore).toBeNull()
    expect(STATUTS_DE_DEPART.pas_encore).toHaveLength(1)
    expect(corps).toContain(
      `if v_match.status <> '${STATUTS_DE_DEPART.pas_encore[0]}' then return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status); end if;`,
    )
  })

  it('l’acheteur est sérialisé par un verrou CONSULTATIF, jamais par un verrou de ligne (deux cycles d’interblocage)', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)
    // La lecture du contact, isolée : ni `for update`, ni aucune autre clause de verrou de ligne.
    const lectureContact = corps.match(/from public\.contacts c where [^;]+;/)
    expect(lectureContact, 'lecture du contact introuvable').not.toBeNull()
    expect(lectureContact![0]).not.toMatch(/\bfor (no key update|update|share|key share)\b/)
    // Le verrou consultatif qui la remplace, clé neutre (`wa_matching_visite` la reprend à l'identique).
    expect(corps).toContain(
      `perform pg_advisory_xact_lock(hashtextextended('wa_matching_acheteur:' || v_match.contact_id::text, 0));`,
    )
  })
})

/**
 * Une copie n'a de sens que confrontée à l'original (conception, principe 4). Les deux copies du fil dans
 * `wa_matching_consigner` : la liste des motifs de refus (MOTIFS_REFUS, filBoucle) et la référence du bien
 * (refBienInterne / refAnnonceMarche, matchingGestes) — importées ici pour de vrai, jamais retapées.
 */
describe('lot D2 — la migration : les copies du fil, confrontées à l’original', () => {
  const d2 = migration('_matching_whatsapp.sql')
  const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)

  it('les motifs de refus acceptés par la fonction sont exactement MOTIFS_REFUS du fil', () => {
    const m = corps.match(/p_motif not in \(([^)]+)\)/)
    expect(m, 'liste des motifs introuvable dans le SQL').not.toBeNull()
    const motifs = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    expect(motifs).toEqual([...MOTIFS_REFUS])
  })

  it('v_ref reprend refBienInterne / refAnnonceMarche du fil, mesurés sur les mêmes exemples', () => {
    expect(corps).toContain("'MG-IN-' || upper(left(p.id::text, 6))")
    expect(corps).toContain(
      "'MG-' || case when ml.source_portal = 'flatfox' then 'FL' else 'MK' end || '-' || coalesce(ml.source_id, left(ml.id::text, 6))",
    )
    // L'original, sur les exemples de la conception : la copie SQL n'a de sens que si ce format est bien le sien.
    const id = 'abcdef12-0000-0000-0000-000000000000'
    expect(refBienInterne(id)).toBe('MG-IN-ABCDEF')
    expect(refAnnonceMarche('flatfox', 'xyz123', id)).toBe('MG-FL-xyz123')
    expect(refAnnonceMarche('realadvisor', null, id)).toBe('MG-MK-abcdef')
  })
})

describe('lot D2 — la migration : la visite du copilote', () => {
  const d2 = migration('_matching_whatsapp.sql')

  it.each(['wa_matching_visite', 'wa_matching_visite_annuler'])('%s : MEGGA AI signe, et le rôle de service seul l’appelle', (nom) => {
    signeeEtReservee(d2.sql, nom)
  })

  it('la visite lit le contact, le mandat, le match et le deal dans l’agence ; l’annulation ne touche que l’agence passée', () => {
    const visite = nu(fonction(d2.sql, 'wa_matching_visite').corps)
    expect(visite).toContain('where c.id = p_contact and c.agency_id = p_agency')
    expect(visite).toContain('where p.id = p_property and p.agency_id = p_agency and p.deleted_at is null')
    expect(visite).toContain('m.agency_id = p_agency and m.contact_id = p_contact')
    expect(visite).toContain('t.agency_id = p_agency and t.contact_buyer_id = p_contact')
    const annuler = nu(fonction(d2.sql, 'wa_matching_visite_annuler').corps)
    // `[^;]*?` — jamais `.*?` : après `nu()` (une seule ligne), un point paresseux traverse un `;` sans effort et
    // irait chercher SA condition d'agence dans le `where` de l'INSTRUCTION SUIVANTE. C'est réel pour `matches`
    // (bornée par le `;` d'après, sinon le test passerait même sans `and agency_id = p_agency` sur CETTE ligne, en
    // empruntant celle, plus loin, de l'update des transactions) — et structurellement pareil pour `transactions`,
    // qui ne le montre pas seulement parce qu'elle est la DERNIÈRE écriture de la fonction : rien à emprunter après
    // elle, aujourd'hui. `visits` et `calendar_events` n'ont pas de clause `set`, donc jamais engagé ce `[^;]*?`.
    for (const table of ['visits', 'calendar_events', 'matches', 'transactions']) {
      expect(annuler, table).toMatch(new RegExp(`(?:from|update) public\\.${table} (?:set [^;]*? )?where id = v_\\w+ and agency_id = p_agency`))
    }
  })

  it('la garde du profil précède le premier verrou de ligne, dans les deux fonctions', () => {
    const gardeProfil = "if p_profile is not null and not exists ( select 1 from public.profiles pr where pr.id = p_profile and pr.agency_id = p_agency )"
    const visite = nu(fonction(d2.sql, 'wa_matching_visite').corps)
    const iGardeVisite = visite.indexOf(gardeProfil)
    const iForUpdateVisite = visite.indexOf('for update')
    expect(iGardeVisite, 'garde du profil introuvable dans wa_matching_visite').toBeGreaterThan(-1)
    expect(iForUpdateVisite, 'for update introuvable dans wa_matching_visite').toBeGreaterThan(-1)
    expect(iGardeVisite).toBeLessThan(iForUpdateVisite)

    // wa_matching_visite_annuler ne pose aucun verrou de ligne (delete/update simples) : la garde doit précéder sa
    // première écriture, la borne analogue à « avant le premier for update ».
    const annuler = nu(fonction(d2.sql, 'wa_matching_visite_annuler').corps)
    const iGardeAnnuler = annuler.indexOf(gardeProfil)
    const iPremiereEcriture = annuler.indexOf('delete from public.visits')
    expect(iGardeAnnuler, 'garde du profil introuvable dans wa_matching_visite_annuler').toBeGreaterThan(-1)
    expect(iPremiereEcriture, 'première écriture introuvable dans wa_matching_visite_annuler').toBeGreaterThan(-1)
    expect(iGardeAnnuler).toBeLessThan(iPremiereEcriture)
  })

  it('l’ordre des verrous est le même dans les deux fonctions : le match, PUIS ce verrou, PUIS le deal', () => {
    const ordre = (corps: string, cle: string) => {
      const verrou = `perform pg_advisory_xact_lock(hashtextextended('wa_matching_acheteur:' || ${cle}::text, 0));`
      const iMatch = corps.indexOf('for update')
      const iVerrou = corps.indexOf(verrou)
      const iDeal = corps.indexOf('from public.transactions t')
      expect(iMatch, 'verrou du match introuvable').toBeGreaterThan(-1)
      expect(iVerrou, 'verrou consultatif introuvable').toBeGreaterThan(-1)
      expect(iDeal, 'accès au deal introuvable').toBeGreaterThan(-1)
      expect(iMatch).toBeLessThan(iVerrou)
      expect(iVerrou).toBeLessThan(iDeal)
    }
    ordre(nu(fonction(d2.sql, 'wa_matching_consigner').corps), 'v_match.contact_id')
    ordre(nu(fonction(d2.sql, 'wa_matching_visite').corps), 'p_contact')
  })

  it('la garde du profil de wa_matching_visite est complète ; la lecture du contact n’a pas de verrou de ligne', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_visite').corps)
    expect(corps).toContain(
      "if p_profile is not null and not exists ( select 1 from public.profiles pr where pr.id = p_profile and pr.agency_id = p_agency ) then return jsonb_build_object('ok', false, 'raison', 'profil'); end if;",
    )
    const lectureContact = corps.match(/from public\.contacts c where [^;]+;/)
    expect(lectureContact, 'lecture du contact introuvable').not.toBeNull()
    expect(lectureContact![0]).not.toMatch(/\bfor (no key update|update|share|key share)\b/)
  })
})

/**
 * Le chemin ANNONCE de `wa_matching_visite` pose un `calendar_events` sous le rôle de service, où `auth.uid()` est
 * nul — sans redéfinition, la fonction du 15.09 signerait `system`, jamais MEGGA AI. La redéfinition doit garder
 * tout ce qui ne parle pas de l'acteur (confronté au corps du 15.09) et déterminer l'acteur EXACTEMENT comme
 * `log_match_reaction` (confronté à son corps réel, pas à une attente réécrite ici).
 */
describe('lot D2 — la migration : calendar_events_journaliser signe MEGGA AI, jamais system sous le rôle de service', () => {
  const d2 = migration('_matching_whatsapp.sql')
  const quinze = migration('_calendar_events.sql')
  const boucle = migration('_matching_boucle.sql')
  const avant = nu(fonction(quinze.sql, 'calendar_events_journaliser').corps)
  const apres = nu(fonction(d2.sql, 'calendar_events_journaliser').corps)
  const modele = nu(fonctionDollarFunction(boucle.sql, 'log_match_reaction').corps)

  it('même signature, security definer, search_path vide : son CREATE OR REPLACE se rejoue sans erreur', () => {
    const entete = fonction(d2.sql, 'calendar_events_journaliser').entete
    expect(entete).toMatch(/returns trigger/)
    expect(entete).toMatch(/security definer/)
    expect(entete).toMatch(/set search_path = ''/)
    expect(d2.sql).toMatch(
      /revoke all on function public\.calendar_events_journaliser\(\) from public, anon, authenticated;/,
    )
  })

  it('tout ce qui ne parle pas de l’acteur est repris À L’IDENTIQUE du 15.09', () => {
    const inchange = [
      'if v_ligne.contact_id is null and v_ligne.property_id is null then return null; end if;',
      'if not exists (select 1 from public.agencies a where a.id = v_ligne.agency_id) then return null; end if;',
      "from jsonb_object_keys(to_jsonb(new)) as k where k not in ('updated_at', 'created_by', 'calendar_label_id') and to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;",
      'if jsonb_array_length(v_changees) = 0 then return null; end if;',
      "case tg_op when 'INSERT' then 'calendar_event_created' when 'UPDATE' then 'calendar_event_updated' else 'calendar_event_deleted' end,",
      "case when v_ligne.contact_id is not null then 'contact' else 'property' end,",
      'coalesce(v_ligne.contact_id, v_ligne.property_id),',
      "case when v_ligne.contact_id is not null then 'contact' else 'bien' end,",
      "jsonb_strip_nulls(jsonb_build_object( 'event_id', v_ligne.id, 'type', v_ligne.type, 'starts_at', to_char(v_ligne.starts_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'changed', v_changees))",
      'insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)',
    ]
    for (const fragment of inchange) {
      expect(avant, `absent du 15.09 : ${fragment}`).toContain(fragment)
      expect(apres, `perdu depuis le 15.09 : ${fragment}`).toContain(fragment)
    }
  })

  it('l’ancien acteur (le seul auth.uid()) a disparu de la redéfinition', () => {
    expect(avant).toContain('v_acteur uuid := auth.uid();')
    expect(avant).toContain("v_ligne.agency_id, v_acteur, case when v_acteur is null then 'system' else 'user' end,")
    expect(apres).not.toContain('v_acteur')
  })

  it('l’acteur nouveau reprend EXACTEMENT le modèle de log_match_reaction, terme à terme', () => {
    const commun = [
      "nullif(current_setting('app.actor_kind', true), '')",
      "nullif(current_setting('app.actor_via', true), '')",
      "nullif(current_setting('app.actor_profile_id', true), '')",
      "v_kind := case when v_guc_kind in ('ai', 'system', 'user') then v_guc_kind when v_uid is null then 'system' else 'user' end;",
      "v_actor := case when v_kind = 'user' then v_uid else null end;",
      "if v_via is not null then v_meta := v_meta || jsonb_build_object('via', v_via); end if;",
      "if v_profile is not null then v_meta := v_meta || jsonb_build_object('profile_id', v_profile); end if;",
    ]
    for (const fragment of commun) {
      expect(modele, `absent de log_match_reaction, ce n'est donc pas SON modèle : ${fragment}`).toContain(fragment)
      expect(apres, `absent de la redéfinition : ${fragment}`).toContain(fragment)
    }
    // L'insertion signe avec les variables nouvelles, jamais avec l'ancien acteur.
    expect(apres).toContain('v_ligne.agency_id, v_actor, v_kind,')
  })

  it('dérive future : la DERNIÈRE redéfinition (par nom de fichier) de calendar_events_journaliser lit encore app.actor_kind, dans SON corps', () => {
    // Si une migration future la redéfinissait à partir du corps du 15.09 sans savoir qu'il est périmé, elle
    // effacerait la signature MEGGA AI en silence : les tests ci-dessus ne comparent qu'à `quinze` et `d2`, tous
    // deux figés au moment où ce fichier est écrit — ils ne verraient jamais un TROISIÈME fichier plus récent.
    //
    // Deux angles morts que ce test ferme :
    //   (a) un marqueur sensible à la casse et fermé aux guillemets manquerait une redéfinition future en
    //       MAJUSCULES non citées (`CREATE OR REPLACE FUNCTION PUBLIC.CALENDAR_EVENTS_JOURNALISER(`, que PostgreSQL
    //       replie en minuscules), au style pg_dump (`"public"."calendar_events_journaliser"`) ou sans `or replace`
    //       après un `drop` — elle resterait invisible, et le test validerait une redéfinition plus ANCIENNE.
    //   (b) chercher `app.actor_kind` dans TOUT LE FICHIER porteur, pas dans le seul corps de CETTE définition,
    //       passerait à tort si le même fichier porte une AUTRE fonction qui lit ce réglage pour une tout autre
    //       raison — un cas réel dans ce dépôt (`log_match_reaction`, `capture_transaction_lifecycle`…).
    const marqueur = /create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\.)?"?calendar_events_journaliser"?\s*\(/i
    const fichiers = readdirSync(DOSSIER).filter((n) => n.endsWith('.sql')).sort()
    const porteurs = fichiers.filter((n) => marqueur.test(readFileSync(join(DOSSIER, n), 'utf8')))
    expect(porteurs.length, 'aucune migration ne définit calendar_events_journaliser').toBeGreaterThan(0)
    const dernier = porteurs[porteurs.length - 1]
    const sqlDernier = readFileSync(join(DOSSIER, dernier), 'utf8')
    const debut = marqueur.exec(sqlDernier)
    expect(debut, `${dernier} : la définition détectée en amont est introuvable en aval`).not.toBeNull()
    // Le délimiteur RÉEL de CETTE définition ($$, $function$…) : jamais supposé, toujours lu après le `as`.
    const tag = /as\s+(\$[a-zA-Z_]*\$)/i.exec(sqlDernier.slice(debut!.index))
    expect(tag, `${dernier} : délimiteur de corps introuvable après ${debut![0]}`).not.toBeNull()
    const debutCorps = debut!.index + tag!.index + tag![0].length
    const finCorps = sqlDernier.indexOf(tag![1], debutCorps)
    expect(finCorps, `${dernier} : fin du corps (second ${tag![1]}) introuvable`).toBeGreaterThan(-1)
    const corps = sqlDernier.slice(debutCorps, finCorps)
    expect(corps, `${dernier} : le corps de la dernière redéfinition ne lit plus app.actor_kind`).toContain(
      "current_setting('app.actor_kind'",
    )
  })
})

/**
 * `wa_matching_biens_designes` fait tourner la désignation par texte EN BASE, sur l'agence ENTIÈRE (jamais un
 * échantillon TS) : mandats et annonces ENSEMBLE, jamais l'un puis l'autre à défaut — un mandat ne masque jamais SEUL
 * une annonce qui répond aussi (conception §3, principe 5).
 */
describe('lot D2 — la migration : désigner un bien par un texte, EN BASE', () => {
  const d2 = migration('_matching_whatsapp.sql')

  it('une lecture stable, security invoker, réservée au SEUL service_role — jamais authenticated (son seul appelant est le copilote)', () => {
    const entete = fonction(d2.sql, 'wa_matching_biens_designes').entete
    expect(entete).toMatch(/\bstable\b/)
    expect(entete).toMatch(/security invoker/)
    expect(entete).toMatch(/set search_path to 'public', 'pg_temp'/)
    expect(d2.sql).toMatch(
      /revoke all on function public\.wa_matching_biens_designes\([^)]*\) from public, anon, authenticated;/,
    )
    expect(d2.sql).toMatch(
      /grant execute on function public\.wa_matching_biens_designes\([^)]*\) to service_role;/,
    )
    // Jamais accordée à `authenticated`, contrairement à `matching_actions_agence` : pas par nécessité de sécurité
    // (sous un jeton, la RLS de properties/matches bornerait de toute façon la lecture à SON agence) mais parce que
    // son seul appelant réel, le copilote WhatsApp, lit toujours par le rôle de service.
    expect(d2.sql).not.toMatch(
      /grant execute on function public\.wa_matching_biens_designes\([^)]*\) to [^;]*\bauthenticated\b/,
    )
  })

  it('les deux branches s’ancrent sur p_agency : le mandat (properties) ET l’annonce, par ses matchs', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    expect(corps).toContain('p.agency_id = p_agency')
    expect(corps).toContain('m.agency_id = p_agency')
  })

  it('un mandat SUPPRIMÉ (deleted_at posé) est écarté', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    expect(corps).toContain('p.deleted_at is null')
  })

  it('seuls les statuts COMPATIBLES désignent une annonce — exactement STATUTS_COMPATIBLES (whatsapp-matching.ts), en deux branches OR pour utiliser deux index partiels', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    const m = corps.match(/m\.status = '([a-z_]+)' or m\.status in \(([^)]+)\)/)
    expect(m, 'les deux branches de statuts introuvables dans le SQL').not.toBeNull()
    const reste = m![2].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    expect([m![1], ...reste]).toEqual([...STATUTS_COMPATIBLES])
  })

  it('chaque mot se compare en lower(unaccent(x)), jamais unaccent(lower(x)) — sûr sous tout ctype ; % et _ neutralisés comme search_cities', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    // Deux branches (mandat, annonce), chacune avec 2 lower(unaccent(…)) : le texte complet (titre+adresse+ville), et
    // le mot cherché.
    expect(corps.match(/lower\(unaccent\(/g) ?? []).toHaveLength(4)
    expect(corps).not.toMatch(/unaccent\(lower\(/)
    expect(corps).toContain("lower(unaccent(concat_ws(' ', p.title, p.address, p.city)))")
    expect(corps).toContain("lower(unaccent(concat_ws(' ', ml.title, ml.address, ml.city)))")
    // Comme 20260707140000_matching_city_filter.sql (search_cities) : % et _ neutralisés AVANT unaccent/lower,
    // jamais laissés filer dans le LIKE.
    expect(corps.match(/replace\(replace\(w, '%', ''\), '_', ''\)/g) ?? []).toHaveLength(2)
  })

  it('aucun cas NUMÉRIQUE dans le corps : un nombre se cherche dans titre + adresse + ville, comme tout mot', () => {
    // `candidats` garde un bien dont le TITRE porte le nombre (« Attique 4 p. ») : un nombre cherché ici dans la seule
    // adresse ferait de ce SQL un SOUS-ensemble, et perdrait en base ce bien avant que `candidats` ne puisse le
    // garder. Mesuré le 25.09.2026 : 1 184 des 1 806 biens désignables de l'agence WhatsApp (ses mandats et les
    // annonces qu'elle suit) portent un chiffre dans leur titre.
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    expect(corps).not.toMatch(/~\*?\s*'/)
    expect(corps).not.toMatch(/\[0-9\]|\\d/)
    expect(corps).not.toMatch(/\bcase\b/)
  })

  it('la limite est bornée entre 1 et 200, 50 par défaut', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_biens_designes').corps)
    expect(corps).toContain('limit least(greatest(coalesce(p_limite, 50), 1), 200);')
  })
})

/**
 * `wa_matching_biens_de_l_acheteur` désigne un bien parmi ceux d'UN acheteur, au statut que sa réponse suppose : ce
 * que `record_match_outcome` peut viser. Sous le rôle de service, la RLS ne borne rien — ses ancrages sur l'agence,
 * l'acheteur et les statuts sont ses seules gardes, et le bien d'un match y est son MANDAT d'abord, comme `idBien`.
 */
describe('lot D2 — la migration : désigner un bien parmi ceux d’UN acheteur, EN BASE', () => {
  const d2 = migration('_matching_whatsapp.sql')
  const f = fonction(d2.sql, 'wa_matching_biens_de_l_acheteur')
  const corps = nu(f.corps)

  it('une lecture stable, security invoker, search_path fixé, réservée au SEUL service_role — jamais authenticated', () => {
    expect(f.entete).toMatch(/language sql/)
    // Sans volatilité déclarée, une fonction est VOLATILE : une lecture se déclare `stable`, comme §5.
    expect(f.entete).toMatch(/\bstable\b/)
    expect(f.entete).toMatch(/security invoker/)
    expect(f.entete).toMatch(/set search_path to 'public', 'pg_temp'/)
    expect(d2.sql).toMatch(
      /revoke all on function public\.wa_matching_biens_de_l_acheteur\(uuid, uuid, text\[\], text\[\], integer\) from public, anon, authenticated;/,
    )
    expect(d2.sql).toMatch(
      /grant execute on function public\.wa_matching_biens_de_l_acheteur\(uuid, uuid, text\[\], text\[\], integer\) to service_role;/,
    )
    expect(d2.sql).not.toMatch(
      /grant execute on function public\.wa_matching_biens_de_l_acheteur\([^)]*\) to [^;]*\bauthenticated\b/,
    )
  })

  it('rend, pour chaque bien, l’id de son match : la ligne que l’exécuteur lit', () => {
    expect(nu(f.entete)).toContain('returns table ( match_id uuid, genre text, id uuid, titre text, adresse text, ville text )')
  })

  // Les clauses se comparent ENTIÈRES, jamais par sous-chaîne : un `or …` ajouté derrière la chaîne attendue rouvrirait
  // toutes les agences sans rien retirer de ce qu'un `toContain` cherche. Un repère disparu donne un morceau faux, que
  // les comparaisons ci-dessous refusent.
  const entre = (de: string, a: string | null): string =>
    corps.slice(corps.indexOf(de), a == null ? undefined : corps.indexOf(a, corps.indexOf(de) + de.length)).trim()
  const projection = entre('select m.id as match_id', ' from public.matches m')
  const jointures = entre('from public.matches m', ' cross join lateral (')
  const lateral = entre('cross join lateral (', ' where m.agency_id')
  const clauseWhere = entre('where m.agency_id', ' order by')
  const fin = entre('order by', null)

  it('le corps est exactement ses cinq clauses, bout à bout : rien ne s’y glisse entre elles', () => {
    expect([projection, jointures, lateral, clauseWhere, fin].join(' ')).toBe(corps)
    expect(projection).toBe('select m.id as match_id, b.genre, b.id, b.titre, b.adresse, b.ville')
  })

  it('le mandat est celui de l’agence, non supprimé ; l’annonce ne se joint qu’à un match SANS mandat', () => {
    // Un match peut porter les deux ids : son bien est son mandat (`idBien`). Sans `m.property_id is null`, un
    // mandat supprimé ou hors agence serait nommé par l'annonce qu'il porte aussi.
    expect(jointures).toBe(
      'from public.matches m left join public.properties p on p.id = m.property_id and p.agency_id = p_agency and p.deleted_at is null left join public.market_listings ml on m.property_id is null and ml.id = m.market_listing_id',
    )
  })

  it('le bien d’un match, colonne par colonne : son mandat s’il se résout, sinon son annonce — jamais un mélange des deux', () => {
    expect(lateral).toBe(
      "cross join lateral ( select case when p.id is not null then 'mandat' else 'annonce' end as genre, coalesce(p.id, ml.id) as id, case when p.id is not null then p.title else ml.title end as titre, case when p.id is not null then p.address else ml.address end as adresse, case when p.id is not null then p.city else ml.city end as ville ) b",
    )
  })

  it('la clause `where` entière : l’agence passée, CET acheteur, ses statuts, un bien résolu, au moins un mot, et chacun contenu', () => {
    expect(clauseWhere).toBe(
      "where m.agency_id = p_agency and m.contact_id = p_contact and m.status = any (p_statuts) and (p.id is not null or ml.id is not null) and coalesce(array_length(p_mots, 1), 0) > 0 and not exists ( select 1 from unnest(p_mots) as mot(w) where lower(unaccent(concat_ws(' ', b.titre, b.adresse, b.ville))) not like '%' || lower(unaccent(replace(replace(w, '%', ''), '_', ''))) || '%' )",
    )
  })

  it('chaque mot en lower(unaccent(x)), jamais unaccent(lower(x)), % et _ neutralisés — et aucun cas numérique, comme §5', () => {
    expect(corps.match(/lower\(unaccent\(/g) ?? []).toHaveLength(2)
    expect(corps).not.toMatch(/unaccent\(lower\(/)
    expect(corps).not.toMatch(/~\*?\s*'/)
    expect(corps).not.toMatch(/\[0-9\]|\\d/)
  })

  it('le meilleur score d’abord, puis l’id du match ; la limite bornée entre 1 et LIMITE_ECHO + 1, 50 par défaut', () => {
    // Les biens que l'exécuteur relit pour un écho (LIMITE_ECHO), et la ligne qui dit la coupe : plafonnée plus bas,
    // une demande de LIMITE_ECHO + 1 rendrait LIMITE_ECHO lignes, et une lecture coupée passerait pour complète.
    expect(f.entete).toMatch(/p_limite integer default 50/)
    expect(fin).toBe(`order by m.score desc, m.id limit least(greatest(coalesce(p_limite, 50), 1), ${LIMITE_ECHO + 1});`)
  })
})
