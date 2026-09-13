// supabase/functions/_shared/function-url.ts
// L'URL d'une Edge Function appelée par une autre — ou remise à un tiers (rappel de
// signature électronique, lien de désinscription) —, exécutée dans la région de la base.
//
// ⛔ SANS ÉPINGLE, LA FONCTION APPELÉE S'EXÉCUTE PRÈS DE L'APPELANT. Mesuré le 13.09.2026
// dans les journaux (`x_sb_edge_region`) : `whatsapp-webhook`, que Meta appelle depuis les
// États-Unis, s'y exécutait, et `whatsapp-agent` qu'il appelle l'y suivait — 24 appels en
// 24 h, tous dans des régions américaines. Le PARAMÈTRE d'URL suffit : jamais l'en-tête
// `x-region`, que le préflight CORS de nos fonctions ne déclare pas. La base fait de même
// pour ses appels pg_net (20260914080000). Garde : tests/unit/region-fonctions.spec.ts.

/** La région de la base (Irlande) : y exécuter ne crée aucun transfert. */
export const REGION_FONCTIONS = 'eu-west-1'

/**
 * `base` est le SUPABASE_URL de l'appelant, PASSÉ et non lu : ce module se charge aussi sous
 * Node (vitest). Les paramètres de `query` précèdent l'épingle, dans leur ordre.
 */
export function urlFonction(base: string, nom: string, query?: Record<string, string>): string {
  const params = new URLSearchParams(query)
  params.set('forceFunctionRegion', REGION_FONCTIONS)
  return `${base.replace(/\/+$/, '')}/functions/v1/${nom}?${params}`
}
