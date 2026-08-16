// Audit Focus (HITL) — mapping PUR d'un id d'item Focus → cible activity_events.
// Zéro I/O → testable en unité (tests/unit/focus-audit.spec.ts). Consommé par
// useFocusQueue.logFocusGesture pour consigner chaque geste de l'agent (règle
// CLAUDE.md §5 « audit pour toute action »).
//
// `category` est contraint en base (kyc|deal|contact|bien|doc|auth|settings|ai) ;
// on la type comme l'union utile (assignable que la colonne soit enum ou text+CHECK).
// `entity_id` est une colonne uuid → null si le rawId n'est pas un uuid nu (jamais
// d'erreur 22P02). La référence brute reste dans metadata.raw_id.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** uuid nu, sinon null — garde UNIQUE du 22P02 (colonne entity_id de type uuid).
 *  Réutilisé par focusAuditTarget ET les autres surfaces d'audit (RelanceSession). */
export function uuidOrNull(v: string | null | undefined): string | null {
  return v && UUID_RE.test(v) ? v : null
}

export interface FocusAuditTarget {
  /** Partie après le 1er tiret de l'id (uuid pour toutes les familles réelles). */
  rawId: string
  /** entity_type libre (pas de CHECK sur cette colonne) — cohérent avec l'existant. */
  entityType: string
  /** uuid nu, ou null si rawId non-uuid (colonne uuid). */
  entityId: string | null
  /** category contrainte (CHECK) — sous-ensemble suffisant pour les familles Focus. */
  category: 'kyc' | 'deal' | 'contact' | 'bien'
}

/** item.id = `<prefix>-<rawId>`. Mappe le préfixe → (entity_type, category). */
export function focusAuditTarget(itemId: string): FocusAuditTarget {
  const dash = itemId.indexOf('-')
  const prefix = dash === -1 ? itemId : itemId.slice(0, dash)
  const rawId = dash === -1 ? itemId : itemId.slice(dash + 1)
  const entityId = uuidOrNull(rawId)
  switch (prefix) {
    case 'rem':     return { rawId, entityType: 'reminder',    entityId, category: 'contact' }
    case 'deal':    return { rawId, entityType: 'transaction', entityId, category: 'deal' }
    case 'kyc':     return { rawId, entityType: 'transaction', entityId, category: 'kyc' }
    case 'match':   return { rawId, entityType: 'match',       entityId, category: 'deal' }
    case 'seller':  return { rawId, entityType: 'seller_lead', entityId, category: 'contact' }
    case 'offer':   return { rawId, entityType: 'offer',       entityId, category: 'deal' }
    case 'visit':   return { rawId, entityType: 'visit',       entityId, category: 'contact' }
    case 'cooling': return { rawId, entityType: 'contact',     entityId, category: 'contact' }
    case 'bien':    return { rawId, entityType: 'property',    entityId, category: 'bien' }
    default:        return { rawId, entityType: 'contact',     entityId, category: 'contact' }
  }
}
