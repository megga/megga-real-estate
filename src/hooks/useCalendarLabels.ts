/**
 * Libellés du Calendrier (13.09.2026) : ceux de l'AGENCE — un nom, une couleur
 * libre —, et le libellé de chaque événement, UN par événement. Même modèle que
 * les libellés de la Messagerie (`useMailLabels`), décidé par Julien.
 *
 * ⚠ LES AFFECTATIONS NE VIENNENT PAS DE LA REQUÊTE DU CALENDRIER. Un événement est
 * une ligne de `visits`, de `reminders` ou d'`appointments` ; son libellé est lu
 * par une RPC à part (`calendar_label_assignments`). Si la migration manquait —
 * le date-guard du déploiement saute toute migration datée d'un jour passé —, le
 * Calendrier perdrait ses couleurs de libellé, pas ses événements.
 *
 * ⚠ ÉCRIRE PASSE PAR `calendar_set_event_label`, qui ne touche que la colonne du
 * libellé : les rendez-vous KYC sont des pièces de conformité, leurs policies
 * n'ont pas été élargies pour un classement.
 */
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface CalendarLabel { id: string; agency_id: string; name: string; color: string; position: number }

/** Table d'origine d'un événement du Calendrier (`CalEvent.origin`). */
type CalLabelSource = 'visit' | 'reminder' | 'appointment'

interface Affectation { source: string; event_id: string; label_id: string }

/**
 * Fenêtre des affectations : la MÊME que celle des événements
 * (`useCalendarScreen`, ±60 jours bornés au jour) — un libellé hors de la fenêtre
 * n'aurait aucun événement à colorer.
 */
function fenetre(): { from: string; to: string } {
  const from = new Date(); from.setDate(from.getDate() - 60); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setDate(to.getDate() + 60); to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Les libellés de l'agence, les affectations, et les cinq gestes. */
export function useCalendarLabels() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const qc = useQueryClient()
  const range = useMemo(() => fenetre(), [])
  const cleAffectations = ['calendar-label-assignments', agencyId, range.from, range.to] as const

  const labelsQ = useQuery({
    queryKey: ['calendar-labels', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<CalendarLabel[]> => {
      const { data, error } = await supabase
        .from('calendar_labels')
        .select('id, agency_id, name, color, position')
        .order('position')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as CalendarLabel[]
    },
    staleTime: 60_000,
  })

  const affectationsQ = useQuery({
    queryKey: cleAffectations,
    enabled: !!agencyId,
    queryFn: async (): Promise<Affectation[]> => {
      const { data, error } = await supabase.rpc('calendar_label_assignments', { p_from: range.from, p_to: range.to })
      if (error) throw error
      return (data ?? []) as Affectation[]
    },
    staleTime: 60_000,
  })

  /** Identifiant d'événement → identifiant de libellé. */
  const assignments = useMemo(
    () => new Map((affectationsQ.data ?? []).map((a) => [a.event_id, a.label_id])),
    [affectationsQ.data],
  )

  // Un libellé supprimé est retiré des événements par la base (SET NULL) : les
  // deux caches se rafraîchissent ensemble.
  const fini = () => {
    void qc.invalidateQueries({ queryKey: ['calendar-labels'] })
    void qc.invalidateQueries({ queryKey: ['calendar-label-assignments'] })
  }

  const create = useMutation({
    mutationFn: async (a: { name: string; color: string }) => {
      if (!agencyId) throw new Error('no_agency')
      const position = labelsQ.data?.length ?? 0
      const { error } = await supabase.from('calendar_labels').insert({ agency_id: agencyId, name: a.name.trim(), color: a.color, position })
      if (error) throw error
    },
    onSuccess: fini,
  })
  /**
   * Renommer ET recolorer en UNE écriture. ⛔ Deux appels enchaînés (le geste de
   * la Messagerie) pouvaient laisser un libellé à moitié modifié : nom changé,
   * couleur refusée — et le créateur, fermé, ne le disait pas.
   */
  const update = useMutation({
    mutationFn: async (a: { id: string; name: string; color: string }) => {
      const { error } = await supabase.from('calendar_labels').update({ name: a.name.trim(), color: a.color }).eq('id', a.id)
      if (error) throw error
    },
    onSuccess: fini,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_labels').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: fini,
  })

  /**
   * Pose (ou retire, `labelId: null`) le libellé d'un événement.
   *
   * ⚠ OPTIMISTE : le bloc prend sa couleur au clic, et la reprend si la base
   * refuse. Sans ça le geste attendait l'aller-retour, et un clic droit suivi
   * d'un choix se lisait comme un menu qui n'avait rien fait.
   */
  const setEventLabel = useMutation({
    mutationFn: async (a: { source: CalLabelSource; eventId: string; labelId: string | null }) => {
      const { error } = await supabase.rpc('calendar_set_event_label', a.labelId
        ? { p_source: a.source, p_event_id: a.eventId, p_label_id: a.labelId }
        : { p_source: a.source, p_event_id: a.eventId })
      if (error) throw error
    },
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: cleAffectations })
      const courant = qc.getQueryData<Affectation[]>(cleAffectations) ?? []
      const precedente = courant.find((x) => x.event_id === a.eventId) ?? null
      const sans = courant.filter((x) => x.event_id !== a.eventId)
      qc.setQueryData<Affectation[]>(cleAffectations, a.labelId
        ? [...sans, { source: a.source, event_id: a.eventId, label_id: a.labelId }]
        : sans)
      return { precedente }
    },
    // ⚠ On ne rétablit QUE l'événement en échec. Rétablir l'instantané entier
    // effaçait aussi les libellés posés entre-temps sur d'autres événements.
    onError: (_e, a, ctx) => {
      qc.setQueryData<Affectation[]>(cleAffectations, (courant) => {
        const sans = (courant ?? []).filter((x) => x.event_id !== a.eventId)
        return ctx?.precedente ? [...sans, ctx.precedente] : sans
      })
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['calendar-label-assignments'] }) },
  })

  return {
    labels: labelsQ.data ?? [],
    assignments,
    isLoading: labelsQ.isPending,
    error: (labelsQ.error ?? affectationsQ.error) as Error | null,
    create, update, remove, setEventLabel,
  }
}
