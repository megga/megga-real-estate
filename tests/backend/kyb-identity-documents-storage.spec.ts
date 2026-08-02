// Storage `documents`, préfixe réservé `kyb-identity` (étape 2 KYB, tâche 6 — pièce
// d'identité du signataire). Migrations : 20260729150900_kyb_identity_documents_storage.sql
// (les 8 policies d'origine) et 20260802200000_kyb_identity_super_admin_select.sql (la
// branche relecteur, SELECT seul).
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
//      comme le reste du dispositif KYB, 20260728102000/300).
//
// QUATRIÈME axe, ajouté le 02.08.2026 avec 20260802200000 : le relecteur super-admin
// LIT la pièce de n'importe quelle agence, et rien de plus. Il est éprouvé sur quatre
// fronts distincts, parce que c'est un élargissement de droits sur une PII sensible :
//
//   4a. il lit (sans quoi il tranche match/partial/mismatch à l'aveugle — le défaut
//       que cette migration corrige) ;
//   4b. un compte `role = 'super_admin'` dont l'e-mail est HORS allowlist ne lit RIEN.
//       Sans ce cas, la suite éprouverait le RÔLE et non `is_super_admin()`, qui exige
//       le rôle ET l'e-mail allowlisté (20260705160000) ;
//   4c. il n'écrit ni n'efface — la branche est bornée à SELECT, le verdict de revue
//       étant append-only et daté ;
//   4d. il ne voit RIEN d'autre dans le bucket `documents` que ce préfixe. C'est LE
//       test de la parenthèse : si `or is_super_admin()` avait été posé au niveau du
//       `using(...)` au lieu d'être imbriqué sous les clauses de portée, il annulerait
//       `bucket_id` et le test de préfixe, et ouvrirait tous les buckets. 4d échouerait,
//       seul, exactement dans ce cas.
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

/**
 * Les formats que le client propose ET valide pour une pièce d'identité, avec
 * l'extension que `extensionOfFile` en dériverait. Recopie DÉLIBÉRÉE de
 * `ALLOWED_IDENTITY_DOCUMENT_TYPES` (useAgencyIdentity.ts) : un test backend ne peut
 * pas importer un module du bundle navigateur, et c'est précisément l'écart entre
 * cette liste et l'`allowed_mime_types` du bucket que le cas ci-dessous mesure.
 */
const CLIENT_ACCEPTED_TYPES: ReadonlyArray<[string, string]> = [
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]

describe.skipIf(!HAS_KEYS)('storage documents/kyb-identity — dirigeant seul (20260728109000)', () => {
  let setup: TwoAgenciesSetup
  let plainAgentId: string
  let plainAgentClient: SupabaseClient
  let superAdminId: string
  let superAdminClient: SupabaseClient
  let rogueSuperId: string
  let rogueSuperClient: SupabaseClient
  let folderA: string
  let pathA: string
  let pathB: string
  let flatPathA: string

  /**
   * Un compte `profiles.role = 'super_admin'`, `agency_id` NULL — l'état réel du seul
   * super-admin de production. Lui donner une agence le ferait passer par la branche
   * `get_my_agency_id()` de la policy : le test serait vert sans rien prouver.
   *
   * `allowlisted` pilote le SEUL écart entre les deux comptes : le domaine de l'e-mail.
   * `@megga-test.local` est le domaine posé dans app_config par setupTwoAgencies() et
   * reconnu par super_admin_allowlist_match (suffixe strict, contraint à '@….local') ;
   * l'autre domaine n'est ni dans l'allowlist en dur ni un suffixe '.local' reconnu.
   */
  async function createSuperAdmin(allowlisted: boolean): Promise<{ id: string; client: SupabaseClient }> {
    const svc = serviceRoleClient()
    const tag = `${allowlisted ? 'super' : 'rogue'}-${setup.stamp}`
    const email = `kyb-identity-${tag}@${allowlisted ? 'megga-test.local' : 'megga-notallowed.example'}`
    // `role` n'est pas attribuable via user_metadata (à raison) : upsert manuel du profil
    // par service_role, même motif que agency-review-queue.spec.ts.
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: `Super ${tag}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser ${tag}: ${error.message}`)
    const id = data.user!.id
    const { error: pErr } = await svc
      .from('profiles')
      .upsert({ id, email, full_name: `Super ${tag}`, role: 'super_admin', agency_id: null }, { onConflict: 'id' })
    if (pErr) throw new Error(`profile ${tag}: ${pErr.message}`)
    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin ${tag}: ${signInErr.message}`)
    return { id, client }
  }

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

    const superAdmin = await createSuperAdmin(true)
    superAdminId = superAdmin.id
    superAdminClient = superAdmin.client
    const rogue = await createSuperAdmin(false)
    rogueSuperId = rogue.id
    rogueSuperClient = rogue.client

    folderA = `${setup.agencyAId}/kyb-identity/person-test-${setup.stamp}`
    pathA = `${folderA}/recto.jpg`
    pathB = `${setup.agencyBId}/kyb-identity/person-test-${setup.stamp}/recto.jpg`
    // Layout PLAT du bucket (hors préfixe réservé) — sert au cas 4d : le super-admin ne
    // doit pas le voir, sans quoi la branche a débordé de sa portée.
    flatPathA = `${setup.agencyAId}/mandat-${setup.stamp}.pdf`
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.storage.from('documents').remove([pathA, pathB, flatPathA]).catch(() => {})
    await svc.auth.admin.deleteUser(plainAgentId).catch(() => {})
    await svc.auth.admin.deleteUser(superAdminId).catch(() => {})
    await svc.auth.admin.deleteUser(rogueSuperId).catch(() => {})
    await setup.cleanup()
  })

  it('un dirigeant téléverse sous le préfixe kyb-identity de SA propre agence', async () => {
    const { error } = await setup.clientA.storage.from('documents').upload(pathA, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, error?.message).toBeNull()
  })

  // Bug du 02.08.2026 : le client proposait et validait `image/webp`, le bucket le
  // refusait (`allowed_mime_types` sans WebP) — validation client verte, téléversement
  // en échec. Corrigé par 20260802140000.
  //
  // ⚠ CE TEST N'AURAIT PAS ATTRAPÉ LE BUG AVANT CETTE MIGRATION, et c'est le fond du
  // problème plutôt qu'un détail : la configuration du bucket avait été posée à la main
  // dans le dashboard, et 20260527000000 est un `INSERT … ON CONFLICT DO NOTHING` qui
  // ne l'écrit jamais. Sur la base FRAÎCHE de la CI, `allowed_mime_types` valait donc
  // NULL — « tout accepté » — et n'importe quel format serait passé au vert pendant que
  // la production refusait. Le cas n'a de mordant que parce que la migration écrit
  // désormais la liste sur les deux bases : c'est la même classe de piège que
  // scripts/check-privilege-drift.mjs documente pour les GRANT.
  it.each(CLIENT_ACCEPTED_TYPES)(
    'le bucket accepte %s, comme le client (bug WebP du 02.08.2026, 20260802140000)',
    async (contentType, extension) => {
      // Storage valide le Content-Type DÉCLARÉ, jamais les octets : un blob factice
      // suffit à éprouver le contrôle MIME du bucket, et seulement lui.
      const path = `${folderA}/format-${extension}.${extension}`
      const blob = new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])], { type: contentType })
      const { error } = await setup.clientA.storage.from('documents').upload(path, blob, { contentType, upsert: true })
      expect(
        error,
        `${contentType} est proposé et validé côté client (ALLOWED_IDENTITY_DOCUMENT_TYPES) : le bucket doit l'accepter — ${error?.message}`,
      ).toBeNull()
      await serviceRoleClient().storage.from('documents').remove([path]).catch(() => {})
    },
  )

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

  // ── 4. Le relecteur super-admin (20260802200000) ────────────────────────────────────

  it('4a. un relecteur super-admin voit la pièce d\'une agence dont il n\'est PAS membre (list)', async () => {
    // Le défaut corrigé : sans cette branche, admin_resolve_agency_id_document était
    // tranchée à l'aveugle alors que son propre commentaire affirme « Le relecteur A le
    // document sous les yeux ».
    const { data, error } = await superAdminClient.storage.from('documents').list(folderA)
    expect(error).toBeNull()
    expect(data?.some((f) => f.name === 'recto.jpg'), 'le relecteur doit voir la pièce qu\'il est censé juger').toBe(true)
  })

  it('4a. ce relecteur obtient une URL signée pour cette pièce', async () => {
    const { data, error } = await superAdminClient.storage.from('documents').createSignedUrl(pathA, 60)
    expect(error).toBeNull()
    expect(data?.signedUrl).toBeTruthy()
  })

  it('4b. un compte role=super_admin dont l\'e-mail est HORS allowlist ne voit RIEN — c\'est is_super_admin() qui est éprouvé, pas le rôle', async () => {
    // Sans ce cas, 4a passerait même si la policy testait `profiles.role = 'super_admin'`
    // tout court, et l'allowlist e-mail (20260705160000) ne serait couverte par rien.
    const { data, error } = await rogueSuperClient.storage.from('documents').list(folderA)
    expect(error).toBeNull()
    expect(data?.some((f) => f.name === 'recto.jpg'), 'le rôle seul ne doit jamais suffire : is_super_admin() exige aussi l\'e-mail allowlisté').toBe(false)
  })

  it('4b. ce même compte n\'obtient aucune URL signée', async () => {
    const { data, error } = await rogueSuperClient.storage.from('documents').createSignedUrl(pathA, 60)
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })

  it('4c. le relecteur ne peut PAS déposer sous ce préfixe — la branche est bornée à SELECT', async () => {
    const { error } = await superAdminClient.storage
      .from('documents')
      .upload(`${folderA}/intrusion-super.jpg`, fakeJpeg(), { contentType: 'image/jpeg' })
    expect(error, 'le relecteur voit, il ne dépose pas').toBeTruthy()
  })

  it('4c. le relecteur ne peut PAS effacer la pièce — le verdict de revue est append-only et daté', async () => {
    // `.remove()` bloqué par RLS ne lève PAS d'erreur : il renvoie une liste vide d'objets
    // retirés, comme `.list()` renvoie un tableau vide. On assied donc l'assertion sur
    // l'EFFET (le fichier est toujours là), jamais sur la présence d'une erreur.
    const { data } = await superAdminClient.storage.from('documents').remove([pathA])
    expect(data ?? [], 'aucun objet ne doit avoir été retiré').toHaveLength(0)

    const { data: still } = await serviceRoleClient().storage.from('documents').list(folderA)
    expect(still?.some((f) => f.name === 'recto.jpg'), 'la pièce doit avoir survécu à la tentative de suppression').toBe(true)
  })

  it('4d. le relecteur ne voit RIEN d\'autre du bucket que ce préfixe — test de la parenthèse', async () => {
    // Si `or is_super_admin()` avait été posé au niveau du `using(...)` plutôt qu'imbriqué
    // sous `bucket_id` et le test de préfixe, il annulerait ces deux conjoints : le
    // relecteur lirait alors TOUS les objets de TOUS les buckets. Ce cas est le seul à
    // tomber dans cette situation — les cas 4a/4b/4c resteraient verts.
    const { error: seedErr } = await serviceRoleClient().storage
      .from('documents')
      .upload(flatPathA, new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), {
        contentType: 'application/pdf',
      })
    expect(seedErr, seedErr?.message).toBeNull()

    const { data, error } = await superAdminClient.storage.from('documents').list(setup.agencyAId)
    expect(error).toBeNull()
    expect(
      data?.some((f) => f.name === `mandat-${setup.stamp}.pdf`),
      'la branche relecteur ne doit jamais déborder du préfixe kyb-identity',
    ).toBe(false)
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
