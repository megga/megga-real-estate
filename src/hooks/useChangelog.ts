// MEGGA CRM Sugar v2 — Changelog admin.
// Source de vérité : table `admin_changelog` (migration 20260518_001).
//
// Étape 21 : les écritures passent désormais par des RPC gardées, plus par des
// INSERT/DELETE directs. La table est fermée en écriture — un GRANT d'écriture était
// une seconde porte à garder synchronisée avec les gestes, et rien ne journalisait.
//
// Une création arrive toujours en BROUILLON : publier est un geste séparé, parce qu'une
// nouveauté est visible de tous les agents. L'ancien formulaire posait `published` à
// l'insert, et la table avait `DEFAULT TRUE` — une entrée créée sans y penser partait en
// production.
//
// ⚠ Client casté : ces RPC ne sont pas encore dans src/types/database.ts (auto-généré, en
// retard sur des migrations non mergées — son en-tête interdit l'édition à la main). Même
// motif que useAdminKybReview.ts. À nettoyer à la première régénération.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const db = supabase as unknown as SupabaseClient

/** Enveloppe §10.1 : `{ ok:false, code, message_fr }` sur refus métier. */
interface Enveloppe { ok: boolean; code?: string; message_fr?: string; data?: unknown }

/** Lève le message serveur plutôt qu'un « échec » muet — l'écran a besoin du motif. */
function deballer(data: unknown, error: { message: string } | null): unknown {
  if (error) throw new Error(error.message)
  const e = data as Enveloppe
  if (e && e.ok === false) throw new Error(e.message_fr ?? e.code ?? 'Refusé')
  return e?.data
}

export interface ChangelogEntry {
  id: string
  title: string
  content: string
  version: string | null
  published: boolean
  created_at: string
  /** draft | scheduled | published (§5.10). */
  status: string
  /** Date de publication programmée, null hors de l'état `scheduled`. */
  scheduled_for: string | null
}

type ChangelogRow = ChangelogEntry

/** Changelog admin (table `admin_changelog`) : liste triée par date + mutations create/delete, invalidées au succès. */
export function useChangelog() {
  const queryClient = useQueryClient()

  const entries = useQuery({
    queryKey: ['admin-changelog'],
    queryFn: async (): Promise<ChangelogEntry[]> => {
      // La lecture reste directe : la RLS ouvre les entrées publiées à tous et le reste au
      // seul super-admin. C'est l'ÉCRITURE qui passe désormais par les gestes.
      const { data, error } = await supabase
        .from('admin_changelog')
        .select('id, title, content, version, published, created_at, status, scheduled_for')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ChangelogRow[]
    },
    staleTime: 60_000,
  })

  const invalider = () => queryClient.invalidateQueries({ queryKey: ['admin-changelog'] })

  const createEntry = useMutation({
    mutationFn: async (input: { title: string; content: string; version: string; published: boolean }) => {
      // La clé d'idempotence protège du double-clic : sans elle, deux entrées identiques
      // que rien ne distinguerait ensuite. `crypto.randomUUID` est disponible partout où
      // ce hook tourne (navigateur moderne, contexte sécurisé).
      const { data, error } = await db.rpc('admin_changelog_save', {
        p_id: null, p_title: input.title, p_content: input.content,
        p_version: input.version || null, p_idempotency_key: crypto.randomUUID(),
      })
      const cree = deballer(data, error) as { id?: string; already_done?: boolean } | undefined

      // Créer puis publier sont DEUX gestes : le second est journalisé à part, parce
      // qu'il rend la nouveauté visible de tous les agents.
      if (input.published && cree?.id) {
        const { data: p, error: pErr } = await db.rpc('admin_changelog_publish', { p_id: cree.id })
        deballer(p, pErr)
      }
    },
    onSuccess: invalider,
  })

  const publishEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc('admin_changelog_publish', { p_id: id })
      deballer(data, error)
    },
    onSuccess: invalider,
  })

  const unpublishEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc('admin_changelog_unpublish', { p_id: id })
      deballer(data, error)
    },
    onSuccess: invalider,
  })

  const scheduleEntry = useMutation({
    mutationFn: async (input: { id: string; when: string }) => {
      const { data, error } = await db.rpc('admin_changelog_schedule', {
        p_id: input.id, p_when: input.when,
      })
      deballer(data, error)
    },
    onSuccess: invalider,
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc('admin_changelog_delete', { p_id: id })
      deballer(data, error)
    },
    onSuccess: invalider,
  })

  return {
    entries: entries.data ?? [],
    isLoading: entries.isLoading,
    isError: entries.isError,
    refetch: entries.refetch,
    createEntry,
    publishEntry,
    unpublishEntry,
    scheduleEntry,
    deleteEntry,
  }
}
