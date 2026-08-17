/**
 * Garde-fou : le sceau de l'écran de retour ne peut plus affirmer une concordance
 * qu'il n'a pas vérifiée.
 *
 * ⛔ CE QUI S'EST PASSÉ, le 17 août 2026. Un dirigeant ayant changé de nom déclare son
 * ANCIEN nom à l'étape 1, puis vérifie son identité chez Stripe avec sa pièce au NOUVEAU
 * nom. Le webhook enregistre fidèlement `{verdict: 'mismatch', lastName: 'differs'}` —
 * et l'écran de retour affiche « ancien nom 🛡️ ». Le sceau se posait sur le seul
 * `status` de la session Stripe, qui dit « document authentique, visage concordant » et
 * rien d'autre. L'en-tête du composant, lui, annonçait depuis toujours que le sceau
 * signifie « le nom que nous détenons correspond au document vérifié ». Le verdict de
 * correspondance n'était même pas dans les props : la promesse n'était pas implémentée.
 *
 * ⚠ CE N'ÉTAIT PAS UNE FAILLE : le mur de conformité est ailleurs (`id_document` /
 * `pending_manual_review`, tranché par un humain, et le relecteur voit bien `mismatch`).
 * C'était un MENSONGE D'INTERFACE, qui laissait finir tout l'onboarding pour se faire
 * retoquer ensuite.
 */
import { describe, it, expect } from 'vitest'
import { resolveDeclaredIdentityGap } from '@/components/crm-identity/IdentityVerificationReturnScreen'
import type { KybIdReadRecord } from '@/types/kybIdRead'

/** Un verdict de prestataire, dont seuls les trois champs comparés varient d'un cas à l'autre. */
function verdict(fields: Partial<KybIdReadRecord['fields']>): KybIdReadRecord {
  return {
    provider: 'stripe_identity',
    verdict: 'partial',
    fields: { firstName: 'exact', lastName: 'exact', dateOfBirth: 'exact', ...fields },
    documentTypeMatches: null,
    expiresOn: null,
    expired: null,
  }
}

describe('resolveDeclaredIdentityGap', () => {
  it('ne signale rien quand tout concorde', () => {
    expect(resolveDeclaredIdentityGap(verdict({}))).toEqual([])
  })

  it('signale le champ CONTREDIT, et lui seul', () => {
    expect(resolveDeclaredIdentityGap(verdict({ lastName: 'differs' }))).toEqual(['lastName'])
    expect(resolveDeclaredIdentityGap(verdict({ firstName: 'differs' }))).toEqual(['firstName'])
    expect(resolveDeclaredIdentityGap(verdict({ dateOfBirth: 'differs' }))).toEqual(['dateOfBirth'])
  })

  it('rend les champs dans l\'ordre où l\'étape 1 les demande', () => {
    const gap = resolveDeclaredIdentityGap(
      verdict({ dateOfBirth: 'differs', lastName: 'differs', firstName: 'differs' }),
    )
    expect(gap).toEqual(['firstName', 'lastName', 'dateOfBirth'])
  })

  it('⚠ NE signale PAS `approx` — c\'est le cas normal du prénom composé et du nom d\'alliance', () => {
    // « Jean » déclaré pour « Jean Pierre » lu, ou un nom de naissance face à un nom
    // d'alliance : la comparaison rend `approx` par conception (compareName). Alerter
    // dessus ferait sonner l'alarme sur des dossiers parfaitement sains.
    expect(resolveDeclaredIdentityGap(verdict({ firstName: 'approx', lastName: 'approx' }))).toEqual([])
  })

  it('⚠ NE signale PAS `unreadable` — absence de preuve n\'est pas contradiction', () => {
    // Une date de naissance non déclarée à l'étape 1 suffit à rendre `unreadable`. C'est
    // fréquent, et ça ne contredit rien.
    expect(resolveDeclaredIdentityGap(verdict({ dateOfBirth: 'unreadable' }))).toEqual([])
  })

  it('ne signale rien sans verdict — on ne sait rien, on n\'accuse de rien', () => {
    expect(resolveDeclaredIdentityGap(null)).toEqual([])
  })

  it('survit à un enregistrement mal formé plutôt que de faire tomber l\'écran', () => {
    // `id_document_read` est du jsonb libre : une ligne écrite par une version antérieure
    // du contrat ne doit pas casser l'écran de retour du dirigeant.
    expect(resolveDeclaredIdentityGap({ verdict: 'match' } as unknown as KybIdReadRecord)).toEqual([])
  })

  it('LE CAS RÉEL du 17.08.2026 : nom contredit, naissance illisible', () => {
    // Verdict effectivement enregistré en production pour la personne
    // 0d506f08-8ff6-4bcc-903f-7291e6803785.
    const reel = verdict({ firstName: 'exact', lastName: 'differs', dateOfBirth: 'unreadable' })
    expect(resolveDeclaredIdentityGap(reel)).toEqual(['lastName'])
  })
})
