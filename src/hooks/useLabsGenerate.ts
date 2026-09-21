/**
 * Les deux générations du studio Labs : l'image (synchrone, Nano Banana 2 rend en ~10 s)
 * et la vidéo (soumise à la file de fal.ai ; `useLabsVideoPolling` la suit).
 * Les erreurs sont des CODES stables de l'edge, traduits par l'écran (`labs:errors.*`).
 */
import { useState } from 'react'
import { invokeLabs } from '@/lib/labs'
import { fxGenerateImage, fxSoldeCourant, fxSoldeInsuffisant, fxSubmitVideo, useLabsFixtures } from '@/components/crm/labs/fixtures'
import { creditsPourImage, creditsPourVideo } from '@/lib/credits'
import type { LabsAsset, LabsImageInput, LabsVideoInput } from '@/types/labs'
import type { Database } from '@/types/database'

type AssetRow = Database['public']['Tables']['labs_assets']['Row']
interface EdgeOk { asset: AssetRow; credits?: { debited: number; balance: number | null } }

export interface LabsGenerateResult {
  asset: LabsAsset | AssetRow | null
  error: string | null
  extra: Record<string, unknown>
  /** Le solde APRÈS le débit, tel que l'edge le rend — l'écran le pose sans relire la RPC. */
  balance: number | null
}

export function useLabsGenerate() {
  const fx = useLabsFixtures()
  const [imageBusy, setImageBusy] = useState(false)
  const [videoBusy, setVideoBusy] = useState(false)

  const generateImage = async (input: LabsImageInput): Promise<LabsGenerateResult> => {
    setImageBusy(true)
    try {
      if (fx) {
        // Le banc refuse comme l'edge : même code, même `extra`, pour éprouver l'écran de refus.
        const prix = creditsPourImage(input.imageSize ?? '2K')
        if (fxSoldeInsuffisant(prix)) return { asset: null, error: 'insufficient_credits', extra: { balance: fxSoldeCourant(), needed: prix }, balance: fxSoldeCourant() }
        const asset = await fxGenerateImage(input.prompt, input.folderId, input.sourceAssetId)
        return { asset, error: null, extra: {}, balance: fxSoldeCourant() }
      }
      const r = await invokeLabs<EdgeOk>('labs-image', {
        prompt: input.prompt,
        folderId: input.folderId,
        sourceAssetId: input.sourceAssetId,
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize ?? '2K',
      })
      if (r.error || !r.data?.asset) return { asset: null, error: r.error ?? 'unknown', extra: r.extra, balance: typeof r.extra.balance === 'number' ? r.extra.balance : null }
      return { asset: r.data.asset, error: null, extra: {}, balance: r.data.credits?.balance ?? null }
    } finally {
      setImageBusy(false)
    }
  }

  const submitVideo = async (input: LabsVideoInput): Promise<LabsGenerateResult> => {
    setVideoBusy(true)
    try {
      if (fx) {
        const prix = creditsPourVideo(input.resolution, input.durationS, !!input.voiceoverText)
        if (fxSoldeInsuffisant(prix)) return { asset: null, error: 'insufficient_credits', extra: { balance: fxSoldeCourant(), needed: prix }, balance: fxSoldeCourant() }
        const asset = await fxSubmitVideo(input.prompt, input.folderId, input.sourceAssetId, input.voiceoverText, input.durationS)
        return { asset, error: null, extra: {}, balance: fxSoldeCourant() }
      }
      const r = await invokeLabs<EdgeOk>('labs-video', {
        prompt: input.prompt,
        folderId: input.folderId,
        sourceAssetId: input.sourceAssetId,
        voiceoverText: input.voiceoverText,
        voiceName: input.voiceName,
        voiceLang: input.voiceLang,
        durationS: input.durationS,
        resolution: input.resolution,
      })
      if (r.error || !r.data?.asset) return { asset: null, error: r.error ?? 'unknown', extra: r.extra, balance: typeof r.extra.balance === 'number' ? r.extra.balance : null }
      return { asset: r.data.asset, error: null, extra: {}, balance: r.data.credits?.balance ?? null }
    } finally {
      setVideoBusy(false)
    }
  }

  return { generateImage, submitVideo, imageBusy, videoBusy }
}
