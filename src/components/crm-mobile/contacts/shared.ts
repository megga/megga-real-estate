// Helpers partagés contacts mobile (liste / nouveau) — segments, libellés de
// type, tons KYC (non-bloquant).

import type { CrmContact } from '@/components/crm/mockData'

export type ContactSeg = 'all' | 'buyer' | 'seller'
export const CONTACT_SEGS: ContactSeg[] = ['all', 'buyer', 'seller']
export const SEG_KEY: Record<ContactSeg, string> = {
  all: 'mobile.seg.all',
  buyer: 'mobile.seg.buyer',
  seller: 'mobile.seg.seller',
}

/** CrmContact.type → clé i18n `contacts:mobile.type.*`. */
export const typeKey = (t: CrmContact['type']): string => `mobile.type.${t}`

/** Type de contact sélectionnable à la création (sous-ensemble écrit). */
export const NEW_TYPES = ['buyer', 'seller', 'tenant'] as const
export type NewContactType = (typeof NEW_TYPES)[number]
