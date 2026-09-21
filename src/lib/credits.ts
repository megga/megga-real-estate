/**
 * Les crédits, côté navigateur : le TARIF (combien de crédits vaut une production),
 * les packs qu'on peut acheter, et les lectures pures de l'écran « Consommation ».
 *
 * ⛔ CE FICHIER NE CONNAÎT AUCUN COÛT FOURNISSEUR. Ni le prix de fal.ai, ni celui de
 * Google, ni le taux USD→CHF, ni la marge — tout cela vit dans
 * `supabase/functions/_shared/credits.ts`, côté serveur, et n'en sort pas. Un agent qui
 * lirait le coût d'une image en francs à côté de « 5 crédits » saurait ce que MEGGA gagne ; le
 * produit vend des crédits, pas une transparence sur ses fournisseurs. La garde
 * `tests/unit/credits-confidentialite.spec.ts` interdit ces nombres à tout `src/`.
 *
 * ⚠ Le tarif et les packs sont le MIROIR EXACT de l'edge (même garde) : c'est le
 * serveur qui débite, l'écran ne fait qu'annoncer — un écart ferait promettre un prix
 * que le serveur ne pratique pas.
 */
import type { LabsResolution } from '@/types/labs'

// ─── Le tarif, en crédits (miroir de l'edge) ─────────────────────────────────

export const CREDITS_IMAGE: Record<'1K' | '2K', number> = { '1K': 3, '2K': 5 }
export const CREDITS_VIDEO_PAR_SECONDE: Record<LabsResolution, number> = { '720p': 18, '1080p': 40 }
export const CREDITS_VOIX_OFF = 10

export function creditsPourImage(taille: '1K' | '2K' = '2K'): number {
  return CREDITS_IMAGE[taille]
}

export function creditsPourVideo(resolution: LabsResolution, secondes: number, voixOff: boolean): number {
  const s = Math.max(0, Math.ceil(secondes))
  return CREDITS_VIDEO_PAR_SECONDE[resolution] * s + (voixOff ? CREDITS_VOIX_OFF : 0)
}

// ─── Les packs (miroir de l'edge) ────────────────────────────────────────────

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

export function packParId(id: string | null | undefined): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null
}

/** Le prix d'UN crédit dans ce pack, en francs. */
export function chfParCredit(pack: CreditPack): number {
  return pack.chf / pack.credits
}

/**
 * La remise d'un pack, en %, contre le PLUS PETIT pack — c'est lui la référence
 * (« 200 crédits pour CHF 10 »), et c'est ce que l'écran annonce : « −18 % ».
 */
export function remisePack(pack: CreditPack): number {
  const base = chfParCredit(CREDIT_PACKS[0])
  return Math.round((1 - chfParCredit(pack) / base) * 100)
}

// ─── La recharge automatique ─────────────────────────────────────────────────

export const AUTO_TOPUP_SEUILS = [50, 100, 200, 500] as const
export type AutoTopupSeuil = (typeof AUTO_TOPUP_SEUILS)[number]

// ─── Le solde, tel que la RPC `credits_balance` le rend ──────────────────────

export interface CreditBalance {
  included: number
  purchased: number
  total: number
  month: string
  plan: string | null
  monthlyAllowance: number
  autoTopupEnabled: boolean
  autoTopupThreshold: AutoTopupSeuil
  autoTopupPack: CreditPackId
  autoTopupLastError: string | null
  autoTopupLastErrorAt: string | null
  hasCard: boolean
  cardBrand: string | null
  cardLast4: string | null
}

export function creditBalanceFromJson(j: unknown): CreditBalance {
  const o = (j ?? {}) as Record<string, unknown>
  const n = (k: string) => Number(o[k] ?? 0) || 0
  const seuil = n('auto_topup_threshold')
  return {
    included: n('included'),
    purchased: n('purchased'),
    total: n('total'),
    month: String(o.month ?? ''),
    plan: (o.plan as string | null) ?? null,
    monthlyAllowance: n('monthly_allowance'),
    autoTopupEnabled: !!o.auto_topup_enabled,
    autoTopupThreshold: ((AUTO_TOPUP_SEUILS as readonly number[]).includes(seuil) ? seuil : 100) as AutoTopupSeuil,
    autoTopupPack: packParId(String(o.auto_topup_pack ?? ''))?.id ?? '500',
    autoTopupLastError: (o.auto_topup_last_error as string | null) ?? null,
    autoTopupLastErrorAt: (o.auto_topup_last_error_at as string | null) ?? null,
    hasCard: !!o.has_card,
    cardBrand: (o.card_brand as string | null) ?? null,
    cardLast4: (o.card_last4 as string | null) ?? null,
  }
}

// ─── Le grand livre ──────────────────────────────────────────────────────────

export type CreditLedgerKind = 'grant_monthly' | 'purchase' | 'auto_topup' | 'debit' | 'refund' | 'adjustment'

export interface CreditLedgerEntry {
  id: string
  kind: CreditLedgerKind
  amount: number
  bucket: 'included' | 'purchased' | 'mixed'
  includedAfter: number
  purchasedAfter: number
  refType: string | null
  refId: string | null
  amountChf: number | null
  metadata: Record<string, unknown>
  createdAt: string
}

export function creditLedgerFromRow(r: {
  id: string; kind: string; amount: number; bucket: string; included_after: number; purchased_after: number
  ref_type: string | null; ref_id: string | null; amount_chf: number | null; metadata: unknown; created_at: string
}): CreditLedgerEntry {
  return {
    id: r.id,
    kind: r.kind as CreditLedgerKind,
    amount: r.amount,
    bucket: r.bucket as CreditLedgerEntry['bucket'],
    includedAfter: r.included_after,
    purchasedAfter: r.purchased_after,
    refType: r.ref_type,
    refId: r.ref_id,
    amountChf: r.amount_chf == null ? null : Number(r.amount_chf),
    metadata: (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }
}

/** La consommation du mois civil courant, lue dans le grand livre — images, vidéos, crédits. */
export function consommationDuMois(entries: CreditLedgerEntry[], now: Date = new Date()): { images: number; videos: number; credits: number; rendus: number } {
  const debut = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const out = { images: 0, videos: 0, credits: 0, rendus: 0 }
  for (const e of entries) {
    if (new Date(e.createdAt).getTime() < debut) continue
    if (e.kind === 'debit') {
      out.credits += -e.amount
      if (e.metadata.kind === 'video') out.videos += 1
      else out.images += 1
    } else if (e.kind === 'refund') {
      out.rendus += e.amount
    }
  }
  return out
}

// ─── Le reçu d'un Checkout (edge `credits-checkout-status`) ──────────────────

/**
 * Où en est le paiement au retour de Stripe.
 *
 * ⚠ `processing` n'est pas une panne : TWINT et quelques cartes aboutissent APRÈS la
 * redirection. C'est le seul état qu'on interroge à nouveau ; les autres sont finaux.
 */
export type CreditRecuStatut = 'paid' | 'processing' | 'unpaid' | 'expired'

export interface CreditRecu {
  statut: CreditRecuStatut
  pack: CreditPackId | null
  credits: number
  chf: number
  /** Le solde APRÈS l'achat, tel que la RPC l'a rendu — `null` tant que rien n'est crédité. */
  balance: number | null
  invoiceUrl: string | null
}

export function creditRecuFromJson(j: unknown): CreditRecu {
  const o = (j ?? {}) as Record<string, unknown>
  const statut = String(o.status ?? '')
  return {
    statut: (['paid', 'processing', 'unpaid', 'expired'].includes(statut) ? statut : 'unpaid') as CreditRecuStatut,
    pack: packParId(String(o.pack ?? ''))?.id ?? null,
    credits: Number(o.credits ?? 0) || 0,
    chf: Number(o.chf ?? 0) || 0,
    balance: o.balance == null ? null : Number(o.balance) || 0,
    invoiceUrl: (o.invoiceUrl as string | null) ?? null,
  }
}

/**
 * `CHF 22.00` — un montant ARGENT, aux centimes.
 *
 * ⛔ Pas d'`Intl` ici, et pas de variante par langue : `fr-CH` rend « 22,00 », avec une
 * virgule, là où le grand livre de cet écran écrit « 22.00 » — deux notations du même
 * franc à deux lignes d'écart. La convention suisse est le POINT décimal et
 * l'APOSTROPHE des milliers, dans les quatre langues ; c'est la même règle que
 * `formatCHF` (`lib/utils`), qui arrondit au franc et ne convient donc pas à un reçu.
 */
export function formatChf(chf: number): string {
  const [entier, centimes] = Math.abs(chf).toFixed(2).split('.')
  return `CHF ${entier.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${centimes}`
}

// ─── Affichage ───────────────────────────────────────────────────────────────

/** `1 240` — l'apostrophe est réservée aux montants en francs, un nombre de crédits prend l'espace. */
export function formatCredits(n: number, lang = 'fr'): string {
  return new Intl.NumberFormat(lang === 'de' ? 'de-CH' : lang === 'it' ? 'it-CH' : lang === 'en' ? 'en-CH' : 'fr-CH', { maximumFractionDigits: 0 }).format(Math.round(n))
}
