// Banc du registre de consentement WhatsApp (lot L1 — migrations 20260815210000 à
// 20260815216000). Aucun appelant applicatif à ce stade : ce banc est le SEUL lecteur des
// deux RPC tant que L3/L4 n'ont pas câblé les 12 sites d'envoi.
//
// Trois principes, hérités d'erreurs déjà payées par ce dépôt :
//
//  1. On assère la FORME, jamais l'existence. `create table if not exists` est un no-op
//     silencieux si une version divergente de la table a été créée entre-temps : une suite
//     qui vérifie « la table existe » serait verte sur un schéma faux. Chaque colonne est
//     donc lue, et chaque CHECK est éprouvé par son contre-exemple.
//
//  2. On assère des COMPTEURS, jamais « ça ne jette pas ». Un UPDATE qui matche 0 ligne ne
//     lève rien — c'est exactement ainsi que la coupure des relances du chantier d'origine
//     était creuse à 100 % (elle écrivait status='pending', valeur absente du domaine).
//
//  @sql-blocks-check — ce fichier est analysé par scripts/check-spec-sql-blocks.mjs, qui
//  vérifie que ses corps plpgsql sont ÉQUILIBRÉS. C'est ici que le défaut est né : quinze
//  refus passaient sur `syntax error at or near "end"`, verts et vides de sens.
//
//  3. skipIf(!HAS_KEYS) ne SKIP PAS en CI (backend.yml exporte SUPABASE_TEST_*) — lire le
//     nombre de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Le corps porte son bloc complet (`begin … end`) — le wrapper ne ferme rien pour lui. */
const runSql = (body: string) => execSql(`do $$\n${body}\n$$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

/**
 * Motifs de refus LÉGITIMES. Tout le reste — une syntaxe fautive au premier chef — est un
 * échec du test, pas une preuve.
 */
const MOTIF_REFUS =
  /violates (check|unique|not-null|foreign key) constraint|est append-only|permission denied|denied for/i

/**
 * Un refus doit venir de la CONTRAINTE, jamais d'une faute de frappe.
 *
 * ⚠ Écrit APRÈS coup, et c'est la leçon. La première version de ce banc se contentait de
 * `toThrow()`, et ses corps refermaient un `end` que le wrapper posait déjà. Les quinze
 * refus passaient donc tous sur `syntax error at or near "end"` : verts, et ne prouvant
 * rien du tout. Une erreur de syntaxe fait « échouer » n'importe quel SQL — c'est le
 * MOTIF qui décide, pas l'échec.
 */
const refuseSql = (body: string, motif: RegExp = MOTIF_REFUS) => {
  let msg = ''
  try { runSql(body) } catch (e) { msg = String((e as Error).message) }
  expect(msg, `ce SQL devait être refusé : ${body}`).not.toBe('')
  expect(msg, 'refusé, mais pas par une contrainte').toMatch(motif)
}

/**
 * Numéro à 11 chiffres dont les 9 derniers — ce que `normalize_phone` retient — sont
 * uniques par appel. Les specs backend partagent une base : deux numéros dont les 9
 * derniers chiffres coïncident se disputeraient `uq_contact_suppressions_active`.
 */
let phoneSeq = 0
const freshPhone = (): string =>
  '41' + String(Date.now() % 1_000_000).padStart(6, '0') + String(phoneSeq++ % 1000).padStart(3, '0')

interface Verdict {
  allowed: boolean
  reason: string
  public_reason: string
  in_24h_window: boolean
  legal_basis: string | null
  subject_kind: string | null
}

describe.skipIf(!HAS_KEYS)('registre de consentement WhatsApp — L1', () => {
  let setup: TwoAgenciesSetup
  let svc: ReturnType<typeof serviceRoleClient>

  /** Numéros semés, pour le nettoyage. */
  const seededPhones: string[] = []
  const seededContacts: string[] = []

  const newPhone = (): string => {
    const p = freshPhone()
    seededPhones.push(p)
    return p
  }

  /** Contact de l'agence A porteur de ce numéro. */
  const seedContact = async (phone: string, agencyId: string): Promise<string> => {
    const { data, error } = await svc
      .from('contacts')
      .insert({
        agency_id: agencyId, first_name: 'Consent', last_name: phone.slice(-4),
        email: `consent-${phone}@megga-test.local`, phone, source: 'manual', type: 'lead',
      })
      .select('id').single()
    if (error) throw new Error(`seedContact: ${error.message}`)
    seededContacts.push(data.id)
    return data.id
  }

  /** Message ENTRANT daté, seul producteur de la fenêtre 24 h et de la relation 30 j. */
  const seedInbound = async (
    phone: string, agencyId: string, contactId: string | null, ageHours: number,
  ): Promise<void> => {
    const at = new Date(Date.now() - ageHours * 3_600_000).toISOString()
    const { error } = await svc.from('whatsapp_messages').insert({
      provider: 'meta', provider_message_id: `wamid.TEST.${phone}.${ageHours}.${phoneSeq++}`,
      direction: 'inbound', wa_from: phone, agency_id: agencyId, contact_id: contactId,
      body: 'bonjour', created_at: at, wa_timestamp: at,
    })
    if (error) throw new Error(`seedInbound: ${error.message}`)
  }

  const allowed = async (args: Record<string, unknown>): Promise<Verdict> => {
    const { data, error } = await svc.rpc('whatsapp_send_allowed', args)
    // Une SURCHARGE de la RPC (signature changée sans drop préalable) se manifesterait ici
    // en PGRST203 « Could not choose the best candidate function » — sur TOUS les appels.
    // C'est la propriété que le comptage de pg_proc protégeait ; l'appel la démontre.
    if (error) throw new Error(`whatsapp_send_allowed: ${error.code} ${error.message}`)
    const rows = data as Verdict[]
    expect(rows, 'la RPC rend exactement une ligne').toHaveLength(1)
    return rows[0]
  }

  const record = async (args: Record<string, unknown>) => svc.rpc('record_whatsapp_consent', args)

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!setup) return
    const list = seededPhones.map((p) => `'${p}'`).join(',') || `'__none__'`
    // whatsapp_consents refuse le DELETE par trigger — c'est le sujet même d'un des tests
    // ci-dessous. Le neutraliser le temps du nettoyage est le seul moyen de ne pas laisser
    // de PII de test derrière soi ; le motif est déjà celui d'activity_events dans ce dépôt.
    try {
      execSql(`
        alter table public.whatsapp_consents disable trigger trg_wa_consents_immutable_delete;
        delete from public.whatsapp_consents where wa_phone in (${list});
        alter table public.whatsapp_consents enable trigger trg_wa_consents_immutable_delete;
        delete from public.contact_suppressions where wa_phone in (${list});
        delete from public.whatsapp_messages where wa_from in (${list});
      `)
    } catch { /* le nettoyage ne doit jamais masquer l'échec d'un test */ }
    for (const id of seededContacts) await svc.from('contacts').delete().eq('id', id)
    await setup.cleanup()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 1. FORME — chaque colonne lue, chaque CHECK éprouvé par son contre-exemple
  // ══════════════════════════════════════════════════════════════════════════

  describe('forme des tables', () => {
    it('contact_suppressions porte exactement les colonnes prévues', async () => {
      const { error } = await svc
        .from('contact_suppressions')
        .select('id, created_at, channel, wa_phone, reason, source_ref, contact_id, agency_id, ack_sent_at, lifted_at, lifted_reason, lifted_by')
        .limit(1)
      expect(error, 'une colonne manquante rend PGRST204 ici, pas au premier envoi').toBeNull()
    })

    it('whatsapp_consents porte exactement les colonnes prévues', async () => {
      const { error } = await svc
        .from('whatsapp_consents')
        .select('id, created_at, subject_kind, contact_id, profile_id, agency_id, wa_phone, event, source, legal_basis, purpose, scope, source_ref, proof, ip_hash, recorded_by')
        .limit(1)
      expect(error).toBeNull()
    })

    it('contacts porte les 4 colonnes de cache, aux bons défauts', async () => {
      const phone = newPhone()
      const id = await seedContact(phone, setup.agencyAId)
      const { data, error } = await svc
        .from('contacts').select('wa_opt_in, wa_consent_at, wa_opt_out_at, wa_suppressed')
        .eq('id', id).single()
      expect(error).toBeNull()
      // Le défaut compte : un `wa_opt_in` NULL au lieu de false ferait passer un contact
      // neuf pour « pas encore décidé » là où il est « pas consenti ».
      expect(data).toEqual({ wa_opt_in: false, wa_consent_at: null, wa_opt_out_at: null, wa_suppressed: false })
    })

    it('le domaine des colonnes de contact_suppressions refuse ses contre-exemples', () => {
      const p = newPhone()
      refuseSql(`begin insert into public.contact_suppressions (channel, wa_phone, reason)
                        values ('sms', '${p}', 'stop_keyword'); end`)                    // channel hors domaine
      refuseSql(`begin insert into public.contact_suppressions (channel, wa_phone, reason)
                        values ('all', '12345', 'stop_keyword'); end`)                   // < 6 chiffres
      refuseSql(`begin insert into public.contact_suppressions (channel, wa_phone, reason)
                        values ('all', '1234567890123456', 'stop_keyword'); end`)        // > 15 = JID de groupe
      refuseSql(`begin insert into public.contact_suppressions (channel, wa_phone, reason)
                        values ('all', '${p}', 'parce_que'); end`)                       // reason hors domaine
      // Une levée sans motif n'est pas une levée : elle serait indistinguable d'un bug.
      refuseSql(`begin insert into public.contact_suppressions (channel, wa_phone, reason, lifted_at)
                        values ('all', '${p}', 'stop_keyword', now()); end`)
    })

    it('un second blocage ACTIF du même numéro est impossible, un blocage après levée ne l’est pas', () => {
      const p = newPhone()
      assertSql(`
      declare v_id uuid;
      begin
        insert into public.contact_suppressions (channel, wa_phone, reason)
          values ('all', '${p}', 'stop_keyword') returning id into v_id;
        -- L'unicité porte sur normalize_phone : le MÊME numéro écrit au format national
        -- doit entrer en collision, sinon 100 % des envois passeraient (l'entrant est en
        -- E.164, le sortant vient de contacts.phone saisi en national).
        begin
          insert into public.contact_suppressions (channel, wa_phone, reason)
            values ('all', '0${p.slice(-9)}', 'meta_block');
          raise exception 'le doublon actif aurait dû être refusé';
        exception when unique_violation then null;
        end;
        -- Levée explicite → le numéro redevient blocable (aucun DELETE n'est nécessaire).
        update public.contact_suppressions
           set lifted_at = now(), lifted_reason = 'super_admin' where id = v_id;
        insert into public.contact_suppressions (channel, wa_phone, reason)
          values ('all', '${p}', 'agent_manual');
      end`)
    })

    it('whatsapp_consents refuse un inbound comme opt-in, et un opt-in marketing fabriqué à la main', () => {
      const p = newPhone()
      const base = `subject_kind, contact_id, wa_phone, event, source`
      // « Un inbound ne vaut JAMAIS opt-in » est STRUCTUREL : la source n'existe pas dans le
      // domaine. Une règle conditionnelle serait contournée par le premier appelant pressé.
      refuseSql(`begin insert into public.whatsapp_consents (${base})
                        values ('contact', gen_random_uuid(), '${p}', 'opt_in', 'wa_inbound'); end`)
      refuseSql(`begin insert into public.whatsapp_consents (${base})
                        values ('contact', gen_random_uuid(), '${p}', 'opt_in', 'web_form'); end`)
      // Un opt-out ne peut pas naître d'une source d'opt-in, et réciproquement.
      refuseSql(`begin insert into public.whatsapp_consents (${base})
                        values ('contact', gen_random_uuid(), '${p}', 'opt_out', 'click_to_wa'); end`)
      // Un agent ne FABRIQUE pas un consentement marketing.
      refuseSql(`begin insert into public.whatsapp_consents (${base}, purpose, proof)
                        values ('contact', gen_random_uuid(), '${p}', 'opt_in', 'agent_manual',
                                'marketing', '{"ui_ref":"x"}'::jsonb); end`)
      // …ni un opt-in manuel sans trace de ce qui a été montré.
      refuseSql(`begin insert into public.whatsapp_consents (${base})
                        values ('contact', gen_random_uuid(), '${p}', 'opt_in', 'agent_manual'); end`)
      // Le sujet est un XOR : ni deux clés, ni aucune.
      refuseSql(`begin insert into public.whatsapp_consents (${base}, profile_id)
                        values ('contact', gen_random_uuid(), '${p}', 'opt_in', 'qr', gen_random_uuid()); end`)
      refuseSql(`begin insert into public.whatsapp_consents (subject_kind, wa_phone, event, source)
                        values ('contact', '${p}', 'opt_in', 'qr'); end`)
      // Le toggle du brief est par nature scopé : un 'brief_disabled' global éteindrait
      // aussi le PDF KYC, les résultats async et le copilote.
      refuseSql(`begin insert into public.whatsapp_consents (subject_kind, profile_id, wa_phone, event, source, scope)
                        values ('profile', gen_random_uuid(), '${p}', 'opt_out', 'brief_disabled', 'all'); end`)
      // …mais une AUTRE source peut porter la portée du brief (le bouton d'opt-out Meta
      // sur le numéro d'un agent, §3.1 point A). L'équivalence stricte l'interdisait.
      assertSql(`begin insert into public.whatsapp_consents (subject_kind, profile_id, wa_phone, event, source, scope)
                        values ('profile', gen_random_uuid(), '${p}', 'opt_out', 'meta_block', 'daily_brief'); end`)
    })

    it('le registre est append-only : UPDATE, DELETE et TRUNCATE sont refusés', () => {
      const p = newPhone()
      assertSql(`begin insert into public.whatsapp_consents (subject_kind, profile_id, wa_phone, event, source)
                        values ('profile', gen_random_uuid(), '${p}', 'opt_in', 'agent_pairing'); end`)
      refuseSql(`begin update public.whatsapp_consents set purpose = 'marketing' where wa_phone = '${p}'; end`)
      refuseSql(`begin delete from public.whatsapp_consents where wa_phone = '${p}'; end`)
      // ⚠ Un trigger FOR EACH ROW ne voit pas un TRUNCATE, et `anon` détient TRUNCATE par
      // héritage des DEFAULT PRIVILEGES sur 75 tables de ce projet : sans le trigger
      // STATEMENT, le registre entier s'efface en une instruction.
      //
      // Transaction EXPLICITE avec rollback : si le trigger manquait, ce test doit échouer
      // en rendant un verdict, pas en vidant le registre de la base de CI pour les specs
      // suivantes. L'assertion tient dans les deux cas.
      let truncErr = ''
      try { execSql('begin; truncate public.whatsapp_consents; rollback;') }
      catch (e) { truncErr = String((e as Error).message) }
      expect(truncErr, 'le trigger STATEMENT doit refuser le TRUNCATE').toMatch(/est append-only/)
    })

    it('le caviardage DSAR efface la PII et RIEN d’autre', async () => {
      const p = newPhone()
      const contactId = await seedContact(p, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: p, p_event: 'opt_in', p_source: 'click_to_wa',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
        p_proof: { shown: 'texte affiché au client' },
      })

      const { data: n } = await svc.rpc('redact_whatsapp_consent', { p_wa_phone: p })
      expect(Number(n), 'au moins la ligne semée est caviardée').toBeGreaterThanOrEqual(1)

      const { data } = await svc.from('whatsapp_consents')
        .select('wa_phone, proof, ip_hash, event, source, legal_basis, purpose, scope, contact_id')
        .eq('contact_id', contactId).single()
      expect(data?.wa_phone, 'le numéro part').toBe('000000000')
      expect(data?.proof, 'la preuve part').toBeNull()
      expect(data?.ip_hash).toBeNull()
      // La ligne JURIDIQUE survit — c'est elle qui rend le registre opposable.
      expect(data?.event).toBe('opt_in')
      expect(data?.source).toBe('click_to_wa')
      expect(data?.contact_id).toBe(contactId)

      // L'échappatoire est étroite : hors caviardage, l'UPDATE reste refusé, et le drapeau
      // seul ne suffit pas à réécrire autre chose que la PII.
      refuseSql(`begin update public.whatsapp_consents set source = 'qr' where contact_id = '${contactId}'; end`)
      refuseSql(`begin
        perform set_config('megga.consent_redaction', 'on', true);
        update public.whatsapp_consents
           set wa_phone = '000000000', proof = null, ip_hash = null, legal_basis = 'contract'
         where contact_id = '${contactId}';
      end`)
    })

    it('les deux RPC existent en un seul exemplaire (une surcharge = PGRST203 partout)', () => {
      // La vérification par le catalogue, et non par un appel : une surcharge introduite par
      // une migration future casserait TOUS les appelants d'un coup, y compris ceux qu'aucun
      // test ne couvre. `drop function` de la signature exacte est ce qui l'empêche.
      assertSql(`
      declare v_n int;
      begin
        select count(*) into v_n from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('whatsapp_send_allowed', 'record_whatsapp_consent');
        if v_n <> 2 then
          raise exception 'attendu 2 fonctions, trouvé % — surcharge ⇒ PGRST203', v_n;
        end if;
      end`)
    })

    it('l’index de la fenêtre 24 h couvre réellement le prédicat de la RPC', () => {
      // On n'assère PAS « le planner le choisit » : sur une base de CI fraîche la table est
      // vide, un seq scan gagne toujours, et l'assertion serait creuse ou instable. Ce qui
      // se vérifie sans dépendre du volume, c'est que l'index est CAPABLE de servir ce
      // prédicat — l'expression indexée et celle de la requête doivent coïncider, et c'est
      // précisément ce qui casse en silence (wa_from brut vs normalisé).
      //
      // Transaction EXPLICITE : `set local` hors bloc transactionnel n'émet qu'un WARNING
      // et ne s'applique pas — le test serait creux, le seq scan gagnerait toujours.
      expect(() => execSql(`
begin;
set local enable_seqscan = off;
do $$
declare v_plan text := ''; v_line text;
begin
  for v_line in
    execute $q$explain (costs off)
      select 1 from public.whatsapp_messages m
       where m.direction = 'inbound'
         and public.normalize_phone(m.wa_from) = '791112233'
         and m.created_at > now() - interval '30 days'$q$
  loop v_plan := v_plan || v_line || ' '; end loop;
  if v_plan not like '%idx_wa_messages_inbound_normphone%' then
    raise exception 'index non utilisable pour la fenetre 24 h. Plan : %', v_plan;
  end if;
end $$;
rollback;
`), 'assertion SQL').not.toThrow()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 2. LES MOTIFS DE whatsapp_send_allowed
  // ══════════════════════════════════════════════════════════════════════════

  describe('whatsapp_send_allowed — les motifs', () => {
    it('invalid_phone : trop court, trop long, et le pas de 6→9 chiffres', async () => {
      expect((await allowed({ p_wa_phone: '12345' })).reason).toBe('invalid_phone')
      expect((await allowed({ p_wa_phone: '1234567890123456' })).reason).toBe('invalid_phone')
      // ⚠ Écart ASSUMÉ entre le CHECK des tables (≥ 6 chiffres) et la garde (≥ 9 après
      // normalisation) : normalize_phone rend les 9 DERNIERS chiffres, donc un numéro de
      // 6 à 8 chiffres ne peut pas être comparé de façon fiable à un numéro E.164. La
      // garde refuse plutôt que de rapprocher deux numéros différents.
      expect((await allowed({ p_wa_phone: '123456' })).reason).toBe('invalid_phone')
    })

    it('subject_mismatch : la fiche annoncée ne porte pas ce numéro', async () => {
      const contactPhone = newPhone()
      const contactId = await seedContact(contactPhone, setup.agencyAId)
      const v = await allowed({ p_wa_phone: newPhone(), p_contact_id: contactId })
      expect(v.reason).toBe('subject_mismatch')
      // Le motif exposable ne dit pas POURQUOI : il ne doit rien apprendre sur l'autre fiche.
      expect(v.public_reason).toBe('not_contactable')
      expect(v.allowed).toBe(false)
    })

    it('agent_link_unverified : un profil annoncé sans lien vérifié est refusé, pas réinterprété', async () => {
      // C'est le trou de kyc-report-pdf (§4 site 12) : `to_phone` y est un paramètre libre
      // du corps. Sans ce refus, un numéro CLIENT dans la fenêtre 24 h faisait partir le
      // rapport KYC d'un agent sous `ok_service_window`.
      const clientPhone = newPhone()
      const clientId = await seedContact(clientPhone, setup.agencyAId)
      await seedInbound(clientPhone, setup.agencyAId, clientId, 1)

      const v = await allowed({ p_wa_phone: clientPhone, p_profile_id: setup.agentAId, p_purpose: 'service' })
      expect(v.reason).toBe('agent_link_unverified')
      expect(v.allowed).toBe(false)
      expect(v.subject_kind).toBe('profile')

      // Sans p_profile_id, le MÊME numéro est bien un contact — la protection tient au
      // sujet annoncé, pas au numéro.
      const asContact = await allowed({ p_wa_phone: clientPhone, p_purpose: 'service' })
      expect(asContact.subject_kind).toBe('contact')
      expect(asContact.allowed).toBe(true)
    })

    it('ok_service_window : répondre dans les 24 h n’exige pas de consentement', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await seedInbound(phone, setup.agencyAId, contactId, 1)
      const v = await allowed({
        p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      // Une garde qui refuserait 100 % des envois au jour 1 (aucun contact n'a d'opt-in)
      // se ferait débrancher dans la semaine.
      expect(v).toMatchObject({
        allowed: true, reason: 'ok_service_window', in_24h_window: true,
        legal_basis: 'legitimate_interest', subject_kind: 'contact',
      })
    })

    it('la fenêtre est SCOPÉE AU TENANT : l’agence B ne « répond » pas au message reçu par A', async () => {
      const phone = newPhone()
      const contactA = await seedContact(phone, setup.agencyAId)
      const contactB = await seedContact(phone, setup.agencyBId)
      // La personne a écrit à l'agence A, et à elle seule.
      await seedInbound(phone, setup.agencyAId, contactA, 1)

      const vA = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactA, p_agency_id: setup.agencyAId })
      expect(vA.in_24h_window, 'A a bien reçu le message').toBe(true)

      const vB = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactB, p_agency_id: setup.agencyBId })
      // Sans le scope, B enverrait du démarchage à froid habillé en réponse.
      expect(vB.in_24h_window, 'B n’a rien reçu').toBe(false)
      expect(vB.allowed).toBe(false)
      expect(vB.reason).toBe('no_opt_in')
    })

    it('no_opt_in : hors fenêtre et sans déclaration, on n’initie pas', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      const v = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(v).toMatchObject({ allowed: false, reason: 'no_opt_in', in_24h_window: false })
    })

    it('ok_business_relationship : un UTILITY hors fenêtre passe sur une relation < 30 j', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await seedInbound(phone, setup.agencyAId, contactId, 25)   // hors 24 h, dans les 30 j
      const util = await allowed({ p_wa_phone: phone, p_purpose: 'utility', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(util).toMatchObject({
        allowed: true, reason: 'ok_business_relationship', in_24h_window: false,
        legal_basis: 'legitimate_interest',
      })
      // Le même contact, en texte libre, reste refusé : c'est ce qui garde le repli
      // template vivant sans rouvrir l'envoi hors fenêtre.
      const svcTxt = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(svcTxt.reason).toBe('no_opt_in')
    })

    it('une relation de plus de 30 jours ne vaut plus rien', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await seedInbound(phone, setup.agencyAId, contactId, 24 * 31)
      const v = await allowed({ p_wa_phone: phone, p_purpose: 'utility', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(v.reason).toBe('no_opt_in')
    })

    it('marketing_requires_consent : un intérêt légitime ne porte pas un broadcast', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'click_to_wa',
        p_contact_id: contactId, p_agency_id: setup.agencyAId, p_legal_basis: 'legitimate_interest',
      })
      const v = await allowed({ p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(v).toMatchObject({ allowed: false, reason: 'marketing_requires_consent', legal_basis: 'legitimate_interest' })
    })

    it('ok : un opt-in de base « consent » ouvre le marketing', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'web_form_doubleoptin',
        p_contact_id: contactId, p_agency_id: setup.agencyAId, p_legal_basis: 'consent', p_purpose: 'marketing',
      })
      const v = await allowed({ p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(v).toMatchObject({ allowed: true, reason: 'ok', legal_basis: 'consent' })
    })

    it('phone_suppressed : la suppression passe AVANT le consentement, et le motif précis ne fuit pas', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      // Un opt-in valide, puis un STOP. Sur un WABA mono-numéro, l'opt-in ne rachète rien.
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'click_to_wa',
        p_contact_id: contactId, p_agency_id: setup.agencyAId, p_legal_basis: 'consent',
      })
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })

      const own = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(own.reason).toBe('phone_suppressed')
      expect(own.public_reason, 'l’agence constatante a le droit de savoir').toBe('phone_suppressed')

      // L'agence B voit le refus mais PAS son motif : lui dire « phone_suppressed » lui
      // apprendrait qu'un numéro a écrit STOP à l'agence A — l'oracle exact que la RLS cache.
      const other = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_agency_id: setup.agencyBId })
      expect(other.reason).toBe('phone_suppressed')
      expect(other.public_reason).toBe('not_contactable')
    })

    it('l’accusé de désinscription part UNE fois, et seulement s’il y a une suppression', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)

      // Sans suppression, l'accusé n'a pas lieu d'être — c'est ce qui empêche de s'en
      // servir comme d'un laissez-passer pour écrire à n'importe qui.
      const before = await allowed({ p_wa_phone: phone, p_purpose: 'opt_out_ack', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(before).toMatchObject({ allowed: false, reason: 'ack_without_suppression' })

      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })

      const first = await allowed({ p_wa_phone: phone, p_purpose: 'opt_out_ack', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(first).toMatchObject({ allowed: true, reason: 'ok_opt_out_ack', legal_basis: 'legal_obligation' })

      await svc.rpc('mark_suppression_ack_sent', { p_wa_phone: phone })
      const second = await allowed({ p_wa_phone: phone, p_purpose: 'opt_out_ack', p_contact_id: contactId, p_agency_id: setup.agencyAId })
      expect(second, 'l’unicité de la ligne active EST le plafond').toMatchObject({
        allowed: false, reason: 'ack_already_sent',
      })
    })

    it('lpd_notice passe un opt-out déclaratif, jamais une suppression active', async () => {
      // Art. 19 nLPD : un message par numéro, jamais du démarchage. Un opt-out 'agent_manual'
      // est une décision de l'AGENT — la personne n'a rien demandé, l'obligation subsiste.
      const declaratif = newPhone()
      const dId = await seedContact(declaratif, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: declaratif, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: dId, p_agency_id: setup.agencyAId,
      })
      // ⚠ 'agent_manual' cascade lui aussi en suppression (channel 'whatsapp') : c'est ce
      // qui la fait survivre au cycle supprimer/recréer la fiche. L'avis n'est donc dû que
      // tant qu'elle est levée — ce que la RPC de l'avis LPD arbitre par `reason`, pas ici.
      execSql(`update public.contact_suppressions set lifted_at = now(), lifted_reason = 'super_admin'
                where wa_phone = '${declaratif}' and lifted_at is null;`)
      const v = await allowed({ p_wa_phone: declaratif, p_purpose: 'lpd_notice', p_contact_id: dId, p_agency_id: setup.agencyAId })
      expect(v).toMatchObject({ allowed: true, reason: 'ok', legal_basis: 'legal_obligation' })

      // Suppression ACTIVE → l'accusé a déjà porté l'avis, on ne réécrit pas.
      const stoppe = newPhone()
      const sId = await seedContact(stoppe, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: stoppe, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: sId, p_agency_id: setup.agencyAId,
      })
      const blocked = await allowed({ p_wa_phone: stoppe, p_purpose: 'lpd_notice', p_contact_id: sId, p_agency_id: setup.agencyAId })
      expect(blocked).toMatchObject({ allowed: false, reason: 'phone_suppressed' })
    })

    it('do_not_contact vs opted_out : la source du refus survit à la levée du blocage', async () => {
      const stop = newPhone()
      const stopId = await seedContact(stop, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: stop, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: stopId, p_agency_id: setup.agencyAId,
      })
      const manuel = newPhone()
      const manuelId = await seedContact(manuel, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: manuel, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: manuelId, p_agency_id: setup.agencyAId,
      })
      // Un super-admin lève les DEUX blocages. La DÉCLARATION, elle, ne se lève pas : le
      // registre est append-only. C'est ce qui distingue « la personne a dit non » de
      // « l'agent a coché une case ».
      execSql(`update public.contact_suppressions set lifted_at = now(), lifted_reason = 'super_admin'
                where wa_phone in ('${stop}', '${manuel}') and lifted_at is null;`)

      const vStop = await allowed({ p_wa_phone: stop, p_purpose: 'service', p_contact_id: stopId, p_agency_id: setup.agencyAId })
      expect(vStop).toMatchObject({ allowed: false, reason: 'do_not_contact', public_reason: 'not_contactable' })

      const vManuel = await allowed({ p_wa_phone: manuel, p_purpose: 'service', p_contact_id: manuelId, p_agency_id: setup.agencyAId })
      expect(vManuel).toMatchObject({ allowed: false, reason: 'opted_out', public_reason: 'not_contactable' })
    })

    it('un opt-out survit à la suppression PUIS recréation de la fiche', async () => {
      // Le registre est lu par NUMÉRO autant que par sujet. Sans ce chemin, l'opt-out
      // survivait à la suppression du contact mais son EFFET non : il suffisait de
      // supprimer puis recréer la fiche (uuid neuf) pour réécrire à quelqu'un.
      const phone = newPhone()
      const first = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: first, p_agency_id: setup.agencyAId,
      })
      execSql(`update public.contact_suppressions set lifted_at = now(), lifted_reason = 'super_admin'
                where wa_phone = '${phone}' and lifted_at is null;`)
      await svc.from('contacts').delete().eq('id', first)

      const reborn = await seedContact(phone, setup.agencyAId)
      await seedInbound(phone, setup.agencyAId, reborn, 1)   // fenêtre 24 h ouverte : le seul rempart est le registre
      const v = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: reborn, p_agency_id: setup.agencyAId })
      expect(v).toMatchObject({ allowed: false, reason: 'opted_out' })
    })

    it('un opt-in obtenu par l’agence B n’autorise pas l’agence A, mais son opt-out la bloque', async () => {
      // La lecture par numéro est ASYMÉTRIQUE, et c'est ce qui empêche de contourner la
      // garde en faisant consentir la personne auprès de n'importe quel autre tenant du
      // WABA partagé. C'est la même règle que la levée par sujet de l'étape 3.
      const phone = newPhone()
      const chezA = await seedContact(phone, setup.agencyAId)
      const chezB = await seedContact(phone, setup.agencyBId)

      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'web_form_doubleoptin',
        p_contact_id: chezB, p_agency_id: setup.agencyBId, p_legal_basis: 'consent',
      })
      const vA = await allowed({ p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: chezA, p_agency_id: setup.agencyAId })
      expect(vA, 'le consentement donné à B ne vaut pas pour A').toMatchObject({
        allowed: false, reason: 'no_opt_in',
      })
      const vB = await allowed({ p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: chezB, p_agency_id: setup.agencyBId })
      expect(vB.allowed, 'B garde le bénéfice de SON opt-in').toBe(true)

      // L'opt-out, lui, traverse : la personne a dit non sur CE numéro. (La suppression en
      // cascade suffirait ici ; on la lève pour éprouver la lecture du registre elle-même.)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: chezB, p_agency_id: setup.agencyBId,
      })
      execSql(`update public.contact_suppressions set lifted_at = now(), lifted_reason = 'super_admin'
                where wa_phone = '${phone}' and lifted_at is null;`)
      const apres = await allowed({ p_wa_phone: phone, p_purpose: 'service', p_contact_id: chezA, p_agency_id: setup.agencyAId })
      expect(apres).toMatchObject({ allowed: false, reason: 'opted_out' })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 3. LES EFFETS DE record_whatsapp_consent — des compteurs, jamais « ça passe »
  // ══════════════════════════════════════════════════════════════════════════

  describe('record_whatsapp_consent — les effets, comptés', () => {
    it('un opt-out coupe suggestion, rappel et action stashée dans la MÊME transaction', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)

      const { error: sugErr } = await svc.from('whatsapp_followup_suggestions').insert({
        agency_id: setup.agencyAId, contact_id: contactId, action: 'rappeler',
        dedup_key: `consent-${phone}`, status: 'suggested',
      })
      expect(sugErr, 'la suggestion de fixture doit exister pour que sa coupure signifie quelque chose').toBeNull()

      const { error: remErr } = await svc.from('reminders').insert({
        agency_id: setup.agencyAId, contact_id: contactId, type: 'custom',
        trigger_rule: 'manual', status: 'pending', channel: 'whatsapp',
      })
      expect(remErr).toBeNull()

      const { error: stashErr } = await svc.from('whatsapp_pending_actions').insert({
        profile_id: setup.agentAId, agency_id: setup.agencyAId, wa_number: phone,
        tool: 'send_client_message', args: { contact_id: contactId, body: 'coucou' },
        summary: 'Envoyer un message',
      })
      expect(stashErr).toBeNull()

      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })

      // ⚠ Compteurs, pas absence d'erreur. Le chantier d'origine écrivait status='pending'
      // sur les suggestions — valeur hors domaine, UPDATE à 0 ligne, AUCUNE erreur.
      const { data: sug } = await svc.from('whatsapp_followup_suggestions')
        .select('status').eq('contact_id', contactId)
      expect(sug?.map((r) => r.status)).toEqual(['dismissed'])

      const { data: rem } = await svc.from('reminders').select('status').eq('contact_id', contactId)
      expect(rem?.map((r) => r.status)).toEqual(['cancelled'])

      const { data: stash } = await svc.from('whatsapp_pending_actions')
        .select('id').eq('profile_id', setup.agentAId)
      expect(stash, 'une action stashée AVANT le STOP resterait proposée après').toHaveLength(0)
    })

    it('un opt-out écrit la suppression ET met le cache de contacts à jour', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'click_to_wa',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      const { data: afterIn } = await svc.from('contacts')
        .select('wa_opt_in, wa_consent_at, wa_opt_out_at, wa_suppressed').eq('id', contactId).single()
      expect(afterIn).toMatchObject({ wa_opt_in: true, wa_opt_out_at: null, wa_suppressed: false })
      expect(afterIn?.wa_consent_at, 'l’opt-in se date').not.toBeNull()

      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      const { data: afterOut } = await svc.from('contacts')
        .select('wa_opt_in, wa_consent_at, wa_opt_out_at, wa_suppressed').eq('id', contactId).single()
      expect(afterOut?.wa_opt_in).toBe(false)
      expect(afterOut?.wa_opt_out_at, 'un opt-out se DATE, il ne s’efface pas').not.toBeNull()
      expect(afterOut?.wa_consent_at, 'la date d’opt-in reste : c’est l’historique').not.toBeNull()
      expect(afterOut?.wa_suppressed, 'sans ça l’UI ne peut pas expliquer le grisage').toBe(true)

      const { data: sup } = await svc.from('contact_suppressions')
        .select('channel, reason, contact_id, agency_id').eq('contact_id', contactId)
      expect(sup, 'un STOP bloque TOUS les canaux').toHaveLength(1)
      expect(sup?.[0]).toMatchObject({ channel: 'all', reason: 'stop_keyword', agency_id: setup.agencyAId })
    })

    it('un opt-out sur un sujet PROFILE n’écrit JAMAIS de suppression', async () => {
      // Suspendre le numéro d'un agent éteindrait son copilote — et sur un WABA
      // mono-numéro, le blocage vaudrait pour tout le monde.
      //
      // ⚠ Profil ANONYME, pas l'agent A : une déclaration écrite ici vivrait dans le même
      // registre que celles du toggle du brief plus bas, et la portée `daily_brief` la
      // ferait compter comme un opt-out antérieur. Le banc se contredirait lui-même.
      const phone = newPhone()
      await record({
        p_kind: 'profile', p_wa_phone: phone, p_event: 'opt_out', p_source: 'meta_block',
        p_profile_id: crypto.randomUUID(), p_scope: 'daily_brief', p_legal_basis: 'contract',
      })
      const { data } = await svc.from('contact_suppressions').select('id').eq('wa_phone', phone)
      expect(data).toHaveLength(0)
    })

    it('la PREUVE est écrite même quand l’effet ne s’applique pas', async () => {
      // Un opt-out sur un contact d'une agence, sans rien à couper : la déclaration existe
      // quand même. C'est elle qui est opposable, pas ses effets.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      const { data } = await svc.from('whatsapp_consents')
        .select('event, source, subject_kind, agency_id').eq('contact_id', contactId)
      expect(data).toHaveLength(1)
      expect(data?.[0]).toMatchObject({
        event: 'opt_out', source: 'agent_manual', subject_kind: 'contact', agency_id: setup.agencyAId,
      })
    })

    it('l’agence est déduite de la fiche quand l’appelant ne la passe pas', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyBId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'qr',
        p_contact_id: contactId,
      })
      const { data } = await svc.from('whatsapp_consents').select('agency_id').eq('contact_id', contactId).single()
      expect(data?.agency_id, 'une déclaration sans agence est invisible de son propre tenant').toBe(setup.agencyBId)
    })

    it('un numéro hors bornes est refusé à l’écriture aussi', async () => {
      const { error } = await record({
        p_kind: 'contact', p_wa_phone: '1234', p_event: 'opt_in', p_source: 'qr',
        p_contact_id: seededContacts[0],
      })
      expect(error, 'la borne vit des deux côtés, sinon le registre porte des numéros inutilisables').not.toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4. GARDES D'APPELANT ET RLS
  // ══════════════════════════════════════════════════════════════════════════

  describe('gardes d’appelant', () => {
    it('un agent ne peut écrire qu’un agent_manual sur un contact de SON agence', async () => {
      const phone = newPhone()
      const mine = await seedContact(phone, setup.agencyAId)
      const theirs = await seedContact(newPhone(), setup.agencyBId)

      const ok = await setup.clientA.rpc('record_whatsapp_consent', {
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: mine,
      })
      expect(ok.error, 'le geste « ne plus contacter » de la fiche doit passer').toBeNull()

      const cross = await setup.clientA.rpc('record_whatsapp_consent', {
        p_kind: 'contact', p_wa_phone: newPhone(), p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: theirs,
      })
      expect(cross.error?.code).toBe('42501')

      // Toutes les autres sources sont réservées au service : sans cette allow-list, un
      // agent fabriquait un opt-in 'click_to_wa' et rouvrait le marketing d'un clic.
      const forged = await setup.clientA.rpc('record_whatsapp_consent', {
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_in', p_source: 'click_to_wa',
        p_contact_id: mine,
      })
      expect(forged.error?.code).toBe('42501')
    })

    it('la preuve d’un geste manuel est CONSTRUITE côté serveur', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await setup.clientA.rpc('record_whatsapp_consent', {
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: contactId, p_proof: { recorded_by: 'quelqu’un d’autre', at: '1999-01-01' },
      })
      const { data } = await svc.from('whatsapp_consents')
        .select('proof, recorded_by').eq('contact_id', contactId).single()
      const proof = data?.proof as Record<string, unknown> | null
      // La preuve passée par le client est ÉCRASÉE, pas fusionnée : un agent qui attribue
      // son geste à un collègue, ou l'antidate, produirait une preuve qui prouve le contraire.
      expect(proof?.recorded_by, 'l’auteur ne se déclare pas, il se constate').toBe(setup.agentAId)
      expect(proof?.ui_ref).toBe('crm_contact_detail')
      expect(String(proof?.at), 'la date vient du serveur').not.toContain('1999')
      expect(data?.recorded_by).toBe(setup.agentAId)
    })

    it('un agent ne peut interroger la garde que sur SES contacts', async () => {
      const phone = newPhone()
      const theirs = await seedContact(phone, setup.agencyBId)
      const { error } = await setup.clientA.rpc('whatsapp_send_allowed', {
        p_wa_phone: phone, p_purpose: 'service', p_contact_id: theirs,
      })
      expect(error?.code, 'sinon la RPC devient un oracle sur le fichier des autres').toBe('42501')

      // Sans contact du tout, l'oracle serait ouvert sur n'importe quel numéro.
      const bare = await setup.clientA.rpc('whatsapp_send_allowed', { p_wa_phone: phone })
      expect(bare.error?.code).toBe('42501')
    })

    it('suppress_contact_phone et redact_whatsapp_consent sont fermées à un authentifié', async () => {
      const a = await setup.clientA.rpc('suppress_contact_phone', {
        p_wa_phone: newPhone(), p_channel: 'all', p_reason: 'stop_keyword',
      })
      expect(a.error, 'le blocage anonyme appartient au webhook, pas à un agent').not.toBeNull()
      const b = await setup.clientA.rpc('redact_whatsapp_consent', { p_wa_phone: newPhone() })
      expect(b.error).not.toBeNull()
    })

    it('suppress_contact_phone est idempotente : un rejeu Meta ne double pas le blocage', async () => {
      const phone = newPhone()
      const first = await svc.rpc('suppress_contact_phone', {
        p_wa_phone: phone, p_channel: 'all', p_reason: 'stop_keyword', p_source_ref: 'wamid.X',
      })
      expect(first.error).toBeNull()
      expect(first.data, 'la première pose rend l’id').not.toBeNull()

      const second = await svc.rpc('suppress_contact_phone', {
        p_wa_phone: phone, p_channel: 'all', p_reason: 'stop_keyword', p_source_ref: 'wamid.X',
      })
      expect(second.error, 'un rejeu ne doit PAS rendre 500 : le webhook renverrait 500 → tempête').toBeNull()
      expect(second.data, 'NULL = il y avait déjà un blocage actif').toBeNull()

      const { data } = await svc.from('contact_suppressions').select('id').eq('wa_phone', phone)
      expect(data).toHaveLength(1)
    })

    it('RLS : une agence ne voit que SES lignes de registre et de blocage', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })

      const mine = await setup.clientA.from('whatsapp_consents').select('id').eq('contact_id', contactId)
      expect(mine.data, 'sinon l’UI ne peut pas montrer le journal de consentement').toHaveLength(1)
      const theirs = await setup.clientB.from('whatsapp_consents').select('id').eq('contact_id', contactId)
      expect(theirs.data).toHaveLength(0)

      const supMine = await setup.clientA.from('contact_suppressions').select('id').eq('wa_phone', phone)
      expect(supMine.data, 'sinon « Envoyer » est grisé sans motif et l’agent réessaie').toHaveLength(1)
      const supTheirs = await setup.clientB.from('contact_suppressions').select('id').eq('wa_phone', phone)
      expect(supTheirs.data).toHaveLength(0)
    })

    it('un agent ne peut ni écrire ni effacer directement dans le registre', async () => {
      // Les DEFAULT PRIVILEGES de ce projet accordent d'office INSERT/DELETE/TRUNCATE à
      // anon et authenticated sur une table neuve. Sans la révocation, RLS resterait le
      // seul verrou d'un registre de conformité.
      const ins = await setup.clientA.from('whatsapp_consents').insert({
        subject_kind: 'contact', contact_id: seededContacts[0], wa_phone: newPhone(),
        event: 'opt_in', source: 'qr',
      })
      expect(ins.error).not.toBeNull()
      const del = await setup.clientA.from('contact_suppressions').delete().neq('id', crypto.randomUUID())
      expect(del.error).not.toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4bis. CE QUE L2 AJOUTE — idempotence du cron et rattrapage des accusés
  // ══════════════════════════════════════════════════════════════════════════

  describe('interception du STOP — l’état qui vit en base', () => {
    it('stop_handled_at existe et vaut NULL par défaut', async () => {
      // Seul garde-fou d'idempotence du point C : `claim_whatsapp_jobs` re-réclame un job
      // retombé en 'failed', et le registre étant append-only chaque reprise empilerait
      // une déclaration de plus.
      const { data, error } = await svc.from('whatsapp_messages')
        .select('id, stop_handled_at').limit(1)
      expect(error, 'colonne absente = le cron rejoue à chaque tick').toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    /** Le prédicat EXACT du rattrapage de whatsapp-process. */
    const accusesDus = async (phone: string) => {
      const { data } = await svc.from('contact_suppressions')
        .select('wa_phone, contact_id, agency_id')
        .is('lifted_at', null).is('ack_sent_at', null)
        .in('reason', ['stop_keyword', 'meta_block'])
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('wa_phone', phone)
      return data ?? []
    }

    it('un STOP crée un accusé DÛ, que l’envoi consomme', async () => {
      // L'accusé est le SEUL message que recevra jamais qui écrit « stop » en premier :
      // le perdre en silence (waitUntil tué, budget du cron épuisé, réseau) n'est pas une
      // option. L'état vit donc en base, et le rattrapage est gratuit.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      expect(await accusesDus(phone), 'un accusé est dû').toHaveLength(1)

      await svc.rpc('mark_suppression_ack_sent', { p_wa_phone: phone })
      expect(await accusesDus(phone), 'consommé : le balayage ne peut pas doubler l’envoi').toHaveLength(0)
    })

    it('un opt-out saisi par l’AGENT ne doit AUCUN accusé', async () => {
      // La personne n'a rien demandé — lui écrire « votre désinscription est prise en
      // compte » serait un message non sollicité de plus, et un mensonge.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'agent_manual',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      expect(await accusesDus(phone)).toHaveLength(0)
      // …et la RÈGLE vit dans la RPC, pas seulement dans le filtre du balayage. Sans ça,
      // les deux se contrediraient : la garde accordait l'accusé (une suppression active
      // suffisait) là où le balayage l'excluait. Un futur appelant aurait eu raison contre
      // le seul endroit qui décide.
      const v = await allowed({
        p_wa_phone: phone, p_purpose: 'opt_out_ack', p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      expect(v).toMatchObject({ allowed: false, reason: 'ack_not_requested' })
    })

    it('le bouton d’opt-out d’un AGENT ne coupe QUE son brief', async () => {
      // Chemin du point A, écrit tel que le webhook l'appelle. Sur un WABA mono-numéro,
      // suspendre le numéro d'un agent vaudrait pour tous les tenants.
      const phone = newPhone()
      const profileId = crypto.randomUUID()
      await record({
        p_kind: 'profile', p_wa_phone: phone, p_event: 'opt_out', p_source: 'meta_block',
        p_profile_id: profileId, p_agency_id: setup.agencyAId,
        p_legal_basis: 'contract', p_scope: 'daily_brief',
      })
      const { data: sup } = await svc.from('contact_suppressions').select('id').eq('wa_phone', phone)
      expect(sup, 'aucune suppression pour un sujet profile').toHaveLength(0)
      expect(await accusesDus(phone), 'donc aucun accusé dû non plus').toHaveLength(0)

      const { data: rows } = await svc.from('whatsapp_consents')
        .select('scope, source, event').eq('profile_id', profileId)
      expect(rows).toHaveLength(1)
      expect(rows?.[0], 'l’équivalence stricte du design rejetait cette ligne').toMatchObject({
        event: 'opt_out', source: 'meta_block', scope: 'daily_brief',
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4ter. RÉCONCILIATION NOCTURNE — le cache raconte ce que le registre dit
  // ══════════════════════════════════════════════════════════════════════════

  describe('reconcile_wa_consent_cache', () => {
    const cache = async (id: string) => (await svc.from('contacts')
      .select('wa_opt_in, wa_consent_at, wa_opt_out_at, wa_suppressed').eq('id', id).single()).data

    it('en régime nominal, elle ne corrige RIEN', async () => {
      // ⚠ PREMIER APPEL : ramener la base à zéro dérive. Ce n'est pas une commodité de test,
      // c'est la fonction qui fait son travail — les tests précédents LÈVENT des suppressions
      // en SQL direct (`lifted_at`), geste qui n'a aucune RPC pour recaler le cache. C'est
      // exactement le chemin pour lequel cette réconciliation existe, et la première version
      // de ce test l'ignorait : elle attendait 0 sur une base que la suite avait fait dériver
      // de quatre fiches. Le rouge en CI venait du TEST, pas de la fonction.
      await svc.rpc('reconcile_wa_consent_cache')

      // À partir d'ici la base est en phase. Une écriture par la RPC ne doit RIEN laisser à
      // corriger : le nombre rendu EST la dérive, et sans le filtre de divergence la
      // fonction rendrait le même chiffre chaque nuit.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      const { data: n, error } = await svc.rpc('reconcile_wa_consent_cache')
      expect(error).toBeNull()
      expect(Number(n), 'record_whatsapp_consent tient déjà le cache à jour').toBe(0)
    })

    it('elle rattrape un cache faussé, dans les DEUX sens', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      // On simule les deux chemins qui évitent la RPC : une écriture directe du cache
      // (import, correction à la main) et une LEVÉE de blocage par un super-admin.
      execSql(`update public.contacts
                  set wa_opt_in = true, wa_suppressed = false, wa_opt_out_at = null
                where id = '${contactId}';`)
      expect((await cache(contactId))?.wa_suppressed, 'la fiche ment maintenant').toBe(false)

      const { data: n } = await svc.rpc('reconcile_wa_consent_cache')
      expect(Number(n), 'une fiche divergeait').toBeGreaterThanOrEqual(1)
      const apres = await cache(contactId)
      expect(apres?.wa_suppressed, 'le blocage est réaffirmé').toBe(true)
      expect(apres?.wa_opt_in).toBe(false)
      expect(apres?.wa_opt_out_at, 'un opt-out se date, il ne s’efface pas').not.toBeNull()

      // Sens inverse : blocage levé → le cache doit cesser de l'afficher.
      execSql(`update public.contact_suppressions
                  set lifted_at = now(), lifted_reason = 'super_admin'
                where contact_id = '${contactId}' and lifted_at is null;`)
      await svc.rpc('reconcile_wa_consent_cache')
      expect((await cache(contactId))?.wa_suppressed, 'une levée n’a aucune RPC pour l’écrire').toBe(false)
    })

    it('elle est fermée à un agent — c’est un travail de nuit, pas un geste', async () => {
      const r = await setup.clientA.rpc('reconcile_wa_consent_cache')
      expect(r.error).not.toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4quater. click_to_wa — LE SEUL chemin d'opt-in
  // ══════════════════════════════════════════════════════════════════════════

  describe('invitation d’opt-in (click_to_wa)', () => {
    const TEXTE = 'Régie du Lac SA peut vous envoyer sur WhatsApp les biens correspondant à '
      + 'votre recherche. Vous pouvez arrêter à tout moment en répondant STOP.'

    const inviter = async (contactId: string) => {
      const { data, error } = await svc.rpc('create_wa_optin_invite', {
        p_contact_id: contactId, p_shown_text: TEXTE, p_lang: 'fr',
      })
      if (error) throw new Error(error.message)
      return (data as Array<{ id: string; wa_phone: string }>)[0]
    }

    it('⛔ RÉGRESSION — `sent_by` est ÉCRIT, pas seulement déclaré', async () => {
      // La colonne existait dans une table de PREUVE et n'était renseignée par personne : la
      // question « qui a déclenché cette invitation ? » n'avait de réponse que dans
      // `activity_events`, écrit en best-effort. On compte la VALEUR, pas l'absence d'erreur.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      // uuid NU, sans FK — même doctrine que `contact_id` sur cette table.
      const profileId = crypto.randomUUID()
      const { data, error } = await svc.rpc('create_wa_optin_invite', {
        p_contact_id: contactId, p_shown_text: TEXTE, p_lang: 'fr', p_sent_by: profileId,
      })
      expect(error).toBeNull()
      const inv = (data as Array<{ id: string }>)[0]
      const { data: row } = await svc.from('whatsapp_optin_invites')
        .select('sent_by').eq('id', inv.id).single()
      expect(row?.sent_by).toBe(profileId)

      // Facultatif : le copilote WhatsApp n'a pas toujours de profil en main.
      const inv2 = await inviter(contactId)
      const { data: row2 } = await svc.from('whatsapp_optin_invites')
        .select('sent_by').eq('id', inv2.id).single()
      expect(row2?.sent_by).toBeNull()
    })

    it('un aller complet produit un opt-in de base « consent », et il OUVRE le marketing', async () => {
      // C'est tout l'enjeu : sans ce chemin, `purpose:'marketing'` ne peut JAMAIS passer —
      // aucune ligne `legal_basis='consent'` n'existe, et la garde paraît cassée.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      const avant = await allowed({
        p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      expect(avant, 'aucun consentement au départ').toMatchObject({ allowed: false, reason: 'no_opt_in' })

      const inv = await inviter(contactId)
      const { data: issue } = await svc.rpc('consume_wa_optin_invite', {
        p_invite_id: inv.id, p_wa_phone: phone, p_message_id: 'wamid.OPTIN1',
      })
      expect(issue).toBe('ok')

      const apres = await allowed({
        p_wa_phone: phone, p_purpose: 'marketing', p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      expect(apres).toMatchObject({ allowed: true, reason: 'ok', legal_basis: 'consent' })
    })

    it('la PREUVE voyage avec la déclaration', async () => {
      // Un opt-in sans trace de ce qui a été montré ne prouve rien (art. 6 al. 6 nLPD) :
      // un audit ne doit avoir à reconstituer ni le texte, ni la langue, ni l'invitation.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      const inv = await inviter(contactId)
      await svc.rpc('consume_wa_optin_invite', { p_invite_id: inv.id, p_wa_phone: phone })

      const { data } = await svc.from('whatsapp_consents')
        .select('event, source, legal_basis, purpose, proof').eq('contact_id', contactId).single()
      expect(data).toMatchObject({
        event: 'opt_in', source: 'click_to_wa', legal_basis: 'consent', purpose: 'marketing',
      })
      const proof = data?.proof as Record<string, unknown>
      expect(proof.shown_text, 'le texte MONTRÉ, mot pour mot').toBe(TEXTE)
      expect(proof.lang).toBe('fr')
      expect(proof.invite_id).toBe(inv.id)
    })

    it('⛔ un EXPÉDITEUR différent du numéro invité ne consent à RIEN', async () => {
      // Le cœur de la sécurité. Le jeton prouve que MEGGA a écrit au contact ; c'est
      // l'expéditeur qui prouve que ce numéro-là veut recevoir. Sans cette égalité, un lien
      // intercepté ferait naître un opt-in attribué au contact — et la garde autoriserait
      // alors du marketing vers le VRAI numéro, que son titulaire n'a jamais consenti.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      const inv = await inviter(contactId)

      const { data: issue } = await svc.rpc('consume_wa_optin_invite', {
        p_invite_id: inv.id, p_wa_phone: newPhone(), p_message_id: 'wamid.PIRATE',
      })
      expect(issue).toBe('phone_mismatch')

      const { data: rows } = await svc.from('whatsapp_consents').select('id').eq('contact_id', contactId)
      expect(rows, 'aucune déclaration fabriquée').toHaveLength(0)
      const { data: encore } = await svc.from('whatsapp_optin_invites')
        .select('consumed_at').eq('id', inv.id).single()
      expect(encore?.consumed_at, 'l’invitation reste ouverte pour son vrai destinataire').toBeNull()
    })

    it('l’usage est UNIQUE : un rejeu ne double pas le consentement', async () => {
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      const inv = await inviter(contactId)
      const un = await svc.rpc('consume_wa_optin_invite', { p_invite_id: inv.id, p_wa_phone: phone })
      const deux = await svc.rpc('consume_wa_optin_invite', { p_invite_id: inv.id, p_wa_phone: phone })
      expect(un.data).toBe('ok')
      expect(deux.data).toBe('already_consumed')
      const { data: rows } = await svc.from('whatsapp_consents').select('id').eq('contact_id', contactId)
      expect(rows).toHaveLength(1)
    })

    it('une invitation expirée est refusée', () => {
      // On la vieillit en SQL : `create_wa_optin_invite` ne sait pas produire un passé.
      assertSql(`
      declare v_id uuid; v_contact uuid; v_agency uuid; v_issue text;
      begin
        select id, agency_id into v_contact, v_agency from public.contacts
         where phone is not null order by created_at desc limit 1;
        insert into public.whatsapp_optin_invites
          (contact_id, agency_id, wa_phone, shown_text, expires_at)
        values (v_contact, v_agency, '410000000001',
                '${TEXTE}', now() - interval '1 day')
        returning id into v_id;
        select public.consume_wa_optin_invite(v_id, '410000000001') into v_issue;
        if v_issue <> 'expired' then
          raise exception 'attendu expired, recu %', v_issue;
        end if;
        delete from public.whatsapp_optin_invites where id = v_id;
      end`)
    })

    it('⛔ on n’invite PAS un numéro déjà bloqué', async () => {
      // Demander « puis-je vous écrire ? » à quelqu'un qui vient de dire STOP est
      // précisément le message qu'il a refusé — et par e-mail, donc hors de portée de la
      // garde WhatsApp.
      const phone = newPhone()
      const contactId = await seedContact(phone, setup.agencyAId)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: contactId, p_agency_id: setup.agencyAId,
      })
      const { error } = await svc.rpc('create_wa_optin_invite', {
        p_contact_id: contactId, p_shown_text: TEXTE, p_lang: 'fr',
      })
      expect(error?.message ?? '').toContain('phone_suppressed')
    })

    it('les deux RPC sont fermées à un agent authentifié', async () => {
      const a = await setup.clientA.rpc('create_wa_optin_invite', {
        p_contact_id: seededContacts[0], p_shown_text: TEXTE, p_lang: 'fr',
      })
      expect(a.error, 'un agent ne fabrique pas une invitation sans passer par l’edge').not.toBeNull()
      const b = await setup.clientA.rpc('consume_wa_optin_invite', {
        p_invite_id: crypto.randomUUID(), p_wa_phone: newPhone(),
      })
      expect(b.error, 'ni ne consent à la place de quelqu’un').not.toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4quinquies. LE CANAL E-MAIL — un STOP WhatsApp coupe aussi les relances
  // ══════════════════════════════════════════════════════════════════════════

  describe('email_send_allowed', () => {
    const mail = (tag: string) => `stop-${tag}-${Date.now()}-${phoneSeq++}@megga-test.local`

    const verdict = async (email: string, purpose = 'relance') => {
      const { data, error } = await svc.rpc('email_send_allowed', { p_email: email, p_purpose: purpose })
      if (error) throw new Error(error.message)
      return (data as Array<{ allowed: boolean; reason: string }>)[0]
    }

    it('une adresse inconnue passe', async () => {
      expect(await verdict(mail('libre'))).toMatchObject({ allowed: true, reason: 'ok' })
    })

    it('⛔ un STOP reçu sur WHATSAPP coupe les relances par E-MAIL', async () => {
      // C'est le trou que ce lot ferme : le refus était enregistré, opposable — et ce
      // canal-ci l'ignorait. La personne disait stop et continuait de recevoir des mails.
      const phone = newPhone()
      const email = mail('wa')
      const { data: c, error } = await svc.from('contacts').insert({
        agency_id: setup.agencyAId, first_name: 'Stop', last_name: 'Mail',
        email, phone, source: 'manual', type: 'lead',
      }).select('id').single()
      if (error) throw new Error(error.message)
      seededContacts.push(c.id); seededPhones.push(phone)

      expect((await verdict(email)).allowed, 'joignable au départ').toBe(true)
      await record({
        p_kind: 'contact', p_wa_phone: phone, p_event: 'opt_out', p_source: 'stop_keyword',
        p_contact_id: c.id, p_agency_id: setup.agencyAId,
      })
      expect(await verdict(email)).toMatchObject({ allowed: false, reason: 'unsubscribed' })

      // …mais un TRANSACTIONNEL passe : c'est une réponse à un geste de la personne, pas
      // une sollicitation. La priver de sa confirmation de visite serait un zèle nuisible.
      expect(await verdict(email, 'transactional')).toMatchObject({ allowed: true, reason: 'ok_transactional' })
    })

    it('un clic « se désinscrire » bloque l’ADRESSE, et lui seule', async () => {
      const email = mail('unsub')
      const { data: id, error } = await svc.rpc('suppress_contact_email', {
        p_email: email, p_source_ref: 'list_unsubscribe_one_click',
      })
      expect(error).toBeNull()
      expect(id, 'la première désinscription rend son id').not.toBeNull()
      expect(await verdict(email)).toMatchObject({ allowed: false, reason: 'unsubscribed' })

      // Idempotent : un second clic (Gmail rejoue parfois le one-click) ne doit pas échouer.
      const again = await svc.rpc('suppress_contact_email', { p_email: email })
      expect(again.error, 'un rejeu ne rend pas 500').toBeNull()
      expect(again.data, 'NULL = déjà désinscrite').toBeNull()

      // ⛔ Le geste NE déborde PAS sur WhatsApp : channel='email'. Étendre une
      // désinscription e-mail au canal WhatsApp serait décider à la place de la personne.
      const { data: rows } = await svc.from('contact_suppressions')
        .select('channel, wa_phone, email').eq('email', email)
      expect(rows).toHaveLength(1)
      expect(rows?.[0]).toMatchObject({ channel: 'email', wa_phone: null })
    })

    it('la casse de l’adresse n’ouvre pas une porte dérobée', async () => {
      const email = mail('case')
      await svc.rpc('suppress_contact_email', { p_email: email.toUpperCase() })
      expect(await verdict(email.toLowerCase())).toMatchObject({ allowed: false })
      expect(await verdict(email.toUpperCase())).toMatchObject({ allowed: false })
    })

    it('une adresse malformée est refusée, pas devinée', async () => {
      for (const bad of ['', '   ', 'pas-une-adresse', 'a@b', 'a b@c.ch']) {
        expect((await verdict(bad)).reason, bad).toBe('invalid_email')
      }
    })

    it('suppress_contact_email est fermée à un agent', async () => {
      const r = await setup.clientA.rpc('suppress_contact_email', { p_email: mail('agent') })
      expect(r.error, 'la désinscription passe par le lien public, pas par un agent').not.toBeNull()
    })

    it('⛔ email_send_allowed est fermée à un agent — une adresse n’est pas un oracle', async () => {
      // Accordée à `authenticated`, elle devenait ÉNUMÉRABLE : l'agence B testait n'importe
      // quelle adresse et apprenait si elle s'était désinscrite chez l'agence A — l'oracle
      // exact que `public_reason` et la policy RLS existent pour fermer.
      //
      // ⚠ L'asymétrie avec `whatsapp_send_allowed`, elle, est voulue : celui-là exige un
      // `p_contact_id` DE L'AGENCE de l'appelant. Ici l'entrée est une ADRESSE — précisément
      // parce que la personne qui se désinscrit n'a pas forcément de fiche — donc aucune
      // garde de tenant n'est possible. Les trois appelants sont des edges en service_role.
      const r = await setup.clientA.rpc('email_send_allowed', { p_email: mail('oracle') })
      expect(r.error, 'aucun appelant front n’existe : la fonction ne doit pas être joignable').not.toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 5. LE TOGGLE DU BRIEF — désactiver → réactiver → désactiver
  // ══════════════════════════════════════════════════════════════════════════

  describe('set_morning_brief_enabled', () => {
    let agentPhone: string

    beforeAll(async () => {
      agentPhone = newPhone()
      const { error } = await svc.from('whatsapp_agent_links').insert({
        profile_id: setup.agentAId, agency_id: setup.agencyAId,
        wa_number: agentPhone, verified: true, verified_at: new Date().toISOString(),
      })
      if (error) throw new Error(`agent_link: ${error.message}`)
    })

    afterAll(async () => {
      await svc.from('whatsapp_agent_links').delete().eq('profile_id', setup.agentAId)
    })

    it('un aller-retour-aller du toggle laisse la colonne et le registre d’accord', async () => {
      // Le troisième mouvement est celui qui compte : c'est là qu'une incohérence de portée
      // ou de source se voit, et pas avant.
      const brief = () => allowed({ p_wa_phone: agentPhone, p_profile_id: setup.agentAId, p_purpose: 'service', p_scope: 'daily_brief' })
      const colonne = async () => (await svc.from('whatsapp_agent_links')
        .select('morning_brief_enabled').eq('profile_id', setup.agentAId).single()).data?.morning_brief_enabled

      expect((await brief()).allowed, 'un agent apparié reçoit le brief par défaut').toBe(true)

      expect((await setup.clientA.rpc('set_morning_brief_enabled', { p_enabled: false })).error).toBeNull()
      expect(await colonne()).toBe(false)
      expect(await brief()).toMatchObject({ allowed: false, reason: 'opted_out', legal_basis: 'contract' })

      expect((await setup.clientA.rpc('set_morning_brief_enabled', { p_enabled: true })).error,
        'la réactivation échouait en 42501 dans le design : agent_pairing n’est pas dans l’allow-list').toBeNull()
      expect(await colonne()).toBe(true)
      expect((await brief()).allowed).toBe(true)

      expect((await setup.clientA.rpc('set_morning_brief_enabled', { p_enabled: false })).error).toBeNull()
      expect(await colonne()).toBe(false)
      expect((await brief()).allowed).toBe(false)

      const { data } = await svc.from('whatsapp_consents')
        .select('event, source, scope').eq('profile_id', setup.agentAId).order('created_at')
      expect(data?.map((r) => `${r.event}/${r.source}/${r.scope}`)).toEqual([
        'opt_out/brief_disabled/daily_brief',
        'opt_in/brief_enabled/daily_brief',
        'opt_out/brief_disabled/daily_brief',
      ])
    })

    it('couper le brief ne coupe QUE le brief', async () => {
      // Sans la portée, « je ne veux plus le brief du matin » éteignait aussi le PDF KYC,
      // les résultats async, les confirmations d'appairage et les réponses du copilote.
      expect((await setup.clientA.rpc('set_morning_brief_enabled', { p_enabled: false })).error).toBeNull()
      const brief = await allowed({ p_wa_phone: agentPhone, p_profile_id: setup.agentAId, p_purpose: 'service', p_scope: 'daily_brief' })
      expect(brief.allowed).toBe(false)
      const reste = await allowed({ p_wa_phone: agentPhone, p_profile_id: setup.agentAId, p_purpose: 'service' })
      expect(reste, 'portée « all » : le copilote et le PDF KYC continuent').toMatchObject({
        allowed: true, reason: 'ok', legal_basis: 'contract', subject_kind: 'profile',
      })
    })

    it('un agent n’a jamais droit au marketing, même apparié', async () => {
      const v = await allowed({ p_wa_phone: agentPhone, p_profile_id: setup.agentAId, p_purpose: 'marketing' })
      expect(v).toMatchObject({ allowed: false, reason: 'marketing_requires_consent', legal_basis: 'contract' })
    })

    it('sans lien vérifié, le toggle refuse au lieu d’écrire une ligne orpheline', async () => {
      const r = await setup.clientB.rpc('set_morning_brief_enabled', { p_enabled: false })
      expect(r.error, 'un brief_disabled orphelin bloquerait plus tard sans qu’aucune UI ne l’explique').not.toBeNull()
    })
  })
})
