// Le MOTIF d'une correction demandée doit arriver jusqu'au dirigeant, dans l'app.
//
// `admin_request_agency_correction` rend le motif OBLIGATOIRE (« a correction request
// must say what to correct ») précisément pour qu'il soit actionnable, puis remet
// `identity_submitted_at` à NULL — ce qui rouvre le gate et renvoie le dirigeant dans le
// wizard. Jusqu'au 05.08.2026 il y arrivait sans savoir quoi corriger : le motif ne
// sortait de la base que par un e-mail, et le wizard n'en disait rien.
//
// Deux accords tiennent cet affichage, et aucun n'est visible en lisant un seul fichier :
//
//  1. le hook lit l'action que la RPC écrit RÉELLEMENT (une chaîne recopiée à la main
//     des deux côtés, donc une divergence possible sans erreur de compilation) ;
//  2. les quatre langues portent les deux clés de l'encart — une clé absente s'affiche
//     en clair (cf. le gate lint:i18n-keys), ici en tête de l'étape que le dirigeant
//     vient corriger.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readCorrectionReason, CORRECTION_REQUESTED_ACTION } from '@/hooks/useAgencyCorrectionReason'
// Préfixés `l` : `it` nu entrerait en collision avec le `it` de vitest.
import lFr from '@/i18n/locales/fr/onboarding.json'
import lDe from '@/i18n/locales/de/onboarding.json'
import lEn from '@/i18n/locales/en/onboarding.json'
import lIt from '@/i18n/locales/it/onboarding.json'

const LANGUES = { fr: lFr, de: lDe, en: lEn, it: lIt } as Record<string, {
  wizard: { correction?: Record<string, string> }
}>

describe('readCorrectionReason — un motif lisible, ou rien', () => {
  it('rend le motif écrit par le relecteur', () => {
    expect(readCorrectionReason({ reason: 'Le numéro IDE ne correspond pas au registre.' }))
      .toBe('Le numéro IDE ne correspond pas au registre.')
  })

  it('rogne les blancs de bord', () => {
    expect(readCorrectionReason({ reason: '  IDE erroné  ' })).toBe('IDE erroné')
  })

  it('un motif VIDE ne produit pas un encart vide', () => {
    // La RPC l'interdit, mais `metadata` est un jsonb libre : un encart qui s'ouvre sur
    // du blanc est pire que la phrase générique, qui reste vraie.
    expect(readCorrectionReason({ reason: '' })).toBeNull()
    expect(readCorrectionReason({ reason: '   ' })).toBeNull()
  })

  it('un metadata sans motif, ou d\'une autre forme, ne casse rien', () => {
    expect(readCorrectionReason({ previous_status: 'manual_review' })).toBeNull()
    expect(readCorrectionReason({ reason: 42 })).toBeNull()
    expect(readCorrectionReason(null)).toBeNull()
    expect(readCorrectionReason(undefined)).toBeNull()
    expect(readCorrectionReason('IDE erroné')).toBeNull()
  })
})

describe('accord avec la RPC — le hook lit ce que la migration écrit', () => {
  it('l\'action journalisée porte le même nom des deux côtés', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260731150000_agency_correction_requested.sql'),
      'utf8',
    )
    expect(
      migration.includes(`'${CORRECTION_REQUESTED_ACTION}'`),
      `admin_request_agency_correction n'écrit plus l'action '${CORRECTION_REQUESTED_ACTION}' — `
      + 'le hook lirait un journal vide et le dirigeant reviendrait corriger à l\'aveugle.',
    ).toBe(true)
  })

  it('le motif voyage bien sous la clé `reason` du metadata', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260731150000_agency_correction_requested.sql'),
      'utf8',
    )
    expect(migration.includes("'reason', p_reason")).toBe(true)
  })
})

describe('les quatre langues portent l\'encart de correction', () => {
  for (const langue of Object.keys(LANGUES)) {
    it(`${langue} — titre et corps`, () => {
      const correction = LANGUES[langue].wizard.correction
      expect(correction, `wizard.correction manque en ${langue}`).toBeTruthy()
      for (const cle of ['title', 'body']) {
        const texte = correction?.[cle]
        expect(typeof texte, `wizard.correction.${cle} manque en ${langue}`).toBe('string')
        expect((texte ?? '').trim().length, `wizard.correction.${cle} est vide en ${langue}`)
          .toBeGreaterThan(0)
      }
    })
  }
})
