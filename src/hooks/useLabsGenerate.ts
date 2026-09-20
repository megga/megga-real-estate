/**
 * Les deux générations du studio Labs : l'image (synchrone, Nano Banana 2 rend en ~10 s)
 * et la vidéo (soumise à la file de fal.ai ; `useLabsVideoPolling` la suit).
 * Les erreurs sont des CODES stables de l'edge, traduits par l'écran (`labs:errors.*`).
 */
import { useState } from 'react'
import { invokeLabs } from '@/lib/labs'
import { fxGenerateImage, fxSubmitVideo, useLabsFixtures } from '@/components/crm/labs/fixtures'
import type { LabsAsset, LabsImageInput, LabsVideoInput } from '@/types/labs'
import type { Database } from '@/types/database'

type AssetRow = Database['public']['Tables']['labs_assets']['Row']
interface EdgeOk { asset: AssetRow; usage?: { current: number; quota: number; remaining: number } }

export interface LabsGenerateResult {
  asset: LabsAsset | AssetRow | null
  error: string | null
  extra: Record<string, unknown>
}

export function useLabsGenerate() {
  const fx = useLabsFixtures()
  const [imageBusy, setImageBusy] = useState(false)
  const [videoBusy, setVideoBusy] = useState(false)

  const generateImage = async (input: LabsImageInput): Promise<LabsGenerateResult> => {
    setImageBusy(true)
    try {
      if (fx) {
        const asset = await fxGenerateImage(input.prompt, input.folderId, input.sourceAssetId)
        return { asset, error: null, extra: {} }
      }
      const r = await invokeLabs<EdgeOk>('labs-image', {
        prompt: input.prompt,
        folderId: input.folderId,
        sourceAssetId: input.sourceAssetId,
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize ?? '2K',
      })
      if (r.error || !r.data?.asset) return { asset: null, error: r.error ?? 'unknown', extra: r.extra }
      return { asset: r.data.asset, error: null, extra: {} }
    } finally {
      setImageBusy(false)
    }
  }

  const submitVideo = async (input: LabsVideoInput): Promise<LabsGenerateResult> => {
    setVideoBusy(true)
    try {
      if (fx) {
        const asset = await fxSubmitVideo(input.prompt, input.folderId, input.sourceAssetId, input.voiceoverText, input.durationS)
        return { asset, error: null, extra: {} }
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
      if (r.error || !r.data?.asset) return { asset: null, error: r.error ?? 'unknown', extra: r.extra }
      return { asset: r.data.asset, error: null, extra: {} }
    } finally {
      setVideoBusy(false)
    }
  }

  return { generateImage, submitVideo, imageBusy, videoBusy }
}
