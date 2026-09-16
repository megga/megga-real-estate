/**
 * Rédaction de la description d'annonce par MEGGA AI — l'appel UNIQUE, partagé par les
 * deux wizards (l'ancien, étape Prix & Description ; « Nouveau bien », étape Annonce).
 *
 * Edge `ai-copilot`, action `draft_description` (DeepSeek). ⛔ Échec HONNÊTE : un résultat
 * vide, trop court ou la phrase-sentinelle de l'edge lèvent une erreur — jamais de repli
 * vers un texte fabriqué. L'IA est une ASSISTANCE : l'agent relit avant de publier.
 */
import { supabase } from '@/lib/supabase'
import type { WizardData } from './tokens'

/** Quand le modèle ne produit rien (tour vide en HTTP 200), l'edge renvoie cette phrase NON vide. */
const AI_EMPTY_SENTINEL = 'Je n\'ai pas pu générer de réponse'

/**
 * @param consigne consigne libre ; s'il y a déjà une description, elle est RÉÉCRITE selon
 *                 la consigne, sinon rédigée selon elle.
 * @returns le texte proposé (au moins 60 caractères) — lève en cas d'échec.
 */
export async function genererDescriptionIA(data: WizardData, consigne?: string): Promise<string> {
  const transaction = data.transaction || 'vente'
  const price = transaction === 'location' ? data.rent : data.price
  const context: Record<string, unknown> = {
    type: data.type, transaction,
    address: data.addr || undefined,
    canton: data.canton || undefined, postal_code: data.postCode || undefined,
    surface_m2: data.area || undefined, rooms: data.rooms || undefined,
    bedrooms: data.bedrooms || undefined, bathrooms: data.bathrooms || undefined,
    features: data.features?.length ? data.features : undefined,
    year_built: data.year || undefined, energy_class: data.energy || undefined,
    price: price || undefined,
  }
  const current = (data.description || '').trim()
  const tail = 'Réponds UNIQUEMENT avec la description (2-3 paragraphes), sans titre ni préambule.'
  let message: string
  if (consigne && consigne.trim() && current) {
    message = `Voici la description actuelle de l'annonce :\n\n${current}\n\nRéécris-la en tenant compte de cette consigne : ${consigne.trim()}. ${tail}`
  } else if (consigne && consigne.trim()) {
    message = `Rédige la description de cette annonce immobilière selon cette consigne : ${consigne.trim()}. ${tail}`
  } else {
    message = `Rédige la description de cette annonce immobilière. ${tail}`
  }
  const { data: res, error } = await supabase.functions.invoke<{ result?: string }>('ai-copilot', {
    body: { action: 'draft_description', message, context, language: 'fr', persist: false, stream: false },
  })
  if (error) throw error
  const text = (res?.result ?? '').trim()
  if (!text || text.length < 60 || text.startsWith(AI_EMPTY_SENTINEL)) throw new Error('degraded')
  return text
}
