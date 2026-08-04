// Backend test (live CI) -- trigger agencies_notify_verification_decision_trg et Edge
// Function agency-verification-notify (étape 7, tâche 6, constat E : « une décision sur
// un dossier prévient enfin l'agence »).
//
// CE QUE CE FICHIER FERME. Le critère de sortie de la tâche 6 était explicite : « un test
// backend qui prouve l'appel ». Avant ce fichier, seul un test UNITAIRE du module pur
// existait (tests/unit/agency-verification-notice.spec.ts) -- il vérifie la composition du
// courriel (sujet, motif échappé, destinataires) mais n'exécute ni le trigger Postgres
// (agencies_notify_verification_decision_trg, migration 20260730160000) ni l'Edge Function
// déployée (supabase/functions/agency-verification-notify/index.ts). Rien ne prouvait que
// le trigger déclenche réellement l'appel.
//
// LE PATRON REPRIS, ET D'OÙ. agency-verification-run.spec.ts (section « déclenchement de la
// vérification depuis submit_agency_identity ») exerce déjà le MÊME genre de dispatch --
// un trigger PL/pgSQL qui pose un net.http_post vers une Edge Function locale, en
// fire-and-forget. Ce fichier reprend tel quel : la config app_config (supabase_url pointé
// sur PG_NET_LOCAL_FUNCTIONS_URL, l'alias Docker par lequel LE CONTENEUR POSTGRES joint le
// gateway Kong local -- 127.0.0.1 y désignerait le conteneur lui-même, pas le gateway),
// service_role_key posé à SERVICE_ROLE_JWT (le format que le runtime edge compare
// littéralement, jamais la clé sb_secret_...), et waitUntil() pour sonder l'effet après le
// commit -- net.http_post MET LA REQUÊTE EN FILE (net.http_request_queue, vidée par un
// worker de fond), aucune assertion ne peut lire l'effet juste après la transition.
//
// CE QUE CES TESTS PROUVENT, TROIS POINTS (revue du constat, explicitement demandés) :
//   1. LA TRANSITION EST DÉTECTÉE -- pas l'état : une écriture qui ne CHANGE PAS
//      verification_status ne redéclenche jamais (guard `is distinct from` du trigger).
//   2. LES STATUTS SONT FILTRÉS -- liste BLANCHE (NOTIFIABLE_STATUSES : validated,
//      auto_validated, rejected, correction_requested, et depuis le 01.08.2026
//      manual_review -- un ACCUSÉ DE RÉCEPTION, jamais un verdict : l'audit d'onboarding a
//      montré que le passage en revue est l'issue NORMALE de tout dossier). 'pending' reste
//      seul hors liste : c'est l'instant entre la soumission et le premier passage du
//      moteur, quelques centaines de ms -- y notifier ferait deux courriels pour une seule
//      soumission.
//   3. LE DISPATCH EST EFFECTIF -- pas seulement tenté : la cible est le VRAI runtime edge
//      local (même cible que « Edge Function déployée » dans agency-verification-run.spec.ts),
//      et l'effet lu est celui que l'Edge Function écrit RÉELLEMENT dans activity_events
//      (agency_verification_notice_sent / _undeliverable), jamais une supposition sur ce que
//      le trigger a « dû » faire.
//
// SANS RESEND_API_KEY EN LOCAL (même situation que DILISENSE_API_KEY / MAPBOX_TOKEN -- non
// posée dans ce worktree, vérifié par `docker exec ... env`), l'Edge Function va jusqu'au
// bout de sa logique -- destinataire trouvé (agencies.email, repli documenté dans
// _shared/agency-verification-notice.ts), courriel composé -- et s'arrête honnêtement au
// dernier geste : `agency_verification_notice_undeliverable`, cause `resend_key_missing`,
// JAMAIS un `_sent` fabriqué. C'est la preuve la PLUS complète disponible sans poser de
// secret, et elle couvre l'intégralité du chemin sauf l'appel HTTP sortant vers Resend
// lui-même.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le compte de tests, jamais le code de sortie
// (même convention que tout tests/backend/agency-*.spec.ts).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'
import { NOTIFIABLE_STATUSES } from '../../supabase/functions/_shared/agency-verification-notice'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
// Même choix, même motif que agency-verification-run.spec.ts (voir son en-tête) : le
// runtime edge n'injecte jamais que le JWT legacy dans SUPABASE_SERVICE_ROLE_KEY -- jamais
// la clé sb_secret_..., même quand SUPABASE_TEST_SERVICE_ROLE_KEY la porte (cas CI).
const SERVICE_ROLE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT || SERVICE_KEY
const NOTIFY_ENDPOINT = `${URL}/functions/v1/agency-verification-notify`

// Alias Docker documenté par Supabase pour Postgres -> Edge Functions locales. net.http_post
// tourne DANS le conteneur Postgres, sur un réseau Docker distinct de celui de ce process
// Node : depuis ce conteneur, 127.0.0.1 désigne le conteneur lui-même, jamais le gateway
// Kong (vérifié à la main dans agency-verification-run.spec.ts -- net._http_response y
// montre "Couldn't connect to server" pour 127.0.0.1). host.docker.internal n'est PAS non
// plus la bonne cible malgré les apparences : rien n'écoute le port hôte 8000 (Kong publie
// son port CONTENEUR 8000 sur le port HÔTE 54321, jamais sur 8000), donc cette route échoue
// tout aussi silencieusement -- "Couldn't connect to server" côté net._http_response,
// reproduit ici à la main via `select net.http_get(...)` avant ce correctif. C'est ce qui
// rendait la suite fragile : AUCUNE transition notifiable n'atteignait jamais le runtime
// edge, quel que soit l'état de charge -- seule la même adresse qu'agency-verification-run.spec.ts,
// api.supabase.internal:8000 (alias Docker réellement documenté par Supabase pour ce
// scénario), livre effectivement la requête -- confirmé ici par la même sonde manuelle
// (HTTP 404 au lieu d'une erreur de connexion : Kong répond, la route existe).
const PG_NET_LOCAL_FUNCTIONS_URL = 'http://api.supabase.internal:8000'

const NOTICE_ACTIONS = ['agency_verification_notice_sent', 'agency_verification_notice_undeliverable']

// execSql ne rend pas de résultat : on lève côté SQL (raise exception dans un bloc `do`),
// l'absence d'exception EST l'assertion -- même idiome que admin-log-chain.spec.ts /
// admin-activation-cron-runs.spec.ts.
const assertSql = (body: string) => expect(() => execSql(`do $$\nbegin\n${body}\nend $$;`), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('trigger agencies_notify_verification_decision -- dispatch réel (étape 7, tâche 6)', () => {
  const agencyIds: string[] = []

  // Démarrage à froid du worker agency-verification-notify, payé UNE fois ici -- même
  // motif, même helper que « Edge Function déployée » dans agency-verification-run.spec.ts :
  // ce hook ne peut PAS faire échouer la suite, et son budget est largement au-dessus
  // du démarrage habituel (~15 s) pour ne jamais être lui-même la cause d'un échec.
  // Il SONDE au lieu d'attendre une réponse unique : un 503 immédiat (worker pas
  // debout) terminait sinon le réchauffement sans que rien ne soit prêt — voir
  // helpers/edge.ts, et l'échec du 02.08.2026 qui a rendu ce défaut visible.
  beforeAll(async () => {
    await waitForEdgeWorker(NOTIFY_ENDPOINT)
  }, 120_000)

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNÊTE (même motif que agency-verification-run.spec.ts) : une agence
    // dont le trigger a écrit un activity_events append-only peut refuser sa suppression
    // (ON DELETE SET NULL déclenche le trigger d'immutabilité). On rapporte nommément,
    // jamais en silence.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-verification-notify.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test non ` +
          'supprimée(s) -- limite structurelle déjà documentée (activity_events append-only, LBA art. 7), ' +
          'pas un échec inattendu :\n' +
          undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createAgency(label: string, email: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Notify ${stamp}`, slug: `agence-notify-${stamp}`, email })
      .select('id')
      .single()
    if (error) throw new Error(`agency: ${error.message}`)
    agencyIds.push(data!.id as string)
    return data!.id as string
  }

  async function setStatus(agencyId: string, status: string): Promise<void> {
    const { error } = await serviceRoleClient()
      .from('agencies')
      .update({ verification_status: status })
      .eq('id', agencyId)
    if (error) throw new Error(`set verification_status=${status}: ${error.message}`)
  }

  type NoticeEvent = { action: string; severity: string; metadata: Record<string, unknown>; created_at: string }

  async function getNoticeEvents(agencyId: string): Promise<NoticeEvent[]> {
    const { data, error } = await serviceRoleClient()
      .from('activity_events')
      .select('action, severity, metadata, created_at')
      .eq('agency_id', agencyId)
      .in('action', NOTICE_ACTIONS)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`get notice events: ${error.message}`)
    return data as NoticeEvent[]
  }

  async function readConfig(key: string): Promise<string | null> {
    const { data } = await serviceRoleClient().from('app_config').select('value').eq('key', key).maybeSingle()
    return (data?.value as string | null) ?? null
  }

  async function setConfig(key: string, value: string): Promise<void> {
    const { error } = await serviceRoleClient().from('app_config').upsert({ key, value }, { onConflict: 'key' })
    if (error) throw new Error(`set app_config ${key}: ${error.message}`)
  }

  async function restoreConfig(key: string, original: string | null): Promise<void> {
    const svc = serviceRoleClient()
    if (original === null) await svc.from('app_config').delete().eq('key', key)
    else await svc.from('app_config').update({ value: original }).eq('key', key)
  }

  // Sonde une condition jusqu'à ce qu'elle devienne vraie ou que le délai expire --
  // indispensable ici pour la même raison que agency-verification-run.spec.ts : net.http_post
  // est asynchrone (file + worker de fond), aucune assertion ne peut lire l'effet juste après
  // la transition qui l'a déclenché.
  async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 10_000, intervalMs = 250): Promise<void> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (await predicate()) return
      if (Date.now() >= deadline) throw new Error(`waitUntil: condition jamais vraie après ${timeoutMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  it(
    'une transition vers manual_review declenche un accuse de reception, et la decision qui suit ' +
      '(validated) declenche son propre courriel -- deux transitions notifiables, deux evenements',
    async () => {
      const urlBefore = await readConfig('supabase_url')
      const keyBefore = await readConfig('service_role_key')
      try {
        await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
        await setConfig('service_role_key', SERVICE_ROLE_JWT)

        const agencyId = await createAgency('validated', 'dirigeant-notify@megga-test.local')

        // 1) pending -> manual_review : ACCUSÉ DE RÉCEPTION (01.08.2026). Ce test assertait
        // l'inverse jusqu'ici — « état d'attente, donc muet ». L'audit d'onboarding a montré
        // que cette attente EST l'issue normale : le véto id_document n'accepte que 'match'
        // et aucun connecteur ne le produit, donc tout dossier passe par un humain.
        await setStatus(agencyId, 'manual_review')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 0)
        const recu = await getNoticeEvents(agencyId)
        expect(recu).toHaveLength(1)
        expect(recu[0].metadata).toMatchObject({ status: 'manual_review' })

        // 2) manual_review -> validated : la DÉCISION, son propre courriel.
        await setStatus(agencyId, 'validated')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 1)

        const events = await getNoticeEvents(agencyId)
        expect(events, 'deux transitions notifiables, deux evenements').toHaveLength(2)
        expect(events.some((e) => (e.metadata as { status?: string }).status === 'validated')).toBe(true)
        // Sans RESEND_API_KEY en local, l'Edge Function va jusqu'au bout de sa logique et
        // s'arrête honnêtement au dernier geste : jamais un `_sent` fabriqué.
        for (const e of events) {
          expect(e.action).toBe('agency_verification_notice_undeliverable')
          expect(e.metadata).toMatchObject({ cause: 'resend_key_missing' })
        }
      } finally {
        await restoreConfig('supabase_url', urlBefore)
        await restoreConfig('service_role_key', keyBefore)
      }
    },
    20_000
  )

  it(
    'un second statut notifiable (rejected) déclenche aussi : NOTIFIABLE_STATUSES n\'est pas câblée sur un seul cas',
    async () => {
      const urlBefore = await readConfig('supabase_url')
      const keyBefore = await readConfig('service_role_key')
      try {
        await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
        await setConfig('service_role_key', SERVICE_ROLE_JWT)

        const agencyId = await createAgency('rejected', 'dirigeant-rejet@megga-test.local')

        // manual_review D'ABORD, et ATTENDU avant de déclencher rejected -- comme le test
        // précédent. Sans cette attente, les deux dispatches (celui de manual_review et celui
        // de rejected, tirés dos à dos) relisent tous deux le statut APRÈS que les deux UPDATE
        // aient commité (la relecture est délibérée, cf. l'en-tête de l'edge function) : les
        // deux événements portent alors {"status":"rejected"} et l'assertion `some(status ===
        // 'rejected')` passe sans jamais avoir prouvé que manual_review, pris isolément,
        // notifie quoi que ce soit -- confondu avec la mesure directe (voir le rapport de
        // diagnostic). En attendant le premier événement, chaque dispatch lit un statut
        // distinct au moment où il s'exécute réellement.
        await setStatus(agencyId, 'manual_review')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 0)
        const afterFirst = await getNoticeEvents(agencyId)
        expect(afterFirst).toHaveLength(1)
        expect(afterFirst[0].metadata).toMatchObject({ status: 'manual_review' })

        await setStatus(agencyId, 'rejected')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 1)
        const events = await getNoticeEvents(agencyId)
        expect(events).toHaveLength(2)
        expect(events[1].metadata).toMatchObject({ status: 'rejected' })
      } finally {
        await restoreConfig('supabase_url', urlBefore)
        await restoreConfig('service_role_key', keyBefore)
      }
    },
    20_000
  )

  it(
    'une réécriture qui NE CHANGE PAS verification_status ne redéclenche jamais -- sur la TRANSITION, jamais sur l\'état',
    async () => {
      const urlBefore = await readConfig('supabase_url')
      const keyBefore = await readConfig('service_role_key')
      try {
        await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
        await setConfig('service_role_key', SERVICE_ROLE_JWT)

        const agencyId = await createAgency('idempotent', 'dirigeant-idem@megga-test.local')
        await setStatus(agencyId, 'manual_review')
        await setStatus(agencyId, 'validated')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 1)
        expect(await getNoticeEvents(agencyId)).toHaveLength(2)

        // Réécrit EXACTEMENT la même valeur -- un UPDATE sans changement réel de la colonne
        // suivie, cas ordinaire (un formulaire qui resauvegarde la ligne). Sans le
        // `is distinct from` du trigger, ce second UPDATE renverrait un second courriel.
        await setStatus(agencyId, 'validated')
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        expect(
          await getNoticeEvents(agencyId),
          'réécrire la MÊME valeur ne doit jamais redéclencher : ce serait relancer un courriel à chaque ' +
            'sauvegarde de la ligne, sans rapport avec une nouvelle décision'
        ).toHaveLength(2)
      } finally {
        await restoreConfig('supabase_url', urlBefore)
        await restoreConfig('service_role_key', keyBefore)
      }
    },
    15_000
  )

  it(
    'sans configuration (supabase_url absent -- env local/CI non seedé), le dispatch est sauté silencieusement, ' +
      'même garde que le déclenchement primaire de agency-verification-run',
    async () => {
      const urlBefore = await readConfig('supabase_url')
      try {
        await serviceRoleClient().from('app_config').delete().eq('key', 'supabase_url')

        const agencyId = await createAgency('no-config', 'dirigeant-noconf@megga-test.local')
        await setStatus(agencyId, 'manual_review')
        await setStatus(agencyId, 'validated')

        // Pas de waitUntil ici : on prouve une ABSENCE. Délai fixe, largement au-dessus du
        // temps qu'un dispatch réel prendrait s'il avait été tenté (quelques centaines de ms,
        // mesuré par les tests précédents de ce fichier).
        await new Promise((resolve) => setTimeout(resolve, 1_500))
        expect(
          await getNoticeEvents(agencyId),
          'sans supabase_url, le trigger doit se taire -- jamais une exception qui ferait échouer la décision elle-même'
        ).toHaveLength(0)
      } finally {
        await restoreConfig('supabase_url', urlBefore)
      }
    },
    15_000
  )

  // ── Garde permanente contre la dérive SQL / TypeScript ──────────────────────────
  //
  // Le côté TS est verrouillé par le compilateur (Record<NotifiableStatus, string> dans
  // _shared/agency-verification-notice.ts) : y ajouter un statut sans mettre à jour les
  // libellés casse le build. La liste blanche du TRIGGER SQL, elle, est une copie à la
  // main (agencies_notify_verification_decision, 20260803230000) -- rien ne la lie au
  // module TS. Un sixième statut ajouté côté TS serait silencieusement ignoré par le
  // trigger : aucun des tests ci-dessus ne le détecterait, tous resteraient verts.
  //
  // Ce test lit pg_get_functiondef() de la fonction déployée et vérifie que CHAQUE entrée
  // de NOTIFIABLE_STATUSES (importée depuis le module, jamais réécrite en dur ici) y
  // figure comme littéral entre guillemets -- si quelqu'un ajoute un statut au tableau TS
  // sans toucher au SQL, ce test échoue avant que quiconque ne découvre l'écart en
  // production.
  it(
    'chaque NOTIFIABLE_STATUSES figure dans la liste blanche SQL du trigger -- ' +
      'sans quoi un statut ajouté côté TS serait ignoré en silence',
    () => {
      const sqlLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`
      const checks = NOTIFIABLE_STATUSES
        .map((status) => `
      if position(${sqlLiteral(sqlLiteral(status))} in pg_get_functiondef('public.agencies_notify_verification_decision'::regproc)) = 0 then
        raise exception 'NOTIFIABLE_STATUSES: statut absent de la liste blanche SQL du trigger: %', ${sqlLiteral(status)};
      end if;`)
        .join('\n')
      assertSql(checks)
    }
  )
})
