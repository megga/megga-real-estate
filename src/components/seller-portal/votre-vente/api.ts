// MEGGA — Espace vendeur — appels backend (Phase 2) vers l'edge function seller-portal-action.
// Le vendeur n'a pas de compte : l'autorisation se fait par le token du lien personnel.
import { supabase } from '@/lib/supabase'
import type { SellerSettings } from './SvSettingsModal'
import type { OfferDecision } from './SvOfferModal'

const FN = 'seller-portal-action'

/** Transmet la décision du vendeur à l'agent (enregistrée + notifiée, jamais appliquée directement). */
export async function submitOfferDecision(
  token: string,
  payload: { offerId?: string; decision: OfferDecision; counterAmount?: number },
): Promise<void> {
  const { error } = await supabase.functions.invoke(FN, {
    body: { token, action: 'offer_decision', ...payload },
  })
  if (error) throw error
}

/** Persiste les préférences vendeur (notifs, dispo visites, langue, canal). */
export async function saveSellerPreferences(token: string, s: SellerSettings): Promise<void> {
  const { error } = await supabase.functions.invoke(FN, {
    body: {
      token,
      action: 'save_preferences',
      preferences: {
        notif_offre: s.notifOffre,
        notif_visite: s.notifVisite,
        notif_retour: s.notifRetour,
        notif_resume: s.notifResume,
        jours: s.jours,
        creneaux: s.creneaux,
        preavis: s.preavis,
        langue: s.langue,
        canal: s.canal,
      },
    },
  })
  if (error) throw error
}

/** Récupère les préférences enregistrées (hydratation à l'ouverture). */
export async function fetchSellerPreferences(token: string): Promise<Partial<SellerSettings> | null> {
  const { data, error } = await supabase.functions.invoke(FN, {
    body: { token, action: 'get_preferences' },
  })
  if (error) return null
  const p = (data as { preferences?: Record<string, unknown> } | null)?.preferences
  if (!p) return null
  return {
    notifOffre: Boolean(p.notif_offre),
    notifVisite: Boolean(p.notif_visite),
    notifRetour: Boolean(p.notif_retour),
    notifResume: Boolean(p.notif_resume),
    jours: Array.isArray(p.jours) ? (p.jours as string[]) : [],
    creneaux: Array.isArray(p.creneaux) ? (p.creneaux as string[]) : [],
    preavis: typeof p.preavis === 'string' ? p.preavis : '24h',
    langue: typeof p.langue === 'string' ? p.langue : 'fr',
    canal: typeof p.canal === 'string' ? p.canal : 'whatsapp',
  }
}
