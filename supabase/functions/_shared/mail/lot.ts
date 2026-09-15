// supabase/functions/_shared/mail/lot.ts
// Les gestes EN LOT de la Messagerie (15.09.2026, Julien : « ça se passe comment si
// l'utilisateur veut supprimer plusieurs mails d'un coup ? »). L'edge `mail-actions` lui
// passe le geste d'UN fil ; ce module rend le verdict de CHACUN.
//
// ⛔ UN VERDICT PAR FIL, JAMAIS UN REFUS EN BLOC. Douze fils sélectionnés, dont un que le
// fournisseur refuse : les onze autres doivent partir quand même, et l'écran doit pouvoir
// dire « 11 supprimés, 1 a échoué » au lieu de tout rétablir ou de tout taire.
//
// Pur : aucune dépendance au runtime, testé sous Node (lot.test.ts).

/** Plafond d'un lot : la liste montre douze fils par page ; le reste est une marge de sûreté. */
export const LOT_MAX = 50

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Les identifiants d'un lot, dédoublonnés dans l'ordre reçu ; `null` si le lot est invalide. */
export function lireLot(brut: unknown): string[] | null {
  if (!Array.isArray(brut)) return null
  const ids = [...new Set(brut.map((x) => String(x)))]
  if (ids.length === 0 || ids.length > LOT_MAX || !ids.every((id) => UUID.test(id))) return null
  return ids
}

/** Le verdict d'un fil : ce que l'écran compte. `error` est un CODE, jamais un texte d'erreur. */
export interface VerdictFil { thread_id: string; ok: boolean; error?: string }

/**
 * Applique `geste` à chaque fil, UN À LA FOIS, dans l'ordre reçu, et sans s'arrêter au
 * premier refus. Un fil hors de `connus` (autre boîte, autre agence, ou supprimé entre-temps)
 * est « introuvable » — exactement le verdict d'un geste un par un, jamais « interdit ».
 *
 * `geste` rend un code d'échec, ou `null` s'il a réussi ; s'il lève, le fil est `failed` et
 * le lot continue.
 */
export async function appliquerEnLot(ids: string[], connus: Set<string>, geste: (id: string) => Promise<string | null>): Promise<VerdictFil[]> {
  const verdicts: VerdictFil[] = []
  for (const id of ids) {
    if (!connus.has(id)) { verdicts.push({ thread_id: id, ok: false, error: 'thread_not_found' }); continue }
    let echec: string | null
    try { echec = await geste(id) } catch { echec = 'failed' }
    verdicts.push(echec ? { thread_id: id, ok: false, error: echec } : { thread_id: id, ok: true })
  }
  return verdicts
}
