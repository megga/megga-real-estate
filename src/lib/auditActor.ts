/**
 * Qui a agi sur une ligne du journal d'audit agent — lu dans `actor_kind`, jamais déduit
 * de la seule absence d'`actor_id`.
 *
 * ⛔ `actor_id` NULL recouvre TROIS acteurs. Le CHECK `activity_events_actor_kind_coherence`
 * (`actor_id IS NULL OR actor_kind = 'user'`) l'admet pour l'IA, pour le SYSTÈME (synchro
 * de boîte, recalcul de score, garde d'envoi WhatsApp) et pour l'agent dont le compte a
 * été supprimé : la FK `ON DELETE SET NULL` (20260801420000) détache l'acteur et laisse
 * `actor_kind = 'user'`. Mesuré le 13.09.2026 sur les lignes rattachées à une agence :
 * 297 lignes système et 16 lignes humaines sans acteur étaient comptées « Actions MEGGA
 * AI » et marquées de l'étincelle.
 *
 * L'inférence inverse, elle, est sûre : le même CHECK fait qu'un `actor_id` posé désigne
 * toujours un humain.
 *
 * ⚠ « 'user' sans `actor_id` » ne veut PAS toujours dire « compte supprimé ». Seule la
 * branche FK du trigger dépose la preuve (`metadata.actor_detached_from`). Sans elle, c'est
 * un émetteur qui a omis `actor_kind` en contexte de service — mesuré le 13.09.2026 : les
 * six `kyc_case_opened` de `seed_kyc_lba_checks` (20260729100000), qui écrit
 * `actor_id = auth.uid()` sans `actor_kind`, donc NULL + 'user' quand un dossier est ouvert
 * par la clé de service (WhatsApp). D'où `acteurDetacheProuve` : le libellé ne dit
 * « compte supprimé » que sur preuve.
 */
import type { AuditEvent } from '@/types/kyc'

/**
 * Les quatre acteurs qu'une ligne peut nommer. `agent_detache` : un humain que la ligne ne
 * nomme plus — détaché par la FK, ou écrit sans acteur (voir l'en-tête).
 */
export type AuditActeur = 'agent' | 'agent_detache' | 'ai' | 'system'

/** L'acteur d'une ligne. */
export function auditActeur(e: Pick<AuditEvent, 'actor_id' | 'actor_kind'>): AuditActeur {
  if (e.actor_kind === 'ai') return 'ai'
  if (e.actor_id) return 'agent'
  return e.actor_kind === 'user' ? 'agent_detache' : 'system'
}

/** Vrai si la ligne porte la preuve que la FK a détaché son acteur (compte supprimé). */
export function acteurDetacheProuve(e: Pick<AuditEvent, 'metadata'>): boolean {
  return typeof e.metadata?.actor_detached_from === 'string'
}

/** Les trois familles du filtre « Acteur » du journal : un agent détaché reste un HUMAIN. */
export type FamilleActeur = 'agent' | 'ai' | 'system'

/**
 * L'`actor_kind` que le filtre « Acteur » pose côté serveur, par famille.
 *
 * Exact, et non approché : la colonne est NOT NULL (défaut 'user'), et le CHECK de
 * cohérence réserve `actor_id` aux humains. 'user' rend donc les agents, nommés ou
 * détachés ; 'ai' et 'system' rendent exactement ce qu'`auditActeur` range sous ces noms.
 * ⚠ Il remplace la carte « Actions MEGGA AI » (14.09.2026) : le journal ne compte plus,
 * il filtre — mais toujours sur `actor_kind`, jamais sur l'absence d'`actor_id`.
 */
export const ACTOR_KIND_DE: Record<FamilleActeur, 'user' | 'ai' | 'system'> = {
  agent: 'user',
  ai: 'ai',
  system: 'system',
}
