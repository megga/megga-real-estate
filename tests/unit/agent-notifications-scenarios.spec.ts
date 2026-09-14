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
import { canalDe, ciblePhoto, regrouper, toKind } from '@/hooks/useAgentNotifications'
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

  /**
   * Plus de libellé de type (14.09.2026, « c'est redondant ») : la ligne ne dit que l'heure.
   * Ce qui distingue un type à l'œil est sa tuile — son glyphe BLANC sur l'aplat de SA
   * teinte (« fais pareil pour les icônes des évènements » : deux types d'un même domaine
   * portaient la même teinte, Visite / Rappel, Étape / Mandat, Équipe / Facturation).
   */
  it('chaque type a son glyphe et SA teinte — distincte, et lisible sous le blanc', () => {
    const lin = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const vues = new Map<string, string>()
    for (const [kind, meta] of Object.entries(KIND_META)) {
      expect(meta.icon, kind).toBeTruthy()
      expect(meta.dot, kind).toMatch(/^#[0-9a-f]{6}$/i)
      const teinte = meta.dot.toLowerCase()
      expect(vues.get(teinte), `${kind} reprend la teinte de ${vues.get(teinte)}`).toBeUndefined()
      vues.set(teinte, kind)
      // Seuil GRAPHIQUE (WCAG 1.4.11) : le glyphe blanc de 20 px doit se lire sur l'aplat.
      expect(1.05 / (luminance(meta.dot) + 0.05), `${kind} : blanc sur ${meta.dot}`).toBeGreaterThanOrEqual(3)
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

describe('cloche — le logo WhatsApp dit le canal', () => {
  it('toute action WhatsApp prend le logo, y compris l’action française de la production', () => {
    for (const a of ['whatsapp_message_received', 'whatsapp_inbound_lead_created', 'whatsapp_agent_copilot_reply',
      'lead_created_whatsapp', 'whatsapp_number_verified', 'wa_undo', 'Fiche enrichie (WhatsApp)']) {
      expect(canalDe(a), a).toBe('whatsapp')
    }
  })
  it('les autres canaux gardent leur glyphe', () => {
    for (const a of ['contact_created', 'reminder_created', 'match_suggested', 'kyc_case_opened']) expect(canalDe(a), a).toBeNull()
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
