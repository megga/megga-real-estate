// Santé d'une agence — la dérivation front que le handoff exige « inchangée ».
//
// Trois propriétés méritent un test, et chacune correspond à un défaut mesuré :
//   1. L'ORDRE des branches. Elles se recouvrent : une agence suspendue ET à
//      score bas doit sortir « suspendue ». Réordonner change le mot sans
//      changer la donnée, et rien d'autre ne le verrait.
//   2. La branche `score < 45` HORS essai n'est exercée par aucune ligne du jeu
//      de démonstration de la maquette — alors qu'elle couvre 9 agences sur 11
//      en production. C'est la branche la plus rendue et la moins éprouvée.
//   3. La sous-ligne d'identité : `city` est nulle sur 9 agences sur 11, et une
//      agence porte `canton` sans `city` — le gabarit naïf rendrait « · GE ».

import { describe, it, expect } from 'vitest'
import {
  agencyHealth,
  compareAgencies,
  agencyIdentityLine,
  HEALTH_WORD_KEY,
  HEALTH_CAUSE_KEY,
  HEALTH_DORMANT_BELOW,
  HEALTH_FADING_BELOW,
  type AgencyHealthInput,
} from '@/lib/adminAgencyHealth'

const a = (o: Partial<AgencyHealthInput>): AgencyHealthInput => ({
  status: 'active', subscription_status: null, score: 90, transaction_count: 3, ...o,
})

describe('agencyHealth — l’ordre des branches est le contrat', () => {
  it('une agence suspendue ET impayée sort « impayé », jamais « dormant »', () => {
    expect(agencyHealth(a({ status: 'suspended', subscription_status: 'past_due' })))
      .toEqual({ word: 'unpaid', tone: 'err', cause: 'unpaid' })
  })

  it('une agence suspendue à score ÉLEVÉ sort quand même « dormant » (cause : suspendue)', () => {
    // Le piège que l'ordre protège : sans lui, un score de 90 la ferait passer
    // pour saine alors qu'un administrateur l'a coupée.
    const h = agencyHealth(a({ status: 'suspended', score: 90 }))
    expect(h.word).toBe('dormant')
    expect(h.cause).toBe('suspended')
  })

  it('sépare les DEUX « dormant » par leur cause — même mot, états incompatibles', () => {
    const suspendue = agencyHealth(a({ status: 'suspended', score: 90 }))
    const scoreBas = agencyHealth(a({ score: 17 }))
    expect(suspendue.word).toBe(scoreBas.word)
    expect(suspendue.cause).not.toBe(scoreBas.cause)
    expect(scoreBas.cause).toBe('lowScore')
  })

  it('« nouvelle » quand le score est absent — l’activation n’a pas encore tourné', () => {
    expect(agencyHealth(a({ score: null }))).toEqual({ word: 'new', tone: 'mute', cause: 'new' })
  })

  it('« activation en panne » exige les TROIS conditions : essai, zéro deal, score bas', () => {
    const panne = { subscription_status: 'trialing', transaction_count: 0, score: 20 }
    expect(agencyHealth(a(panne)).word).toBe('stalledActivation')
    // Un seul deal suffit à retomber sur « dormant » : l'agence a démarré.
    expect(agencyHealth(a({ ...panne, transaction_count: 1 })).word).toBe('dormant')
    // Hors essai, c'est « dormant » aussi.
    expect(agencyHealth(a({ ...panne, subscription_status: null })).word).toBe('dormant')
  })

  it('couvre la branche la plus rendue en production : score bas, hors essai', () => {
    // 9 agences sur 11 tombent ici, et aucune ligne du mock de la maquette ne
    // l'exerce — c'est la raison d'être de ce test.
    const h = agencyHealth(a({ score: 17, subscription_status: null }))
    expect(h).toEqual({ word: 'dormant', tone: 'err', cause: 'lowScore' })
  })

  it('respecte les deux seuils, bornes comprises', () => {
    expect(agencyHealth(a({ score: HEALTH_DORMANT_BELOW - 1 })).word).toBe('dormant')
    expect(agencyHealth(a({ score: HEALTH_DORMANT_BELOW })).word).toBe('toWake')
    expect(agencyHealth(a({ score: HEALTH_FADING_BELOW - 1 })).word).toBe('toWake')
    expect(agencyHealth(a({ score: HEALTH_FADING_BELOW })).word).toBe('healthy')
  })

  it('chaque mot et chaque cause ont une clé i18n', () => {
    for (const mot of ['healthy', 'toWake', 'stalledActivation', 'dormant', 'unpaid', 'new'] as const) {
      expect(HEALTH_WORD_KEY[mot]).toBeTruthy()
    }
    for (const cause of ['suspended', 'unpaid', 'new', 'stalled', 'lowScore', 'fading', 'healthy'] as const) {
      expect(HEALTH_CAUSE_KEY[cause]).toBeTruthy()
    }
  })
})

describe('compareAgencies', () => {
  const r = (name: string, mrr: number, status = 'active') => ({ name, mrr, status })

  it('range les suspendues en dernier, quel que soit leur MRR', () => {
    const tri = [r('A', 0), r('B', 999, 'suspended'), r('C', 89)].sort(compareAgencies)
    expect(tri.map(x => x.name)).toEqual(['C', 'A', 'B'])
  })

  it('départage par le nom quand le MRR est égal — le cas de TOUTE la base aujourd’hui', () => {
    // 11 agences, toutes Starter, donc MRR 0 : sans ce départage le tri serait
    // instable à l'affichage.
    const tri = [r('Zurich'), r('Aarau'), r('Genève')].map(x => ({ ...x, mrr: 0 })).sort(compareAgencies)
    expect(tri.map(x => x.name)).toEqual(['Aarau', 'Genève', 'Zurich'])
  })
})

describe('agencyIdentityLine', () => {
  it('ne laisse pas de séparateur orphelin quand la ville manque', () => {
    // Cas réel en production : une agence porte `canton = 'GE'` sans ville.
    expect(agencyIdentityLine(null, 'GE')).toBe('GE')
    expect(agencyIdentityLine('Genève', null)).toBe('Genève')
    expect(agencyIdentityLine('Genève', 'GE')).toBe('Genève · GE')
  })

  it('rend une chaîne vide quand les deux manquent — 8 agences sur 11', () => {
    expect(agencyIdentityLine(null, null)).toBe('')
  })

  it('coupe les espaces parasites de la base', () => {
    // Mesuré : une agence porte `"Les Acasias "`, espace finale comprise.
    expect(agencyIdentityLine('Les Acasias ', 'GE')).toBe('Les Acasias · GE')
  })
})
