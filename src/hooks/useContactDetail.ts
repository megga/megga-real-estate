import { useState, useCallback } from 'react'
import { getContactById, type MockContact } from '@/lib/mockData'

// Mock AI summary data per contact
const MOCK_AI_SUMMARIES: Record<string, string> = {
  c1: 'Cliente sérieuse, budget CHF 600\'000–900\'000, recherche active Eaux-Vives/Champel. 1 visite planifiée, dernière interaction il y a 4 jours. Réactivité excellente, profil prêt à acheter.',
  c2: 'Vendeur d\'une villa à Cologny, prix demandé CHF 2\'950\'000. Une offre reçue à CHF 2\'800\'000. Pas pressé mais attentif au marché. Niveau de tension modéré.',
  c3: 'Investisseur actif, budget CHF 1.5–2M, cible rendement locatif. Profil expérimenté, 2 visites effectuées. Dernière interaction il y a 1 semaine.',
  c4: 'Lead froid, premier contact il y a 5 mois via le site web. Aucune visite, aucune interaction récente. Relance recommandée avant archivage.',
  c5: 'Cliente acheteuse et vendeuse. Vend un 3 pièces à Carouge pour acheter plus grand. Budget estimé supérieur au budget annoncé. Timing : 3-6 mois.',
}

const MOCK_NEXT_ACTIONS: Record<string, { title: string; description: string; actionLabel: string; score?: number }> = {
  c1: { title: 'Proposer le 3 pièces rue du Rhône', description: 'Ce bien correspond à 92% des critères de Marie. Budget, zone et surface compatibles.', actionLabel: 'Envoyer le bien', score: 92 },
  c2: { title: 'Planifier un point vendeur', description: 'Pierre n\'a pas eu de nouvelles depuis 7 jours. Une offre est en attente de réponse.', actionLabel: 'Appeler' },
  c3: { title: 'Envoyer l\'analyse de rendement', description: 'Jean attend une projection de rentabilité pour le bien commercial à Meyrin.', actionLabel: 'Préparer le document' },
  c4: { title: 'Relancer avec de nouveaux biens', description: 'Sophie est inactive depuis 30 jours. 2 nouveaux biens correspondent à ses anciens critères.', actionLabel: 'Envoyer une sélection' },
  c5: { title: 'Estimer le bien actuel', description: 'Isabelle souhaite vendre son 3 pièces. L\'estimation permettra de confirmer son budget d\'achat.', actionLabel: 'Planifier l\'estimation' },
}

// Enriched mock data extending MockContact with new CRM fields
export interface EnrichedContactData {
  contact: MockContact
  aiSummary: string
  nextAction: { title: string; description: string; actionLabel: string; score?: number }
  // Enriched CRM fields
  whatsapp_phone: string | null
  language: string
  nationality: string | null
  budget_announced: number | null
  budget_estimated_ai: number | null
  search_zones: string[]
  ai_seriousness_score: number | null
  ai_purchase_probability: number | null
  ai_timing: string | null
  ai_engagement_level: string | null
  ai_tension_level: string | null
  ai_price_reduction_probability: number | null
}

const ENRICHED_DATA: Record<string, Partial<EnrichedContactData>> = {
  c1: {
    whatsapp_phone: '+41 79 310 45 67',
    language: 'fr',
    nationality: 'CH',
    budget_announced: 900000,
    budget_estimated_ai: 1050000,
    search_zones: ['Eaux-Vives', 'Champel', 'Plainpalais'],
    ai_seriousness_score: 88,
    ai_purchase_probability: 75,
    ai_timing: 'immediate',
    ai_engagement_level: 'very_high',
    ai_tension_level: null,
    ai_price_reduction_probability: null,
  },
  c2: {
    whatsapp_phone: '+41 79 456 78 90',
    language: 'fr',
    nationality: 'CH',
    budget_announced: null,
    budget_estimated_ai: null,
    search_zones: [],
    ai_seriousness_score: null,
    ai_purchase_probability: null,
    ai_timing: null,
    ai_engagement_level: 'high',
    ai_tension_level: 'moderate',
    ai_price_reduction_probability: 35,
  },
  c3: {
    whatsapp_phone: null,
    language: 'fr',
    nationality: 'FR',
    budget_announced: 2000000,
    budget_estimated_ai: 1800000,
    search_zones: ['Genève', 'Nyon', 'Meyrin'],
    ai_seriousness_score: 72,
    ai_purchase_probability: 55,
    ai_timing: '1-3_months',
    ai_engagement_level: 'high',
    ai_tension_level: null,
    ai_price_reduction_probability: null,
  },
  c4: {
    whatsapp_phone: null,
    language: 'fr',
    nationality: 'CH',
    budget_announced: 500000,
    budget_estimated_ai: null,
    search_zones: ['Lausanne'],
    ai_seriousness_score: 15,
    ai_purchase_probability: 10,
    ai_timing: 'long_term',
    ai_engagement_level: 'dormant',
    ai_tension_level: null,
    ai_price_reduction_probability: null,
  },
  c5: {
    whatsapp_phone: '+41 76 234 56 78',
    language: 'fr',
    nationality: 'CH',
    budget_announced: 800000,
    budget_estimated_ai: 950000,
    search_zones: ['Carouge', 'Lancy', 'Onex'],
    ai_seriousness_score: 65,
    ai_purchase_probability: 50,
    ai_timing: '3-6_months',
    ai_engagement_level: 'medium',
    ai_tension_level: 'calm',
    ai_price_reduction_probability: 20,
  },
}

export function useContactDetail(contactId: string) {
  const [isRefreshingAi, setIsRefreshingAi] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  const contact = getContactById(contactId)
  const enriched = ENRICHED_DATA[contactId]
  const defaultSummary = MOCK_AI_SUMMARIES[contactId] || 'Aucune analyse disponible pour ce contact.'
  const nextAction = MOCK_NEXT_ACTIONS[contactId] || {
    title: 'Prendre contact',
    description: 'Aucune action spécifique identifiée. Planifier un premier échange.',
    actionLabel: 'Appeler',
  }

  const refreshAiSummary = useCallback(async () => {
    setIsRefreshingAi(true)
    try {
      // Try real AI summary via Edge Function with enriched context
      const { buildContactContext } = await import('@/lib/copilotContext')
      const { fetchContactMemory } = await import('@/hooks/useContactMemory')
      const memory = await fetchContactMemory(contactId)

      if (memory.contact) {
        const context = buildContactContext(memory)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: 'summarize_contact',
            message: `Résume le profil de ${memory.contact.first_name} ${memory.contact.last_name}`,
            context,
            language: 'fr',
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setAiSummary(data.result)
          return
        }
      }
    } catch {
      // Fallback to mock if Edge Function fails
    } finally {
      setIsRefreshingAi(false)
    }
    setAiSummary(defaultSummary)
  }, [contactId, defaultSummary])

  return {
    contact,
    enrichedData: enriched || null,
    aiSummary: aiSummary || defaultSummary,
    nextAction,
    isRefreshingAi,
    refreshAiSummary,
    isLoading: false,
    isError: false,
  }
}
