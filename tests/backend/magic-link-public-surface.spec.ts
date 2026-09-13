/**
 * Backend (live CI) — ce que lit, écrit et soumet un porteur de lien magique KYC, bout en bout
 * par les edge functions servies en local (audit du 13.09.2026, point S10).
 *
 *   G  magic-link-get sert la LISTE BLANCHE : prénom + nom de fichier (témoins), aucune
 *      sentinelle — ni nom de famille, ni message, ni champ OCR, y compris d'une pièce
 *      WhatsApp RATTACHÉE au lien (la liste blanche tient indépendamment des droits).
 *      Une fois soumis : {status, confirmed_at, message} et rien d'autre.
 *   C  magic-link-confirm : un lien passé à `expired` avant son échéance (le seul levier de
 *      révocation) répond 410 et ne bascule NI le lien NI le dossier ; témoin : le même
 *      parcours sur un lien ouvert soumet.
 *   U  magic-link-upload : un lien plein répond 409 `upload_limit` AVANT de lire le corps,
 *      et n'écrit qu'UNE ligne d'audit par heure, même refusé deux fois.
 *
 * Secret HMAC : même câblage que kyc-report-data.spec.ts (backend.yml pose la valeur de test,
 * config.toml la passe au runtime, ce fichier signe avec le module partagé sous un shim Deno).
 * ⚠ Pas de dépôt RÉUSSI par HTTP ici : le bucket `kyc-magic-link` n'existe pas en local
 * (créé au tableau de bord en production), le stockage répondrait 500.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const HAS_HMAC = !!process.env.MEGGA_MAGIC_LINK_HMAC_SECRET
const TEST_SECRET = process.env.MEGGA_MAGIC_LINK_HMAC_SECRET ?? ''
const BASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const FN_HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}` }

const SENTINELLES = ['SENTINEL_LAST', 'SENTINEL_MSG', 'SENTINEL_NOM', 'SENTINEL_DOC', '1901-01-01']

type SignFn = (payload: { id: string; exp: number }) => Promise<string>

describe.skipIf(!HAS_KEYS || !HAS_HMAC)('lien magique KYC — surface publique de bout en bout', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let sign: SignFn
  const contactIds: string[] = []
  const caseIds: string[] = []
  const linkIds: string[] = []

  /** Un lien de l'agence A, signé, dont le jeton stocké est celui qu'on présente. */
  const mkLink = async (tag: string, status = 'opened') => {
    const { data: c, error: cErr } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Marie', last_name: `SENTINEL_LAST-${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contact ${tag}: ${cErr.message}`)
    contactIds.push(c.id)
    const { data: k, error: kErr } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: c.id, type: 'buyer_pp',
    }).select('id, dossier_status').single()
    if (kErr) throw new Error(`kyc_case ${tag}: ${kErr.message}`)
    caseIds.push(k.id)
    const { data: l, error: lErr } = await svc.from('kyc_magic_links').insert({
      token: `s10-http-${setup.stamp}-${tag}`,
      agency_id: setup.agencyAId, kyc_case_id: k.id, contact_id: c.id,
      mode: 'verifiee', channels: ['email'], status, custom_message: 'SENTINEL_MSG',
      expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      created_by: setup.agentAId,
    }).select('id').single()
    if (lErr) throw new Error(`link ${tag}: ${lErr.message}`)
    linkIds.push(l.id)
    const token = await sign({ id: l.id, exp: Math.floor(Date.now() / 1000) + 3600 })
    const { error: tErr } = await svc.from('kyc_magic_links').update({ token }).eq('id', l.id)
    if (tErr) throw new Error(`token ${tag}: ${tErr.message}`)
    return { linkId: l.id as string, caseId: k.id as string, token, dossierStatus: k.dossier_status as string }
  }

  const piece = (linkId: string | null, extra: Record<string, unknown> = {}) => ({
    magic_link_id: linkId, agency_id: setup.agencyAId, type: 'identity',
    filename: 'passeport-demo.pdf', size_bytes: 1, mime_type: 'application/pdf',
    storage_path: `${setup.agencyAId}/${linkId ?? 'wa'}/${crypto.randomUUID()}.pdf`,
    ...extra,
  })

  const get = (token: string) =>
    fetch(`${BASE_URL}/functions/v1/magic-link-get`, { headers: { ...FN_HEADERS, 'x-magic-link-token': token } })

  const confirm = (token: string) =>
    fetch(`${BASE_URL}/functions/v1/magic-link-confirm`, {
      method: 'POST',
      headers: { ...FN_HEADERS, 'x-magic-link-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

  /** Corps multipart écrit à la main : sa longueur est connue, donc Content-Length est posé. */
  const upload = (token: string) => {
    const boundary = `----s10${setup.stamp}`
    const corps = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="type"',
      '',
      'identity',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="piece.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.4 sonde',
      `--${boundary}--`,
      '',
    ].join('\r\n')
    return fetch(`${BASE_URL}/functions/v1/magic-link-upload`, {
      method: 'POST',
      headers: { ...FN_HEADERS, 'x-magic-link-token': token, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: new TextEncoder().encode(corps),
    })
  }

  beforeAll(async () => {
    // Shim Deno AVANT d'importer le module de jeton — même convention que kyc-report-data.spec.ts.
    ;(globalThis as Record<string, unknown>).Deno = {
      env: { get: (k: string) => (k === 'MEGGA_MAGIC_LINK_HMAC_SECRET' ? TEST_SECRET : undefined) },
    }
    const mod = (await import('../../supabase/functions/_shared/magic-link-token.ts')) as { signMagicLinkToken: SignFn }
    sign = mod.signMagicLinkToken
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    // Les lignes d'audit restent : `activity_events` est append-only par conception.
    if (linkIds.length) await svc.from('kyc_magic_link_uploads').delete().in('magic_link_id', linkIds).then(() => {}, () => {})
    if (caseIds.length) await svc.from('kyc_magic_link_uploads').delete().in('kyc_case_id', caseIds).then(() => {}, () => {})
    if (linkIds.length) await svc.from('kyc_magic_links').delete().in('id', linkIds).then(() => {}, () => {})
    if (caseIds.length) await svc.from('kyc_cases').delete().in('id', caseIds).then(() => {}, () => {})
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds).then(() => {}, () => {})
    await setup.cleanup()
  })

  describe('G — magic-link-get ne sert que la liste blanche', () => {
    it('G1 lien ouvert : prénom et nom de fichier servis, aucune sentinelle — pas même d’une pièce WhatsApp rattachée', async () => {
      const { linkId, caseId, token } = await mkLink('G1')
      const { error: e1 } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, {
        ocr_fields: { nom: 'SENTINEL_NOM', numero: 'SENTINEL_DOC', naissance: '1901-01-01' },
      }))
      expect(e1).toBeNull()
      // Pièce WhatsApp (porteuse d'OCR) rattachée au lien PAR LE SERVICE : le trigger l'admet
      // (même agence, lien ouvert, sous plafond) — c'est donc la liste blanche qui doit tenir.
      const { data: wa, error: e2 } = await svc.from('kyc_magic_link_uploads').insert(piece(null, {
        kyc_case_id: caseId, source: 'whatsapp', filename: 'wa-demo.pdf',
        ocr_fields: { nom: 'SENTINEL_NOM', numero: 'SENTINEL_DOC' },
      })).select('id').single()
      expect(e2).toBeNull()
      const { error: e3 } = await svc.from('kyc_magic_link_uploads').update({ magic_link_id: linkId }).eq('id', wa!.id)
      expect(e3).toBeNull()

      const res = await get(token)
      expect(res.status).toBe(200)
      const texte = await res.text()
      // Témoins : la vue n'est pas vide.
      expect(texte).toContain('Marie')
      expect(texte).toContain('passeport-demo.pdf')
      expect(texte).toContain('wa-demo.pdf')
      for (const s of SENTINELLES) expect(texte, `fuite : ${s}`).not.toContain(s)
      for (const cle of ['ocr_fields', 'last_name', 'custom_message', 'slug', 'confirmed_by_client']) {
        expect(texte, `clé servie : ${cle}`).not.toContain(`"${cle}"`)
      }
    })

    it('G2 lien soumis : {status, confirmed_at, message} et rien d’autre', async () => {
      const { linkId, token } = await mkLink('G2')
      await svc.from('kyc_magic_links').update({ status: 'submitted', confirmed_at: new Date().toISOString() }).eq('id', linkId)
      const res = await get(token)
      expect(res.status).toBe(200)
      const corps = (await res.json()) as Record<string, unknown>
      expect(corps.status).toBe('submitted')
      expect(Object.keys(corps).sort()).toEqual(['confirmed_at', 'message', 'status'])
    })
  })

  describe('C — magic-link-confirm : cycle de vie à sens unique', () => {
    it('C1 un lien expiré par son STATUT (échéance future) répond 410, sans rien basculer', async () => {
      const { linkId, caseId, token, dossierStatus } = await mkLink('C1')
      await svc.from('kyc_magic_link_uploads').insert(piece(linkId))
      await svc.from('kyc_magic_links').update({ status: 'expired' }).eq('id', linkId)

      const res = await confirm(token)
      expect(res.status).toBe(410)
      const { data: lien } = await svc.from('kyc_magic_links').select('status').eq('id', linkId).single()
      expect(lien?.status).toBe('expired')
      const { data: dossier } = await svc.from('kyc_cases').select('dossier_status').eq('id', caseId).single()
      expect(dossier?.dossier_status).toBe(dossierStatus)
    })

    it('C2 CONTRÔLE POSITIF — le même parcours sur un lien ouvert soumet', async () => {
      const { linkId, token } = await mkLink('C2')
      await svc.from('kyc_magic_link_uploads').insert(piece(linkId))
      const res = await confirm(token)
      expect(res.status).toBe(200)
      expect(((await res.json()) as { status?: string }).status).toBe('submitted')
      const { data: lien } = await svc.from('kyc_magic_links').select('status').eq('id', linkId).single()
      expect(lien?.status).toBe('submitted')
    })

    it('C3 reconfirmer un lien soumis PUIS échu reste idempotent : jamais réécrit en « expiré »', async () => {
      const { linkId, token } = await mkLink('C3')
      await svc.from('kyc_magic_link_uploads').insert(piece(linkId))
      expect((await confirm(token)).status).toBe(200)
      // L'échéance passe (envoi antidaté avec elle : CHECK kyc_magic_links_expires_after_sent).
      // L'ancien ordre testait la date AVANT la soumission et réécrivait le lien en `expired`.
      const passe = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
      const { error: echuErr } = await svc.from('kyc_magic_links').update({ sent_at: passe(2), expires_at: passe(1) }).eq('id', linkId)
      expect(echuErr).toBeNull()
      const res = await confirm(token)
      expect(res.status).toBe(200)
      expect(((await res.json()) as { idempotent?: boolean }).idempotent).toBe(true)
      const { data: lien } = await svc.from('kyc_magic_links').select('status').eq('id', linkId).single()
      expect(lien?.status).toBe('submitted')
    })
  })

  describe('U — magic-link-upload : un lien plein', () => {
    it('U1 répond 409 upload_limit, et n’écrit qu’UNE ligne d’audit pour deux refus', async () => {
      const { linkId, token } = await mkLink('U1')
      for (let i = 0; i < 20; i++) {
        const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId))
        expect(error, `pièce ${i + 1}`).toBeNull()
      }
      for (let essai = 0; essai < 2; essai++) {
        const res = await upload(token)
        expect(res.status, `essai ${essai + 1}`).toBe(409)
        expect(((await res.json()) as { reason?: string }).reason).toBe('upload_limit')
      }
      const { data: audit } = await svc.from('activity_events').select('id, category, severity, actor_kind')
        .eq('entity_id', linkId).eq('action', 'kyc_magic_link_upload_refused')
      expect(audit ?? []).toHaveLength(1)
      expect(audit?.[0]).toMatchObject({ category: 'kyc', severity: 'warn', actor_kind: 'system' })
      const { count } = await svc.from('kyc_magic_link_uploads').select('id', { count: 'exact', head: true }).eq('magic_link_id', linkId)
      expect(count).toBe(20)
    })
  })
})
