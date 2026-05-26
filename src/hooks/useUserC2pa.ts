import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Signature } from '@/components/account/profile/C2PASignatureGallery'

interface PropertyRow {
  id: string
  title: string | null
  photos: string[] | null
  c2pa_verified: boolean | null
  c2pa_verified_at: string | null
  status: string | null
}

// Aggregate the user's C2PA-signed photos into a Signature[] array consumable
// by the gallery. Each c2pa_verified property contributes 1 signature per
// photo. The manifestId is synthesized from {propertyId}-{photoIdx}; once a
// dedicated `c2pa_manifests` table exists, swap this hook to read from it.

export function useUserC2pa(): Signature[] {
  const { user } = useAuth()

  const { data = [] } = useQuery({
    queryKey: ['account-user-c2pa', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data: rows, error } = await supabase
        .from('properties')
        .select('id, title, photos, c2pa_verified, c2pa_verified_at, status')
        .eq('created_by', user.id)
        .eq('c2pa_verified', true)
        .order('c2pa_verified_at', { ascending: false })
        .limit(50)
      if (error || !rows) return []
      return (rows as PropertyRow[]).flatMap((p) => buildSignaturesFor(p))
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  return data
}

function buildSignaturesFor(p: PropertyRow): Signature[] {
  const photos = p.photos ?? []
  if (photos.length === 0 || !p.c2pa_verified_at) return []
  // Single signedAt for all photos of a property — they were signed in batch
  return photos.map((url, idx) => ({
    id: `${p.id}-${idx}`,
    bienId: p.id,
    thumb: url,
    styleLabel: idx === 0 ? 'Photo principale' : `Photo ${idx + 1}`,
    signedAt: p.c2pa_verified_at!,
    manifestId: `urn:megga:c2pa:${p.id}-${idx}`,
    share: 'public',
    listingTitle: p.title ?? 'Bien',
    photoIdx: idx,
  }))
}
