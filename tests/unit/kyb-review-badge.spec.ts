// Unitaire — la pastille de la file de revue KYB.
//
// CE QUI EST EN JEU. Un dossier qui part en revue produit déjà un activity_events `warn`, donc
// une ligne dans le flux d'alertes du tableau de bord admin — une ligne dans un flux de 10, qui
// défile. Ce que personne n'avait, c'est un compte PERSISTANT : « il y en a 3 » reste vrai tant
// que les 3 n'ont pas été traités, là où un événement passe.

import { describe, it, expect } from 'vitest'
// `@/` (et non un chemin relatif) : c'est l'alias que suivent les specs unitaires qui
// visent `src/` — cf. tests/unit/identity-gate.spec.ts. Les specs qui visent
// `supabase/functions/` passent en revanche par un chemin relatif, l'alias ne couvrant
// que `src/`.
import { formatReviewBadge } from '@/hooks/useKybReviewCount'

describe('formatReviewBadge', () => {
  it('aucune pastille quand la file est vide — une pastille « 0 » serait un bruit permanent', () => {
    expect(formatReviewBadge(0)).toBeNull()
  })

  it('le compte exact tant qu\'il tient sur deux chiffres', () => {
    expect(formatReviewBadge(1)).toBe('1')
    expect(formatReviewBadge(99)).toBe('99')
  })

  it('plafonne à 99+ — au-delà, le chiffre exact ne change plus la décision et casse le rail', () => {
    expect(formatReviewBadge(100)).toBe('99+')
    expect(formatReviewBadge(4200)).toBe('99+')
  })

  it('un compte négatif ou absurde ne rend rien plutôt qu\'une pastille fausse', () => {
    expect(formatReviewBadge(-1)).toBeNull()
    expect(formatReviewBadge(Number.NaN)).toBeNull()
  })
})
