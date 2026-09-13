/**
 * État local des actions agent sur un bien externe (issu du matching
 * hors-catalogue) : notes, envois et flag « importé ». Purement client
 * (localStorage) — ces annotations survivent au refresh mais pas au changement
 * d'appareil, aucune persistance Supabase.
 *
 * ⚠ Rangé PAR COMPTE (`megga_external_listing_actions:<uid>`, audit S11) et PURGÉ
 * à la déconnexion : ces notes portent le nom du contact destinataire, et une clé
 * fixe les montrait au compte suivant du même navigateur. L'ancienne clé non
 * indexée est retirée au premier démarrage — son propriétaire est inconnu.
 * Des notes qui survivraient à la déconnexion demanderaient une table sous RLS
 * d'agence, pas le stockage du navigateur.
 */
import { useState, useCallback } from 'react'
import type { ExternalListing } from './useExternalMatching'
import { useAuth } from '@/hooks/useAuth'
import { cleDuCompte } from '@/lib/stockageParCompte'

// ── Types ────────────────────────────────────────────────────────────────

export interface ExternalNote {
  id: string
  text: string
  created_at: string
}

export interface SendRecord {
  id: string
  contact_name: string
  channel: 'email' | 'internal'
  sent_at: string
}

interface ExternalListingState {
  notes: ExternalNote[]
  sends: SendRecord[]
  imported: boolean
  imported_at: string | null
}

type StateMap = Record<string, ExternalListingState>

// ── Storage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'megga_external_listing_actions'

/** Lit la map d'états du compte ; `{}` sans compte, absente ou corrompue. */
function loadState(uid: string | null): StateMap {
  if (!uid) return {}
  try {
    const raw = localStorage.getItem(cleDuCompte(STORAGE_KEY, uid))
    return raw ? (JSON.parse(raw) as StateMap) : {}
  } catch {
    return {}
  }
}

/** Persiste la map d'états du compte ; rien sans compte (échec silencieux si le quota est plein). */
function saveState(uid: string | null, state: StateMap) {
  if (!uid) return
  try {
    localStorage.setItem(cleDuCompte(STORAGE_KEY, uid), JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** État d'un bien donné, avec valeurs par défaut s'il n'a jamais été annoté. */
function getListingState(stateMap: StateMap, externalId: string): ExternalListingState {
  return stateMap[externalId] || { notes: [], sends: [], imported: false, imported_at: null }
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Notes/envois/import mémorisés pour un bien externe, avec écriture localStorage
 * transparente. Retourne l'état courant du bien + les actions de mutation.
 */
export function useExternalListingActions(listing: ExternalListing | undefined) {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [stateMap, setStateMap] = useState<StateMap>(() => loadState(uid))

  // ⚠ `listing.id` — l'uuid de `market_listings` — depuis le 05.09.2026. Le champ
  // s'appelait `external_id` et portait l'identifiant d'un pipeline RealAdvisor
  // supprimé le 18.05.2026. Aucune annotation vivante n'est orpheline : la page qui
  // écrit ici rendait « introuvable » avant toute affordance, donc `saveState` était
  // injoignable depuis cette date — ce qui reste sous les anciennes clés date de
  // mars-avril 2026 et n'était de toute façon que par appareil.
  const externalId = listing?.id || ''
  const listingState = getListingState(stateMap, externalId)

  const updateState = useCallback((newListingState: ExternalListingState) => {
    setStateMap(prev => {
      const next = { ...prev, [externalId]: newListingState }
      saveState(uid, next)
      return next
    })
  }, [externalId, uid])

  // Add note
  const addNote = useCallback((text: string) => {
    if (!text.trim()) return
    const note: ExternalNote = {
      id: `note_${Date.now()}`,
      text: text.trim(),
      created_at: new Date().toISOString(),
    }
    updateState({
      ...listingState,
      notes: [...listingState.notes, note],
    })
  }, [listingState, updateState])

  // Delete note
  const deleteNote = useCallback((noteId: string) => {
    updateState({
      ...listingState,
      notes: listingState.notes.filter(n => n.id !== noteId),
    })
  }, [listingState, updateState])

  // Record send
  const recordSend = useCallback((contactName: string, channel: 'email' | 'internal') => {
    const send: SendRecord = {
      id: `send_${Date.now()}`,
      contact_name: contactName,
      channel,
      sent_at: new Date().toISOString(),
    }
    updateState({
      ...listingState,
      sends: [...listingState.sends, send],
    })
  }, [listingState, updateState])

  // Mark as imported
  const markImported = useCallback(() => {
    updateState({
      ...listingState,
      imported: true,
      imported_at: new Date().toISOString(),
    })
  }, [listingState, updateState])

  return {
    notes: listingState.notes,
    sends: listingState.sends,
    imported: listingState.imported,
    importedAt: listingState.imported_at,
    addNote,
    deleteNote,
    recordSend,
    markImported,
  }
}
