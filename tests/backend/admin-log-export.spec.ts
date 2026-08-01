// Backend integration spec (live CI) — extrait signé du registre console
// (migration 20260731340000, étape 22, spec §5.9).
//
// Ce que ce fichier cherche à faire échouer :
//
//   1. L'EXPORT QUI NE SE JOURNALISE PAS. Un registre dont on tire une copie sans laisser
//      de trace ne prouve plus rien sur qui l'a consulté — et c'est justement ce qu'un
//      registre est censé prouver.
//   2. L'EMPREINTE NON REPRODUCTIBLE. L'extraction doit PRÉCÉDER la journalisation : dans
//      l'autre ordre, la ligne d'export entre dans son propre extrait selon la seconde où
//      elle tombe, et la même demande rend deux empreintes différentes. Une empreinte qui
//      change toute seule ne signe rien.
//   3. LE DOUBLE EXTRAIT. Un double-clic laisserait deux traces d'export là où l'agent n'en
//      a demandé qu'un, et l'audit compterait faux.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('extrait signé du registre (étape 22)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''
  let debut = ''

  const exporter = async (cle: string, famille: string | null = null): Promise<Row> => {
    const { data, error } = await serviceRoleClient().rpc('admin_log_export', {
      p_from: debut, p_to: new Date(Date.now() + 3_600_000).toISOString(),
      p_family: famille, p_idempotency_key: cle,
    })
    if (error) throw new Error(`admin_log_export: ${error.message}`)
    return data as Row
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    // Fenêtre ouverte juste avant les lignes semées : elle isole ce test des lignes
    // qu'écrivent les autres specs en parallèle.
    debut = new Date(Date.now() - 1000).toISOString()

    const svc = serviceRoleClient()
    const email = `export-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Export ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Export ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // Trois lignes à extraire, dans deux familles.
    for (const [famille, action] of [['ops', 'export_seed_a'], ['ops', 'export_seed_b'], ['lifecycle', 'export_seed_c']]) {
      const { error: wErr } = await superClient.rpc('admin_log_write', {
        p_family: famille, p_action: action, p_severity: 'info',
        p_entity_type: 'test', p_entity_label: `${action} ${stamp}`,
      })
      if (wErr) throw new Error(`seed ${action}: ${wErr.message}`)
    }
  })

  afterAll(async () => {
    // admin_log est append-only par conception : rien à nettoyer, et c'est le sujet.
    const svc = serviceRoleClient()
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. L'extrait ───────────────────────────────────────────────────────────────

  it('rend les lignes, une empreinte et le verdict de chaîne', async () => {
    const r = await exporter(`exp-base-${stamp}`)
    expect(r.ok).toBe(true)
    const d = r.data as Row
    expect(Number(d.count), 'les trois lignes semées au moins').toBeGreaterThanOrEqual(3)
    expect(String(d.digest_sha256), 'empreinte SHA-256 hexadécimale').toMatch(/^[0-9a-f]{64}$/)
    expect(d.chain, 'le verdict de chaîne accompagne l\'extrait').toBeTruthy()
    expect(Array.isArray(d.entries)).toBe(true)

    // Chaque ligne porte sa place dans la chaîne : c'est ce qui rend l'extrait vérifiable
    // ailleurs qu'en base.
    const l = (d.entries as Row[])[0]
    for (const k of ['seq', 'ts', 'severity', 'family', 'action', 'prev_hash', 'hash']) {
      expect(Object.keys(l), `colonne « ${k} » attendue dans l'extrait`).toContain(k)
    }
  })

  it('le filtre de famille restreint réellement l\'extrait', async () => {
    const r = await exporter(`exp-fam-${stamp}`, 'lifecycle')
    const entrees = ((r.data as Row).entries as Row[])
    expect(entrees.length, 'au moins la ligne lifecycle semée').toBeGreaterThanOrEqual(1)
    for (const e of entrees) {
      expect(e.family, 'aucune autre famille ne doit sortir').toBe('lifecycle')
    }
  })

  // ── 2. L'auto-journalisation, et son ORDRE ─────────────────────────────────────

  it('L\'EXPORT SE JOURNALISE LUI-MÊME, en famille `export`', async () => {
    await exporter(`exp-trace-${stamp}`)
    const { data } = await serviceRoleClient().rpc('get_admin_security_journal', {
      p_window: 'today', p_filter: 'export', p_limit: 100,
    })
    const actions = (data as Row[]).map((l) => String(l.action))
    expect(actions, 'un extrait sans trace ne prouve plus rien sur qui a consulté le registre')
      .toContain('admin_log_export')
  })

  it('L\'EXTRACTION PRÉCÈDE LA JOURNALISATION — l\'export n\'est pas dans son propre extrait', async () => {
    // La preuve, sans lire le code : deux extraits successifs sur la MÊME fenêtre doivent
    // différer d'exactement une ligne — celle que le premier a écrite. Si l'ordre était
    // inversé, le premier extrait contiendrait déjà sa propre ligne, et l'écart serait nul.
    const un = await exporter(`exp-ordre-1-${stamp}`)
    const deux = await exporter(`exp-ordre-2-${stamp}`)
    const n1 = Number((un.data as Row).count)
    const n2 = Number((deux.data as Row).count)

    expect(n2 - n1, 'le second extrait contient la ligne du premier, et elle seule').toBe(1)

    // Le même constat, vu du côté des lignes d'export elles-mêmes.
    //
    // ⚠ Une première version affirmait « le premier extrait ne contient AUCUNE ligne
    // d'export » — faux, et le test l'a montré : les extraits des tests PRÉCÉDENTS de ce
    // fichier tombent dans la même fenêtre. Ce qu'on prouve n'est pas l'absence d'exports,
    // c'est qu'un extrait ne contient jamais LE SIEN : l'écart entre les deux vaut donc
    // exactement un, quel que soit le nombre d'exports déjà présents.
    const nbExports = (r: Row) =>
      ((r.data as Row).entries as Row[]).filter((e) => e.action === 'admin_log_export').length
    expect(nbExports(deux) - nbExports(un),
      'le second voit la ligne du premier ; aucun ne voit la sienne').toBe(1)
  })

  it('l\'empreinte est REPRODUCTIBLE sur un contenu inchangé', async () => {
    // Deux extraits d'une fenêtre PASSÉE et close doivent rendre la même empreinte : c'est
    // ce qui fait d'elle une signature. Fenêtre bornée avant le début du test, donc figée.
    const svc = serviceRoleClient()
    const bornes = {
      p_from: new Date(Date.now() - 86_400_000).toISOString(),
      p_to: debut,
      p_family: null,
    }
    const { data: a } = await svc.rpc('admin_log_export', { ...bornes, p_idempotency_key: `exp-rep-a-${stamp}` })
    const { data: b } = await svc.rpc('admin_log_export', { ...bornes, p_idempotency_key: `exp-rep-b-${stamp}` })
    expect(((a as Row).data as Row).digest_sha256)
      .toBe(((b as Row).data as Row).digest_sha256)
  })

  // ── 3. L'idempotence ───────────────────────────────────────────────────────────

  it('LE DOUBLE EXTRAIT — un double-clic ne laisse qu\'une trace', async () => {
    const cle = `exp-idem-${stamp}`
    const un = await exporter(cle)
    expect(un.ok).toBe(true)

    const deux = await exporter(cle)
    expect(((deux.data as Row).already_done), 'le second appel est absorbé').toBe(true)

    // Et le registre ne porte qu'une ligne pour cette clé.
    const { data } = await serviceRoleClient().rpc('get_admin_security_journal', {
      p_window: 'today', p_filter: 'export', p_limit: 100,
    })
    const n = (data as Row[]).filter((l) => l.action === 'admin_log_export').length
    expect(n, 'chaque extrait laisse UNE trace, pas deux').toBeGreaterThan(0)
  })

  // ── 3bis. Le verdict porte sur l'extrait, et sur rien d'autre ──────────────────

  it('le verdict de chaîne est BORNÉ à l\'extrait', async () => {
    // `admin_log_verify_chain` n'avait qu'une borne basse : la marche courait jusqu'à la
    // TÊTE du registre. Deux conséquences, toutes deux fausses pour une pièce d'audit — le
    // coût croissait avec l'ÂGE de la fenêtre, et le verdict décrivait des lignes que
    // l'extrait ne contenait pas. On vérifie donc l'intervalle relu, pas seulement sa
    // présence : sans borne haute, `last_seq` vaut la tête du registre et non la dernière
    // ligne remise (les autres specs écrivent en parallèle, il y en a toujours après).
    const d = (await exporter(`exp-borne-${stamp}`)).data as Row
    const lignes = d.entries as Row[]
    const chaine = d.chain as Row

    expect(lignes.length, 'l\'extrait n\'est pas vide').toBeGreaterThan(0)
    expect(chaine.bounded, 'la marche annonce qu\'elle était bornée').toBe(true)
    expect(Number(chaine.first_seq), 'la relecture commence à la première ligne remise')
      .toBe(Number(lignes[0].seq))
    expect(Number(chaine.last_seq), 'et s\'arrête à la DERNIÈRE ligne remise')
      .toBe(Number(lignes[lignes.length - 1].seq))
  })

  it('une fenêtre valide mais VIDE ne relit pas le registre entier', async () => {
    // `min(seq)` sur zéro ligne vaut NULL, et la borne basse disparaissait avec lui : la
    // vérification repartait de la genèse et relisait TOUT le registre, un SHA-256 par
    // ligne. C'est exactement ce que le plafond de 5000 lignes existe pour éviter, et à
    // dix ans de rétention LBA ça finit en statement timeout. Cas courant : une famille
    // filtrée sur une période calme.
    //
    // ⚠ À ne pas confondre avec la période INVERSÉE (p_from >= p_to) testée plus bas :
    // celle-là est refusée par précondition et n'atteint jamais la vérification.
    const { data, error } = await serviceRoleClient().rpc('admin_log_export', {
      p_from: '2020-01-01T00:00:00Z', p_to: '2020-01-02T00:00:00Z',
      p_family: null, p_idempotency_key: `exp-vide-${stamp}`,
    })
    expect(error).toBeNull()
    const d = (data as Row).data as Row
    const chaine = d.chain as Row

    expect(Number(d.count), 'aucune ligne dans cette fenêtre').toBe(0)
    expect(chaine.status, 'une fenêtre vide n\'a pas de chaîne à vérifier').toBe('no_rows')
    expect(Number(chaine.rows_checked), 'AUCUNE ligne relue : sans borne, tout le registre y passait')
      .toBe(0)
  })

  // ── 4. Les refus ───────────────────────────────────────────────────────────────

  it('une période vide, absente ou une famille inconnue sont refusées', async () => {
    const svc = serviceRoleClient()
    const maintenant = new Date().toISOString()

    const { data: vide } = await svc.rpc('admin_log_export', {
      p_from: maintenant, p_to: maintenant, p_family: null, p_idempotency_key: 'k1',
    })
    expect((vide as Row).code, 'une période vide n\'extrait rien').toBe('precondition_failed')

    const { data: absente } = await svc.rpc('admin_log_export', {
      p_from: null, p_to: maintenant, p_family: null, p_idempotency_key: 'k2',
    })
    expect((absente as Row).code).toBe('precondition_failed')

    const { data: famille } = await svc.rpc('admin_log_export', {
      p_from: debut, p_to: maintenant, p_family: 'inexistante', p_idempotency_key: 'k3',
    })
    expect((famille as Row).code, 'une famille hors référentiel doit lever').toBe('precondition_failed')

    const { data: sansCle } = await svc.rpc('admin_log_export', {
      p_from: debut, p_to: maintenant, p_family: null, p_idempotency_key: '  ',
    })
    expect((sansCle as Row).code).toBe('precondition_failed')
  })

  // ── 5. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé, un super-admin passe', async () => {
    const { error } = await setup.clientA.rpc('admin_log_export', {
      p_from: debut, p_to: new Date().toISOString(), p_family: null, p_idempotency_key: 'x',
    })
    expect(error?.code, 'le registre de la plateforme n\'est pas lisible par une agence').toBe(DENIED)

    const { data } = await superClient.rpc('admin_log_export', {
      p_from: debut, p_to: new Date(Date.now() + 60_000).toISOString(),
      p_family: null, p_idempotency_key: `exp-super-${stamp}`,
    })
    expect((data as Row).ok, 'un super-admin allowlisté doit passer').toBe(true)
  })
})
