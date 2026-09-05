/**
 * Les 50 derniers documents de l'agence (sous RLS), pour les joindre à un
 * message — la section « Documents de l'agence » du popover de pièces jointes.
 *
 * ⚠ Sens du transfert : ici on SORT un document du dossier pour l'envoyer. Le
 * geste inverse (« Classer dans le dossier », T2.11) passe par l'edge
 * `mail-attachment`, jamais par le navigateur : c'est lui qui vérifie le MIME
 * contre l'allowlist du bucket et calcule l'empreinte.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyDocument { id: string; name: string; size_bytes: number; storage_path: string; type: string }

/** Les documents disponibles de l'agence, du plus récent au plus ancien. */
export function useAgencyDocuments(enabled: boolean) {
  return useQuery({
    queryKey: ['mail', 'agency-documents'],
    enabled,
    queryFn: async (): Promise<AgencyDocument[]> => {
      const { data, error } = await supabase.from('documents')
        .select('id, name, size_bytes, storage_path, type')
        .eq('status', 'available').order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return (data ?? []) as AgencyDocument[]
    },
    staleTime: 60_000,
  })
}

/** Télécharge un document du bucket et le rend en base64 (pour `mail-send`). */
export async function documentToBase64(storagePath: string): Promise<{ base64: string; mimeType: string }> {
  const { data, error } = await supabase.storage.from('documents').download(storagePath)
  if (error || !data) throw new Error(error?.message ?? 'download_failed')
  return { base64: await blobToBase64(data), mimeType: data.type || 'application/octet-stream' }
}

/**
 * Un blob en base64 SANS son préfixe `data:…;base64,` — c'est ce que `mail-send`
 * attend, et laisser le préfixe produirait une pièce jointe illisible sans
 * qu'aucune erreur ne remonte.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
