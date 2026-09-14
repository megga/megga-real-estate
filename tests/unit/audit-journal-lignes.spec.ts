/**
 * Le journal d'audit refait (14.09.2026, Julien : « organisé et épuré ») — ce que ses
 * fonctions pures promettent : des jours nommés dans l'ordre, des rafales qui ne fondent
 * jamais deux acteurs, une recherche qui trouve ce que l'agent LIT.
 *
 * ⚠ La recherche ne lisait que le code brut de l'action : taper « Contact créé », le texte
 * même de la ligne, ne trouvait rien.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { correspondRecherche, grouperParJour, libelleActeur, libelleCategorie, rafales } from '@/components/crm-dossiers/audit/journal'
import type { AuditEvent } from '@/types/kyc'

/** Lundi 14 septembre 2026, 15:00 — heure LOCALE, comme les jours du journal. */
const MAINTENANT = new Date(2026, 8, 14, 15, 0, 0)
const aLHeure = (jour: number, h: number, mois = 8, an = 2026) => new Date(an, mois, jour, h, 0, 0).toISOString()

function ev(o: Partial<AuditEvent> & Pick<AuditEvent, 'id' | 'action'>): AuditEvent {
  return {
    agency_id: 'agence-A', actor_id: null, actor_kind: 'ai', entity_type: 'contact', entity_id: null,
    metadata: null, created_at: aLHeure(14, 10), severity: 'info', category: 'contact',
    object_label: null, ip_address: null,
    ...o,
  } as AuditEvent
}

const NOMS = { today: 'Aujourd’hui', yesterday: 'Hier' }

beforeAll(async () => {
  await i18n.changeLanguage('fr')
})

describe('journal d’audit — les jours', () => {
  it('Aujourd’hui, Hier, puis le jour en toutes lettres — du plus récent au plus ancien', () => {
    const jours = grouperParJour([
      ev({ id: 'a', action: 'contact_created', created_at: aLHeure(10, 9) }),
      ev({ id: 'b', action: 'contact_created', created_at: aLHeure(14, 9) }),
      ev({ id: 'c', action: 'contact_created', created_at: aLHeure(13, 20) }),
      ev({ id: 'd', action: 'contact_created', created_at: aLHeure(14, 14) }),
    ], NOMS, MAINTENANT)
    expect(jours.map((j) => j.libelle)).toEqual(['Aujourd’hui', 'Hier', 'Jeudi 10 septembre'])
    // Dans un jour, le plus récent d'abord — quel que soit l'ordre reçu.
    expect(jours[0].events.map((e) => e.id)).toEqual(['d', 'b'])
  })

  it('l’année n’apparaît que lorsqu’elle n’est pas celle en cours', () => {
    const [jour] = grouperParJour([ev({ id: 'a', action: 'contact_created', created_at: aLHeure(3, 9, 11, 2025) })], NOMS, MAINTENANT)
    expect(jour.libelle).toBe('Mercredi 3 décembre 2025')
  })
})

describe('journal d’audit — les rafales', () => {
  it('trois correspondances anonymes du même acteur : une ligne ×3', () => {
    const l = rafales(['a', 'b', 'c'].map((id) => ev({ id, action: 'match_suggested' })))
    expect(l).toHaveLength(1)
    expect(l[0].events.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('⛔ deux acteurs ne se fondent jamais — un journal dit QUI a agi', () => {
    const l = rafales([
      ev({ id: 'a', action: 'contact_created', actor_kind: 'user', actor_id: 'u1' }),
      ev({ id: 'b', action: 'contact_created', actor_kind: 'user', actor_id: 'u2' }),
      ev({ id: 'c', action: 'contact_created', actor_kind: 'system' }),
    ])
    expect(l.map((x) => x.events.length)).toEqual([1, 1, 1])
  })

  it('un événement qui a un SUJET reste seul, et une autre sévérité coupe la rafale', () => {
    const l = rafales([
      ev({ id: 'a', action: 'contact_created', object_label: 'Léa Martin' }),
      ev({ id: 'b', action: 'contact_created', object_label: 'Théo B.' }),
      ev({ id: 'c', action: 'match_suggested' }),
      ev({ id: 'd', action: 'match_suggested', severity: 'warn' }),
    ])
    expect(l.map((x) => x.events.map((e) => e.id))).toEqual([['a'], ['b'], ['c'], ['d']])
  })
})

describe('journal d’audit — la recherche lit ce que l’agent voit', () => {
  const cree = ev({ id: 'a', action: 'contact_created', object_label: 'Léa Martin', actor_kind: 'user', actor_id: 'u1' })

  it('le titre traduit, accents et casse pliés — plus seulement le code brut', () => {
    expect(correspondRecherche(cree, 'Contact créé')).toBe(true)
    expect(correspondRecherche(cree, 'contact cree')).toBe(true)
    expect(correspondRecherche(cree, 'contact_created')).toBe(true)
  })

  it('chaque mot doit s’y trouver — le sujet, l’acteur, la catégorie', () => {
    expect(correspondRecherche(cree, 'léa grégory', 'Grégory Lyonnet')).toBe(true)
    expect(correspondRecherche(cree, 'léa camille', 'Grégory Lyonnet')).toBe(false)
    expect(correspondRecherche(ev({ id: 'b', action: 'kyc_screening_match', category: 'kyc' }), 'kyc')).toBe(true)
  })

  it('une recherche vide ne filtre rien', () => {
    expect(correspondRecherche(cree, '   ')).toBe(true)
  })
})

describe('journal d’audit — qui a agi', () => {
  it('le collègue par son nom quand la page le connaît, sinon le rôle', () => {
    const noms = new Map([['u1', 'Grégory Lyonnet']])
    expect(libelleActeur({ actor_id: 'u1', actor_kind: 'user', metadata: null }, noms)).toBe('Grégory Lyonnet')
    expect(libelleActeur({ actor_id: 'u9', actor_kind: 'user', metadata: null }, noms)).toBe('Agent')
    expect(libelleActeur({ actor_id: null, actor_kind: 'ai', metadata: null }, noms)).toBe('MEGGA AI')
    expect(libelleActeur({ actor_id: null, actor_kind: 'system', metadata: null }, noms)).toBe('Système')
  })

  it('« compte supprimé » sur PREUVE seulement', () => {
    expect(libelleActeur({ actor_id: null, actor_kind: 'user', metadata: { actor_detached_from: 'u-supprime' } })).toBe('Agent (compte supprimé)')
    expect(libelleActeur({ actor_id: null, actor_kind: 'user', metadata: null })).toBe('Agent (non identifié)')
  })

  it('la catégorie se lit traduite, jamais brute', () => {
    expect(libelleCategorie({ category: 'messaging' })).toBe('Messagerie')
    expect(libelleCategorie({ category: null })).toBe('—')
  })
})
