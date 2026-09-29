/**
 * La CLÔTURE d'une affaire conclue : ce qu'il reste à régler, lu en base, et le geste qui le règle
 * (proposition du 27.09.2026 — le panneau « Affaire conclue » du board et la fiche d'une affaire
 * conclue). Et son APRÈS-VENTE : trois rappels pour l'agent, à 7, 30 et 365 jours (`apresVente.ts`).
 *
 * ⛔ « CONCLU » NE FAISAIT RIEN D'AUTRE QUE POSER LE STATUT. Mesuré le 27.09.2026 : aucun
 * déclencheur ne suit `transactions.status = 'completed'`. Le bien restait `active`, donc le moteur
 * de matching (qui ne lit que les biens actifs) continuait de le proposer. La recherche de
 * l'acheteur restait active, et il recevait des biens le lendemain de son achat. Les acheteurs qui
 * suivaient ce bien n'étaient signalés nulle part.
 *
 * ⚠ RIEN NE PART SEUL. Chaque suite est une case que l'agent valide (validation humaine, CLAUDE.md
 * §5). « Prévenir les acheteurs » et l'après-vente créent des RAPPELS pour l'agent, jamais un
 * message : le matching reste chez l'agent (décision du 21.09.2026, `matching-sans-sortie.spec.ts`).
 *
 * ⚠ Une location n'a pas de statut « loué » (`property_status` : draft, active, reserved, sold,
 * archived). Son bien est RETIRÉ du marché (`archived`), jamais écrit « vendu ».
 *
 * La clôture validée s'écrit au journal (`Clôture enregistrée`, ses suites en métadonnées) : c'est
 * elle que la fiche relit pour ne plus réclamer une clôture « à terminer ».
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRevalidateTables } from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useLogAudit } from '@/hooks/useAuditLog'
import { usePipelineReminderCreators } from '@/hooks/usePipelineNextActions'
import {
  REGLE_APRES_VENTE, estApresVente, etapeDe, type EtapeApresVente,
} from '@/components/crm/pipeline/apresVente'

/** L'action du journal qui marque une clôture validée — la fiche la relit, l'historique la nomme. */
export const ACTION_CLOTURE = 'Clôture enregistrée'

/** Les états d'un match où l'acheteur CONNAÎT le bien : proposé, visite prévue, intéressé. */
const STATUTS_SUIVI = ['sent', 'visit_planned', 'interested']
const OUVERTES = ['pending', 'triggered', 'snoozed']

/** Ce que la clôture a réglé — écrit au journal. */
export interface SuitesCloture {
  bien?: 'sold' | 'archived'
  recherches?: number
  prevenir?: number
  relances?: number
  apresVente?: number
}

/** Une étape d'après-vente planifiée : sa relance, son jour, faite ou non. */
export interface EtapePlanifiee {
  id: string
  etape: EtapeApresVente | null
  note: string | null
  le: string
  fait: boolean
}

export interface EtatCloture {
  acheteurId: string | null
  /** Le contact de l'affaire, acheteur à défaut vendeur : celui qu'on félicite, celui des rappels. */
  contactId: string | null
  bien: { id: string; titre: string; statut: string; location: boolean } | null
  /** Les recherches ACTIVES de l'acheteur. */
  recherches: string[]
  /** Les autres acheteurs qui suivaient ce bien. */
  suiveurs: { contactId: string; nom: string }[]
  /** Les relances encore ouvertes de l'affaire, HORS après-vente — celles que la clôture solde. */
  relances: string[]
  apresVente: EtapePlanifiee[]
  enregistree: { le: string; suites: SuitesCloture } | null
}

type LigneAffaire = { contact_buyer_id: string | null; contact_seller_id: string | null; property_id: string | null }
type LigneBien = { id: string; title: string; status: string; transaction_type: string | null }

async function lire<T>(requete: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await requete
  if (error) throw error
  return data
}

/** L'état de clôture d'une affaire — tout ce que le panneau propose et que la fiche montre. */
export function useClotureAffaire(dealId: string | undefined, actif = true) {
  return useQuery({
    queryKey: ['cloture-affaire', dealId],
    enabled: !!dealId && actif,
    queryFn: async (): Promise<EtatCloture> => {
      const affaire = await lire<LigneAffaire>(supabase.from('transactions')
        .select('contact_buyer_id, contact_seller_id, property_id').eq('id', dealId!).maybeSingle())
      const acheteurId = affaire?.contact_buyer_id ?? null
      const bienId = affaire?.property_id ?? null
      const [bien, recherches, suivis, relances, journal] = await Promise.all([
        bienId ? lire<LigneBien>(supabase.from('properties').select('id, title, status, transaction_type').eq('id', bienId).maybeSingle()) : null,
        acheteurId ? lire(supabase.from('client_searches').select('id').eq('contact_id', acheteurId).eq('is_active', true)) : null,
        bienId ? lire(supabase.from('matches').select('contact_id').eq('property_id', bienId).in('status', STATUTS_SUIVI)) : null,
        lire(supabase.from('reminders').select('id, type, trigger_rule, trigger_days, trigger_at, status, message_template')
          .eq('transaction_id', dealId!).in('status', [...OUVERTES, 'done'])),
        lire(supabase.from('activity_events').select('created_at, metadata').eq('entity_id', dealId!)
          .eq('action', ACTION_CLOTURE).order('created_at', { ascending: false }).limit(1)),
      ])
      const ids = [...new Set((suivis ?? []).map((m) => m.contact_id).filter((id): id is string => !!id && id !== acheteurId))]
      const noms = ids.length > 0
        ? await lire(supabase.from('contacts').select('id, first_name, last_name').in('id', ids)) ?? []
        : []
      const evenement = journal?.[0]
      return {
        acheteurId,
        contactId: acheteurId ?? affaire?.contact_seller_id ?? null,
        bien: bien ? { id: bien.id, titre: bien.title, statut: bien.status, location: bien.transaction_type === 'rent' } : null,
        recherches: (recherches ?? []).map((r) => r.id),
        suiveurs: ids.map((id) => {
          const c = noms.find((n) => n.id === id)
          return { contactId: id, nom: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '' }
        }).filter((s) => s.nom),
        relances: (relances ?? []).filter((r) => OUVERTES.includes(r.status) && !estApresVente(r)).map((r) => r.id),
        apresVente: (relances ?? []).filter(estApresVente)
          .flatMap((r) => r.trigger_at
            ? [{ id: r.id, etape: etapeDe(r.trigger_days), note: r.message_template, le: r.trigger_at, fait: r.status === 'done' }]
            : [])
          .sort((a, b) => a.le.localeCompare(b.le)),
        enregistree: evenement
          ? { le: evenement.created_at, suites: ((evenement.metadata as { suites?: SuitesCloture } | null)?.suites ?? {}) }
          : null,
      }
    },
  })
}

/** Les rappels d'après-vente à poser : une ligne par étape. */
export interface EtapesAPoser {
  dealId: string
  contactId: string | null
  etapes: { jours: number; kind: 'call' | 'note'; at: Date; note: string }[]
}

async function poserApresVente(agence: string, p: EtapesAPoser): Promise<void> {
  const { error } = await supabase.from('reminders').insert(p.etapes.map((e) => ({
    agency_id: agence, transaction_id: p.dealId, contact_id: p.contactId, type: 'custom', kind: e.kind,
    trigger_rule: REGLE_APRES_VENTE, trigger_days: e.jours, trigger_at: e.at.toISOString(),
    status: 'pending', channel: 'task', message_template: e.note,
  })))
  if (error) throw error
}

/** Planifie l'après-vente d'une affaire déjà conclue (celle qui ne l'a pas eu à sa clôture). */
export function usePlanifierApresVente() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const revalider = useRevalidateTables([{ schema: 'public', table: 'reminders' }])
  return useMutation({
    mutationFn: async (p: EtapesAPoser) => {
      if (!profile?.agency_id) throw new Error('Aucune agence rattachée')
      await poserApresVente(profile.agency_id, p)
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['cloture-affaire'] }), revalider()])
    },
  })
}

/** Ce que l'agent a coché. Chaque clé absente est une suite qu'il a laissée. */
export interface PlanCloture {
  dealId: string
  contactId: string | null
  objectLabel: string
  bien?: { id: string; statut: 'sold' | 'archived' }
  recherches?: string[]
  prevenir?: { nombre: number; note: string; at: Date }
  /** Les relances à solder, par identifiant : l'après-vente n'en fait jamais partie. */
  relances?: string[]
  apresVente?: EtapesAPoser['etapes']
}

/** Le geste de clôture : chaque suite cochée, puis la ligne du journal qui les résume. */
export function useCloturerAffaire() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const logAudit = useLogAudit()
  const { createNextAction } = usePipelineReminderCreators()
  const revalider = useRevalidateTables([
    { schema: 'public', table: 'properties' },
    { schema: 'public', table: 'client_searches' },
    { schema: 'public', table: 'reminders' },
  ])
  return useMutation({
    mutationFn: async (plan: PlanCloture): Promise<SuitesCloture> => {
      const suites: SuitesCloture = {}
      // ⚠ Solder PAR IDENTIFIANT, et d'abord : une annulation en bloc des relances de l'affaire
      // emporterait aussi l'après-vente et le rappel « prévenir », posés juste après.
      if (plan.relances && plan.relances.length > 0) {
        const { error } = await supabase.from('reminders').update({ status: 'cancelled' }).in('id', plan.relances)
        if (error) throw error
        suites.relances = plan.relances.length
      }
      if (plan.bien) {
        const { error } = await supabase.from('properties').update({ status: plan.bien.statut }).eq('id', plan.bien.id)
        if (error) throw error
        suites.bien = plan.bien.statut
      }
      if (plan.recherches && plan.recherches.length > 0) {
        const { error } = await supabase.from('client_searches').update({ is_active: false }).in('id', plan.recherches)
        if (error) throw error
        suites.recherches = plan.recherches.length
      }
      if (plan.prevenir) {
        await createNextAction({
          transactionId: plan.dealId, contactId: plan.contactId, kind: 'match', at: plan.prevenir.at, note: plan.prevenir.note,
        })
        suites.prevenir = plan.prevenir.nombre
      }
      if (plan.apresVente && plan.apresVente.length > 0) {
        if (!profile?.agency_id) throw new Error('Aucune agence rattachée')
        await poserApresVente(profile.agency_id, { dealId: plan.dealId, contactId: plan.contactId, etapes: plan.apresVente })
        suites.apresVente = plan.apresVente.length
      }
      await logAudit.mutateAsync({
        category: 'deal', severity: 'info', action: ACTION_CLOTURE, entityType: 'deal', entityId: plan.dealId,
        objectLabel: plan.objectLabel, metadata: { suites },
      })
      return suites
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cloture-affaire'] }),
        queryClient.invalidateQueries({ queryKey: ['fiche-affaire'] }),
        revalider(),
      ])
    },
  })
}
