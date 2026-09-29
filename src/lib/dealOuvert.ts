/**
 * Le deal OUVERT d'un acheteur : la seule règle qui dit si un deal l'est encore. Les gestes du matching la lisent pour
 * trouver le deal auquel un geste se rattache (`rattacherDeal`, matchingGestes.ts), la fiche d'un mandat pour savoir qui
 * y est un acheteur en cours (`visiteurs.ts`). Module PUR : ni React, ni Supabase, ni traduction.
 *
 * ⚠ Le module ne porte que ce prédicat, pas « son deal » : entre plusieurs deals ouverts, chaque lecteur choisit — le
 * dernier créé pour les gestes et le copilote, le dernier modifié sur ce bien pour la fiche (l'ordre de
 * `useTransactions`).
 *
 * Lot E1 (conception §5.8, décisions de Julien) : un deal est ouvert si son statut est `active` ou `on_hold`, que son
 * étape n'est pas `lost`, et qu'il n'est pas archivé (`archived_at`, 29.09.2026 : le Pipeline le range hors de sa vue,
 * un geste neuf ne doit pas s'y rattacher sans qu'on le voie). ⚠ « Perdu » n'est pas un statut : c'est l'étape `lost` —
 * « Marquer perdu » du Pipeline n'écrit qu'elle, le statut reste `active`. Lu sur le statut seul, un geste neuf se
 * rattacherait au deal perdu au lieu d'en ouvrir un.
 *
 * ⛔ CE MODULE EST LE MIROIR DU SQL : `wa_matching_consigner` et `wa_matching_visite` (le copilote WhatsApp, migration
 * `20260924200000_matching_whatsapp.sql`) appliquent la même règle ; `tests/unit/deal-ouvert.spec.ts` les confronte.
 */
import type { Enums } from '@/types/database'

/**
 * Les statuts d'un deal ouvert (`transactions.status`) : `active`, et `on_hold`, un deal suspendu que le Pipeline garde.
 * `completed` est un deal gagné (« Terminer »), `cancelled` un deal annulé.
 */
export const STATUTS_DEAL_OUVERT: readonly Enums<'transaction_status'>[] = ['active', 'on_hold']

/** L'étape d'un deal perdu (`transactions.stage`) : il n'est plus ouvert, quel que soit son statut. */
export const ETAPE_DEAL_PERDU: Enums<'transaction_stage'> = 'lost'

/**
 * Un deal ouvert : d'un statut ouvert, pas perdu, pas archivé. Son étape n'est jamais nulle (`transactions.stage` est
 * `NOT NULL`) : c'est ce qui rend la règle identique au `<> 'lost'` du SQL et au `neq` de PostgREST, qui excluraient
 * une étape nulle. `archived_at` est exigé du lecteur : un deal lu sans lui passerait pour ouvert.
 */
export const dealOuvert = (d: {
  status: Enums<'transaction_status'>
  stage: Enums<'transaction_stage'>
  archived_at: string | null
}): boolean => STATUTS_DEAL_OUVERT.includes(d.status) && d.stage !== ETAPE_DEAL_PERDU && d.archived_at == null
