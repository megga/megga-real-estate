import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────────

export type StagingStyle = 'modern' | 'classic' | 'luxury' | 'scandinavian' | 'minimal'
export type RoomType =
  | 'salon' | 'chambre' | 'cuisine' | 'salle_a_manger' | 'bureau' | 'autre'
  | 'terrasse' | 'jardin' | 'balcon' // outdoor variants (Nano Banana 2)

/** Analyse Claude Vision retournée par l'EF dans la réponse staging. */
export interface PhotoAnalysis {
  detected_room: string
  confidence: number
  quality: { sharpness: number; lighting: number; composition: number; overall: number }
  flags: string[]
}

export interface StagingResult {
  staged_url: string
  style: StagingStyle
  room_type: RoomType
  usage: {
    current: number
    quota: number
    remaining: number
  }
  /** Présente depuis le gate Vision (v2). Permet à l'UI d'afficher un badge "qualité photo" si on veut. */
  analysis?: PhotoAnalysis
}

export interface StagingError {
  error: string
  upgrade_required?: boolean
  quota_exceeded?: boolean
  current_usage?: number
  quota?: number
  // Nouveaux signaux du gate Vision (v2)
  mismatch?: boolean
  detected_room?: string
  requested_room?: string
  confidence?: number
  suggested_room_type?: RoomType
  quality_issue?: boolean
  lpd_block?: boolean
  already_furnished?: boolean
  analysis?: { quality: PhotoAnalysis['quality']; flags: string[] }
}

export interface StagedPhoto {
  original_url: string
  staged_url: string
  style: StagingStyle
  room_type: RoomType
  created_at: string
}

// ─── Style metadata ─────────────────────────────────────────────────────

export const STAGING_STYLES: { value: StagingStyle; label: string; description: string }[] = [
  { value: 'modern', label: 'Moderne', description: 'Lignes épurées, tons neutres' },
  { value: 'classic', label: 'Classique', description: 'Bois noble, tissus riches' },
  { value: 'luxury', label: 'Luxe', description: 'Marbre, velours, designer' },
  { value: 'scandinavian', label: 'Scandinave', description: 'Bouleau, lin, hygge' },
  { value: 'minimal', label: 'Minimal', description: 'Épuré, zen, espace ouvert' },
]

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'salon', label: 'Salon' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'salle_a_manger', label: 'Salle à manger' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'autre', label: 'Autre' },
  // Outdoor — Nano Banana 2 supporte le staging extérieur
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'jardin', label: 'Jardin' },
  { value: 'balcon', label: 'Balcon' },
]

// ─── Plan quotas (mirrored from Edge Function) ──────────────────────────

export const STAGING_QUOTAS: Record<string, number> = {
  starter: 0,
  pro: 50,
  entreprise: 200,
  agency: 200,
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useVirtualStaging() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<StagingError | null>(null)
  const [result, setResult] = useState<StagingResult | null>(null)

  async function generateStaging(
    photoUrl: string,
    propertyId: string,
    style: StagingStyle = 'modern',
    roomType: RoomType = 'salon'
  ): Promise<StagingResult | null> {
    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('virtual-staging', {
        body: { photoUrl, style, roomType, propertyId },
      })

      if (fnError) {
        const errData = { error: fnError.message || 'Erreur de génération' }
        setError(errData)
        return null
      }

      if (data?.error) {
        setError(data as StagingError)
        return null
      }

      setResult(data as StagingResult)
      return data as StagingResult
    } catch {
      const errData = { error: 'Erreur de connexion' }
      setError(errData)
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  function reset() {
    setError(null)
    setResult(null)
  }

  return {
    generateStaging,
    isGenerating,
    error,
    result,
    reset,
  }
}
