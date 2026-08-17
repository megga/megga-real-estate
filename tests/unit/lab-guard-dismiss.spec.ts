/**
 * Garde-fou : renvoyer le bandeau LAB fait taire UN ÉTAT, jamais « le bandeau ».
 *
 * Le bandeau de `LabGuardBanner` est devenu fermable le 18 août 2026 (demande Julien :
 * « Vérification d'identité non soumise » est redondant avec le wizard qu'on a sous les
 * yeux). Toute la prudence tient dans ce que le renvoi MÉMORISE.
 *
 * ⛔ Un simple booléen « fermé » ferait taire la SUITE. Quelqu'un qui écarte « non
 * soumise » n'entendrait plus « Correction demandée » — or ce bandeau-là est, de l'aveu
 * de l'en-tête du composant, la SEULE chose qui explique pourquoi son formulaire vient
 * de se rouvrir après un renvoi du relecteur. Le message n'est pas « un bandeau », c'est
 * « votre dossier est dans l'état X ».
 *
 * ⚠ Le renvoi ne lève AUCUN blocage : celui-ci est côté serveur
 * (`_shared/agency-lab-guard.ts`), et ce bandeau n'a jamais fait que l'annoncer à
 * l'avance. Fermer une annonce ne débloque rien.
 */
import { describe, it, expect } from 'vitest'
import { labGuardDismissKey } from '@/components/layout/LabGuardBanner'

const AGENCE = '18f9003d-1235-4025-8422-9ad4ee26d898'
const AUTRE_AGENCE = '10f62037-9110-4950-968c-941814dd3c11'

describe('labGuardDismissKey', () => {
  it('le même état, dans la même agence, reste renvoyé', () => {
    expect(labGuardDismissKey(AGENCE, 'blocked_not_submitted'))
      .toBe(labGuardDismissKey(AGENCE, 'blocked_not_submitted'))
  })

  it('⛔ un CHANGEMENT D\'ÉTAT ramène le bandeau — c\'est la raison d\'être de cette clé', () => {
    const renvoye = labGuardDismissKey(AGENCE, 'blocked_not_submitted')
    // Les trois autres états bloqués disent autre chose, et doivent se redire.
    expect(labGuardDismissKey(AGENCE, 'blocked_correction_requested')).not.toBe(renvoye)
    expect(labGuardDismissKey(AGENCE, 'blocked_pending_review')).not.toBe(renvoye)
    expect(labGuardDismissKey(AGENCE, 'blocked_rejected')).not.toBe(renvoye)
  })

  it('un CHANGEMENT D\'AGENCE ramène le bandeau', () => {
    // Un poste qui a vu deux agences (super-admin, impersonation) ne doit pas éteindre
    // le bandeau de la seconde parce qu'on a fermé celui de la première.
    expect(labGuardDismissKey(AUTRE_AGENCE, 'blocked_not_submitted'))
      .not.toBe(labGuardDismissKey(AGENCE, 'blocked_not_submitted'))
  })

  it('une agence absente ne se confond pas avec une agence nommée', () => {
    const sansAgence = labGuardDismissKey(null, 'blocked_not_submitted')
    expect(sansAgence).toBe(labGuardDismissKey(undefined, 'blocked_not_submitted'))
    expect(sansAgence).not.toBe(labGuardDismissKey(AGENCE, 'blocked_not_submitted'))
  })

  it('rend une valeur unique par couple, jamais une collision', () => {
    const agences = [AGENCE, AUTRE_AGENCE, null]
    const etats = ['blocked_not_submitted', 'blocked_correction_requested',
      'blocked_pending_review', 'blocked_rejected'] as const
    const cles = agences.flatMap((a) => etats.map((e) => labGuardDismissKey(a, e)))
    expect(new Set(cles).size).toBe(cles.length)
  })
})
