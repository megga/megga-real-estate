/**
 * La cloche couvre les scénarios du CRM — chaque action a son TYPE, et les rafales se lisent en une ligne.
 *
 * ⛔ Mesuré en production le 14.09.2026 : l'événement le plus fréquent de la cloche,
 * `match_suggested` (6 116 lignes), n'avait pas de type à lui et tombait en « Système »,
 * sous une cloche ; `lead` était rangé en « IA ». Le classement est désormais une table
 * explicite (`toKind`), confrontée ici aux 100 actions de la table du journal et aux actions
 * que la production écrit.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ciblePhoto, regrouper, toKind } from '@/hooks/useAgentNotifications'
import { KIND_META, type NotifKind } from '@/components/crm/notifications/data'
import { repoPath } from './helpers/fs-scan'

const lireJson = (chemin: string) => JSON.parse(readFileSync(repoPath(chemin), 'utf8')) as Record<string, unknown>

/** Les actions de la table du journal, clés POINTÉES comprises (`signature.created`). */
function actionsDuJournal(): string[] {
  const table = (lireJson('src/i18n/locales/fr/common.json').audit as { action: Record<string, unknown> }).action
  const cles: string[] = []
  const walk = (o: Record<string, unknown>, p: string) => {
    for (const [k, v] of Object.entries(o)) {
      const cle = p ? `${p}.${k}` : k
      if (typeof v === 'string') cles.push(cle)
      else walk(v as Record<string, unknown>, cle)
    }
  }
  walk(table, '')
  return cles
}

/** Ce qui RELÈVE de la plateforme, et seulement cela, peut rester en « Système ». */
const SYSTEME = new Set([
  'agency_created', 'admin_console_entered', 'edge_function_error', 'solo_agency_released',
  'solo_agency_retained', 'whatsapp_number_verified', 'rls_hardening_applied',
])

describe('cloche — chaque action a son type', () => {
  const actions = actionsDuJournal()

  it('la table du journal est bien lue (elle porte cent actions)', () => {
    expect(actions.length).toBeGreaterThanOrEqual(100)
    expect(actions).toContain('signature.created')
  })

  it('aucune action du journal ne tombe en « Système » par défaut', () => {
    const perdues = actions.filter((a) => toKind(a, null) === 'system' && !SYSTEME.has(a))
    expect(perdues).toEqual([])
  })

  it('les actions que la production écrit sont rangées là où l’agent les cherche', () => {
    const attendu: [string, string | null, NotifKind][] = [
      ['match_suggested', 'contact', 'matching'],
      ['whatsapp_agent_copilot_reply', 'ai', 'message'],
      ['whatsapp_message_received', 'contact', 'message'],
      ['contact_created', 'contact', 'contact'],
      ['whatsapp_inbound_lead_created', 'contact', 'contact'],
      ['lead_created_whatsapp', 'contact', 'contact'],
      ['seller_lead_received', 'deal', 'contact'],
      ['Fiche enrichie (WhatsApp)', 'contact', 'contact'],
      ['reminder_created', 'contact', 'rappel'],
      ['stage_change', 'deal', 'pipeline'],
      ['kyc_case_opened', 'contact', 'kyc'],
      ['kyc_screening', null, 'kyc'],
      ['agency_verification_run', 'kyc', 'kyc'],
      ['onboarding_call_booked', 'onboarding', 'visite'],
      ['role_changed', 'auth', 'team'],
      ['agency_created', 'settings', 'system'],
    ]
    for (const [action, categorie, kind] of attendu) expect(toKind(action, categorie), action).toBe(kind)
  })

  it('une action encore inconnue se range par ses mots, puis par sa catégorie', () => {
    expect(toKind('match_digest_sent', null)).toBe('matching')
    expect(toKind('esign_envelope_completed', null)).toBe('mandat')
    expect(toKind('something_new', 'bien')).toBe('bien')
    expect(toKind('something_new', null)).toBe('system')
  })

  it('chaque type a son glyphe et son libellé, dans les quatre langues', () => {
    for (const langue of ['fr', 'en', 'de', 'it']) {
      const kinds = ((lireJson(`src/i18n/locales/${langue}/common.json`).notifications as { kind: Record<string, string> }).kind)
      for (const kind of Object.keys(KIND_META)) expect(kinds[kind], `${langue} : ${kind}`).toBeTruthy()
    }
  })
})

describe('cloche — les rafales se lisent en une ligne', () => {
  const ev = (id: string, action: string, heuresAvant: number, object_label: string | null = null) => ({
    id, action, object_label, entity_type: null, entity_id: null, metadata: null, category: null, severity: null,
    created_at: new Date(Date.now() - heuresAvant * 3_600_000).toISOString(),
  })

  it('trois correspondances anonymes consécutives du même jour : une ligne ×3', () => {
    const g = regrouper([ev('a', 'match_suggested', 1), ev('b', 'match_suggested', 1), ev('c', 'match_suggested', 1)])
    expect(g).toHaveLength(1)
    expect(g[0].ids).toEqual(['a', 'b', 'c'])
  })

  it('un événement qui a un SUJET reste seul — le regrouper effacerait ce qu’il dit', () => {
    const g = regrouper([ev('a', 'contact_created', 1, 'Léa Martin'), ev('b', 'contact_created', 1, 'Théo B.')])
    expect(g).toHaveLength(2)
  })

  it('une autre action entre deux rafales les sépare ; deux jours aussi', () => {
    const g = regrouper([
      ev('a', 'match_suggested', 1), ev('b', 'reminder_created', 1), ev('c', 'match_suggested', 1),
      ev('d', 'match_suggested', 50),
    ])
    expect(g.map((x) => x.ids)).toEqual([['a'], ['b'], ['c'], ['d']])
  })
})

describe('cloche — la photo vient de ce que l’événement désigne', () => {
  // La forme de production d'un match (mesurée le 14.09.2026) : l'annonce est dans `metadata`.
  it('un match du marché désigne son annonce, un match d’agence son bien', () => {
    expect(ciblePhoto({ entity_type: 'match', entity_id: 'm1', metadata: { source: 'market', market_listing_id: 'ml1', property_id: null } }))
      .toEqual({ table: 'market_listings', id: 'ml1' })
    expect(ciblePhoto({ entity_type: 'match', entity_id: 'm2', metadata: { source: 'property', market_listing_id: null, property_id: 'p9' } }))
      .toEqual({ table: 'properties', id: 'p9' })
  })

  it('un événement de bien désigne le bien de son `entity_id`', () => {
    expect(ciblePhoto({ entity_type: 'property', entity_id: 'p1', metadata: null })).toEqual({ table: 'properties', id: 'p1' })
  })

  it('sans bien désigné, pas de photo — la ligne garde son glyphe', () => {
    expect(ciblePhoto({ entity_type: 'contact', entity_id: 'c1', metadata: null })).toBeNull()
    expect(ciblePhoto({ entity_type: 'reminder', entity_id: null, metadata: { contact_id: 'c1' } })).toBeNull()
  })
})

describe('cloche — le technique n’y entre pas', () => {
  it('les recalculs sont écartés par la requête ET par le rendu', () => {
    const hook = readFileSync(repoPath('src/hooks/useAgentNotifications.ts'), 'utf8')
    expect(hook).toContain(".not('action', 'in', HORS_CLOCHE_TECHNIQUE)")
    expect(hook).toMatch(/filter\(\(ev\) => !TECHNIQUE\.includes\(ev\.action\)\)/)
    for (const a of ['contact_scores.recompute', 'property_scores.recompute', 'agency_verification_recomputed']) {
      expect(hook, a).toContain(`'${a}'`)
    }
  })
})
