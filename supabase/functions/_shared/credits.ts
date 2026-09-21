// supabase/functions/_shared/credits.ts
//
// L'ÉCONOMIE DU STUDIO LABS — le crédit, ce qu'il achète, ce qu'il coûte à MEGGA.
//
// ⛔ CE MODULE EST LE SEUL ENDROIT DU DÉPÔT OÙ LE COÛT FOURNISSEUR ET LA MARGE
// SONT ÉCRITS, et il ne sort JAMAIS du serveur. Le client (`src/lib/credits.ts`) ne
// connaît que le TARIF EN CRÉDITS — jamais un dollar de fal.ai ni de Google. La garde
// `tests/unit/credits-confidentialite.spec.ts` interdit à `src/` de porter ces
// nombres : un agent qui lirait « CHF 0,09 l'image » à côté de « 5 crédits » saurait
// exactement ce que MEGGA gagne, et c'est une information que le produit ne vend pas.
//
// Le modèle est celui de Higgsfield (relevé le 20.09.2026 : Starter 19 $ → 270 crédits,
// Plus 59 $ → 1 200, Ultra 129 $ → 3 000 ; recharges ~5 $ les 100 crédits ; les crédits
// du mois ne se reportent pas) : UN solde, exprimé en crédits, composé de la dotation
// mensuelle du plan et des crédits achetés ; chaque production coûte un nombre entier
// de crédits, affiché AVANT de générer ; le solde se recharge à la main ou
// automatiquement sous un seuil.
//
// ⚠ Module PUR : aucun `Deno.*`, aucun import par URL — il est importé par
// `tests/backend/credits.spec.ts` sous Node, et c'est là que la marge est mesurée.

import type { LabsVideoResolution } from './labs.ts'

// ─── Le crédit ───────────────────────────────────────────────────────────────

/**
 * Valeur de RÉFÉRENCE d'un crédit : le prix du plus petit pack (200 crédits pour
 * CHF 10). Les packs plus gros descendent sous cette valeur — c'est la remise de
 * volume — et c'est contre le PLUS BAS prix au crédit que la marge est mesurée.
 */
export const CREDIT_CHF_BASE = 0.05

// ─── Ce que le client PAIE, en crédits ───────────────────────────────────────
// ⚠ Miroir EXACT de `src/lib/credits.ts` (garde : credits-confidentialite.spec.ts).
// Un écart ferait annoncer un prix que le serveur ne débite pas — ou l'inverse.

export const CREDITS_IMAGE: Record<'1K' | '2K', number> = { '1K': 3, '2K': 5 }
export const CREDITS_VIDEO_PAR_SECONDE: Record<LabsVideoResolution, number> = { '720p': 18, '1080p': 40 }
export const CREDITS_VOIX_OFF = 10

export function creditsPourImage(taille: '1K' | '2K'): number {
  return CREDITS_IMAGE[taille]
}

/** Une vidéo se paie à la seconde ENTIÈRE facturée par le fournisseur, plus la voix off. */
export function creditsPourVideo(resolution: LabsVideoResolution, secondes: number, voixOff: boolean): number {
  const s = Math.max(0, Math.ceil(secondes))
  return CREDITS_VIDEO_PAR_SECONDE[resolution] * s + (voixOff ? CREDITS_VOIX_OFF : 0)
}

// ─── Les packs ───────────────────────────────────────────────────────────────
// ⚠ L'identifiant est la TAILLE ('200'), pas un nom : un nom se rebaptise, une
// taille se lit dans le grand livre dix ans plus tard sans table de correspondance.
// Le prix est en francs ENTIERS : Stripe reçoit des centimes, l'écran des francs.

export type CreditPackId = '200' | '500' | '1200' | '3000'

export interface CreditPack {
  id: CreditPackId
  credits: number
  chf: number
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: '200', credits: 200, chf: 10 },
  { id: '500', credits: 500, chf: 22 },
  { id: '1200', credits: 1200, chf: 49 },
  { id: '3000', credits: 3000, chf: 109 },
] as const

export function packParId(id: unknown): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null
}

/** Le prix d'UN crédit dans ce pack — c'est lui qui borne la marge par le bas. */
export function chfParCredit(pack: CreditPack): number {
  return pack.chf / pack.credits
}

/** Le pack le moins cher au crédit : la marge se mesure LÀ, pas au tarif de base. */
export function packLeMoinsCher(): CreditPack {
  return [...CREDIT_PACKS].sort((a, b) => chfParCredit(a) - chfParCredit(b))[0]
}

// ─── La dotation mensuelle des plans ─────────────────────────────────────────
// ⚠ Miroir de la table `credit_plan_allowances` (migration 20260921110000) — c'est la
// TABLE qui fait foi en base (la RPC `credits_wallet_ensure` la lit) ; ce miroir sert
// les tests de marge et l'affichage. Traduit des anciens quotas (Pro : 50 images +
// 10 vidéos de 8 s ≈ 1 690 crédits ; Entreprise : 200 + 40 ≈ 6 760) en chiffres RONDS,
// ARRONDIS VERS LE BAS pour que la dotation reste sous la moitié du prix du plan au
// pire usage (tout en vidéo 720p, cf. `tests/backend/credits.spec.ts`).

export const CREDITS_DOTATION_MENSUELLE: Record<string, number> = {
  starter: 0,
  pro: 1500,
  // ⚠ 4 800 et non 5 000 (Julien, 21.09.2026) : 5 000 × CHF 0,05 = 250 dépassait le prix
  // du plan (249) — la dotation valait plus que ce qu'on la vend. `agency` suit : même
  // prix, et la base ne l'admet plus (`agencies_plan_check` : starter | pro | entreprise).
  entreprise: 4800,
  agency: 4800,
}

export function dotationMensuelle(plan: string | null | undefined): number {
  return CREDITS_DOTATION_MENSUELLE[(plan ?? 'starter').toLowerCase()] ?? 0
}

/** Prix mensuel des plans, pour mesurer la part de la dotation (miroir de `src/lib/plans.ts`). */
export const PRIX_PLAN_CHF: Record<string, number> = { starter: 0, pro: 89, entreprise: 249, agency: 249 }

// ─── La recharge automatique ─────────────────────────────────────────────────

export const AUTO_TOPUP_SEUILS = [50, 100, 200, 500] as const
export type AutoTopupSeuil = (typeof AUTO_TOPUP_SEUILS)[number]
export const AUTO_TOPUP_SEUIL_DEFAUT: AutoTopupSeuil = 100
export const AUTO_TOPUP_PACK_DEFAUT: CreditPackId = '500'

/**
 * Après un débit, faut-il recharger ? La RPC `credits_debit` rend déjà ce verdict
 * (`auto_topup_due`) ; cette lecture pure sert les tests et la reprise.
 */
export function rechargeDue(p: { enabled: boolean; hasCard: boolean; balance: number; threshold: number }): boolean {
  return p.enabled && p.hasCard && p.balance < p.threshold
}

/**
 * Le premier identifiant de client Stripe RÉEL (`cus_…`) parmi les candidats.
 * ⚠ `admin_set_agency_plan` pose `manual_<agence>` dans `subscriptions` : une valeur
 * factice, que Stripe refuse (« No such customer »). La transmettre au Checkout faisait
 * échouer tout achat de crédits d'une agence passée en Pro par la console.
 */
export function clientStripeReel(...ids: Array<string | null | undefined>): string | null {
  for (const id of ids) {
    if (typeof id === 'string' && /^cus_[A-Za-z0-9]+$/.test(id)) return id
  }
  return null
}

// ─── CONFIDENTIEL — le coût fournisseur et la marge ──────────────────────────
// ⛔ Rien de ce bloc ne doit être importé par `src/`. Le taux USD→CHF et les barèmes
// sont ceux de `labs.ts` (relevés le 20.09.2026) : Nano Banana 2 en 2K 0,101 $ l'image,
// 1K 0,067 $ ; Seedance 2.5 sur fal.ai (h × w × s × 24) / 1024 jetons à 0,0214 $ les
// mille — 720p ≈ 0,462 $/s, 1080p ≈ 1,04 $/s ; voix off ≈ 0,02 $ (synthèse + mux).

const USD_CHF = 0.9

export function coutFournisseurImageChf(taille: '1K' | '2K'): number {
  return (taille === '2K' ? 0.101 : 0.067) * USD_CHF
}

export function coutFournisseurVideoChf(resolution: LabsVideoResolution, secondes: number, voixOff: boolean): number {
  const dims = resolution === '1080p' ? [1920, 1080] : [1280, 720]
  const jetons = (dims[0] * dims[1] * secondes * 24) / 1024
  const usd = (jetons / 1000) * 0.0214 + (voixOff ? 0.02 : 0)
  return usd * USD_CHF
}

/**
 * Le multiplicateur revente ÷ coût, au prix du crédit donné.
 *
 * Les CIBLES gardées par `tests/backend/credits.spec.ts` :
 *   · ≥ 2,0 pour toute production au tarif de base (CHF 0,05 le crédit) ;
 *   · ≥ 1,5 pour toute production au prix du pack le moins cher — c'est le plancher
 *     réel, celui qu'un client qui achète en gros obtient ;
 *   · la dotation mensuelle d'un plan, dépensée ENTIÈREMENT en vidéo 720p (le pire
 *     cas pour MEGGA), coûte moins de la moitié du prix du plan.
 */
export function margeImage(taille: '1K' | '2K', chfCredit: number): number {
  return (creditsPourImage(taille) * chfCredit) / coutFournisseurImageChf(taille)
}

export function margeVideo(resolution: LabsVideoResolution, secondes: number, voixOff: boolean, chfCredit: number): number {
  return (creditsPourVideo(resolution, secondes, voixOff) * chfCredit) / coutFournisseurVideoChf(resolution, secondes, voixOff)
}

/** Coût pour MEGGA d'une dotation mensuelle dépensée ENTIÈREMENT en vidéo 720p sans voix off. */
export function coutPireCasDotationChf(plan: string): number {
  const secondes = dotationMensuelle(plan) / CREDITS_VIDEO_PAR_SECONDE['720p']
  return coutFournisseurVideoChf('720p', secondes, false)
}
