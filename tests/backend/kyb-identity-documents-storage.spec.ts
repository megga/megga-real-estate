// Storage `documents`, préfixe réservé `kyb-identity` (étape 2 KYB, tâche 6 — pièce
// d'identité du signataire). Migration : 20260727110000_kyb_identity_documents_storage.sql.
//
// Le reste du bucket `documents` (20260527000000) est lisible/écrivable par TOUTE
// l'agence — il ne vérifie que le premier segment de chemin (agency_id), jamais le
// rôle. Une pièce d'identité de dirigeant est une PII de conformité bien plus
// sensible qu'un mandat PDF généré : ce test prouve que le nouveau préfixe est
// restreint à is_agency_admin(), sur TROIS axes distincts prouvés séparément :
//
//   1. un dirigeant accède au préfixe de SA propre agence (cas nominal) ;
//   2. un agent simple de la MÊME agence en est exclu — preuve que l'axe de
//      restriction est bien le RÔLE, pas seulement l'agence (l'objet même de
//      cette migration, cf. son en-tête) ;
//   3. un dirigeant d'une AUTRE agence en est exclu (isolation inter-agences,
//      comme le reste du dispositif KYB, 20260726130200/300).
//
// Et une non-régression : le layout plat existant ({agency_id}/{document_id}.pdf)
// reste accessible à tout agent de l'agence, preuve que l'exclusion du préfixe
// kyb-identity n'a pas cassé le comportement général du bucket (déjà couvert par
// tests/backend/documents-storage-rls.spec.ts, qui continue de tourner sans
// modification — ce test-ci n'en est qu'un rappel local).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

function fakeJpeg(): Blob {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })
}

describe.skipIf(!HAS_KEYS)('storage documents/kyb-identity — dirigeant seul (20260727110000)', () => {
  let setup: TwoAgenciesSetup
  let plainAgentId: string
  let plainAgentClient: SupabaseClient
  let folderA: string
  let pathA: string
  let pathB: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // setupTwoAgencies() provisionne clientA/clientB en role='agent' — promus
    // dirigeants ici, condition testée par ce dispositif (is_agency_admin()).
    const { error: promoteAErr } = await svc.from('profiles').update({ role: 'admin' }).eq('id', setup.agentAId)
    if (promoteAErr) throw new Error(`promote A: ${promoteAErr.message}`)
    const { error: promoteBErr } = await svc.from('profiles').update({ role: 'admin' }).eq('id', setup.agentBId)
    if (promoteBErr) throw new Error(`promote B: ${promoteBErr.message}`)

    // Un troisième compte, agent SIMPLE de l'agence A, jamais promu : seul lui isole
    // l'axe « rôle » à agence constante — clientB seul isolerait uniquement l'axe
    // « agence » (déjà prouvé séparément ci-dessous).
    const email = `plain-agent-${setup.stamp}@megga-test.local`
    const { data: user, error: userErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: 'Agent Simple', role: 'agent' },
    })
    if (userErr) throw new Error(`plain agent createUser: ${userErr.message}`)
    plainAgentId = user.user!.id
    const { error: profileErr } = await svc
      .from('profiles')
      .upsert({ id: plainAgentId, email, full_name: 'Agent Simple', role: 'agent', agency_id: setup.agencyAId }, { onConflict: 'id' })
    if (profileErr) throw new Error(`plain agent profile: ${profileErr.message}`)
    plainAgentClient = anonClient()
    const { error: signInErr } = await plainAgentClient.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`plain agent signin: ${signInErr.message}`)

    folderA = `${setup.agencyAId}/kyb-identity/person-test-${setup.stamp}`
    pathA = `${folderA}/recto.jpg`
    pathB = `${setup.agencyBId}/kyb-identity/person-test-${setup.stamp}/recto.jpg`
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.storage.from('documents').remove([pathA, pathB]).catch(() => {})
    await svc.auth.admin.deleteUser(plainAgentId).catch(() => {})
    await setup.cleanup()
  })

  it('un dirigeant téléverse sous le préfixe kyb-identity de SA propre agence', async () => {
    const { error } = await setup.clientA.storage.from('documents').upload(pathA, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, error?.message).toBeNull()
  })

  it('ce même dirigeant relit ce qu\'il vient de téléverser (list)', async () => {
    const { data, error } = await setup.clientA.storage.from('documents').list(folderA)
    expect(error).toBeNull()
    expect(data?.some((f) => f.name === 'recto.jpg')).toBe(true)
  })

  it('ce même dirigeant obtient une URL signée pour ce fichier', async () => {
    const { data, error } = await setup.clientA.storage.from('documents').createSignedUrl(pathA, 60)
    expect(error).toBeNull()
    expect(data?.signedUrl).toBeTruthy()
  })

  it('un agent simple de la MÊME agence ne voit PAS ce fichier (list) — l\'axe de restriction est le rôle, pas seulement l\'agence', async () => {
    // .list() sur un préfixe filtré par RLS renvoie un tableau vide, sans erreur — la
    // RLS filtre les LIGNES visibles, elle ne bloque pas l'appel lui-même.
    const { data, error } = await plainAgentClient.storage.from('documents').list(folderA)
    expect(error).toBeNull()
    expect(data?.some((f) => f.name === 'recto.jpg'), 'un agent simple ne doit jamais voir la pièce d\'identité de son agence').toBe(false)
  })

  it('un agent simple de la MÊME agence ne peut PAS y téléverser', async () => {
    const sneakyPath = `${folderA}/intrusion.jpg`
    const { error } = await plainAgentClient.storage.from('documents').upload(sneakyPath, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, 'un agent simple ne doit jamais pouvoir déposer une pièce d\'identité').toBeTruthy()
  })

  // Revue tâche 6, point 1 (CRITIQUE, reproduit en base réelle) : les policies
  // comparaient (storage.foldername(name))[2] octet à octet à 'kyb-identity', mais
  // storage.search() (qu'appelle .list()) filtre sur lower(o.name) — un agent simple
  // pouvait donc déposer sous 'KYB-IDENTITY' (majuscules) : la policy générale (qui ne
  // vérifie que l'agence, jamais le rôle) restait seule à s'appliquer puisque
  // 'KYB-IDENTITY' est syntaxiquement DISTINCT de 'kyb-identity' pour une comparaison
  // sensible à la casse. Conséquence reproduite : le dirigeant listait ensuite ce
  // fichier étranger (recherche insensible à la casse), reconstruisait un chemin en
  // minuscules qui ne correspond à AUCUN objet réel, et createSignedUrl échouait —
  // plus aucun moyen de terminer l'étape 4. lower() des deux côtés (8 policies) ferme
  // ce contournement.
  it('un agent simple de la MÊME agence ne peut pas contourner le préfixe réservé en changeant la casse (bug critique reproduit en base réelle)', async () => {
    const casedPath = `${setup.agencyAId}/KYB-IDENTITY/person-test-${setup.stamp}/verso.jpg`
    const { error } = await plainAgentClient.storage.from('documents').upload(casedPath, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, 'un agent simple ne doit jamais pouvoir contourner le préfixe réservé en changeant la casse du dossier').toBeTruthy()
    // Filet de sécurité : si la policy est encore cassée (rouge), ne laisse pas
    // l'objet traîner entre deux runs — service_role passe outre RLS.
    await serviceRoleClient().storage.from('documents').remove([casedPath]).catch(() => {})
  })

  it('un agent simple de la MÊME agence ne peut pas obtenir d\'URL signée pour ce fichier', async () => {
    const { data, error } = await plainAgentClient.storage.from('documents').createSignedUrl(pathA, 60)
    expect(data).toBeNull()
    expect(error, 'aucune URL signée ne doit être émise sans droit de lecture').toBeTruthy()
  })

  it('un dirigeant d\'une AUTRE agence ne voit pas ce fichier (list) — isolation inter-agences', async () => {
    const { data, error } = await setup.clientB.storage.from('documents').list(folderA)
    expect(error).toBeNull()
    expect(data?.some((f) => f.name === 'recto.jpg'), 'isolation inter-agences : un dirigeant d\'une autre agence ne doit rien voir').toBe(false)
  })

  it('un dirigeant d\'une AUTRE agence ne peut pas y téléverser', async () => {
    const sneakyPath = `${folderA}/intrusion-b.jpg`
    const { error } = await setup.clientB.storage.from('documents').upload(sneakyPath, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, 'un dirigeant d\'une autre agence ne doit jamais pouvoir y déposer un fichier').toBeTruthy()
  })

  it('un dirigeant d\'une AUTRE agence ne peut pas obtenir d\'URL signée pour ce fichier', async () => {
    const { data, error } = await setup.clientB.storage.from('documents').createSignedUrl(pathA, 60)
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })

  it('le layout plat existant ({agency_id}/{document_id}.pdf) reste accessible à tout agent de l\'agence (non-régression)', async () => {
    // storage.foldername ne renvoie ici qu'UN segment (le nom de fichier n'en fait pas
    // partie) : jamais 'kyb-identity' en position [2], donc jamais concerné par
    // l'exclusion ajoutée aux 4 policies documents_bucket_* — comportement général
    // (20260527000000) inchangé pour ce layout.
    const flatPath = `${setup.agencyAId}/regression-doc-${setup.stamp}.pdf`
    const fakePdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })
    const { error } = await plainAgentClient.storage.from('documents').upload(flatPath, fakePdf, { contentType: 'application/pdf' })
    expect(error, error?.message).toBeNull()
    await serviceRoleClient().storage.from('documents').remove([flatPath])
  })
})
