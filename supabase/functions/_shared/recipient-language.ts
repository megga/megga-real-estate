// supabase/functions/_shared/recipient-language.ts
//
// D'où vient la langue d'un e-mail. Module PUR pour la partie qui décide, avec une
// seule fonction qui touche la base.
//
// LE PROBLÈME QU'IL RÉSOUT. La langue choisie ne vivait que dans le `localStorage` du
// navigateur (`megga-language`). Tant qu'un humain clique, le front la joint à sa
// requête et l'e-mail part juste. Mais un envoi AUTOMATIQUE — rappel J-1, relance,
// rappel de contact — n'a aucune requête d'où la lire : `onboarding-call-reminder`
// écrivait `locale: 'fr'` EN DUR, donc un anglophone ayant réservé en anglais recevait
// son rappel de la veille en français. La colonne `profiles.language` (migration
// 20260815250000) est la source qui survit à la fermeture de l'onglet.
//
// L'ORDRE DE PRIORITÉ compte, et il n'est pas évident : la requête PASSE AVANT la base.
// Quelqu'un qui vient de basculer l'interface en allemand attend une confirmation en
// allemand — même si la persistance de sa préférence n'a pas encore atterri, ou a
// échoué. La base est ce qu'on sait de lui ; la requête est ce qu'il fait à l'instant.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Les quatre langues du produit (CLAUDE.md §6). */
export type AppLocale = 'fr' | 'de' | 'en' | 'it'

/** Le français est le défaut du produit, pas un repli d'erreur. */
export const DEFAULT_LOCALE: AppLocale = 'fr'

/**
 * Ramène n'importe quelle entrée à une langue du produit, ou `null`.
 *
 * ⚠ Rend `null` et non `'fr'` pour une valeur inconnue : l'appelant doit pouvoir
 * distinguer « il n'a rien demandé » de « il a demandé le français ». Confondre les
 * deux ferait qu'un corps de requête bruité écraserait une préférence enregistrée.
 *
 * Tolère les formes régionales (`de-CH`, `en-GB`) : le navigateur en produit, et les
 * refuser renverrait l'utilisateur au français pour une raison qu'il ne verrait pas.
 */
export function parseLocale(raw: unknown): AppLocale | null {
  if (typeof raw !== 'string') return null
  const base = raw.trim().slice(0, 5).toLowerCase().split(/[-_]/)[0]
  return base === 'fr' || base === 'de' || base === 'en' || base === 'it' ? base : null
}

/**
 * La langue à employer, la requête d'abord, la préférence enregistrée ensuite.
 *
 * Pure : c'est elle que les tests éprouvent, la lecture en base restant triviale.
 */
export function pickLocale(fromRequest: unknown, stored: unknown): AppLocale {
  return parseLocale(fromRequest) ?? parseLocale(stored) ?? DEFAULT_LOCALE
}

/**
 * Langue de correspondance d'un profil MEGGA.
 *
 * `profileId` nul, profil absent, colonne jamais renseignée : le français, sans bruit.
 * Une langue n'est pas une donnée critique, et faire échouer un envoi parce qu'on ne
 * sait pas dans quelle langue écrire serait pire que d'écrire en français.
 */
export async function profileLocale(
  db: SupabaseClient,
  profileId: string | null | undefined,
  fromRequest?: unknown,
): Promise<AppLocale> {
  const demandee = parseLocale(fromRequest)
  if (demandee) return demandee
  if (!profileId) return DEFAULT_LOCALE
  const { data } = await db.from('profiles').select('language').eq('id', profileId).maybeSingle()
  return parseLocale(data?.language) ?? DEFAULT_LOCALE
}
