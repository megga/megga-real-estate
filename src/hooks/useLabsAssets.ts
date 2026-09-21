/**
 * Les productions du studio Labs : la liste de l'agence (300 dernières, hors corbeille),
 * le temps réel qui la rafraîchit quand une vidéo aboutit, et les trois gestes que la
 * base laisse à l'agent — ranger dans un dossier, étoiler, mettre à la corbeille —
 * chacun à l'unité (`move`, `favorite`, `remove`) ET sur une sélection (`…Many`).
 *
 * ⚠ Canal Realtime nommé par `useId()` (CLAUDE.md §4) ; le banc ne s'abonne pas.
 */
import { useEffect, useId, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useEcranActif } from '@/hooks/useEcranActif'
import { LABS_ASSET_COLONNES, invokeLabs, labsAssetFromRow, type LabsAssetRow } from '@/lib/labs'
import { fxAssets, fxEcouter, fxPatchAsset, fxRemoveAsset, useLabsFixtures } from '@/components/crm/labs/fixtures'
import type { LabsAsset } from '@/types/labs'

export const LABS_ASSETS_KEY = ['labs', 'assets'] as const
const LIMITE = 300
const REGROUPEMENT_MS = 800
const SONDAGE_MS = 5000


export function useLabsAssets() {
  const { profile } = useAuth()
  const fx = useLabsFixtures()
  const qc = useQueryClient()
  const agencyId = profile?.agency_id ?? null
  const key = [...LABS_ASSETS_KEY, fx ? `fx-${fx}` : agencyId]

  const query = useQuery({
    queryKey: key,
    enabled: !!fx || !!agencyId,
    queryFn: async (): Promise<LabsAsset[]> => {
      if (fx) return fxAssets(fx)
      const { data, error } = await supabase
        .from('labs_assets').select(LABS_ASSET_COLONNES)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(LIMITE)
      if (error) throw error
      return (data ?? []).map(labsAssetFromRow)
    },
  })

  useEffect(() => {
    if (!fx) return
    return fxEcouter(() => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) })
  }, [fx, qc])

  // Temps réel : une vidéo qui passe `ready` sous la main d'un collègue remonte ici.
  const channelId = useId()
  const enAttente = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!agencyId || fx) return
    const channel = supabase
      .channel(`labs-assets-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labs_assets', filter: `agency_id=eq.${agencyId}` }, () => {
        if (enAttente.current) clearTimeout(enAttente.current)
        enAttente.current = setTimeout(() => {
          enAttente.current = null
          void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY })
        }, REGROUPEMENT_MS)
      })
      .subscribe()
    return () => {
      if (enAttente.current) { clearTimeout(enAttente.current); enAttente.current = null }
      void supabase.removeChannel(channel)
    }
  }, [agencyId, channelId, fx, qc])

  /** Remplace une ligne dans le cache sans attendre le serveur. */
  const poser = (id: string, patch: Partial<LabsAsset>) => {
    qc.setQueryData<LabsAsset[]>(key, (prev) => (prev ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const move = useMutation({
    mutationFn: async (p: { id: string; folderId: string | null }) => {
      if (fx) { fxPatchAsset(p.id, { folderId: p.folderId }); return p }
      const { error } = await supabase.from('labs_assets').update({ folder_id: p.folderId }).eq('id', p.id)
      if (error) throw error
      return p
    },
    onMutate: (p) => poser(p.id, { folderId: p.folderId }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  const favorite = useMutation({
    mutationFn: async (p: { id: string; isFavorite: boolean }) => {
      if (fx) { fxPatchAsset(p.id, { isFavorite: p.isFavorite }); return p }
      const { error } = await supabase.from('labs_assets').update({ is_favorite: p.isFavorite }).eq('id', p.id)
      if (error) throw error
      return p
    },
    onMutate: (p) => poser(p.id, { isFavorite: p.isFavorite }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (fx) { fxRemoveAsset(id); return id }
      const { error } = await supabase.from('labs_assets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      return id
    },
    onMutate: (id) => {
      qc.setQueryData<LabsAsset[]>(key, (prev) => (prev ?? []).filter((a) => a.id !== id))
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  // ─── Les mêmes gestes, sur une SÉLECTION ──────────────────────────────
  //
  // ⚠ UNE requête par geste (`.in('id', ids)`), pas une boucle : ranger douze
  // productions ne doit pas être douze allers-retours — c'est la lenteur qui décourage
  // de ranger, et un studio qu'on ne range pas devient un tas.
  //
  // ⛔ Et le plafond est celui de la LISTE (300 lignes chargées), pas un nombre
  // inventé : on ne peut cocher que ce qu'on voit.

  /** Applique une retouche locale à plusieurs lignes d'un coup. */
  const poserPlusieurs = (ids: string[], patch: Partial<LabsAsset>) => {
    const vise = new Set(ids)
    qc.setQueryData<LabsAsset[]>(key, (prev) => (prev ?? []).map((a) => (vise.has(a.id) ? { ...a, ...patch } : a)))
  }

  const moveMany = useMutation({
    mutationFn: async (p: { ids: string[]; folderId: string | null }) => {
      if (fx) { for (const id of p.ids) fxPatchAsset(id, { folderId: p.folderId }); return p }
      const { error } = await supabase.from('labs_assets').update({ folder_id: p.folderId }).in('id', p.ids)
      if (error) throw error
      return p
    },
    onMutate: (p) => poserPlusieurs(p.ids, { folderId: p.folderId }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  const favoriteMany = useMutation({
    mutationFn: async (p: { ids: string[]; isFavorite: boolean }) => {
      if (fx) { for (const id of p.ids) fxPatchAsset(id, { isFavorite: p.isFavorite }); return p }
      const { error } = await supabase.from('labs_assets').update({ is_favorite: p.isFavorite }).in('id', p.ids)
      if (error) throw error
      return p
    },
    onMutate: (p) => poserPlusieurs(p.ids, { isFavorite: p.isFavorite }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      if (fx) { for (const id of ids) fxRemoveAsset(id); return ids }
      const { error } = await supabase.from('labs_assets').update({ deleted_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
      return ids
    },
    onMutate: (ids) => {
      const vise = new Set(ids)
      qc.setQueryData<LabsAsset[]>(key, (prev) => (prev ?? []).filter((a) => !vise.has(a.id)))
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: LABS_ASSETS_KEY }) },
  })

  /** Ajoute une production fraîchement rendue par une edge, en tête. */
  const inserer = (row: LabsAssetRow | LabsAsset) => {
    const asset = 'agency_id' in row ? labsAssetFromRow(row) : row
    qc.setQueryData<LabsAsset[]>(key, (prev) => [asset, ...(prev ?? []).filter((a) => a.id !== asset.id)])
  }

  return {
    assets: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    move,
    favorite,
    remove,
    moveMany,
    favoriteMany,
    removeMany,
    inserer,
    poser,
  }
}

/**
 * Sonde les vidéos en file d'attente tant que l'écran est ACTIF : `labs-video-status`
 * finalise la vidéo (voix off, R2) et la ligne passe `ready` ou `failed`. Un écran
 * caché est muet (CLAUDE.md §8, les écrans d'onglet restent vivants).
 */
export function useLabsVideoPolling(assets: LabsAsset[], poser: (id: string, patch: Partial<LabsAsset>) => void) {
  const fx = useLabsFixtures()
  const actif = useEcranActif()
  const enCours = assets.filter((a) => a.kind === 'video' && (a.status === 'generating' || a.status === 'pending')).map((a) => a.id)
  const cle = enCours.join(',')
  useEffect(() => {
    if (fx || !actif || enCours.length === 0) return
    let arrete = false
    let suivant: ReturnType<typeof setTimeout> | null = null
    // ⛔ Le tour SUIVANT part quand le précédent a FINI. Une finalisation (mux, copie R2)
    // dure bien plus que l'intervalle, et `setInterval` empilait les appels sur la même
    // vidéo ; l'edge tient désormais un bail, l'écran cesse en plus de la marteler.
    const tour = async () => {
      for (const id of enCours) {
        if (arrete) return
        const r = await invokeLabs<{ asset: LabsAssetRow }>('labs-video-status', { assetId: id })
        if (arrete) return
        if (r.data?.asset) poser(id, labsAssetFromRow(r.data.asset))
      }
      if (!arrete) suivant = setTimeout(() => { void tour() }, SONDAGE_MS)
    }
    void tour()
    return () => { arrete = true; if (suivant) clearTimeout(suivant) }
    // `cle` résume la liste ; `poser` est stable par construction du cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, fx, actif])
}
