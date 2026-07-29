// Backend integration spec (live CI) — garde LAB plein (etape 5, tache 4).
//
// Verifie que le blocage vaut cote SERVEUR, pas seulement dans l'interface : un
// appel HTTP direct aux edge functions kyc-screening et sign-document (action
// 'create'), pour une agence dont verification_status n'est ni 'auto_validated' ni
// 'validated', est refuse AVANT toute logique metier — meme si l'appelant est
// authentifie, meme via le chemin service-role (whatsapp-agent).
//
// Principe de test (pas de reseau externe, pas de secret optionnel requis) : les
// deux fonctions ont chacune une etape downstream dependante d'une configuration
// absente en local/CI (DILISENSE_API_KEY pour kyc-screening — cf.
// supabase/config.toml [edge_runtime.secrets], qui ne le liste pas ; aucun
// fournisseur de signature connecte pour sign-document). Le garde LAB est place
// AVANT ces etapes (kyc-screening/index.ts, sign-document/index.ts) : une agence
// CLEARED atteint donc de maniere deterministe cette etape downstream (500/400 selon
// la fonction), jamais le 403 agency_not_verified — c'est la preuve que le garde a
// bien laisse passer l'appel, sans dependre d'un secret externe ni d'un vrai
// fournisseur configure.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer — lire le compte de tests, jamais le code de
// sortie (meme convention que les autres specs etape 5).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const KYC_SCREENING_ENDPOINT = `${URL}/functions/v1/kyc-screening`
const SIGN_DOCUMENT_ENDPOINT = `${URL}/functions/v1/sign-document`

describe.skipIf(!HAS_KEYS)('garde LAB plein — kyc-screening et sign-document refusent une agence non verifiee', () => {
  let setup: TwoAgenciesSetup
  /** clientA/agencyAId restent au statut par defaut (verification_status='pending',
   *  identity_submitted_at=null) — jamais soumis, donc bloques. */
  let blockedToken: string
  /** agencyBId est promue 'auto_validated' juste apres setup — clientB en devient le
   *  representant "cleared". */
  let clearedToken: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    const { data: blockedSession, error: blockedErr } = await setup.clientA.auth.getSession()
    if (blockedErr || !blockedSession.session) throw new Error(`clientA session: ${blockedErr?.message}`)
    blockedToken = blockedSession.session.access_token

    const { error: promoteErr } = await serviceRoleClient()
      .from('agencies')
      .update({ identity_submitted_at: new Date().toISOString(), verification_status: 'auto_validated' })
      .eq('id', setup.agencyBId)
    if (promoteErr) throw new Error(`promote agencyB: ${promoteErr.message}`)

    const { data: clearedSession, error: clearedErr } = await setup.clientB.auth.getSession()
    if (clearedErr || !clearedSession.session) throw new Error(`clientB session: ${clearedErr?.message}`)
    clearedToken = clearedSession.session.access_token
  })

  afterAll(async () => {
    await setup.cleanup()
  })

  // ── kyc-screening — chemin utilisateur (requireAgentAuth) ──────────────────

  it('agence non verifiee (defaut, jamais soumise) -> 403 agency_not_verified, avant meme la validation du corps', async () => {
    const res = await fetch(KYC_SCREENING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${blockedToken}` },
      // kyc_case_id volontairement absent : le garde LAB doit rejeter avant la
      // validation de presence des champs, l'agence n'a pas a apprendre si la
      // ressource visee existe.
      body: JSON.stringify({ entity_type: 'individual' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('agency_not_verified')
  })

  it('agence verifiee (auto_validated) -> depasse le garde, atteint la config downstream (jamais 403)', async () => {
    const res = await fetch(KYC_SCREENING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${clearedToken}` },
      body: JSON.stringify({ kyc_case_id: '00000000-0000-0000-0000-000000000000', entity_type: 'individual' }),
    })
    expect(res.status).not.toBe(403)
    // DILISENSE_API_KEY n'est pas configure en local/CI (cf. en-tete du fichier) :
    // l'atteinte deterministe de ce 500 prouve que le garde a laisse passer l'appel.
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/DILISENSE_API_KEY/)
  })

  // ── kyc-screening — chemin service-role (whatsapp-agent, agency_id dans le corps) ──

  it('chemin service-role, agence non verifiee -> 403 agency_not_verified', async () => {
    const res = await fetch(KYC_SCREENING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        entity_type: 'individual',
        agency_id: setup.agencyAId,
      }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('agency_not_verified')
  })

  it('chemin service-role, agence verifiee -> depasse le garde (jamais 403)', async () => {
    const res = await fetch(KYC_SCREENING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        kyc_case_id: '00000000-0000-0000-0000-000000000000',
        entity_type: 'individual',
        agency_id: setup.agencyBId,
      }),
    })
    expect(res.status).not.toBe(403)
    expect(res.status).toBe(500)
  })

  // ── sign-document — action 'create' uniquement ──────────────────────────────

  it("action 'create', agence non verifiee -> 403 agency_not_verified, avant la validation du corps", async () => {
    const res = await fetch(SIGN_DOCUMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${blockedToken}` },
      // Corps volontairement incomplet (ni pdf_base64, ni title, ni signers) : le
      // garde LAB doit rejeter avant la validation de forme de la demande.
      body: JSON.stringify({ action: 'create' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('agency_not_verified')
  })

  it("action 'create', agence verifiee -> depasse le garde, atteint la validation normale (jamais 403)", async () => {
    const res = await fetch(SIGN_DOCUMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${clearedToken}` },
      body: JSON.stringify({ action: 'create' }),
    })
    expect(res.status).not.toBe(403)
    // pdf_base64 manquant : preuve deterministe qu'on a atteint la validation
    // normale de handleCreate, pas de fournisseur reel requis.
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/pdf_base64/)
  })

  it("action 'list' reste utilisable meme pour une agence non verifiee (garde limite a 'create')", async () => {
    // Le garde LAB ne bloque QUE la creation d'une signature ('lancer une signature
    // electronique', brief tache 4) — pas la consultation des fournisseurs connectes
    // ni leur configuration, qu'une agence en cours de verification doit pouvoir
    // preparer a l'avance.
    const res = await fetch(SIGN_DOCUMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${blockedToken}` },
      body: JSON.stringify({ action: 'list' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.connections)).toBe(true)
  })

  // ── Points mineurs (revue) : le fail-closed serveur n'etait teste ni pour une
  // lecture en echec, ni pour les statuts intermediaires (seul le defaut 'pending'
  // etait couvert ci-dessus) — requireAgencyLabCleared (agency-lab-guard.ts) traite
  // pourtant les deux comme le meme cas fail-closed (verificationStatus undefined :
  // agence introuvable OU valeur hors liste blanche). Places APRES les tests
  // ci-dessus (jamais avant) : ceux-la dependent d'agencyA reste au defaut 'pending'
  // jusqu'ici — ces tests-ci le font ensuite evoluer, execution sequentielle du
  // fichier (fileParallelism: false, vitest.backend.config.ts).

  it('agence introuvable (lecture en echec) -> 403 agency_not_verified, fail-closed', async () => {
    // Chemin service-role (agency_id vient du corps, pas d'une session) : le seul des
    // deux chemins ou l'on peut fournir un agency_id qui n'existe PAS sans devoir
    // supprimer l'agence d'un utilisateur reel en cours de test. requireAgencyLabCleared
    // lit agencies.verification_status pour cet id ; .single() echoue (aucune ligne),
    // verificationStatus reste undefined -> meme branche fail-closed qu'une panne
    // reseau (agency-lab-guard.ts : "Lecture impossible (agence introuvable, panne
    // reseau) : on ne SAIT pas si l'agence est cleared").
    const res = await fetch(KYC_SCREENING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        entity_type: 'individual',
        agency_id: '00000000-0000-0000-0000-000000000000',
      }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('agency_not_verified')
  })

  it.each(['manual_review', 'rejected'])(
    "agence au statut intermediaire '%s' -> 403 agency_not_verified (liste blanche, pas liste noire)",
    async (status) => {
      const { error: setErr } = await serviceRoleClient()
        .from('agencies')
        .update({ verification_status: status })
        .eq('id', setup.agencyAId)
      expect(setErr, `poser verification_status=${status} sur agencyA`).toBeNull()

      const res = await fetch(KYC_SCREENING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${blockedToken}` },
        body: JSON.stringify({ kyc_case_id: '00000000-0000-0000-0000-000000000000', entity_type: 'individual' }),
      })
      expect(res.status, `verification_status='${status}' ne doit jamais suffire a debloquer kyc-screening`).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('agency_not_verified')
    }
  )
})
