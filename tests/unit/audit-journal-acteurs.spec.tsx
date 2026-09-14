/**
 * Garde-fou : une ligne du journal d'audit agent dit QUI a agi — lu dans `actor_kind`,
 * jamais déduit de la seule absence d'`actor_id`.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `actor_id` NULL recouvre TROIS acteurs, et la base le dit elle-même : le CHECK
 * `activity_events_actor_kind_coherence` (`actor_id IS NULL OR actor_kind = 'user'`)
 * admet une ligne sans acteur pour l'IA, pour le SYSTÈME (synchro de boîte, recalcul
 * de score, garde d'envoi WhatsApp) et pour l'agent dont le compte a été supprimé —
 * la FK `ON DELETE SET NULL` (20260801420000) laisse `actor_kind = 'user'`.
 *
 * `AudEventRow` et `AuditPage` ne lisaient pas `actor_kind`. Mesuré le 13.09.2026 sur
 * les lignes rattachées à une agence : 297 lignes système et 16 lignes humaines sans
 * acteur (10 détachées par la FK, 6 écrites sans `actor_kind`) étaient comptées
 * « Actions MEGGA AI » et marquées de l'étincelle, pendant que les vraies lignes IA
 * s'affichaient « Système ». Une agence voyait 30 actions IA sur 30 jours pour zéro
 * réelle. Pour un journal LBA art. 7, dont la fonction est de dire qui a agi, créditer
 * à la machine le geste d'un agent n'est pas cosmétique.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * La TEINTE de l'avatar dit humain / non-humain (`invBgSoft` / `invBg`, paire déjà
 * mesurée par dossiers-contraste.spec.ts). Le GLYPHE sépare l'IA (étincelle, la
 * marque IA de CLAUDE.md §5) du système (`server`). L'étincelle ne se pose sur rien
 * d'autre.
 *
 * ⚠ Les tests purs importent `@/lib/auditActor` DANS le `it` : sur l'ancien code le
 * module n'existe pas, et un import statique ferait échouer le fichier entier avant
 * que les rendus — qui, eux, tournent sur l'ancien code — ne puissent rougir pour
 * leur propre raison.
 *
 * Montage `createRoot` + `act`, idiome de focus-trap.spec.ts : le dépôt n'a pas
 * @testing-library/react.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import i18n from '@/i18n'
import { AudEventRow } from '@/components/crm-dossiers/audit/AudEventRow'
import type { AuditEvent } from '@/types/kyc'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Premier tronçon du tracé de l'étincelle (`icons.tsx`, clé `sparkle`). */
const ETINCELLE = /^m12 3-1\.9 5\.8/

/**
 * Fabrique d'une ligne complète. `actor_kind` est posé par chaque cas : c'est la
 * colonne sous test, elle ne doit jamais venir d'un défaut implicite de la fabrique.
 */
function ev(o: Partial<AuditEvent> & Pick<AuditEvent, 'action'> & { actor_kind: 'user' | 'ai' | 'system' }): AuditEvent {
  return {
    id: `ev-${o.action}-${o.actor_kind}`,
    agency_id: 'agence-A',
    actor_id: null,
    entity_type: 'contact',
    entity_id: null,
    metadata: null,
    created_at: '2026-09-13T08:00:00Z',
    severity: 'info',
    category: null,
    object_label: 'Camille Rochat',
    ip_address: null,
    ...o,
  } as AuditEvent
}

/** Les six formes qu'une ligne prend réellement en production (13.09.2026). */
const IA = ev({ actor_kind: 'ai', action: 'match_suggested', category: 'ai' })
const COURRIER_SYNCHRO = ev({ actor_kind: 'system', action: 'email_received', category: 'messaging', object_label: null })
const RECALCUL = ev({ actor_kind: 'system', action: 'contact_scores.recompute', category: 'contact' })
/**
 * L'agent dont le compte a été supprimé : la FK a détaché `actor_id`, `actor_kind` est resté
 * 'user', et la branche FK du trigger a déposé sa preuve (20260801420000).
 */
const AGENT_DETACHE = ev({
  actor_kind: 'user', actor_id: null, action: 'agency_legal_identity_updated', category: 'kyc',
  metadata: { actor_detached_from: 'u-supprime', actor_detached_reason: 'profile deleted (FK on delete set null)' },
})
/**
 * ⚠ La MÊME forme sans la preuve : `seed_kyc_lba_checks` écrit `actor_id = auth.uid()` sans
 * `actor_kind` — NULL + 'user' quand la clé de service ouvre le dossier (six lignes en
 * production le 13.09.2026). Aucun compte n'a été supprimé : le dire serait faux.
 */
const AGENT_SANS_NOM = ev({ actor_kind: 'user', actor_id: null, action: 'kyc_case_opened', category: 'kyc', metadata: null })
const AGENT = ev({ actor_kind: 'user', actor_id: 'u1', action: 'email_sent', category: 'messaging' })
const LIGNES = [IA, COURRIER_SYNCHRO, RECALCUL, AGENT_DETACHE, AGENT_SANS_NOM, AGENT]

let racine: Root | null = null
let hote: HTMLDivElement

function monter(event: AuditEvent) {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(createElement(AudEventRow, { event, last: true })))
  return hote
}

/** La pastille d'acteur : le seul élément titré par un nom d'acteur (la ligne n'a plus de bouton « Détails » : elle s'ouvre entière). */
const avatar = (titre: string) => hote.querySelector<HTMLElement>(`[title="${titre}"]`)
const traceDe = (el: Element | null) => el?.querySelector('svg path')?.getAttribute('d') ?? null

beforeAll(async () => {
  await i18n.changeLanguage('fr')
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  document.body.innerHTML = ''
})

describe('journal d’audit agent — l’acteur d’une ligne', () => {
  it('courrier synchronisé : « Système », glyphe serveur, catégorie traduite', () => {
    monter(COURRIER_SYNCHRO)
    const a = avatar('Système')
    expect(a, 'une synchro de boîte est un geste du SYSTÈME').not.toBeNull()
    expect(traceDe(a), 'l’étincelle est la marque IA : elle ne se pose pas sur le système').not.toMatch(ETINCELLE)
    expect(a!.querySelector('svg'), 'le système porte un glyphe, pas des initiales').not.toBeNull()
    // La catégorie vit dans le DÉTAIL depuis le 14.09.2026 : la ligne entière l'ouvre.
    act(() => hote.querySelector('button')!.click())
    expect(hote.querySelector('[role="region"]'), 'la ligne n’ouvre pas son détail').not.toBeNull()
    expect(hote.textContent).toContain('Messagerie')
    const brut = [...hote.querySelectorAll('div, span')].filter((d) => d.textContent === 'messaging')
    expect(brut, 'la catégorie s’affichait en valeur BRUTE, non traduite').toHaveLength(0)
  })

  it('recalcul de score : « Système », sans étincelle', () => {
    monter(RECALCUL)
    const a = avatar('Système')
    expect(a).not.toBeNull()
    expect(traceDe(a)).not.toMatch(ETINCELLE)
  })

  it('ligne IA : « MEGGA AI », avec l’étincelle', () => {
    monter(IA)
    const a = avatar('MEGGA AI')
    expect(a, 'une ligne écrite par l’IA s’affichait « Système »').not.toBeNull()
    expect(traceDe(a)).toMatch(ETINCELLE)
    expect(avatar('Système')).toBeNull()
  })

  it('agent au compte supprimé : un HUMAIN, jamais la machine', () => {
    monter(AGENT_DETACHE)
    const a = avatar('Agent (compte supprimé)')
    expect(a, 'une action humaine d’un agent supprimé était créditée au système').not.toBeNull()
    expect(a!.textContent).toBe('AG')
    expect(traceDe(a)).toBeNull()
    expect(avatar('Système')).toBeNull()
    expect(avatar('MEGGA AI')).toBeNull()
  })

  it('humain sans nom ni preuve de détachement : « non identifié », jamais « compte supprimé »', () => {
    monter(AGENT_SANS_NOM)
    const a = avatar('Agent (non identifié)')
    expect(a, 'sans `actor_detached_from`, rien ne prouve qu’un compte a été supprimé').not.toBeNull()
    expect(a!.textContent).toBe('AG')
    expect(avatar('Agent (compte supprimé)')).toBeNull()
    expect(avatar('Système')).toBeNull()
  })

  it('agent identifié : « Agent », initiales', () => {
    monter(AGENT)
    const a = avatar('Agent')
    expect(a).not.toBeNull()
    expect(a!.textContent).toBe('AG')
  })

  /**
   * La carte « Actions MEGGA AI » a laissé la place, le 14.09.2026, au filtre « Acteur » —
   * posé CÔTÉ SERVEUR, sur `actor_kind`. La garde se déplace avec elle : chaque ligne que
   * le serveur rend sous une famille doit être une ligne que la page NOMME ainsi.
   */
  it('le filtre « Acteur » rend exactement les lignes que la page nomme ainsi', async () => {
    // Témoin : l'ancienne règle (`!e.actor_id`) prenait CINQ de ces six lignes pour l'IA.
    expect(LIGNES.filter((e) => !e.actor_id)).toHaveLength(5)
    // Chemin en variable : un littéral serait résolu à la TRANSFORMATION du fichier, et
    // son absence ferait tomber toute la suite au lieu de ce seul test.
    const module = '@/lib/auditActor'
    const { ACTOR_KIND_DE, auditActeur } = (await import(/* @vite-ignore */ module)) as typeof import('@/lib/auditActor')
    expect(LIGNES.map(auditActeur)).toEqual(['ai', 'system', 'system', 'agent_detache', 'agent_detache', 'agent'])
    // Un agent détaché reste un HUMAIN : il est de la famille « Agents ».
    const famille = (e: AuditEvent) => { const a = auditActeur(e); return a === 'agent_detache' ? 'agent' : a }
    for (const f of ['agent', 'ai', 'system'] as const) {
      const parLeServeur = LIGNES.filter((e) => e.actor_kind === ACTOR_KIND_DE[f]).map((e) => e.id)
      const parLaPage = LIGNES.filter((e) => famille(e) === f).map((e) => e.id)
      expect(parLeServeur, `famille ${f}`).toEqual(parLaPage)
    }
    expect(LIGNES.filter((e) => e.actor_kind === ACTOR_KIND_DE.ai), 'une seule ligne est de l’IA').toHaveLength(1)
  })
})
