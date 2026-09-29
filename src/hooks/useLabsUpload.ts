/**
 * L'import d'une photo dans le studio Labs : le fichier va dans le bucket `labs`
 * (Storage, lecture publique — Seedance et Gemini la lisent par URL), puis une ligne
 * `labs_assets` de genre `upload`, la seule que la base laisse insérer au client.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { LABS_ASSET_COLONNES, LABS_STORAGE_BUCKET, labsAssetFromRow, labsUploadPath, labsUploadProblem } from '@/lib/labs'
import { fxUpload, useLabsFixtures } from '@/components/crm/labs/fixtures'
import type { LabsAsset } from '@/types/labs'

/** Dimensions lues dans le navigateur : la galerie en tire la hauteur de la vignette. */
function lireDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export function useLabsUpload() {
  const { profile } = useAuth()
  const fx = useLabsFixtures()
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File, folderId: string | null): Promise<{ asset: LabsAsset | null; error: string | null }> => {
    const probleme = labsUploadProblem(file)
    if (probleme) return { asset: null, error: probleme }
    setUploading(true)
    try {
      if (fx) return { asset: await fxUpload(file, folderId), error: null }
      const agencyId = profile?.agency_id
      if (!agencyId) return { asset: null, error: 'unknown' }
      const id = crypto.randomUUID()
      const path = labsUploadPath(agencyId, file.type, id)
      const { error: upErr } = await supabase.storage
        .from(LABS_STORAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' })
      if (upErr) return { asset: null, error: 'upload_failed' }
      const { data: pub } = supabase.storage.from(LABS_STORAGE_BUCKET).getPublicUrl(path)
      const dims = await lireDimensions(file)
      const { data, error } = await supabase
        .from('labs_assets')
        .insert({
          id,
          agency_id: agencyId,
          folder_id: folderId,
          kind: 'upload',
          status: 'ready',
          url: pub.publicUrl,
          thumbnail_url: pub.publicUrl,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          provider: 'upload',
          metadata: { name: file.name, bytes: file.size, mime: file.type },
        })
        .select(LABS_ASSET_COLONNES)
        .single()
      if (error || !data) return { asset: null, error: 'upload_failed' }
      return { asset: labsAssetFromRow(data), error: null }
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading }
}
