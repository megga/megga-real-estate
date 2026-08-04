// Où le bandeau LAB doit se taire — et où il doit rester.
//
// Le bandeau avertit quelqu'un qui fait AUTRE CHOSE que son agence est bloquée. Deux
// surfaces disent déjà mieux ce qu'il résume, et il ne doit donc pas s'y superposer :
//
//  · /dashboard/kyc* — l'écran plein de KycLabGuard porte le même message en entier ;
//  · /dashboard/identite — le wizard EST la réponse aux deux statuts qui y conduisent,
//    et il affiche désormais le motif exact d'une correction, que ce bandeau ne peut
//    que résumer. S'y ajoute l'habillage : ce parcours porte la peau MEGGA X, pas le
//    thème du CRM dont le bandeau tire ses couleurs.
//
// Mais il doit RESTER sur le gate pour les deux statuts qui n'y conduisent personne :
// on n'arrive sur ce formulaire « en revue » ou « refusé » qu'en tapant l'URL, devant
// des colonnes que la base a gelées — le bandeau est alors la seule chose qui explique
// pourquoi rien ne s'enregistrera.

import { describe, it, expect } from 'vitest'
import { shouldShowLabGuardBanner } from '@/components/layout/LabGuardBanner'
import { KYC_LAB_GUARD_ROUTE_PREFIX, LAB_GUARD_LABEL_KEY } from '@/hooks/useLabGuard'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'

/** Les quatre statuts bloqués, tenus par le typage de LAB_GUARD_LABEL_KEY. */
const BLOQUES = Object.keys(LAB_GUARD_LABEL_KEY) as Array<keyof typeof LAB_GUARD_LABEL_KEY>

describe('routes gardées par KycLabGuard — le bandeau se tait', () => {
  for (const statut of BLOQUES) {
    it(`${statut} : muet sur ${KYC_LAB_GUARD_ROUTE_PREFIX}`, () => {
      expect(shouldShowLabGuardBanner(statut, KYC_LAB_GUARD_ROUTE_PREFIX)).toBe(false)
      expect(shouldShowLabGuardBanner(statut, `${KYC_LAB_GUARD_ROUTE_PREFIX}/un-dossier`)).toBe(false)
    })
  }
})

describe('gate d\'identité — muet pour ce qui y conduit, présent pour le reste', () => {
  it('« jamais soumis » : le wizard EST la réponse', () => {
    expect(shouldShowLabGuardBanner('blocked_not_submitted', IDENTITY_GATE_ROUTE)).toBe(false)
  })

  it('« correction demandée » : le wizard porte le motif exact', () => {
    // admin_request_agency_correction remet identity_submitted_at à NULL, donc le gate
    // redirige ICI : répéter un résumé au-dessus du motif complet n'ajoute rien, et le
    // fait dans une autre peau que celle du parcours.
    expect(shouldShowLabGuardBanner('blocked_correction_requested', IDENTITY_GATE_ROUTE)).toBe(false)
  })

  it('« en revue » : personne n\'est envoyé ici, le bandeau explique le formulaire gelé', () => {
    expect(shouldShowLabGuardBanner('blocked_pending_review', IDENTITY_GATE_ROUTE)).toBe(true)
  })

  it('« refusé » : idem, et c\'est le seul renvoi vers le support', () => {
    expect(shouldShowLabGuardBanner('blocked_rejected', IDENTITY_GATE_ROUTE)).toBe(true)
  })
})

describe('partout ailleurs — le bandeau reste le rappel persistant', () => {
  for (const statut of BLOQUES) {
    it(`${statut} : visible sur le reste du CRM`, () => {
      expect(shouldShowLabGuardBanner(statut, '/dashboard')).toBe(true)
      expect(shouldShowLabGuardBanner(statut, '/dashboard/contacts')).toBe(true)
      expect(shouldShowLabGuardBanner(statut, '/dashboard/rendez-vous-accueil')).toBe(true)
    })
  }

  it('une route qui COMMENCE comme le gate sans en être une n\'est pas exemptée', () => {
    // `===` et non `startsWith` sur le gate : /dashboard/identite-verification (route
    // hypothétique) est une page du CRM comme une autre, elle n'a pas la peau MEGGA X.
    expect(shouldShowLabGuardBanner('blocked_not_submitted', `${IDENTITY_GATE_ROUTE}-autre`)).toBe(true)
  })
})
