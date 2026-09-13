/**
 * Accepter une invitation ne détruit plus l'agence que l'on quitte (audit du 13.09.2026,
 * point S9 — migrations 20260913160200 et 20260913160300, edge accept-team-invite).
 *
 * ⛔ LE DÉFAUT. `accept-team-invite` supprimait l'agence solo de l'invité dès qu'elle était
 * solo, créée par lui et sans autre membre — sans regarder ce qu'elle contenait. Les tables
 * en CASCADE partaient avec : deals sans contact, rappels, dossier KYB de l'agence. Rejoué en
 * production (transaction annulée) : trois des quatre agences solo qui ont un créateur
 * auraient disparu. PREUVE DE MUTATION, à refaire si l'on doute de ce fichier : contre l'edge
 * d'avant ce correctif, le premier test du scénario « invitation » échoue — l'agence et ses
 * trois lignes semées ont disparu après la réclamation.
 *
 * Trois étages, parce qu'aucun ne suffit seul :
 *   1. l'EDGE, de bout en bout : aperçu, refus 409 sans consentement, réclamation
 *      consentie, lien WhatsApp et profil IA ré-hébergés ;
 *   2. la FONCTION, cas par cas, en transaction annulée (execSql) — dont un CONTRÔLE POSITIF
 *      obligatoire : une fonction qui ne supprimerait jamais rien passerait tous les autres ;
 *   3. les DROITS : seul service_role exécute, et un agent reçoit 42501 — pas une erreur
 *      quelconque, qu'une faute de frappe dans le nom (PGRST202) produirait aussi.
 * Et `team_remove_member` : un membre retiré perd son lien WhatsApp vérifié.
 *
 * ⚠ Cas NON couvert, par décision : la clé étrangère composite. En fabriquer une exige un
 * index unique sur deux colonnes d'`agencies`, dont la construction verrouille la table
 * pendant toute la transaction. Aucune n'existe en production (67 clés, toutes simples) ; la
 * fonction la traite en fermé (`:composite_fk` retient l'agence).
 *
 * @sql-blocks-check — corps plpgsql analysés par scripts/check-spec-sql-blocks.mjs.
 *
 * skipIf(!HAS_KEYS) ne SKIP PAS en CI (backend.yml exporte SUPABASE_TEST_*) : lire le nombre
 * de tests exécutés, jamais le code de sortie.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PW = 'Test-Password-123!'
const ENDPOINT = `${URL}/functions/v1/accept-team-invite`

/** Signature exacte : les contrôles de droits la lisent, et une faute les rendrait creux. */
const SIG = 'public.release_empty_solo_agency(uuid, uuid, boolean)'
/**
 * psql tourne en `postgres`, sans JWT : la garde du corps (`is_service_role()`) refuserait.
 * Le réglage est LOCAL à la transaction, comme le pose PostgREST pour une requête de service.
 */
const SERVICE_CLAIMS = '{"role":"service_role"}'
const CLAIMS = `perform set_config('request.jwt.claims', '${SERVICE_CLAIMS}', true);`

/** Corps plpgsql complet (`declare … begin … end`), exécuté dans une transaction ANNULÉE. */
const runSql = (body: string) => execSql(`begin;\ndo $$\n${body}\n$$;\nrollback;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

/** Un refus doit venir de la GARDE nommée, jamais d'une faute de syntaxe. */
const refuseSql = (body: string, motif: RegExp) => {
  let msg = ''
  try { runSql(body) } catch (e) { msg = String((e as Error).message) }
  expect(msg, `ce SQL devait être refusé : ${body}`).not.toBe('')
  expect(msg, 'refusé, mais pas par la garde attendue').toMatch(motif)
}

interface ReleaseVerdict {
  released: boolean
  releasable: boolean
  reason: string | null
  blocking: string[]
  dry_run: boolean
}

interface TestUser {
  id: string
  email: string
  client: SupabaseClient
  /** Agence provisionnée à l'inscription (rôles agence), sinon null. */
  agencyId: string | null
}

let seq = 0
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${seq++}`
/** Numéro E.164 en chiffres seuls, dont les 9 derniers (normalize_phone) sont uniques. */
const freshPhone = (): string =>
  '41' + String(Date.now() % 1_000_000).padStart(6, '0') + String(seq++ % 1000).padStart(3, '0')

/** Statut et code métier d'un refus de `functions.invoke` (le corps vit dans `error.context`). */
async function refusEdge(error: unknown): Promise<{ status: number; code: string | null }> {
  const ctx = (error as { context?: Response } | null)?.context
  if (!ctx) return { status: 0, code: null }
  const body = (await ctx.json().catch(() => null)) as { error?: string } | null
  return { status: ctx.status, code: body?.error ?? null }
}

describe.skipIf(!HAS_KEYS)('S9 — l’agence quittée n’est libérée que vierge', () => {
  const userIds: string[] = []
  const agencyIds: string[] = []
  let svc: SupabaseClient

  /** Inscrit un compte par le vrai trigger, puis le connecte. */
  async function newUser(label: string, role: 'agent' | 'buyer'): Promise<TestUser> {
    const email = `s9-${label}-${stamp()}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `S9 ${label}`, role },
    })
    if (error) throw new Error(`createUser ${label}: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
    const agencyId = (prof?.agency_id as string | null | undefined) ?? null
    if (agencyId) agencyIds.push(agencyId)
    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin ${label}: ${sErr.message}`)
    return { id, email, client, agencyId }
  }

  /** Invitation de `host` vers l'e-mail de `invitee`, rendue avec son jeton. */
  async function invite(host: TestUser, email: string): Promise<{ id: string; token: string }> {
    const { data, error } = await svc
      .from('team_invitations')
      .insert({ agency_id: host.agencyId, email, role: 'agent', invited_by: host.id })
      .select('id, token')
      .single()
    if (error) throw new Error(`invitation: ${error.message}`)
    return data as { id: string; token: string }
  }

  const agencyExists = async (id: string): Promise<boolean> => {
    const { data } = await svc.from('agencies').select('id').eq('id', id).maybeSingle()
    return !!data
  }

  const agencyOf = async (userId: string): Promise<string | null> => {
    const { data } = await svc.from('profiles').select('agency_id').eq('id', userId).maybeSingle()
    return (data?.agency_id as string | null | undefined) ?? null
  }

  const releaseEvents = async (agencyId: string, action: string) => {
    const { data, error } = await svc
      .from('activity_events')
      .select('agency_id, actor_id, category, severity, metadata')
      .eq('action', action)
      .eq('entity_id', agencyId)
    if (error) throw new Error(`activity_events: ${error.message}`)
    return (data ?? []) as Array<{ agency_id: string | null; actor_id: string | null; category: string; severity: string; metadata: { blocking?: string[] } | null }>
  }

  beforeAll(async () => {
    svc = serviceRoleClient()
    // Le runtime local répond 503 tant que le worker n'est pas debout : ce 503 ne dirait
    // rien du contrat, mais une assertion de statut le prendrait pour une régression.
    await waitForEdgeWorker(ENDPOINT)
  }, 90_000)

  afterAll(async () => {
    // Les comptes d'abord : leurs profils référencent les agences (NO ACTION). Les traces
    // restent — activity_events est append-only, et s'en détache sans s'effacer.
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    for (const id of agencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. L'EDGE, de bout en bout
  // ═══════════════════════════════════════════════════════════════════════════
  describe('invitation acceptée depuis une agence qui porte des données', () => {
    let host: TestUser
    let invitee: TestUser
    let soloAgencyId: string
    let token = ''
    let invitationId = ''
    const seeded: { transaction: string; reminder: string; person: string } = { transaction: '', reminder: '', person: '' }
    let linkId = ''

    beforeAll(async () => {
      host = await newUser('hote', 'agent')
      invitee = await newUser('invite', 'agent')
      expect(invitee.agencyId, 'l’invité doit avoir reçu son agence solo à l’inscription').toBeTruthy()
      soloAgencyId = invitee.agencyId!

      // Exactement les classes qui partaient en cascade en production : aucune n'exige
      // de contact, donc aucune n'était retenue par le NO ACTION de `contacts`.
      const tx = await svc.from('transactions').insert({ agency_id: soloAgencyId }).select('id').single()
      if (tx.error) throw new Error(`transaction: ${tx.error.message}`)
      seeded.transaction = tx.data.id as string
      const rem = await svc.from('reminders')
        .insert({ agency_id: soloAgencyId, type: 'custom', trigger_rule: 'manual' }).select('id').single()
      if (rem.error) throw new Error(`reminder: ${rem.error.message}`)
      seeded.reminder = rem.data.id as string
      const person = await svc.from('agency_related_persons')
        .insert({ agency_id: soloAgencyId, first_name: 'Dirigeant', last_name: 'S9' }).select('id').single()
      if (person.error) throw new Error(`agency_related_persons: ${person.error.message}`)
      seeded.person = person.data.id as string

      // Le copilote WhatsApp tire son agence du LIEN : c'est lui qui doit suivre la personne.
      const link = await svc.from('whatsapp_agent_links').insert({
        profile_id: invitee.id, agency_id: soloAgencyId, wa_number: freshPhone(),
        verified: true, verified_at: new Date().toISOString(),
      }).select('id').single()
      if (link.error) throw new Error(`whatsapp_agent_links: ${link.error.message}`)
      linkId = link.data.id as string
      const ai = await svc.from('agent_ai_profiles')
        .upsert({ agent_id: invitee.id, agency_id: soloAgencyId }, { onConflict: 'agent_id' })
      if (ai.error) throw new Error(`agent_ai_profiles: ${ai.error.message}`)

      const inv = await invite(host, invitee.email)
      token = inv.token
      invitationId = inv.id
    }, 60_000)

    it('l’aperçu de l’invité connecté annonce que son agence porte des données', async () => {
      const { data, error } = await invitee.client.functions.invoke('accept-team-invite', {
        body: { token, action: 'preview' },
      })
      expect(error, JSON.stringify(error)).toBeNull()
      expect(data?.email, 'l’aperçu lui-même doit répondre').toBe(invitee.email)
      expect(data?.leavesAgencyWithData).toBe(true)
    })

    it('… mais ne le dit JAMAIS à un appelant anonyme, ni à un autre compte', async () => {
      const anonyme = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
      const vueAnonyme = await anonyme.functions.invoke('accept-team-invite', { body: { token, action: 'preview' } })
      expect(vueAnonyme.error, JSON.stringify(vueAnonyme.error)).toBeNull()
      // Contrôle positif : l'aperçu répond bien — c'est seulement le drapeau qui manque.
      expect(vueAnonyme.data?.email).toBe(invitee.email)
      expect(vueAnonyme.data).not.toHaveProperty('leavesAgencyWithData')

      const vueHote = await host.client.functions.invoke('accept-team-invite', { body: { token, action: 'preview' } })
      expect(vueHote.error, JSON.stringify(vueHote.error)).toBeNull()
      expect(vueHote.data?.email).toBe(invitee.email)
      expect(vueHote.data).not.toHaveProperty('leavesAgencyWithData')
    })

    it('sans consentement : 409 prior_agency_holds_data, et RIEN n’a bougé', async () => {
      const { error } = await invitee.client.functions.invoke('accept-team-invite', {
        body: { token, action: 'claim' },
      })
      expect(await refusEdge(error)).toEqual({ status: 409, code: 'prior_agency_holds_data' })
      expect(await agencyOf(invitee.id), 'le profil ne doit pas avoir changé d’agence').toBe(soloAgencyId)
      const { data: inv } = await svc.from('team_invitations').select('status').eq('id', invitationId).single()
      expect(inv?.status, 'l’invitation doit rester en attente').toBe('pending')
    })

    it('avec consentement : la réclamation passe, l’agence ET ses données restent', async () => {
      const { data, error } = await invitee.client.functions.invoke('accept-team-invite', {
        body: { token, action: 'claim', confirmLeave: true },
      })
      expect(error, JSON.stringify(error)).toBeNull()
      expect(data?.success, JSON.stringify(data)).toBe(true)
      expect(await agencyOf(invitee.id)).toBe(host.agencyId)

      // LE test de ce fichier : contre l'edge d'avant, ces quatre lectures rendent null.
      expect(await agencyExists(soloAgencyId), 'l’agence qui porte des données a été supprimée').toBe(true)
      const { data: tx } = await svc.from('transactions').select('id').eq('id', seeded.transaction).maybeSingle()
      const { data: rem } = await svc.from('reminders').select('id').eq('id', seeded.reminder).maybeSingle()
      const { data: per } = await svc.from('agency_related_persons').select('id').eq('id', seeded.person).maybeSingle()
      expect(tx, 'le deal est parti en cascade').not.toBeNull()
      expect(rem, 'le rappel est parti en cascade').not.toBeNull()
      expect(per, 'le dossier KYB de l’agence est parti en cascade').not.toBeNull()
    })

    it('la conservation se journalise DANS l’agence gardée, en nommant ce qui la retient', async () => {
      const events = await releaseEvents(soloAgencyId, 'solo_agency_retained')
      expect(events, 'une trace, et une seule').toHaveLength(1)
      expect(events[0]).toMatchObject({ agency_id: soloAgencyId, actor_id: invitee.id, category: 'settings', severity: 'warn' })
      expect(events[0].metadata?.blocking).toEqual(expect.arrayContaining(['transactions', 'reminders', 'agency_related_persons']))
      // Le lien a été ré-hébergé AVANT la libération : il ne compte plus parmi ce qui retient.
      expect(events[0].metadata?.blocking).not.toContain('whatsapp_agent_links')
      expect(await releaseEvents(soloAgencyId, 'solo_agency_released')).toEqual([])
    })

    it('le lien WhatsApp vérifié et le profil IA suivent la personne dans la nouvelle agence', async () => {
      const { data: link } = await svc.from('whatsapp_agent_links')
        .select('agency_id, verified').eq('id', linkId).single()
      expect(link).toEqual({ agency_id: host.agencyId, verified: true })
      const { data: ai } = await svc.from('agent_ai_profiles').select('agency_id').eq('agent_id', invitee.id).single()
      expect(ai?.agency_id).toBe(host.agencyId)
    })
  })

  describe('CONTRÔLE POSITIF — invitation acceptée depuis une agence vierge', () => {
    it('ni avertissement ni 409 : l’agence solo est libérée et la libération journalisée', async () => {
      const host = await newUser('hote-vierge', 'agent')
      const invitee = await newUser('invite-vierge', 'agent')
      const soloAgencyId = invitee.agencyId!
      const { token } = await invite(host, invitee.email)

      const apercu = await invitee.client.functions.invoke('accept-team-invite', { body: { token, action: 'preview' } })
      expect(apercu.error, JSON.stringify(apercu.error)).toBeNull()
      // Le drapeau est bien CALCULÉ (présent), et faux : le `true` du scénario précédent
      // n'est donc pas une constante.
      expect(apercu.data?.leavesAgencyWithData).toBe(false)

      const { data, error } = await invitee.client.functions.invoke('accept-team-invite', {
        body: { token, action: 'claim' },
      })
      expect(error, JSON.stringify(error)).toBeNull()
      expect(data?.success).toBe(true)
      expect(await agencyExists(soloAgencyId), 'l’agence vierge devait être libérée').toBe(false)
      const events = await releaseEvents(soloAgencyId, 'solo_agency_released')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ agency_id: null, actor_id: invitee.id, category: 'settings', severity: 'info' })
    }, 60_000)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LA FONCTION, cas par cas (transactions annulées)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('release_empty_solo_agency — le verdict', () => {
    // Deux comptes SANS agence (rôle buyer : handle_new_user ne provisionne rien). Ils ne
    // sont membres de rien, donc une libération réelle ne bute pas sur leur profil.
    let owner: TestUser
    let other: TestUser

    beforeAll(async () => {
      owner = await newUser('proprietaire', 'buyer')
      other = await newUser('autre', 'buyer')
    }, 60_000)

    /** Agence solo vierge de `owner`, créée dans la transaction : v_id. */
    const vierge = (extraCols = '', extraVals = '') => `
      insert into public.agencies (name, slug, solo, created_by${extraCols})
        values ('S9 ' || gen_random_uuid(), 's9-' || gen_random_uuid(), true, '${owner.id}'${extraVals})
        returning id into v_id;`

    it('CONTRÔLE POSITIF — une agence vierge (et son agency_activation) est libérée et journalisée', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb; v_n int;
        begin
          ${CLAIMS}
          ${vierge()}
          insert into public.agency_activation (agency_id) values (v_id);
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if (v_res->>'released')::boolean is not true then
            raise exception 'agence vierge non libérée : %', v_res;
          end if;
          if exists (select 1 from public.agencies where id = v_id) then
            raise exception 'la ligne agencies a survécu à la libération';
          end if;
          select count(*) into v_n from public.activity_events
           where action = 'solo_agency_released' and entity_id = v_id
             and agency_id is null and actor_id = '${owner.id}';
          if v_n <> 1 then
            raise exception 'solo_agency_released attendu une fois, % trouvé(s)', v_n;
          end if;
        end`)
    })

    // Le propriétaire est ENCORE dans l'agence : c'est l'état exact de la simulation que
    // l'edge fait avant de déplacer le profil. Puis la libération RÉELLE dans le même état :
    // gardée par `profiles` — un verdict, pas le 23503 du NO ACTION.
    it('la simulation dit « libérable » sans rien supprimer ni journaliser — le partant n’y compte pas', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          update public.profiles set agency_id = v_id where id = '${owner.id}';
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}', true);
          if (v_res->>'releasable')::boolean is not true or (v_res->>'released')::boolean is not false
             or (v_res->>'dry_run')::boolean is not true then
            raise exception 'simulation sur agence vierge : %', v_res;
          end if;
          if not exists (select 1 from public.agencies where id = v_id) then
            raise exception 'la simulation a supprimé l''agence';
          end if;
          if exists (select 1 from public.activity_events where entity_id = v_id and action like 'solo_agency_%') then
            raise exception 'la simulation a journalisé';
          end if;
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if (v_res->>'released')::boolean is not false or v_res->'blocking' <> '["profiles"]'::jsonb then
            raise exception 'propriétaire encore membre : %', v_res;
          end if;
        end`)
    })

    it('un deal suffit à garder l’agence : blocking = [transactions], le deal survit, la trace est rangée dans l’agence', () => {
      assertSql(`
        declare v_id uuid; v_tx uuid; v_res jsonb; v_n int;
        begin
          ${CLAIMS}
          ${vierge()}
          insert into public.transactions (agency_id) values (v_id) returning id into v_tx;
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if v_res->>'reason' is distinct from 'holds_data' or v_res->'blocking' <> '["transactions"]'::jsonb then
            raise exception 'verdict inattendu : %', v_res;
          end if;
          if not exists (select 1 from public.transactions where id = v_tx)
             or not exists (select 1 from public.agencies where id = v_id) then
            raise exception 'l''agence ou son deal a disparu';
          end if;
          select count(*) into v_n from public.activity_events
           where action = 'solo_agency_retained' and entity_id = v_id and agency_id = v_id
             and severity = 'warn' and metadata->'blocking' = '["transactions"]'::jsonb;
          if v_n <> 1 then
            raise exception 'solo_agency_retained attendu une fois, % trouvé(s)', v_n;
          end if;
        end`)
    })

    // Précondition vérifiée dans le corps : sans FORCE RLS, ce cas ne prouverait plus rien.
    it('une table en FORCE RLS retient aussi : le propriétaire de la fonction franchit bien la RLS', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          if not (select c.relforcerowsecurity from pg_class c where c.oid = 'public.agent_time_off'::regclass) then
            raise exception 'agent_time_off n''est plus en FORCE RLS : choisir une autre table témoin';
          end if;
          ${CLAIMS}
          ${vierge()}
          insert into public.agent_time_off (agent_id, agency_id, starts_at, ends_at)
            values ('${owner.id}', v_id, now(), now() + interval '1 hour');
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if not (v_res->'blocking' ? 'agent_time_off') then
            raise exception 'agent_time_off invisible à la fonction : %', v_res;
          end if;
        end`)
    })

    it('un contact retient l’agence par un VERDICT, pas par un 23503', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          insert into public.contacts (agency_id, first_name, last_name) values (v_id, 'Contact', 'S9');
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if (v_res->>'released')::boolean is not false or not (v_res->'blocking' ? 'contacts') then
            raise exception 'contact non retenu : %', v_res;
          end if;
        end`)
    })

    it('une table créée APRÈS la fonction retient d’office : la liste est lue à l’appel', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          create table public.s9_probe_child (agency_id uuid references public.agencies (id) on delete cascade);
          insert into public.s9_probe_child (agency_id) values (v_id);
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if not (v_res->'blocking' ? 's9_probe_child') then
            raise exception 'une table neuve n''est pas sondée : %', v_res;
          end if;
        end`)
    })

    it('une table de prospects SANS clé étrangère retient aussi (contact_suppressions)', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          insert into public.contact_suppressions (agency_id, channel, reason, wa_phone)
            values (v_id, 'whatsapp', 'agent_manual', '${freshPhone()}');
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if not (v_res->'blocking' ? 'contact_suppressions') then
            raise exception 'contact_suppressions non sondée : %', v_res;
          end if;
        end`)
    })

    it('un autre membre retient l’agence, en simulation comme en libération', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          update public.profiles set agency_id = v_id where id = '${other.id}';
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}', true);
          if (v_res->>'releasable')::boolean is not false or v_res->'blocking' <> '["profiles"]'::jsonb then
            raise exception 'membre restant ignoré en simulation : %', v_res;
          end if;
        end`)
    })

    // Les valeurs sont posées dans l'INSERT, pas par un UPDATE : les gardes BEFORE UPDATE
    // d'agencies n'ont pas à juger ce cas.
    it('la ligne elle-même : client Stripe, raison sociale ou plan payant retiennent l’agence', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge(', stripe_customer_id', ", 'cus_s9probe'")}
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}', true);
          if v_res->'blocking' <> '["agencies.columns"]'::jsonb then
            raise exception 'stripe_customer_id non retenu : %', v_res;
          end if;

          ${vierge(', legal_name', ", 'S9 Probe SA'")}
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}', true);
          if v_res->'blocking' <> '["agencies.columns"]'::jsonb then
            raise exception 'legal_name non retenu : %', v_res;
          end if;

          ${vierge(', plan', ", 'pro'")}
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}', true);
          if v_res->'blocking' <> '["agencies.plan_status"]'::jsonb then
            raise exception 'plan payant non retenu : %', v_res;
          end if;
        end`)
    })

    // Trois refus : créateur différent, agence non solo, et une agence solo SANS créateur
    // appelée avec un propriétaire NULL — l'égalité NULL/NULL ne doit désigner personne.
    it('seulement l’agence solo que CETTE personne a créée : autrement not_owned_solo, rien ne bouge', () => {
      assertSql(`
        declare v_id uuid; v_res jsonb;
        begin
          ${CLAIMS}
          ${vierge()}
          v_res := public.release_empty_solo_agency(v_id, '${other.id}');
          if v_res->>'reason' is distinct from 'not_owned_solo' then
            raise exception 'créateur différent : %', v_res;
          end if;
          if not exists (select 1 from public.agencies where id = v_id) then
            raise exception 'l''agence d''un autre a été supprimée';
          end if;

          insert into public.agencies (name, slug, solo, created_by)
            values ('S9 ' || gen_random_uuid(), 's9-' || gen_random_uuid(), false, '${owner.id}')
            returning id into v_id;
          v_res := public.release_empty_solo_agency(v_id, '${owner.id}');
          if v_res->>'reason' is distinct from 'not_owned_solo' then
            raise exception 'agence non solo : %', v_res;
          end if;

          insert into public.agencies (name, slug, solo)
            values ('S9 ' || gen_random_uuid(), 's9-' || gen_random_uuid(), true)
            returning id into v_id;
          v_res := public.release_empty_solo_agency(v_id, null);
          if v_res->>'reason' is distinct from 'not_owned_solo' then
            raise exception 'propriétaire NULL : %', v_res;
          end if;
        end`)
    })

    it('la garde du CORPS refuse un appelant sans le rôle de service, même détenteur d’EXECUTE', () => {
      // `postgres` possède la fonction, donc l'exécute : seule la garde du corps peut refuser.
      refuseSql(`
        begin
          perform public.release_empty_solo_agency(gen_random_uuid(), gen_random_uuid(), true);
        end`, /release_empty_solo_agency : r.serv.e au r.le de service/)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LES DROITS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('droits — service seul, et plus de DELETE sur agencies pour les clients', () => {
    it('catalogue : anon et authenticated n’exécutent pas, service_role oui ; DELETE retiré aux clients seulement', () => {
      assertSql(`
        begin
          if has_function_privilege('anon', '${SIG}', 'EXECUTE')
             or has_function_privilege('authenticated', '${SIG}', 'EXECUTE') then
            raise exception 'la fonction est exécutable hors du rôle de service';
          end if;
          if not has_function_privilege('service_role', '${SIG}', 'EXECUTE') then
            raise exception 'service_role ne peut pas l''exécuter : l''edge garderait toute agence';
          end if;
          if has_table_privilege('anon', 'public.agencies', 'DELETE')
             or has_table_privilege('authenticated', 'public.agencies', 'DELETE') then
            raise exception 'un client peut encore supprimer une agence';
          end if;
          if not has_table_privilege('service_role', 'public.agencies', 'DELETE') then
            raise exception 'service_role a perdu DELETE sur agencies';
          end if;
        end`)
    })

    it('un agent authentifié reçoit 42501 — et le MÊME appel en service_role libère', async () => {
      const agent = await newUser('appelant', 'buyer')
      const { data: ag, error: agErr } = await svc.from('agencies')
        .insert({ name: `S9 droits ${stamp()}`, slug: `s9-droits-${stamp()}`, solo: true, created_by: agent.id })
        .select('id').single()
      if (agErr) throw new Error(`agence: ${agErr.message}`)
      const agencyId = ag.id as string
      agencyIds.push(agencyId)
      const args = { p_agency_id: agencyId, p_former_owner: agent.id }

      const { error } = await agent.client.rpc('release_empty_solo_agency', args)
      // 42501 et rien d'autre : PGRST202 (fonction introuvable) serait aussi une erreur.
      expect(error?.code, JSON.stringify(error)).toBe('42501')
      expect(await agencyExists(agencyId)).toBe(true)

      const { data, error: svcErr } = await svc.rpc('release_empty_solo_agency', args)
      expect(svcErr, JSON.stringify(svcErr)).toBeNull()
      expect(data as ReleaseVerdict).toMatchObject({ released: true, releasable: true, reason: null })
      expect(await agencyExists(agencyId)).toBe(false)
    }, 60_000)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. team_remove_member — le lien WhatsApp part avec le membre
  // ═══════════════════════════════════════════════════════════════════════════
  describe('team_remove_member — un membre retiré perd son copilote WhatsApp', () => {
    let agencyId: string
    let admin: TestUser

    /** Compte rattaché à l'agence de test avec le rôle voulu (profil posé en service_role). */
    async function member(label: string, role: 'admin' | 'agent'): Promise<TestUser> {
      const u = await newUser(label, 'buyer')
      const { error } = await svc.from('profiles').update({ agency_id: agencyId, role }).eq('id', u.id)
      if (error) throw new Error(`profil ${label}: ${error.message}`)
      return { ...u, agencyId }
    }

    const unlinkEvents = async (linkId: string) => {
      const { data, error } = await svc.from('activity_events')
        .select('agency_id, actor_id, category, severity, metadata')
        .eq('action', 'whatsapp_number_unlinked').eq('entity_id', linkId)
      if (error) throw new Error(`activity_events: ${error.message}`)
      return data ?? []
    }

    beforeAll(async () => {
      const { data, error } = await svc.from('agencies')
        .insert({ name: `S9 equipe ${stamp()}`, slug: `s9-equipe-${stamp()}` }).select('id').single()
      if (error) throw new Error(`agence: ${error.message}`)
      agencyId = data.id as string
      agencyIds.push(agencyId)
      admin = await member('admin', 'admin')
    }, 60_000)

    it('le lien vérifié est vidé, sort de l’agence, et le retrait laisse UNE trace', async () => {
      const m = await member('retire', 'agent')
      const numero = freshPhone()
      const { data: link, error } = await svc.from('whatsapp_agent_links').insert({
        profile_id: m.id, agency_id: agencyId, wa_number: numero,
        verified: true, verified_at: new Date().toISOString(),
      }).select('id, verified').single()
      if (error) throw new Error(`lien: ${error.message}`)
      expect(link.verified, 'le lien doit être vérifié AVANT, sinon le test ne prouve rien').toBe(true)

      const { error: rmErr } = await admin.client.rpc('team_remove_member', { p_member_id: m.id })
      expect(rmErr, JSON.stringify(rmErr)).toBeNull()

      const { data: after } = await svc.from('whatsapp_agent_links')
        .select('agency_id, verified, wa_number').eq('id', link.id).single()
      expect(after).toEqual({ agency_id: null, verified: false, wa_number: null })
      expect(await agencyOf(m.id), 'le retrait lui-même doit avoir eu lieu').toBeNull()

      const traces = await unlinkEvents(link.id as string)
      expect(traces).toHaveLength(1)
      expect(traces[0]).toMatchObject({ agency_id: agencyId, actor_id: admin.id, category: 'settings', severity: 'info' })
      expect(traces[0].metadata).toEqual({ profile_id: m.id, phone_tail: numero.slice(-4), via: 'member_removed' })
    }, 60_000)

    it('un lien jamais vérifié est détaché sans trace : aucune preuve n’a changé', async () => {
      const m = await member('en-attente', 'agent')
      // Code aléatoire : la base est partagée, un code fixe pourrait répondre à l'appairage
      // d'un autre banc pendant les quelques millisecondes où il existe.
      const code = String(10_000_000 + Math.floor(Math.random() * 89_999_999))
      const { data: link, error } = await svc.from('whatsapp_agent_links')
        .insert({ profile_id: m.id, agency_id: agencyId, verified: false, pairing_code: code })
        .select('id').single()
      if (error) throw new Error(`lien: ${error.message}`)

      const { error: rmErr } = await admin.client.rpc('team_remove_member', { p_member_id: m.id })
      expect(rmErr, JSON.stringify(rmErr)).toBeNull()

      const { data: after } = await svc.from('whatsapp_agent_links')
        .select('agency_id, verified, pairing_code').eq('id', link.id).single()
      expect(after).toEqual({ agency_id: null, verified: false, pairing_code: null })
      expect(await unlinkEvents(link.id as string)).toEqual([])
    }, 60_000)

    it('un membre sans lien se retire comme avant', async () => {
      const m = await member('sans-lien', 'agent')
      const { error } = await admin.client.rpc('team_remove_member', { p_member_id: m.id })
      expect(error, JSON.stringify(error)).toBeNull()
      const { data } = await svc.from('profiles').select('agency_id, role').eq('id', m.id).single()
      expect(data).toEqual({ agency_id: null, role: 'buyer' })
    }, 60_000)
  })
})
