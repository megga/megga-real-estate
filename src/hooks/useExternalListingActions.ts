import { useState, useCallback } from 'react'
import type { ExternalListing } from './useExternalMatching'

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

function loadState(): StateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveState(state: StateMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function getListingState(stateMap: StateMap, externalId: string): ExternalListingState {
  return stateMap[externalId] || { notes: [], sends: [], imported: false, imported_at: null }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useExternalListingActions(listing: ExternalListing | undefined) {
  const [stateMap, setStateMap] = useState<StateMap>(loadState)

  const externalId = listing?.external_id || ''
  const listingState = getListingState(stateMap, externalId)

  const updateState = useCallback((newListingState: ExternalListingState) => {
    setStateMap(prev => {
      const next = { ...prev, [externalId]: newListingState }
      saveState(next)
      return next
    })
  }, [externalId])

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
