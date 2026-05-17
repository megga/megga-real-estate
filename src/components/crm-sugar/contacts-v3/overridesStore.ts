// MEGGA Contacts V3 — store overrides (persistance localStorage).
// Port de `crm-contacts-store.jsx`.
//
// En prod : remplacer par une mutation API `PATCH /api/contacts/:id`
// (TanStack Query optimistic + invalidate). Garder le pattern : patch partiel,
// deep-merge sur `criteria`.

import { CRM_CONTACTS, type CrmContact } from '../mockData'

const KEY = 'megga-crm-contacts-overrides-v1'

type ContactPatch = Partial<CrmContact> & {
  criteria?: Partial<NonNullable<CrmContact['criteria']>>
}
type Overrides = Record<string, ContactPatch>

let overrides: Overrides = {}

function loadOverrides(): void {
  if (typeof window === 'undefined') return
  try {
    overrides = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}
  } catch {
    overrides = {}
  }
  CRM_CONTACTS.forEach((c, i) => {
    const o = overrides[c.id]
    if (!o) return
    const merged: CrmContact = { ...c, ...o }
    if (o.criteria) {
      merged.criteria = {
        ...(c.criteria ?? ({} as NonNullable<CrmContact['criteria']>)),
        ...o.criteria,
      } as CrmContact['criteria']
    }
    CRM_CONTACTS[i] = merged
  })
}

function saveOverrides(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(overrides))
  } catch {
    // localStorage may be unavailable (private mode) — fail silently
  }
}

/**
 * crmUpdateContact — mute CRM_CONTACTS en place + persiste un diff.
 * Champs supportés : top-level + deep-merge sur `criteria`.
 */
export function crmUpdateContact(id: string, patch: ContactPatch): void {
  if (!patch || typeof patch !== 'object') return
  const idx = CRM_CONTACTS.findIndex(c => c.id === id)
  if (idx === -1) return

  const cur = CRM_CONTACTS[idx]
  const next: CrmContact = { ...cur, ...patch }
  if (patch.criteria) {
    next.criteria = {
      ...(cur.criteria ?? ({} as NonNullable<CrmContact['criteria']>)),
      ...patch.criteria,
    } as CrmContact['criteria']
  }
  CRM_CONTACTS[idx] = next

  const prev = overrides[id] || {}
  const nextOv: ContactPatch = { ...prev, ...patch }
  if (patch.criteria) {
    nextOv.criteria = { ...(prev.criteria || {}), ...patch.criteria }
  }
  overrides[id] = nextOv
  saveOverrides()
}

export function crmResetContactOverrides(): void {
  overrides = {}
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // localStorage may be unavailable
  }
}

// Bootstrap au chargement du module (côté browser uniquement)
if (typeof window !== 'undefined') {
  loadOverrides()
}
