/**
 * Backend (live CI) — plafonds d'un lien magique KYC et écriture réservée au service
 * (migration 20260913160400, audit du 13.09.2026, point S10).
 *
 * Rejoue en base fraîche ce que la sonde de production (transaction annulée) a montré :
 *   A  20 pièces passent, la 21ᵉ est refusée ; 100 Mo passent, un octet de plus non ;
 *      une pièce WhatsApp (sans lien) n'est pas plafonnée — contrôle positif.
 *   B  le chemin UPDATE : rattacher une pièce à un lien plein, ou au lien d'une autre
 *      agence, est refusé — l'INSERT seul ne suffisait pas.
 *   C  un lien soumis, ou échu par sa date, ne reçoit plus rien.
 *   D  `authenticated` ne peut plus écrire dans la table — refus de PRIVILÈGE, pas une
 *      ligne invisible : l'agent LIT toujours la même ligne (contrôle positif).
 *
 * Toutes les écritures passent par le service_role : c'est l'identité des écrivains réels
 * (magic-link-upload, magic-link-confirm, whatsapp-actions), et le trigger doit les borner.
 *
 * ⚠ Nettoyage en meilleur effort : la rétention LBA (enforce_kyc_magic_links_retention)
 * refuse de supprimer un lien de moins de dix ans — même convention que kyc-appointments.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const MIB = 1024 * 1024

describe.skipIf(!HAS_KEYS)('kyc_magic_link_uploads — plafonds par lien et écriture réservée au service', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  const contactIds: string[] = []
  const caseIds: string[] = []
  const linkIds: string[] = []

  const mkCase = async (tag: string): Promise<{ contactId: string; caseId: string }> => {
    const { data: c, error: cErr } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Plafond', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contact ${tag}: ${cErr.message}`)
    contactIds.push(c.id)
    const { data: k, error: kErr } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: c.id, type: 'buyer_pp',
    }).select('id').single()
    if (kErr) throw new Error(`kyc_case ${tag}: ${kErr.message}`)
    caseIds.push(k.id)
    return { contactId: c.id, caseId: k.id }
  }

  /** Un lien de l'agence A ; `expiresInH` négatif fabrique un lien échu (envoi antidaté). */
  const mkLink = async (tag: string, opts: { status?: string; expiresInH?: number } = {}) => {
    const { contactId, caseId } = await mkCase(tag)
    const expiresAt = new Date(Date.now() + (opts.expiresInH ?? 72) * 3_600_000)
    // CHECK kyc_magic_links_expires_after_sent : l'envoi précède toujours l'échéance.
    const sentAt = new Date(Math.min(Date.now(), expiresAt.getTime() - 3_600_000))
    const { data, error } = await svc.from('kyc_magic_links').insert({
      token: `s10-${setup.stamp}-${tag}`,
      agency_id: setup.agencyAId, kyc_case_id: caseId, contact_id: contactId,
      mode: 'libre', channels: ['email'], status: opts.status ?? 'opened',
      sent_at: sentAt.toISOString(), expires_at: expiresAt.toISOString(),
      created_by: setup.agentAId,
    }).select('id').single()
    if (error) throw new Error(`link ${tag}: ${error.message}`)
    linkIds.push(data.id)
    return { linkId: data.id as string, caseId }
  }

  const piece = (linkId: string | null, size: number, extra: Record<string, unknown> = {}) => ({
    magic_link_id: linkId, agency_id: setup.agencyAId, type: 'identity',
    filename: 'piece.pdf', size_bytes: size, mime_type: 'application/pdf',
    storage_path: `${setup.agencyAId}/${linkId ?? 'wa'}/${crypto.randomUUID()}.pdf`,
    ...extra,
  })

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    if (linkIds.length) await svc.from('kyc_magic_link_uploads').delete().in('magic_link_id', linkIds).then(() => {}, () => {})
    if (caseIds.length) await svc.from('kyc_magic_link_uploads').delete().in('kyc_case_id', caseIds).then(() => {}, () => {})
    if (linkIds.length) await svc.from('kyc_magic_links').delete().in('id', linkIds).then(() => {}, () => {})
    if (caseIds.length) await svc.from('kyc_cases').delete().in('id', caseIds).then(() => {}, () => {})
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds).then(() => {}, () => {})
    await setup.cleanup()
  })

  describe('A — plafonds à l’INSERT', () => {
    it('A1 20 pièces passent, la 21ᵉ est refusée (magic_link_upload_limit)', async () => {
      const { linkId } = await mkLink('A1')
      for (let i = 0; i < 20; i++) {
        const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
        expect(error, `pièce ${i + 1}`).toBeNull()
      }
      const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error?.message ?? '').toContain('magic_link_upload_limit')
    })

    it('A2 exactement 100 Mo passent, un octet de plus non', async () => {
      const { linkId } = await mkLink('A2')
      for (let i = 0; i < 10; i++) {
        const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 10 * MIB))
        expect(error, `pièce ${i + 1}`).toBeNull()
      }
      const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error?.message ?? '').toContain('magic_link_upload_limit')
    })

    it('A3 CONTRÔLE POSITIF — une pièce WhatsApp (sans lien) passe, même sur le dossier d’un lien plein', async () => {
      const { linkId, caseId } = await mkLink('A3')
      for (let i = 0; i < 20; i++) await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      const { error } = await svc.from('kyc_magic_link_uploads')
        .insert(piece(null, 1, { kyc_case_id: caseId, source: 'whatsapp' }))
      expect(error).toBeNull()
    })
  })

  describe('B — le chemin UPDATE ne contourne plus rien', () => {
    it('B1 rattacher une pièce WhatsApp à un lien plein est refusé', async () => {
      const { linkId, caseId } = await mkLink('B1')
      for (let i = 0; i < 20; i++) await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      const { data: wa, error: waErr } = await svc.from('kyc_magic_link_uploads')
        .insert(piece(null, 1, { kyc_case_id: caseId, source: 'whatsapp' })).select('id').single()
      expect(waErr).toBeNull()
      const { error } = await svc.from('kyc_magic_link_uploads').update({ magic_link_id: linkId }).eq('id', wa!.id)
      expect(error?.message ?? '').toContain('magic_link_upload_limit')
    })

    it('B2 CONTRÔLE POSITIF — le même rattachement passe sur un lien ouvert non plein de la même agence', async () => {
      const { linkId, caseId } = await mkLink('B2')
      const { data: wa } = await svc.from('kyc_magic_link_uploads')
        .insert(piece(null, 1, { kyc_case_id: caseId, source: 'whatsapp' })).select('id').single()
      const { error } = await svc.from('kyc_magic_link_uploads').update({ magic_link_id: linkId }).eq('id', wa!.id)
      expect(error).toBeNull()
    })

    it('B3 une pièce d’une autre agence ne se rattache pas au lien (magic_link_agency_mismatch)', async () => {
      const { linkId } = await mkLink('B3')
      const { error } = await svc.from('kyc_magic_link_uploads')
        .insert(piece(linkId, 1, { agency_id: setup.agencyBId }))
      expect(error?.message ?? '').toContain('magic_link_agency_mismatch')
    })
  })

  describe('C — un lien terminal ne reçoit plus rien', () => {
    it('C1 un lien soumis refuse toute pièce (magic_link_not_uploadable)', async () => {
      const { linkId } = await mkLink('C1', { status: 'submitted' })
      const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error?.message ?? '').toContain('magic_link_not_uploadable')
    })

    it('C2 un lien échu par sa DATE refuse, même si son statut est encore ouvert', async () => {
      const { linkId } = await mkLink('C2', { status: 'opened', expiresInH: -1 })
      const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error?.message ?? '').toContain('magic_link_not_uploadable')
    })

    it('C3 CONTRÔLE POSITIF — un lien ouvert et à échéance accepte la pièce', async () => {
      const { linkId } = await mkLink('C3', { status: 'uploading' })
      const { error } = await svc.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error).toBeNull()
    })
  })

  describe('D — `authenticated` n’écrit plus dans la table', () => {
    it('D1 l’UPDATE d’un agent sur une pièce de SON agence est refusé par privilège', async () => {
      const { linkId, caseId } = await mkLink('D1')
      const { data: wa } = await svc.from('kyc_magic_link_uploads')
        .insert(piece(null, 1, { kyc_case_id: caseId, source: 'whatsapp', ocr_fields: { nom: 'SONDE' } }))
        .select('id').single()

      // Contrôle positif : l'agent VOIT la ligne — le refus qui suit n'est donc pas une
      // ligne rendue invisible par la RLS, mais bien un privilège retiré.
      const { data: vue, error: lectureErr } = await setup.clientA.from('kyc_magic_link_uploads').select('id').eq('id', wa!.id)
      expect(lectureErr).toBeNull()
      expect((vue ?? []).map((r) => r.id)).toEqual([wa!.id])

      const { error } = await setup.clientA.from('kyc_magic_link_uploads').update({ magic_link_id: linkId }).eq('id', wa!.id)
      expect(error, 'un agent a pu écrire dans kyc_magic_link_uploads').not.toBeNull()
      expect(error?.code).toBe('42501')

      const { data: relue } = await svc.from('kyc_magic_link_uploads').select('magic_link_id').eq('id', wa!.id).single()
      expect(relue?.magic_link_id).toBeNull()
    })

    it('D2 l’INSERT d’un agent est refusé par privilège', async () => {
      const { linkId } = await mkLink('D2')
      const { error } = await setup.clientA.from('kyc_magic_link_uploads').insert(piece(linkId, 1))
      expect(error?.code).toBe('42501')
    })
  })
})
