// Dérivations du registre Utilisateurs.
//
// Les propriétés testées ici sont celles qu'aucune revue ne verra, parce que la
// production ne les exerce pas — c'est le critère de choix, pas la couverture :
//   1. la cascade EXCLUSIVE des anomalies (aucun compte suspendu en base) ;
//   2. le rang d'un rôle HORS organisation : `indexOf` rend −1, et un
//      comparateur qui soustrait des NaN rend un tri indéfini. La base porte
//      justement un profil `buyer` ;
//   3. `displayName` sur la chaîne VIDE — deux profils sur sept, jamais `null` ;
//   4. `consentView` prend la PREMIÈRE ligne d'un type (la RPC trie du plus
//      récent au plus ancien), et le marketing ne rend jamais « refusé ».

import { describe, it, expect } from 'vitest'
import {
  userFlag,
  compareUsers,
  displayName,
  activityView,
  consentView,
  USER_FLAG_ORDER,
  USER_FLAG_KEY,
  USER_FLAG_TONE,
  ROLE_LABEL_KEY,
  ORG_ROLES,
  STALE_DAYS_MIN,
} from '@/lib/adminUserRegistry'

describe('userFlag — cascade exclusive', () => {
  it('un compte suspendu ET dormant sort « suspendu », jamais « dormant »', () => {
    // Croisement qu'aucun compte de production n'exerce : invisible en revue.
    expect(userFlag({ suspended: true, last: null, stale_days: 400 })).toBe('suspended')
  })

  it('« sans activité » l’emporte sur « dormant » quand la date est absente', () => {
    expect(userFlag({ suspended: false, last: null, stale_days: 400 })).toBe('noActivity')
  })

  it('« dormant » à partir du seuil, pas avant', () => {
    expect(userFlag({ suspended: false, last: 'x', stale_days: STALE_DAYS_MIN - 1 })).toBeNull()
    expect(userFlag({ suspended: false, last: 'x', stale_days: STALE_DAYS_MIN })).toBe('stale')
  })

  it('un compte sain ne porte aucun drapeau', () => {
    expect(userFlag({ suspended: false, last: 'x', stale_days: 2 })).toBeNull()
  })

  it('chaque drapeau a un libellé et un ton', () => {
    for (const f of USER_FLAG_ORDER) {
      expect(USER_FLAG_KEY[f]).toBeTruthy()
      expect(USER_FLAG_TONE[f]).toBeTruthy()
    }
  })
})

describe('compareUsers', () => {
  const u = (agency: string | null, role: string, name: string | null) => ({ agency, role, name })

  it('ne rend pas un tri INDÉFINI sur un rôle hors organisation', () => {
    // `buyer` n'est pas dans ORG_ROLES : sans repli, indexOf rend −1 et la
    // soustraction produit un comparateur incohérent.
    const tri = [u('A', 'buyer', 'Zoé'), u('A', 'admin', 'Bob'), u('A', 'agent', 'Ana')].sort(compareUsers)
    expect(tri.map(x => x.name)).toEqual(['Bob', 'Ana', 'Zoé'])
  })

  it('range les comptes SANS agence en dernier', () => {
    const tri = [u(null, 'admin', 'Sans'), u('Zurich', 'agent', 'Avec')].sort(compareUsers)
    expect(tri.map(x => x.name)).toEqual(['Avec', 'Sans'])
  })

  it('groupe par agence avant de trier par rôle', () => {
    const tri = [u('B', 'super_admin', 'X'), u('A', 'agent', 'Y')].sort(compareUsers)
    expect(tri.map(x => x.agency)).toEqual(['A', 'B'])
  })
})

describe('displayName', () => {
  it('replie sur la chaîne VIDE, pas seulement sur null', () => {
    // Deux profils sur sept portent `full_name = ''` : un `?? fallback` est mort.
    expect(displayName('', 'Sans nom')).toBe('Sans nom')
    expect(displayName('   ', 'Sans nom')).toBe('Sans nom')
    expect(displayName(null, 'Sans nom')).toBe('Sans nom')
    expect(displayName('Sophie', 'Sans nom')).toBe('Sophie')
  })
})

describe('activityView', () => {
  it('distingue jamais-actif, dormant et récent', () => {
    expect(activityView({ last: null, stale_days: null }).kind).toBe('none')
    expect(activityView({ last: 'x', stale_days: 90 }).kind).toBe('stale')
    expect(activityView({ last: 'x', stale_days: 1 }).kind).toBe('recent')
  })
})

describe('consentView', () => {
  const rows = [
    { type: 'terms', version: '2026-08', accepted_at: '2026-08-01T00:00:00Z' },
    { type: 'terms', version: '2026-07', accepted_at: '2026-07-01T00:00:00Z' },
    { type: 'privacy', version: '2026-07', accepted_at: '2026-07-01T00:00:00Z' },
  ]

  it('retient la PREMIÈRE ligne d’un type — la RPC trie du plus récent au plus ancien', () => {
    const v = consentView(rows, false)
    expect(v.terms).toEqual({ kind: 'accepted', version: '2026-08', at: '2026-08-01T00:00:00Z' })
  })

  it('dit « non enregistré » quand le type manque, sans inventer de refus', () => {
    expect(consentView([{ type: 'terms', version: '1', accepted_at: 'x' }], false).privacy.kind)
      .toBe('notRecorded')
  })

  it('le marketing ne rend JAMAIS « refusé » — aucun chemin d’inscription ne le demande', () => {
    expect(consentView(rows, false).marketing.kind).toBe('notAsked')
    expect(consentView(rows, true).marketing.kind).toBe('accepted')
    expect(consentView([], false).marketing.kind).toBe('notAsked')
  })

  it('ne casse pas sur un consentement absent ou mal formé', () => {
    expect(consentView(null, false).terms.kind).toBe('notRecorded')
    expect(consentView(undefined, false).privacy.kind).toBe('notRecorded')
  })
})

describe('vocabulaire des rôles', () => {
  it('couvre les huit rôles que la RPC de changement accepte', () => {
    for (const r of [...ORG_ROLES, 'buyer', 'seller', 'particulier']) {
      expect(ROLE_LABEL_KEY[r], `rôle « ${r} » sans libellé`).toBeTruthy()
    }
  })

  it('ne propose au CHANGEMENT que les rôles d’organisation', () => {
    expect(ORG_ROLES).not.toContain('buyer')
    expect(ORG_ROLES).toHaveLength(5)
  })
})
