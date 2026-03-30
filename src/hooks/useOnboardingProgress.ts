import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface OnboardingStep {
  key: string
  label: string
  description: string
  link: string
  completed: boolean
  completedAt: string | null
}

const STEP_DEFINITIONS: { key: string; label: string; description: string; link: string }[] = [
  { key: 'profile', label: 'Compléter votre profil', description: 'Ajoutez votre téléphone et votre canton.', link: '/dashboard/settings' },
  { key: 'contacts', label: 'Importer 5+ contacts', description: 'Importez vos clients pour commencer.', link: '/dashboard/contacts/import' },
  { key: 'property', label: 'Ajouter votre premier bien', description: 'Créez un bien dans votre portefeuille.', link: '/dashboard/listings/new' },
  { key: 'kyc', label: 'Lancer une vérification KYC', description: "Ouvrez un dossier de conformité.", link: '/dashboard/kyc' },
  { key: 'match', label: 'Envoyer un match à un client', description: 'Proposez un bien correspondant.', link: '/dashboard/matching' },
]

export function useOnboardingProgress() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id
  const agencyId = profile?.agency_id

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ['onboarding-progress', userId, agencyId],
    queryFn: async (): Promise<OnboardingStep[]> => {
      if (!userId || !agencyId) return STEP_DEFINITIONS.map(d => ({ ...d, completed: false, completedAt: null }))

      // Fetch existing checklist rows
      const { data: rows } = await supabase
        .from('onboarding_checklist')
        .select('step_key, completed, completed_at')
        .eq('user_id', userId)

      const completedMap = new Map<string, { completed: boolean; completed_at: string | null }>()
      for (const row of rows || []) {
        completedMap.set(row.step_key, { completed: row.completed, completed_at: row.completed_at })
      }

      // Live-check conditions
      const checks = await Promise.all([
        checkProfile(userId),
        checkContacts(agencyId),
        checkProperty(agencyId),
        checkKyc(agencyId),
        checkMatch(agencyId),
      ])

      const results: OnboardingStep[] = []
      for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
        const def = STEP_DEFINITIONS[i]
        const existing = completedMap.get(def.key)
        const liveCheck = checks[i]

        // Auto-complete if live condition met but not yet marked
        if (liveCheck && !existing?.completed) {
          await supabase.from('onboarding_checklist').upsert({
            user_id: userId,
            agency_id: agencyId,
            step_key: def.key,
            completed: true,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'user_id,step_key' })
          results.push({ ...def, completed: true, completedAt: new Date().toISOString() })
        } else {
          results.push({
            ...def,
            completed: existing?.completed ?? liveCheck,
            completedAt: existing?.completed_at ?? null,
          })
        }
      }

      return results
    },
    enabled: !!userId,
    staleTime: 30_000,
  })

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return
      // Mark all steps as completed
      for (const def of STEP_DEFINITIONS) {
        await supabase.from('onboarding_checklist').upsert({
          user_id: userId,
          agency_id: agencyId,
          step_key: def.key,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,step_key' })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
    },
  })

  const completedCount = steps.filter(s => s.completed).length
  const total = STEP_DEFINITIONS.length
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const isComplete = completedCount === total

  return {
    steps,
    completedCount,
    total,
    percentage,
    isComplete,
    isLoading,
    dismiss: () => dismissMutation.mutate(),
    refresh: () => queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] }),
  }
}

// ── Live condition checkers ───────────────────────────────────────────────

async function checkProfile(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, phone, canton')
    .eq('id', userId)
    .single()
  return !!(data?.full_name && data?.phone && data?.canton)
}

async function checkContacts(agencyId: string): Promise<boolean> {
  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
  return (count ?? 0) >= 5
}

async function checkProperty(agencyId: string): Promise<boolean> {
  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
  return (count ?? 0) >= 1
}

async function checkKyc(agencyId: string): Promise<boolean> {
  const { count } = await supabase
    .from('kyc_cases')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
  return (count ?? 0) >= 1
}

async function checkMatch(agencyId: string): Promise<boolean> {
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
    .eq('status', 'sent')
  return (count ?? 0) >= 1
}
