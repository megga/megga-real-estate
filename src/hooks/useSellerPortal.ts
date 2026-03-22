import { useState, useCallback } from 'react'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import type { SellerPortalData } from '@/lib/mockSellerData'

// ── Token generation ─────────────────────────────────────────────────────

const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateToken(length = 9): string {
  let token = ''
  for (let i = 0; i < length; i++) {
    token += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return token
}

// ── Portal store (localStorage for MVP, Supabase later) ──────────────────

export interface SellerPortalRecord {
  id: string
  token: string
  contactId: string
  contactName: string
  contactEmail: string
  propertyTitle: string
  propertyAddress: string
  agentName: string
  status: 'active' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  lastViewedAt: string | null
  viewCount: number
  inviteSentAt: string | null
}

const STORAGE_KEY = 'megga_seller_portals'

function loadPortals(): SellerPortalRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePortals(portals: SellerPortalRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portals))
  } catch {
    // silently ignore
  }
}

// ── Hook: manage portals (agent side) ────────────────────────────────────

export function useSellerPortals() {
  const [portals, setPortals] = useState<SellerPortalRecord[]>(loadPortals)

  const createPortal = useCallback((params: {
    contactId: string
    contactName: string
    contactEmail: string
    propertyTitle: string
    propertyAddress: string
    agentName?: string
  }): SellerPortalRecord => {
    // Check if portal already exists for this contact
    const existing = portals.find(p => p.contactId === params.contactId && p.status === 'active')
    if (existing) return existing

    const token = generateToken()
    const now = new Date()
    const expires = new Date(now)
    expires.setMonth(expires.getMonth() + 6)

    const portal: SellerPortalRecord = {
      id: `sp_${Date.now()}`,
      token,
      contactId: params.contactId,
      contactName: params.contactName,
      contactEmail: params.contactEmail,
      propertyTitle: params.propertyTitle,
      propertyAddress: params.propertyAddress,
      agentName: params.agentName || 'Gregory Lyonnet',
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      lastViewedAt: null,
      viewCount: 0,
      inviteSentAt: null,
    }

    const updated = [...portals, portal]
    setPortals(updated)
    savePortals(updated)
    return portal
  }, [portals])

  const revokePortal = useCallback((portalId: string) => {
    const updated = portals.map(p =>
      p.id === portalId ? { ...p, status: 'revoked' as const } : p
    )
    setPortals(updated)
    savePortals(updated)
  }, [portals])

  const markInviteSent = useCallback((portalId: string) => {
    const updated = portals.map(p =>
      p.id === portalId ? { ...p, inviteSentAt: new Date().toISOString() } : p
    )
    setPortals(updated)
    savePortals(updated)
  }, [portals])

  const getPortalForContact = useCallback((contactId: string): SellerPortalRecord | null => {
    return portals.find(p => p.contactId === contactId && p.status === 'active') || null
  }, [portals])

  const getPortalUrl = useCallback((token: string): string => {
    return `${window.location.origin}/portail/${token}`
  }, [])

  return {
    portals: portals.filter(p => p.status === 'active'),
    createPortal,
    revokePortal,
    markInviteSent,
    getPortalForContact,
    getPortalUrl,
  }
}

// ── Hook: validate token and load data (seller side) ─────────────────────

export interface PortalValidation {
  isValid: boolean
  isExpired: boolean
  isRevoked: boolean
  data: SellerPortalData | null
  portal: SellerPortalRecord | null
}

export function useSellerPortalAccess(token: string | undefined): PortalValidation {
  if (!token) {
    return { isValid: false, isExpired: false, isRevoked: false, data: null, portal: null }
  }

  const portals = loadPortals()
  const portal = portals.find(p => p.token === token)

  if (!portal) {
    return { isValid: false, isExpired: false, isRevoked: false, data: null, portal: null }
  }

  if (portal.status === 'revoked') {
    return { isValid: false, isExpired: false, isRevoked: true, data: null, portal }
  }

  if (portal.status === 'expired' || new Date(portal.expiresAt) < new Date()) {
    return { isValid: false, isExpired: true, isRevoked: false, data: null, portal }
  }

  // Record view (fire and forget)
  const updated = portals.map(p =>
    p.token === token
      ? { ...p, lastViewedAt: new Date().toISOString(), viewCount: p.viewCount + 1 }
      : p
  )
  savePortals(updated)

  // In production: fetch real data from Supabase based on portal.contactId + portal.propertyId
  // For MVP: return mock data with the seller's name injected
  const data: SellerPortalData = {
    ...MOCK_SELLER_DATA,
    agent: {
      ...MOCK_SELLER_DATA.agent,
      name: portal.agentName,
    },
  }

  return { isValid: true, isExpired: false, isRevoked: false, data, portal }
}
