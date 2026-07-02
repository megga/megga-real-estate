// Kill-switch runtime de l'agent WhatsApp. Permet de COUPER tout le pipeline
// (webhook + cron) sans redéploiement, via une simple ligne app_config.
//
// MEGGA WhatsApp est ACTIF par défaut. Pour le couper : poser
//   app_config.whatsapp_enabled = 'false'
// Pour le réactiver : 'true' ou supprimer la ligne.
//
// Fail-OPEN : ligne absente ou lecture en erreur → actif (un blip de lecture ne
// doit jamais couper un système sain ; seule la valeur explicite 'false' coupe).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KILL_KEY = 'whatsapp_enabled'

export async function isWhatsAppEnabled(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await admin.from('app_config').select('value').eq('key', KILL_KEY).maybeSingle()
    const v = (data as { value?: string } | null)?.value
    return (v ?? 'true').trim().toLowerCase() !== 'false'
  } catch {
    return true
  }
}
