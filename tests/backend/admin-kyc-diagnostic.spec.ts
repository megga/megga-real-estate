// Backend integration spec (live CI) — diagnostic d'un lien KYC
// (migration 20260801310000, étape 19, spec §5.5 et HANDOFF_KYC_DIAGNOSTIC.md).
//
// Le handoff ouvre par : « les contraintes ci-dessous ne sont pas des détails d'UI, elles
// définissent ce que la plateforme a le droit de VOIR des clients finaux d'une agence ».
// Ce fichier est donc d'abord un test de NON-FUITE, et seulement ensuite un test de
// fonctionnement :
//
//   1. SEPT CHAMPS, PAS HUIT. Ni jeton, ni URL, ni documents, ni IP, ni user-agent — toutes
//      ces colonnes existent pourtant sur la ligne, et un `select *` les aurait sorties.
//   2. LE PLAFOND DE 3. Au-delà, le COMPTE sort, jamais les lignes : un compte ne nomme
//      personne. C'est la différence entre « votre recherche est trop large » et une liste
//      parcourable de clients finaux, que le produit a explicitement supprimée.
//   3. LE MOTIF OBLIGATOIRE. Sans lui l'audit dit qui a cherché un nom, jamais pourquoi.
//
// ⚠ MESURÉ, ET DÉTERMINANT POUR CE FICHIER : le plafond de débit compte les lignes
// d'`admin_log` de `actor_user_id = auth.uid()`. Sous `service_role`, `auth.uid()` est NULL
// et `actor_user_id = NULL` n'est jamais vrai en SQL — le compteur rend donc toujours 0.
// Le plafond ne s'éprouve QUE depuis un vrai super-admin authentifié.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

/**
 * Les SEPT champs autorisés par §4 du handoff, plus l'identifiant que l'écran doit cibler.
 * ⚠ `email_sent_at` a REMPLACÉ `sent_at` le 01.08 — même nombre de champs, mais celui-ci
 * dit la vérité : `sent_at` est un DEFAULT now() posé à l'INSERT que rien ne met à jour.
 */
const CHAMPS_AUTORISES = ['link_id', 'contact', 'email', 'phone', 'agency', 'status', 'mode', 'email_sent_at']
/** Ce que §2 interdit nommément. */
const CHAMPS_INTERDITS = ['token', 'link_url', 'url', 'documents', 'ip', 'client_ip', 'user_agent',
                          'client_user_agent', 'kyc_case_id', 'custom_message']

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('diagnostic d\'un lien KYC (étape 19)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''
  let contactId = ''
  let linkId = ''
  const JETON = 'jeton-qui-ne-doit-jamais-sortir'

  /**
   * Crée un dossier KYC, seul moyen de poser un lien : `kyc_magic_links.kyc_case_id` est
   * NOT NULL SANS défaut. L'omettre faisait échouer le beforeAll, donc SKIPPER la suite —
   * « N ignorés » au lieu de « N échecs ». `type` est un enum sans défaut
   * (buyer_pp|buyer_pm|seller_pp|seller_pm) : l'inventer lèverait 22P02.
   */
  const creerDossier = async (agencyId: string, contact: string): Promise<string> => {
    const { data, error } = await serviceRoleClient().from('kyc_cases')
      .insert({ agency_id: agencyId, contact_id: contact, type: 'buyer_pp' })
      .select('id').single()
    if (error) throw new Error(`kyc_case: ${error.message}`)
    return data.id as string
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    const svc = serviceRoleClient()
    const email = `kycdiag-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Diag ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Diag ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // Un contact au nom ACCENTUÉ et au téléphone espacé : la normalisation doit trouver les
    // deux formes. Le prénom porte le stamp pour rester unique dans une base partagée.
    const { data: c, error: cErr } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId,
      first_name: `Sophie${stamp}`, last_name: 'Marchand-Frédéric',
      email: `sophie.${stamp}@megga-staging.invalid`, phone: '+41 79 412 08 51',
    }).select('id').single()
    if (cErr) throw new Error(`contact: ${cErr.message}`)
    contactId = c.id

    // Le lien porte un jeton RECONNAISSABLE : sa présence dans une réponse EST la fuite.
    const { data: l, error: lErr } = await svc.from('kyc_magic_links').insert({
      token: JETON, agency_id: setup.agencyAId, contact_id: contactId,
      kyc_case_id: await creerDossier(setup.agencyAId, contactId),
      mode: 'libre', channels: ['email'], status: 'pending',
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      sent_at: new Date().toISOString(),
      client_ip: '203.0.113.42', client_user_agent: 'Mozilla/5.0 test',
    }).select('id').single()
    if (lErr) throw new Error(`lien: ${lErr.message}`)
    linkId = l.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.from('kyc_magic_links').delete().eq('contact_id', contactId).then(() => {}, () => {})
    await svc.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  const chercher = async (q: string, client?: SupabaseClient): Promise<Row> => {
    const { data, error } = await (client ?? serviceRoleClient()).rpc('admin_kyc_link_lookup', {
      p_motive_agency_id: setup.agencyAId, p_motive_ref: `TICKET-${stamp}`, p_query: q,
    })
    if (error) throw new Error(`lookup: ${error.message}`)
    return data as Row
  }

  // ── 1. La non-fuite ────────────────────────────────────────────────────────────

  it('LA NON-FUITE — sept champs, et pas un de plus', async () => {
    const r = await chercher(`Sophie${stamp}`)
    expect(r.ok, 'la recherche doit aboutir').toBe(true)
    const m = ((r.data as Row).matches as Row[])[0]
    expect(m, 'le lien semé est trouvé').toBeTruthy()

    for (const k of Object.keys(m)) {
      expect(CHAMPS_AUTORISES, `champ « ${k} » hors du contrat §4 du handoff`).toContain(k)
    }
    for (const interdit of CHAMPS_INTERDITS) {
      expect(Object.keys(m), `« ${interdit} » est interdit par §2`).not.toContain(interdit)
    }
  })

  it('LA PREUVE D\'ENVOI EN EST UNE — « créé mais jamais parti » devient lisible', async () => {
    // Le diagnostic remettait `sent_at`, et toute l'étape 19 existe pour répondre à « où en
    // est ce lien ? » quand une agence signale que sa cliente ne l'a jamais reçu. Or
    // `sent_at` est un `DEFAULT now()` posé à l'INSERT que RIEN ne met jamais à jour (grep
    // exhaustif : aucun UPDATE ne le touche). Il vaut donc la même chose que Resend ait
    // répondu 200, 502, ou n'ait jamais été appelé — le cas quand le canal choisi est
    // `sms`, que personne ne consomme. Le champ censé porter la preuve d'envoi ne
    // distinguait pas « envoyé » de « jamais parti ».
    //
    // ⚠ POURQUOI ON N'A PAS CORRIGÉ `sent_at` EN PLACE : le rendre nullable casserait la
    // contrainte `expires_at > sent_at`, et surtout `get_admin_end_user_stats` filtre
    // `where sent_at >= v_month_start` — une cohorte MENSUELLE qui aurait perdu des lignes
    // en silence. On ajoute une colonne qui dit vrai plutôt que de déplacer le défaut.
    //
    // Le lien semé par ce fichier est inséré directement en base : rien ne l'a jamais
    // envoyé. C'est exactement le cas que l'opérateur doit pouvoir constater.
    // ⚠ MESURÉ : `admin_ok` applique `jsonb_strip_nulls`, et c'est RÉCURSIF — une valeur
    // nulle disparaît jusque dans les objets imbriqués de `matches`. Le contrat du dépôt est
    // donc « clé absente = null », et `contact`, `email` et `phone` s'y conforment déjà.
    // On asserte le COMPORTEMENT, pas la forme de la clé : un test qui exigerait
    // `email_sent_at: null` échouerait sur une enveloppe pourtant correcte.
    const jamais = ((await chercher(`Sophie${stamp}`)).data as Row).matches as Row[]
    expect(jamais[0].email_sent_at, 'un lien jamais envoyé ne porte AUCUN horodatage d\'envoi')
      .toBeFalsy()
    expect(Object.keys(jamais[0]), '`sent_at` ne dit rien d\'un envoi — il ne doit plus sortir')
      .not.toContain('sent_at')

    // L'autre moitié du contrat, et la seule qui prouve que la colonne est vraiment
    // projetée : quand un envoi a eu lieu, le diagnostic le REMET. On pose l'horodatage en
    // base plutôt que d'envoyer un e-mail — Resend n'a pas sa place dans une suite de tests.
    const svc = serviceRoleClient()
    const quand = new Date(Date.now() - 3_600_000).toISOString()
    await svc.from('kyc_magic_links').update({ email_sent_at: quand }).eq('id', linkId)
    try {
      const envoye = ((await chercher(`Sophie${stamp}`)).data as Row).matches as Row[]
      expect(envoye[0].email_sent_at, 'un envoi réel est remis, et daté').toBeTruthy()
      expect(new Date(String(envoye[0].email_sent_at)).getTime(),
        'et c\'est bien CET horodatage, pas un autre').toBe(new Date(quand).getTime())
    } finally {
      // Remise à l'état semé : les tests suivants partagent ce lien.
      await svc.from('kyc_magic_links').update({ email_sent_at: null }).eq('id', linkId)
    }
  })

  it('LA NON-FUITE — ni le jeton, ni l\'IP, ni le user-agent, sous AUCUN nom', async () => {
    // Le contrôle par nom de clé ne suffit pas : une projection qui renommerait `token` en
    // `code` passerait. On cherche donc les VALEURS, qui sont reconnaissables à dessein.
    const brut = JSON.stringify(await chercher(`Sophie${stamp}`)).toLowerCase()
    expect(brut, 'le jeton du lien a fuité').not.toContain(JETON)
    expect(brut, 'l\'adresse IP du client final a fuité').not.toContain('203.0.113.42')
    expect(brut, 'le user-agent du client final a fuité').not.toContain('mozilla')
  })

  // ── 2. Le motif (§3, étape 1) ──────────────────────────────────────────────────

  it('LE MOTIF est obligatoire — sans lui, la RPC refuse', async () => {
    const svc = serviceRoleClient()
    const { data: sansRef } = await svc.rpc('admin_kyc_link_lookup', {
      p_motive_agency_id: setup.agencyAId, p_motive_ref: '   ', p_query: `Sophie${stamp}`,
    })
    expect((sansRef as Row).ok).toBe(false)
    expect((sansRef as Row).code).toBe('precondition_failed')

    const { data: sansAgence } = await svc.rpc('admin_kyc_link_lookup', {
      p_motive_agency_id: null, p_motive_ref: 'TICKET-1', p_query: `Sophie${stamp}`,
    })
    expect((sansAgence as Row).code).toBe('precondition_failed')

    // Une agence inventée n'est pas un motif : elle rendrait le champ décoratif.
    const { data: fantome } = await svc.rpc('admin_kyc_link_lookup', {
      p_motive_agency_id: '00000000-0000-0000-0000-000000000000',
      p_motive_ref: 'TICKET-1', p_query: `Sophie${stamp}`,
    })
    expect((fantome as Row).code).toBe('not_found')
  })

  // ── 3. La recherche (§3, étape 2) ──────────────────────────────────────────────

  it('la requête est NORMALISÉE — accents et espaces ne font pas obstacle', async () => {
    // Le téléphone est stocké « +41 79 412 08 51 » ; l'agence le dictera collé.
    const parTel = await chercher('+41794120851')
    expect(Number((parTel.data as Row).count), 'un numéro sans espaces doit trouver')
      .toBeGreaterThanOrEqual(1)

    // Le nom porte un accent ; la recherche se fait sans.
    const sansAccent = await chercher(`marchand-frederic`)
    expect(Number((sansAccent.data as Row).count), '« frederic » doit trouver « Frédéric »')
      .toBeGreaterThanOrEqual(1)
  })

  it('moins de 3 caractères est refusé, pas ignoré', async () => {
    const r = await chercher('ab')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('precondition_failed')
  })

  it('LE PLAFOND DE 3 — au-delà, le compte sort, JAMAIS les lignes', async () => {
    // Quatre liens partageant un motif de recherche : le plafond doit se déclencher.
    const svc = serviceRoleClient()
    const motif = `plafond${stamp}`
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const { data: c } = await svc.from('contacts').insert({
        agency_id: setup.agencyAId, first_name: `${motif}`, last_name: `N${i}`,
        email: `${motif}-${i}@megga-staging.invalid`,
      }).select('id').single()
      const { data: l } = await svc.from('kyc_magic_links').insert({
        token: `t-${motif}-${i}`, agency_id: setup.agencyAId, contact_id: c!.id,
        kyc_case_id: await creerDossier(setup.agencyAId, c!.id),
        mode: 'libre', channels: ['email'], status: 'pending',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      }).select('id').single()
      ids.push(c!.id)
      void l
    }

    try {
      const r = await chercher(motif)
      expect(r.ok, 'quatre correspondances dépassent le plafond').toBe(false)
      expect(r.code).toBe('too_many')
      expect(Number((r.details as Row).count), 'le COMPTE est rendu').toBe(4)

      // Le point entier du plafond : le compte ne nomme personne, les lignes si.
      const brut = JSON.stringify(r).toLowerCase()
      expect(brut, 'aucune ligne ne doit sortir au-delà du plafond').not.toContain('@megga-staging.invalid')
      expect(Object.keys(r), 'pas de `data` : il n\'y a rien à montrer').not.toContain('data')
    } finally {
      for (const id of ids) {
        await svc.from('kyc_magic_links').delete().eq('contact_id', id).then(() => {}, () => {})
        await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
      }
    }
  })

  // ── 4. La régénération (§4) ────────────────────────────────────────────────────

  it('LA RÉGÉNÉRATION NE DÉTRUIT PAS CE QU\'ELLE NE SAIT PAS REMPLACER', async () => {
    // Ce test asserait l'inverse jusqu'au 01.08 : « l'ancien lien est invalidé ».
    // Il encodait un défaut. La spec écrit le geste en TROIS temps indissociables —
    // « invalide l'ancien lien, en émet un nouveau, le dépose côté agence » — et la RPC
    // n'en exécutait qu'un : elle expirait, déposait un job que PERSONNE ne consomme
    // (mesuré : zéro appelant d'admin_outbox_claim hors tests, le seul cron outbox est une
    // purge), puis journalisait une régénération accomplie.
    //
    // Résultat : le lien de la cliente cessait de fonctionner, le remplaçant ne partait
    // jamais, et le registre — infalsifiable — attestait d'un fait qui n'avait pas eu lieu.
    // Sous le seul scénario que la spec décrit (« elle n'a jamais reçu son lien »), c'est
    // le pire des états possibles : elle l'avait peut-être, et on vient de le lui retirer.
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('admin_kyc_link_regenerate', {
      p_link_id: linkId, p_motive_agency_id: setup.agencyAId,
      p_motive_ref: `TICKET-${stamp}`, p_idempotency_key: `regen-${stamp}`,
    })
    expect(error).toBeNull()
    const r = data as Row
    expect(r.ok).toBe(true)
    expect((r.data as Row).requested_at, '§4 : succès + horodatage').toBeTruthy()
    expect((r.data as Row).emission, 'la réponse dit que l\'émission RESTE À FAIRE')
      .toBe('pending')
    expect((r.data as Row).regenerated_at,
      'plus de « regenerated_at » : rien n\'a été régénéré').toBeUndefined()

    // « Réponse : succès + horodatage, PAS le lien lui-même. »
    const brut = JSON.stringify(r).toLowerCase()
    expect(brut, 'le nouveau lien ne doit pas transiter par la réponse').not.toContain('token')
    expect(brut).not.toContain('http')

    // LE CŒUR DU TEST : l'ancien lien est INTACT.
    const { data: ancien } = await svc.from('kyc_magic_links')
      .select('status, expired_at').eq('id', linkId).single()
    expect((ancien as Row).status,
      'l\'ancien lien reste utilisable tant qu\'aucun remplaçant n\'est parti').not.toBe('expired')
    expect((ancien as Row).expired_at,
      'ne rien détruire, c\'est aussi ne rien dater').toBeNull()

    // L'invalidation n'est pas abandonnée : elle est DÉPLACÉE chez celui qui émettra, pour
    // qu'elle arrive dans le même souffle que le remplacement.
    const { data: jobs } = await svc.from('outbox_jobs')
      .select('kind, payload').eq('payload->>previous_link_id', linkId)
    expect((jobs as Row[]).length, 'un job d\'émission est déposé').toBe(1)
    expect((jobs as Row[])[0].kind).toBe('notify')
    const charge = (jobs as Row[])[0].payload as Row
    expect(charge.deliver_to,
      '§2 : le lien est remis à l\'AGENCE, jamais envoyé au client final').toBe('agency')
    expect(charge.expire_previous,
      'le consommateur DOIT expirer l\'ancien, une fois le nouveau frappé').toBe(true)
  })

  it('L\'IDEMPOTENCE — un double-clic ne régénère pas deux fois', async () => {
    // Sans elle, l'agence recevrait deux liens pour un seul signalement.
    const svc = serviceRoleClient()
    const { data } = await svc.rpc('admin_kyc_link_regenerate', {
      p_link_id: linkId, p_motive_agency_id: setup.agencyAId,
      p_motive_ref: `TICKET-${stamp}`, p_idempotency_key: `regen-${stamp}`,
    })
    expect((data as Row).ok).toBe(true)
    expect(((data as Row).data as Row).already_done, 'le second appel est absorbé').toBe(true)

    const { data: jobs } = await svc.from('outbox_jobs')
      .select('id').eq('payload->>previous_link_id', linkId)
    expect((jobs as Row[]).length, 'toujours UN seul job d\'émission').toBe(1)
  })

  it('un REFUS ne consomme pas la clé d\'idempotence', async () => {
    // Un `return admin_error` n'annule rien : la transaction COMMITTE. La clé réservée
    // AVANT les contrôles restait donc consommée par un geste qui n'avait rien fait, et le
    // réessai avec la même clé — ce à quoi sert exactement une clé d'idempotence — répondait
    // `already_done` : une forme de SUCCÈS pour un lien jamais réémis. L'écran aurait
    // annoncé une régénération alors que rien n'était parti dans l'outbox.
    const svc = serviceRoleClient()
    const cle = `regen-refus-${stamp}`
    const inconnu = '00000000-0000-0000-0000-000000000000'
    const appel = () => svc.rpc('admin_kyc_link_regenerate', {
      p_link_id: inconnu, p_motive_agency_id: setup.agencyAId,
      p_motive_ref: `TICKET-refus-${stamp}`, p_idempotency_key: cle,
    })

    const { data: premier } = await appel()
    expect((premier as Row).code, 'un lien inconnu est refusé').toBe('not_found')

    // LE POINT DU TEST : le même appel doit rendre le MÊME refus, jamais « déjà fait ».
    const { data: second } = await appel()
    expect((second as Row).ok, 'un refus reste un refus au réessai').toBe(false)
    expect((second as Row).code, 'la clé a été consommée par un geste qui n\'a rien fait')
      .toBe('not_found')
  })

  it('un parcours déjà terminé ne se régénère pas', async () => {
    const svc = serviceRoleClient()
    const { data: c } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: `Fini${stamp}`, last_name: 'Complet',
    }).select('id').single()
    const { data: l } = await svc.from('kyc_magic_links').insert({
      token: `t-fini-${stamp}`, agency_id: setup.agencyAId, contact_id: c!.id,
      kyc_case_id: await creerDossier(setup.agencyAId, c!.id),
      mode: 'libre', channels: ['email'], status: 'submitted',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }).select('id').single()

    try {
      const { data } = await svc.rpc('admin_kyc_link_regenerate', {
        p_link_id: l!.id, p_motive_agency_id: setup.agencyAId,
        p_motive_ref: `TICKET-fini-${stamp}`, p_idempotency_key: `regen-fini-${stamp}`,
      })
      expect((data as Row).ok).toBe(false)
      expect((data as Row).code, 'relancer une cliente qui a fini n\'aide personne')
        .toBe('precondition_failed')
    } finally {
      await svc.from('kyc_magic_links').delete().eq('id', l!.id).then(() => {}, () => {})
      await svc.from('contacts').delete().eq('id', c!.id).then(() => {}, () => {})
    }
  })

  // ── 5. Le journal (§5, non négociable) ─────────────────────────────────────────

  it('LE JOURNAL — chaque recherche et chaque régénération y écrivent, AVEC le motif', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('get_admin_security_journal', {
      p_window: 'today', p_filter: 'link', p_limit: 100,
    })
    expect(error).toBeNull()
    const lignes = data as Row[]

    const actions = lignes.map((l) => String(l.action))
    expect(actions, 'la recherche est journalisée').toContain('kyc_link_lookup')

    // L'action DIT ce qui a eu lieu : une DEMANDE de réémission, pas une réémission.
    // Tant qu'aucun consommateur d'outbox n'existe, écrire `kyc_link_regenerate` serait
    // sceller dans la chaîne un fait qui ne s'est pas produit. La ligne de complétion
    // appartient au consommateur, quand il existera — deux lignes pour deux faits.
    expect(actions, 'la DEMANDE de réémission est journalisée')
      .toContain('kyc_link_regenerate_requested')
    expect(actions, 'et rien n\'affirme une réémission accomplie')
      .not.toContain('kyc_link_regenerate')

    const demande = lignes.find((l) => l.action === 'kyc_link_regenerate_requested')
    const metaDemande = JSON.stringify(demande?.meta ?? [])
    expect(metaDemande, 'le registre dit que l\'ancien lien est CONSERVÉ')
      .toContain('conservé')
    expect(metaDemande, 'et que l\'émission reste à faire').toContain('attente')

    // Le motif est la raison d'être de l'étape 1 : l'audit doit dire POURQUOI on a cherché
    // un nom, pas seulement qui. Une ligne sans motif viderait le dispositif de son sens.
    const recherche = lignes.find((l) => l.action === 'kyc_link_lookup')
    const meta = JSON.stringify(recherche?.meta ?? [])
    expect(meta, 'le motif est dans le journal').toContain(`TICKET-${stamp}`)
    expect(meta, 'la requête est dans le journal').toContain('Requête')
  })

  // ── 6. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé sur les deux RPC', async () => {
    const { error: e1 } = await setup.clientA.rpc('admin_kyc_link_lookup', {
      p_motive_agency_id: setup.agencyAId, p_motive_ref: 'x', p_query: 'sophie',
    })
    expect(e1?.code, 'un agent ne diagnostique pas les liens de la plateforme').toBe(DENIED)

    const { error: e2 } = await setup.clientA.rpc('admin_kyc_link_regenerate', {
      p_link_id: linkId, p_motive_agency_id: setup.agencyAId,
      p_motive_ref: 'x', p_idempotency_key: 'y',
    })
    expect(e2?.code).toBe(DENIED)
  })

  // ── Les jokers ne sont pas des jokers ──────────────────────────────────────────

  it('LES JOKERS — `%` et `_` sont des CARACTÈRES, pas des motifs', async () => {
    // Mesuré sur la fonction vivante le 03.08.2026 : `admin_kyc_query_normalize` ne
    // retire que `[\s.\-()]`. Une saisie « %%% » franchissait donc le seuil des trois
    // caractères et devenait `like '%%%%%'` — un motif qui matche TOUT. Le seul rempart
    // restant était le plafond de trois correspondances, qui existe pour empêcher de
    // NOMMER des personnes, pas pour tenir lieu de garde contre une recherche sans
    // critère. Corrigé par 20260803040000 : l'échappement porte sur le motif seul, la
    // longueur reste mesurée sur la requête normalisée.
    for (const joker of ['%%%', '_o_', '%_%']) {
      const r = await chercher(joker)
      expect(r.ok, `« ${joker} » doit être accepté comme requête (3 caractères)`).toBe(true)
      const m = (r.data as Row).matches as Row[]
      expect(m.length, `« ${joker} » ne doit nommer personne`).toBe(0)
      expect((r.data as Row).count, `« ${joker} » ne compte personne`).toBe(0)
    }

    // Le contrôle qui empêche le test d'être creux : la même recherche, avec un vrai
    // critère, trouve toujours. Sans lui, une régression qui casserait la recherche
    // ENTIÈRE laisserait les assertions ci-dessus vertes.
    const temoin = await chercher(`Sophie${stamp}`)
    expect(temoin.ok).toBe(true)
    expect(((temoin.data as Row).matches as Row[]).length, 'le témoin doit rester trouvable').toBe(1)
  })

  it('un super-admin authentifié passe, et son plafond de débit le retient', async () => {
    // ⚠ Ce test ne peut PAS se faire en service_role : le compteur filtre sur
    // `actor_user_id = auth.uid()`, or auth.uid() est NULL sous service_role et
    // `colonne = NULL` n'est jamais vrai — le plafond ne se déclencherait jamais.
    const r1 = await chercher(`Sophie${stamp}`, superClient)
    expect(r1.ok, 'un super-admin allowlisté doit passer').toBe(true)

    // Dix recherches au total sur l'heure : la onzième doit être retenue.
    for (let i = 0; i < 10; i++) await chercher(`Sophie${stamp}`, superClient)
    const bloque = await chercher(`Sophie${stamp}`, superClient)
    expect(bloque.ok, 'le plafond de 10/h doit finir par retenir').toBe(false)
    expect(bloque.code).toBe('rate_limited')
  })
})
