// Lecteur client du diagnostic de lien KYC.
//
// Les trois propriétés éprouvées ici correspondent chacune à un défaut qui a été
// trouvé en relisant le plan contre les fonctions VIVANTES :
//   1. les deux RPC rendent PLUS de refus que le chemin heureux — `precondition_failed`,
//      `not_found`, `rate_limited`, et deux refus de statut sur la régénération.
//      Un lecteur qui ne trierait que `too_many` laisserait tomber le message du
//      serveur dans une branche que rien ne dessine, sur les cas les plus fréquents.
//   2. la régénération est REFUSÉE pour `submitted` et `expired` : le bouton doit
//      être désactivé, pas produire un refus par clic — et « expiré » est justement
//      la réponse la plus probable au signalement que cet outil sert à traiter.
//   3. la normalisation serveur passe par `unaccent`, une TABLE de translittération
//      (ß→ss, æ→ae…), et non par une décomposition NFD : les deux longueurs
//      divergent sur exactement les noms germanophones que ce produit sert.

import { describe, it, expect } from 'vitest'
import {
  readKycLookup,
  readKycRegenerate,
  kycNormalize,
  canRegenerate,
  KYC_QUERY_MIN,
  STATUS_LABEL_KEY,
  STATUS_STEP,
} from '@/lib/kycDiagnostic'

const ok = (data: unknown) => ({ ok: true, data })
const err = (code: string, message_fr: string, details?: unknown) => ({ ok: false, code, message_fr, details })

describe('readKycLookup', () => {
  it('lit une correspondance et laisse absents les champs que jsonb_strip_nulls a retirés', () => {
    const r = readKycLookup(ok({
      count: 1,
      matches: [{ link_id: 'l1', status: 'pending', agency: 'Immo Léman', email: 'a@b.ch' }],
    }))
    expect(r.kind).toBe('matches')
    if (r.kind !== 'matches') return
    expect(r.count).toBe(1)
    expect(r.matches[0].contact).toBeUndefined()
    expect(r.matches[0].email).toBe('a@b.ch')
  })

  it('trie `too_many` à part et porte le COMPTE, jamais les lignes', () => {
    const r = readKycLookup(err('too_many', 'Cette recherche renvoie trop de résultats. Précisez-la.', { count: 9 }))
    expect(r.kind).toBe('too_many')
    if (r.kind !== 'too_many') return
    expect(r.count).toBe(9)
  })

  it.each([
    ['precondition_failed', 'La recherche demande au moins 3 caractères.'],
    ['not_found', 'Cette agence est introuvable.'],
    ['rate_limited', 'Trop de recherches sur la dernière heure. Réessayez plus tard.'],
  ])('rend le refus « %s » avec le message du serveur VERBATIM', (code, message) => {
    const r = readKycLookup(err(code, message))
    expect(r.kind).toBe('refused')
    if (r.kind !== 'refused') return
    expect(r.code).toBe(code)
    expect(r.messageFr).toBe(message)
  })

  it('ne casse pas sur une réponse vide', () => {
    expect(readKycLookup(null).kind).toBe('refused')
  })
})

describe('readKycRegenerate', () => {
  it('distingue une demande enregistrée d’un rejeu déjà fait', () => {
    expect(readKycRegenerate(ok({ emission: 'pending' })).kind).toBe('requested')
    expect(readKycRegenerate(ok({ already_done: true })).kind).toBe('already_done')
  })

  it.each([
    ['submitted', 'Ce parcours est déjà terminé : il n’y a pas de lien à réémettre.'],
    ['expired', 'Ce lien est déjà expiré : demandez-en un nouveau depuis la fiche du dossier.'],
  ])('rend le refus de statut « %s » plutôt que de le laisser tomber', (_statut, message) => {
    const r = readKycRegenerate(err('precondition_failed', message))
    expect(r.kind).toBe('refused')
    if (r.kind !== 'refused') return
    expect(r.messageFr).toBe(message)
  })
})

describe('canRegenerate — le bouton est fermé sur ce que le serveur refuse', () => {
  it('refuse les deux statuts que la RPC rejette', () => {
    expect(canRegenerate('submitted')).toBe(false)
    expect(canRegenerate('expired')).toBe(false)
  })

  it('autorise les statuts en cours de parcours', () => {
    for (const s of ['pending', 'opened', 'uploaded']) expect(canRegenerate(s)).toBe(true)
  })
})

describe('kycNormalize', () => {
  it('retire espaces, points, tirets et parenthèses comme le serveur', () => {
    expect(kycNormalize('+41 79 412.08-51')).toBe('+41794120851')
    expect(kycNormalize('Sophie Marchand')).toBe('sophiemarchand')
  })

  it('translittère comme `unaccent`, et non comme une décomposition NFD', () => {
    // NFD laisserait ces caractères INTACTS : ils ne portent aucune marque
    // combinante. Le serveur, lui, les remplace — d'où une longueur différente,
    // donc un seuil de 3 caractères qui divergerait sur des noms germanophones.
    expect(kycNormalize('Straßer')).toBe('strasser')
    expect(kycNormalize('Ærø')).toBe('aero')
    expect(kycNormalize('Œuvre')).toBe('oeuvre')
  })

  it('retire les diacritiques latins ordinaires', () => {
    expect(kycNormalize('Génève Zürich')).toBe('genevezurich')
  })

  it('laisse une requête trop courte sous le seuil, pour ne pas appeler le serveur pour rien', () => {
    expect(kycNormalize('a b').length).toBeLessThan(KYC_QUERY_MIN)
    expect(kycNormalize('a. b').length).toBeLessThan(KYC_QUERY_MIN)
  })
})

describe('vocabulaire de statut', () => {
  it('couvre les six statuts que la base peut porter', () => {
    for (const s of ['pending', 'opened', 'uploaded', 'submitted', 'expired', 'cancelled']) {
      expect(STATUS_LABEL_KEY[s]).toBeTruthy()
      expect(STATUS_STEP[s]).toBeDefined()
    }
  })

  it('place expiré et annulé HORS de la frise, jamais à l’étape zéro', () => {
    expect(STATUS_STEP.expired).toBe(-1)
    expect(STATUS_STEP.cancelled).toBe(-1)
    expect(STATUS_STEP.pending).toBe(0)
  })
})
