/**
 * Les dossiers du studio Labs : lecture (RLS agence) et les trois gestes — créer,
 * renommer, supprimer — chacun journalisé (`activity_events`, catégorie `doc`).
 * Sous le banc `/dev/labs`, tout répond depuis les fixtures.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useLogAudit } from '@/hooks/useAuditLog'
import { labsFolderFromRow } from '@/lib/labs'
import {
  fxCreateFolder, fxDeleteFolder, fxEcouter, fxFolders, fxRenameFolder, useLabsFixtures,
} from '@/components/crm/labs/fixtures'
import type { LabsFolder } from '@/types/labs'

export const LABS_FOLDERS_KEY = ['labs', 'folders'] as const

export function useLabsFolders() {
  const { profile } = useAuth()
  const fx = useLabsFixtures()
  const qc = useQueryClient()
  const logAudit = useLogAudit()
  const agencyId = profile?.agency_id ?? null
  const key = [...LABS_FOLDERS_KEY, fx ? `fx-${fx}` : agencyId]

  const query = useQuery({
    queryKey: key,
    enabled: !!fx || !!agencyId,
    queryFn: async (): Promise<LabsFolder[]> => {
      if (fx) return fxFolders(fx)
      const { data, error } = await supabase
        .from('labs_folders').select('*')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(labsFolderFromRow)
    },
  })

  // Le banc écrit en mémoire : ses lecteurs se rafraîchissent à chaque geste.
  useEffect(() => {
    if (!fx) return
    return fxEcouter(() => { void qc.invalidateQueries({ queryKey: LABS_FOLDERS_KEY }) })
  }, [fx, qc])

  const invalidate = () => qc.invalidateQueries({ queryKey: LABS_FOLDERS_KEY })
  const journaliser = (action: string, folder: { id: string; name: string }) => {
    if (fx) return
    logAudit.mutate({ category: 'doc', action, entityType: 'labs_folder', entityId: folder.id, objectLabel: folder.name })
  }

  const create = useMutation({
    mutationFn: async (name: string): Promise<LabsFolder> => {
      if (fx) return fxCreateFolder(name)
      const { data, error } = await supabase
        .from('labs_folders').insert({ agency_id: agencyId ?? '', name }).select('*').single()
      if (error) throw error
      return labsFolderFromRow(data)
    },
    onSuccess: (f) => { void invalidate(); journaliser('labs_folder_created', f) },
  })

  const rename = useMutation({
    mutationFn: async (p: { id: string; name: string }): Promise<{ id: string; name: string }> => {
      if (fx) { fxRenameFolder(p.id, p.name); return p }
      const { error } = await supabase.from('labs_folders').update({ name: p.name }).eq('id', p.id)
      if (error) throw error
      return p
    },
    onSuccess: (f) => { void invalidate(); journaliser('labs_folder_renamed', f) },
  })

  const remove = useMutation({
    mutationFn: async (folder: { id: string; name: string }): Promise<{ id: string; name: string }> => {
      if (fx) { fxDeleteFolder(folder.id); return folder }
      const { error } = await supabase.from('labs_folders').delete().eq('id', folder.id)
      if (error) throw error
      return folder
    },
    onSuccess: (f) => {
      void invalidate()
      // Ses productions retombent « sans dossier » : leur liste doit le voir aussi.
      void qc.invalidateQueries({ queryKey: ['labs', 'assets'] })
      journaliser('labs_folder_deleted', f)
    },
  })

  return {
    folders: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    create,
    rename,
    remove,
  }
}
