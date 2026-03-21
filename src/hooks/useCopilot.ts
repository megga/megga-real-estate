import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type CopilotAction = 'summarize_contact' | 'suggest_next_action' | 'draft_email' | 'draft_description' | 'analyze_kyc' | 'score_lead'

interface CopilotResponse {
  result: string
  action: string
  usage?: { input_tokens: number; output_tokens: number }
}

/* ─── Mock responses (fallback when Edge Function unavailable) ─── */

const MOCK_RESPONSES: Record<string, string> = {
  summarize_contact: `**Résumé du contact :**

• Client actif avec un budget estimé entre CHF 600'000 et CHF 900'000
• Recherche un bien de 3-4 pièces dans les quartiers Eaux-Vives ou Champel
• 3 visites effectuées, dernière interaction il y a 5 jours
• Niveau d'engagement élevé — réactif aux propositions
• **Action recommandée :** Proposer le nouveau 3 pièces rue du Rhône (92% compatible)`,

  suggest_next_action: `**Actions prioritaires recommandées :**

1. 🔴 **Urgent** — Relancer Marie Dupont (pas de retour depuis la visite du 14.03)
2. 🟠 **Aujourd'hui** — Confirmer la visite de 14h30 avec Isabelle Rochat
3. 🟢 **Suggestion** — Envoyer le nouveau 3 pièces Eaux-Vives à Jean-Marc Weber (88% compatible)

*Basé sur l'analyse de votre pipeline et des interactions récentes.*`,

  draft_email: `**Objet :** Suivi de notre rencontre — nouveaux biens disponibles

Madame, Monsieur,

Suite à notre dernière rencontre, je me permets de revenir vers vous avec de nouvelles opportunités qui correspondent à vos critères de recherche.

Un magnifique appartement de 3 pièces vient d'être mis sur le marché dans le quartier des Eaux-Vives, avec une vue dégagée et un balcon exposé sud. Le prix est en adéquation avec votre budget.

Seriez-vous disponible cette semaine pour une visite ? Je reste à votre entière disposition.

Avec mes meilleures salutations,
Gregory Lyonnet
MEGGA Real Estate`,

  draft_description: `Découvrez cet exceptionnel appartement de 3 pièces au cœur des Eaux-Vives, offrant une luminosité remarquable grâce à sa double exposition sud-ouest. Avec ses 75 m² de surface habitable, ce bien se distingue par ses finitions haut de gamme et son balcon de 8 m² donnant sur un environnement verdoyant.

L'appartement comprend un séjour spacieux ouvert sur une cuisine équipée moderne, une chambre principale avec rangements intégrés, ainsi qu'une salle de bains contemporaine. Une place de parking intérieure et une cave complètent cette offre.

Situé à proximité immédiate des commerces, transports publics et du lac, ce bien représente une opportunité rare sur le marché genevois.`,

  analyze_kyc: `**Analyse du dossier KYC :**

✅ Pièce d'identité — validée
✅ Justificatif de domicile — validé
⚠️ Attestation de provenance des fonds — **manquante**
⚠️ Extrait du registre des poursuites — expire dans 15 jours

**Niveau de risque préliminaire :** Moyen
**Facteurs :** Nationalité hors zone GAFI, montant > CHF 1M

*Estimation IA — validation humaine requise avant finalisation.*`,

  score_lead: `**Qualification du lead :**

🔥 **Chaud** — Score de sérieux estimé à 82/100

**Justification :**
• Réactivité élevée (répond dans les 24h)
• Budget cohérent avec le marché ciblé
• 3 visites effectuées en 2 semaines
• Demande active de documentation complémentaire

*Estimation IA — à confirmer par l'agent.*`,
}

/* ─── Action detection from natural language ─── */

function detectAction(message: string): CopilotAction {
  const lower = message.toLowerCase()
  if (/résumé|résume|profil|qui est/.test(lower)) return 'summarize_contact'
  if (/relance|rédige|email|message|écrire/.test(lower)) return 'draft_email'
  if (/matching|biens|proposer|envoyer|compatible/.test(lower)) return 'suggest_next_action'
  if (/actions|prochaines|priorité|faire/.test(lower)) return 'suggest_next_action'
  if (/kyc|conformité|dossier|document/.test(lower)) return 'analyze_kyc'
  if (/score|qualif|lead|chaud|froid/.test(lower)) return 'score_lead'
  if (/annonce|description|listing/.test(lower)) return 'draft_description'
  return 'suggest_next_action'
}

export function useCopilot() {
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> => {
    const action = detectAction(message)

    setIsLoading(true)
    try {
      // Try Edge Function first
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await supabase.functions.invoke<CopilotResponse>('ai-copilot', {
          body: {
            action,
            context: {
              message,
              ...context,
            },
          },
        })

        if (res.data?.result) {
          return res.data.result
        }
      }

      // Fallback to mock responses
      return MOCK_RESPONSES[action] || MOCK_RESPONSES.suggest_next_action
    } catch {
      // Fallback to mock responses on any error
      return MOCK_RESPONSES[action] || MOCK_RESPONSES.suggest_next_action
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { sendMessage, isLoading, detectAction }
}
