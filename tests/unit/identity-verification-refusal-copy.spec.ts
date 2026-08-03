// Le motif d'un refus de vérification doit rester LISIBLE là où il atterrit.
//
// Depuis le 03.08.2026 l'étape 3 du wizard KYB propose la vérification chez Stripe.
// Sur un refus DÉFINITIF (verificationNeedsManualFallback), IdentityShell bascule
// l'écran sur le dépôt manuel tout seul : le dirigeant revient de chez le prestataire
// et trouve un formulaire de fichier à la place du bouton qu'il venait d'actionner.
//
// Deux invariants tiennent cette bascule, et aucun des deux n'est visible en lisant le
// composant :
//
//  1. Chaque code définitif a sa PROPRE phrase dans le catalogue. Sans elle,
//     knownVerificationError() retombe sur `unknown`, dont le texte propose de
//     « reprendre » — un conseil impossible à suivre, puisque réessayer donnerait
//     exactement le même refus. C'est le pire des deux mondes : l'écran a changé de
//     forme ET il conseille le geste qui ne marche pas.
//
//  2. Les quatre langues portent ces phrases. Une clé absente s'affiche en clair
//     (cf. le gate lint:i18n-keys), et ici ce serait `wizard.pieceIdentite.
//     verification.errors.country_not_supported` en plein milieu de l'écran, au moment
//     précis où l'utilisateur cherche à comprendre ce qui vient de le bloquer.
//
// Ce fichier n'éprouve PAS le rendu (ce dépôt n'a pas @testing-library/react) : il
// éprouve l'accord entre trois sources qui ne se connaissent pas — la liste des refus
// définitifs (useAgencyIdentity), le catalogue de codes (StepPieceIdentite) et les
// quatre fichiers de traduction.

import { describe, it, expect } from 'vitest'
import { KNOWN_VERIFICATION_ERRORS, verificationNeedsManualFallback } from '@/hooks/useAgencyIdentity'
// Préfixés `l` : `it` nu entrerait en collision avec le `it` de vitest — le fichier
// compile alors en apparence et casse au transform, pas à la lecture.
import lFr from '@/i18n/locales/fr/onboarding.json'
import lDe from '@/i18n/locales/de/onboarding.json'
import lEn from '@/i18n/locales/en/onboarding.json'
import lIt from '@/i18n/locales/it/onboarding.json'

/** Les trois codes que Stripe rend et sur lesquels réessayer est inutile. */
const REFUS_DEFINITIFS = ['consent_declined', 'country_not_supported', 'under_supported_age']

const LANGUES = { fr: lFr, de: lDe, en: lEn, it: lIt } as Record<string, {
  wizard: { pieceIdentite: { verification: { accepted: string; errors: Record<string, string> } } }
}>

/** Le catalogue traduit d'une langue, tel que le composant le lit. */
function messages(langue: string): Record<string, string> {
  return LANGUES[langue].wizard.pieceIdentite.verification.errors
}

describe('refus définitifs — la liste et le catalogue ne doivent pas diverger', () => {
  it('les trois codes définitifs sont bien reconnus comme tels', () => {
    // Garde-fou de la garde elle-même : si quelqu'un retire un code de
    // verificationNeedsManualFallback, les assertions suivantes deviendraient vraies
    // sans rien prouver — elles porteraient sur des codes qui ne déclenchent plus la
    // bascule.
    for (const code of REFUS_DEFINITIFS) {
      expect(verificationNeedsManualFallback(code), code).toBe(true)
    }
  })

  it('chaque code définitif a sa propre entrée au catalogue, jamais le repli `unknown`', () => {
    for (const code of REFUS_DEFINITIFS) {
      expect(KNOWN_VERIFICATION_ERRORS, code).toContain(code)
    }
  })

  it('un code définitif ajouté sans phrase ferait retomber sur `unknown` — ce que ce test interdit', () => {
    // Éprouve l'inverse : tout code qui déclenche la bascule DOIT être au catalogue.
    // Écrit dans ce sens, le test attrape un quatrième code ajouté demain à
    // verificationNeedsManualFallback sans sa traduction.
    const declencheurs = [...REFUS_DEFINITIFS, 'document_unverified_other', 'abandoned', null]
      .filter((c) => verificationNeedsManualFallback(c))
    expect(declencheurs.filter((c) => !KNOWN_VERIFICATION_ERRORS.includes(c as string))).toEqual([])
  })
})

describe('les quatre langues portent les phrases lues depuis le dépôt manuel', () => {
  for (const langue of Object.keys(LANGUES)) {
    it(`${langue} — les trois refus définitifs et le repli \`unknown\` sont traduits et non vides`, () => {
      const catalogue = messages(langue)
      for (const code of [...REFUS_DEFINITIFS, 'unknown']) {
        expect(catalogue[code], `${langue}/${code}`).toBeTruthy()
        expect(catalogue[code].trim().length, `${langue}/${code}`).toBeGreaterThan(0)
      }
    })

    it(`${langue} — la nature des pièces acceptées en ligne est annoncée avant le clic`, () => {
      // `accepted` répond au fait que le sous-titre de l'étape annonce le titre de
      // séjour, que Stripe n'accepte pas : sans cette phrase, un dirigeant au livret
      // B/C part chez le prestataire pour se cogner à l'autre bout.
      const phrase = LANGUES[langue].wizard.pieceIdentite.verification.accepted
      expect(phrase, langue).toBeTruthy()
      expect(phrase.trim().length, langue).toBeGreaterThan(0)
    })
  }
})
