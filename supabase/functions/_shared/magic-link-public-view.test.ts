/**
 * La vue publique d'un lien magique KYC ne sert QUE sa liste blanche (audit S10, 13.09.2026).
 *
 * Chaque négatif a son témoin : une vue vide (`{}`) passerait tous les « ne contient pas » —
 * c'est pourquoi le même JSON doit AUSSI contenir le prénom, l'agent, l'agence et le nom de
 * fichier. Et les jeux de clés sont comparés EXACTEMENT : un champ ajouté par mégarde fait
 * rougir, même s'il ne porte aucune sentinelle.
 */
import { describe, it, expect } from 'vitest'
import { buildMagicLinkPublicView, type MagicLinkPublicViewInput } from './magic-link-public-view.ts'

const SENTINELLES = [
  'SENTINEL_MSG', 'SENTINEL_LAST', 'SENTINEL_SLUG', 'SENTINEL_NOM', 'SENTINEL_DOC',
  'SENTINEL_PATH', 'SENTINEL_EMAIL', 'SENTINEL_PHONE', 'SENTINEL_TOKEN', 'SENTINEL_IP',
  // Les clés internes du lien : aucune n'a de raison d'atteindre le porteur.
  'agence-1', 'dossier-1', 'contact-1',
  '1901-01-01', 'a'.repeat(64),
]

function entree(): MagicLinkPublicViewInput {
  return {
    link: {
      id: 'lien-1', status: 'pending', mode: 'verifiee', expires_at: '2026-09-20T10:00:00.000Z',
      custom_message: 'SENTINEL_MSG', token: 'SENTINEL_TOKEN', client_ip: 'SENTINEL_IP',
      agency_id: 'agence-1', kyc_case_id: 'dossier-1', contact_id: 'contact-1',
    },
    contact: { first_name: 'Marie', last_name: 'SENTINEL_LAST', email: 'SENTINEL_EMAIL', phone: 'SENTINEL_PHONE' },
    agency: { name: 'Agence A', slug: 'SENTINEL_SLUG' },
    agent: { full_name: 'Agent B', email: 'SENTINEL_EMAIL' },
    uploads: [{
      id: 'piece-1', type: 'identity', filename: 'passeport.pdf', size_bytes: 1,
      uploaded_at: '2026-09-13T10:00:00.000Z',
      // Objet imbriqué : la forme réelle d'`ocr_fields` (whatsapp-actions).
      ocr_fields: { nom: 'SENTINEL_NOM', numero: 'SENTINEL_DOC', naissance: '1901-01-01' },
      confirmed_by_client: true, storage_path: 'SENTINEL_PATH', sha256_hash: 'a'.repeat(64),
    }],
  }
}

describe('buildMagicLinkPublicView — liste blanche', () => {
  it('ne laisse sortir AUCUNE sentinelle (OCR, nom de famille, message, slug, chemin, empreinte…)', () => {
    const json = JSON.stringify(buildMagicLinkPublicView(entree()))
    for (const s of SENTINELLES) expect(json, `fuite : ${s}`).not.toContain(s)
    expect(json).not.toContain('ocr_fields')
    expect(json).not.toContain('confirmed_by_client')
  })

  it('TÉMOIN — le même JSON porte ce que la page affiche (une vue vide échouerait ici)', () => {
    const json = JSON.stringify(buildMagicLinkPublicView(entree()))
    for (const attendu of ['Marie', 'Agence A', 'Agent B', 'passeport.pdf', 'identity', 'lien-1', 'verifiee']) {
      expect(json).toContain(attendu)
    }
  })

  it('les jeux de clés sont EXACTEMENT ceux de la liste blanche', () => {
    const vue = buildMagicLinkPublicView(entree())
    expect(Object.keys(vue).sort()).toEqual(
      ['agency', 'agent', 'contact', 'expires_at', 'magic_link_id', 'mode', 'status', 'uploads'],
    )
    expect(Object.keys(vue.contact ?? {})).toEqual(['first_name'])
    expect(Object.keys(vue.agency ?? {})).toEqual(['name'])
    expect(Object.keys(vue.agent ?? {})).toEqual(['full_name'])
    expect(vue.uploads).toHaveLength(1)
    expect(Object.keys(vue.uploads[0]).sort()).toEqual(['filename', 'id', 'size_bytes', 'type', 'uploaded_at'])
  })

  it('`pending` est rendu `opened` ; les autres statuts passent tels quels', () => {
    expect(buildMagicLinkPublicView(entree()).status).toBe('opened')
    const e = entree()
    expect(buildMagicLinkPublicView({ ...e, link: { ...e.link, status: 'uploading' } }).status).toBe('uploading')
    expect(buildMagicLinkPublicView({ ...e, link: { ...e.link, status: 'verifying' } }).status).toBe('verifying')
  })

  it('contact, agence et agent absents deviennent null ; uploads absents, une liste vide', () => {
    const e = entree()
    const vue = buildMagicLinkPublicView({ ...e, contact: null, agency: undefined, agent: null, uploads: null })
    expect(vue.contact).toBeNull()
    expect(vue.agency).toBeNull()
    expect(vue.agent).toBeNull()
    expect(vue.uploads).toEqual([])
    // Témoin : les champs du lien, eux, restent servis.
    expect(vue.magic_link_id).toBe('lien-1')
  })

  it('une valeur d’un autre type que prévu devient vide au lieu de voyager telle quelle', () => {
    const e = entree()
    const vue = buildMagicLinkPublicView({
      ...e,
      contact: { first_name: { nested: 'SENTINEL_NOM' } },
      uploads: [{ id: 'p', type: 'other', filename: ['SENTINEL_DOC'], size_bytes: '12', uploaded_at: 7 }],
    })
    const json = JSON.stringify(vue)
    expect(json).not.toContain('SENTINEL_NOM')
    expect(json).not.toContain('SENTINEL_DOC')
    expect(vue.contact).toEqual({ first_name: '' })
    expect(vue.uploads[0]).toEqual({ id: 'p', type: 'other', filename: '', size_bytes: 0, uploaded_at: '' })
  })
})
