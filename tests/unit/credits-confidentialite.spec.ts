/**
 * Les crédits — ce que le client VOIT, et ce qu'il ne doit JAMAIS voir.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────
 * Le studio Labs vend des crédits. Le coût fournisseur (fal.ai, Google), le taux de
 * change et la marge sont CONFIDENTIELS (Julien, 20.09.2026) : ils vivent dans
 * `supabase/functions/_shared/credits.ts`, côté serveur, et rien de `src/` ne les
 * porte — ni en code, ni en commentaire, ni en libellé. Un bundle public qui dirait
 * « 0,101 $ l'image » à côté de « 5 crédits » donnerait la marge à quiconque ouvre
 * l'inspecteur.
 *
 * ── CE QUI EST GARDÉ ─────────────────────────────────────────────────────────
 *  1. Aucun fichier de `src/` ne porte un des nombres du barème fournisseur, ni le
 *     taux USD→CHF, ni un import du module serveur de l'économie.
 *  2. Le TARIF (crédits par image, par seconde, par voix off) et les PACKS sont le
 *     miroir exact de l'edge — c'est le serveur qui débite, l'écran annonce.
 *  3. La section « Consommation » existe dans les Réglages et ses libellés sont là
 *     dans les quatre langues ; les libellés du studio aussi.
 *  4. La visionneuse et la barre ne disent plus « CHF » : le prix se dit en crédits.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CREDIT_PACKS, CREDITS_IMAGE, CREDITS_VIDEO_PAR_SECONDE, CREDITS_VOIX_OFF, AUTO_TOPUP_SEUILS,
  consommationDuMois, creditBalanceFromJson, creditRecuFromJson, creditsPourVideo, formatChf, formatCredits, remisePack,
} from '@/lib/credits'
import {
  CREDIT_PACKS as EDGE_PACKS, CREDITS_IMAGE as EDGE_IMAGE, CREDITS_VIDEO_PAR_SECONDE as EDGE_VIDEO,
  CREDITS_VOIX_OFF as EDGE_VO, AUTO_TOPUP_SEUILS as EDGE_SEUILS, creditsPourVideo as edgeCreditsPourVideo,
} from '../../supabase/functions/_shared/credits'
import { SETTINGS_SECTIONS } from '@/components/crm/settings/data'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

const LANGS = ['fr', 'de', 'en', 'it'] as const
const lire = (lng: string, ns: string) => JSON.parse(readFileSync(`src/i18n/locales/${lng}/${ns}.json`, 'utf8')) as Record<string, unknown>
const chemin = (o: Record<string, unknown>, p: string): unknown =>
  p.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)

describe('crédits — le coût fournisseur ne sort pas du serveur', () => {
  /**
   * Les nombres du barème (relevés du 20.09.2026) et le taux, tels qu'ils s'écrivent
   * en TypeScript. ⚠ `0.9` seul serait trop commun (une opacité) : c'est la constante
   * NOMMÉE qui est cherchée, et les barèmes à trois ou quatre décimales.
   */
  const INTERDITS: [RegExp, string][] = [
    [/0\.0214\b/, 'le prix Seedance au millier de jetons'],
    [/0\.101\b/, 'le prix Nano Banana 2 en 2K'],
    [/0\.067\b/, 'le prix Nano Banana 2 en 1K'],
    [/\bUSD_TO_CHF\b/, 'le taux USD→CHF'],
    [/\bUSD_CHF\b/, 'le taux USD→CHF'],
    [/coutFournisseur|margeImage|margeVideo|coutPireCas/, 'une fonction de marge'],
    [/_shared\/credits(\.ts)?['"]/, 'un import du module serveur de l’économie'],
    [/labsVideoCostUsd|labsImageCostChf|labsVideoCostChf/, 'une fonction de coût de l’edge'],
  ]

  it('aucun fichier de `src/` ne porte le barème, le taux ni une fonction de marge', () => {
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) }])
    expect(emptyRoots(scan), 'racine vide : chemin cassé').toEqual([])
    expect(scan.unreadable).toEqual([])
    // Contrôle positif : la racine est bien lue — un arbre vide rendrait la garde verte.
    expect(scan.files.length).toBeGreaterThan(500)
    const fautifs: string[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      for (const [re, quoi] of INTERDITS) {
        if (re.test(lu.value)) fautifs.push(`${rel(abs)} — ${quoi}`)
      }
    }
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })

  it('contrôle positif : le module serveur, lui, les porte', () => {
    const edge = readFileSync('supabase/functions/_shared/credits.ts', 'utf8')
    expect(edge).toMatch(/0\.0214\b/)
    expect(edge).toMatch(/0\.101\b/)
    expect(edge).toMatch(/margeVideo/)
  })
})

describe('crédits — le tarif de l’écran est celui de l’edge', () => {
  it('crédits par image, par seconde, par voix off : identiques', () => {
    expect(CREDITS_IMAGE).toEqual(EDGE_IMAGE)
    expect(CREDITS_VIDEO_PAR_SECONDE).toEqual(EDGE_VIDEO)
    expect(CREDITS_VOIX_OFF).toBe(EDGE_VO)
    for (const res of ['720p', '1080p'] as const) {
      for (const s of [4, 7.2, 8, 30]) {
        for (const vo of [false, true]) expect(creditsPourVideo(res, s, vo)).toBe(edgeCreditsPourVideo(res, s, vo))
      }
    }
  })
  it('les packs et les seuils de recharge : identiques', () => {
    expect(CREDIT_PACKS).toEqual(EDGE_PACKS)
    expect([...AUTO_TOPUP_SEUILS]).toEqual([...EDGE_SEUILS])
  })
  it('la remise se lit contre le plus petit pack, et le premier n’en a pas', () => {
    expect(remisePack(CREDIT_PACKS[0])).toBe(0)
    for (let i = 1; i < CREDIT_PACKS.length; i++) expect(remisePack(CREDIT_PACKS[i])).toBeGreaterThan(remisePack(CREDIT_PACKS[i - 1]))
  })
})

describe('crédits — les lectures pures de l’écran', () => {
  it('le solde se lit depuis le JSON de la RPC, avec des replis sûrs', () => {
    const b = creditBalanceFromJson({ included: 903, purchased: 340, total: 1243, month: '2026-09', plan: 'pro', monthly_allowance: 1500, auto_topup_enabled: true, auto_topup_threshold: 200, auto_topup_pack: '1200', has_card: true, card_brand: 'visa', card_last4: '4242' })
    expect(b.total).toBe(1243)
    expect(b.autoTopupThreshold).toBe(200)
    expect(b.autoTopupPack).toBe('1200')
    expect(b.hasCard).toBe(true)
    // Un seuil ou un pack inconnu retombe sur le défaut, jamais sur `undefined`.
    const v = creditBalanceFromJson({ auto_topup_threshold: 33, auto_topup_pack: 'x' })
    expect(v.autoTopupThreshold).toBe(100)
    expect(v.autoTopupPack).toBe('500')
    expect(creditBalanceFromJson(null).total).toBe(0)
  })

  it('la consommation du mois compte les débits par genre et les remboursements', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    const e = (kind: 'debit' | 'refund' | 'purchase', amount: number, meta: Record<string, unknown>, at: string) => ({
      id: at, kind, amount, bucket: 'included' as const, includedAfter: 0, purchasedAfter: 0, refType: null, refId: null, amountChf: null, metadata: meta, createdAt: at,
    })
    const c = consommationDuMois([
      e('debit', -5, { kind: 'image' }, '2026-09-19T10:00:00Z'),
      e('debit', -154, { kind: 'video' }, '2026-09-18T10:00:00Z'),
      e('refund', 154, { reason: 'provider_failed' }, '2026-09-18T11:00:00Z'),
      e('purchase', 500, { pack: '500' }, '2026-09-17T10:00:00Z'),
      e('debit', -5, { kind: 'image' }, '2026-08-30T10:00:00Z'),
    ], now)
    expect(c).toEqual({ images: 1, videos: 1, credits: 159, rendus: 154 })
  })

  it('formate en milliers', () => {
    expect(formatCredits(1243, 'fr')).toMatch(/1.243/)
  })
})

describe('crédits — la section existe, dans les quatre langues', () => {
  it('« Consommation » est une section des Réglages, dans le groupe du compte', () => {
    const s = SETTINGS_SECTIONS.find((x) => x.id === 'credits')
    expect(s?.group).toBe('compte')
  })

  const CLES_SETTINGS = [
    'nav.sections.credits.label', 'nav.sections.credits.short',
    'credits.title', 'credits.subtitle',
    'credits.balance.title', 'credits.balance.included', 'credits.balance.purchased', 'credits.balance.allowance', 'credits.balance.topup', 'credits.balance.noPlan', 'credits.balance.goPlan',
    'credits.month.title', 'credits.month.images', 'credits.month.videos', 'credits.month.spent', 'credits.month.refunded',
    'credits.tariff.title', 'credits.tariff.image', 'credits.tariff.image1k', 'credits.tariff.video720', 'credits.tariff.video1080', 'credits.tariff.voiceover', 'credits.tariff.example', 'credits.tariff.unit_one', 'credits.tariff.unit_other',
    'credits.packs.title', 'credits.packs.body', 'credits.packs.buy', 'credits.packs.credits', 'credits.packs.price', 'credits.packs.perCredit', 'credits.packs.discount', 'credits.packs.best', 'credits.packs.opening', 'credits.packs.bench', 'credits.packs.error',
    'credits.auto.title', 'credits.auto.body', 'credits.auto.enabled', 'credits.auto.disabled', 'credits.auto.threshold', 'credits.auto.pack', 'credits.auto.card', 'credits.auto.noCard', 'credits.auto.lastError', 'credits.auto.saved', 'credits.auto.saveError',
    'credits.ledger.title', 'credits.ledger.empty', 'credits.ledger.balanceAfter',
    'credits.ledger.kinds.grant_monthly', 'credits.ledger.kinds.purchase', 'credits.ledger.kinds.auto_topup', 'credits.ledger.kinds.debit_image', 'credits.ledger.kinds.debit_video', 'credits.ledger.kinds.debit_video_vo', 'credits.ledger.kinds.refund', 'credits.ledger.kinds.adjustment',
    'credits.canceled',
    // Le REÇU du retour de Stripe (`CreditsRecuModal`) — chaque état a sa phrase, et
    // une phrase manquante rendrait la clé brute dans une modale de confirmation
    // d'achat, c'est-à-dire au pire endroit possible.
    'credits.receipt.pendingTitle', 'credits.receipt.pendingBody', 'credits.receipt.slowBody',
    'credits.receipt.paidTitle', 'credits.receipt.paidBody',
    'credits.receipt.unpaidTitle', 'credits.receipt.unpaidBody',
    'credits.receipt.expiredTitle', 'credits.receipt.expiredBody',
    'credits.receipt.unknownTitle', 'credits.receipt.unknownBody',
    'credits.receipt.newBalance', 'credits.receipt.paidAmount',
    'credits.receipt.done', 'credits.receipt.retry', 'credits.receipt.close', 'credits.receipt.invoice',
    'credits.auto.adminOnly',
  ]
  const CLES_LABS = [
    'credits.amount_one', 'credits.amount_other', 'menu.creditsHint',
    'prompt.estimate', 'prompt.estimateVideo', 'prompt.estimateMany_one', 'prompt.estimateMany_other', 'prompt.balance', 'prompt.recharge',
    'errors.insufficient_credits', 'errors.credits_partial', 'errors.credits_failed', 'errors.upgrade_required',
  ]

  it('aucune clé ne manque, aucune n’est vide', () => {
    for (const lng of LANGS) {
      const s = lire(lng, 'settings')
      for (const cle of CLES_SETTINGS) {
        const v = chemin(s, cle)
        expect(v, `${lng}: settings.${cle}`).toBeTypeOf('string')
        expect((v as string).trim().length, `${lng}: settings.${cle} vide`).toBeGreaterThan(0)
      }
      const l = lire(lng, 'labs')
      for (const cle of CLES_LABS) {
        const v = chemin(l, cle)
        expect(v, `${lng}: labs.${cle}`).toBeTypeOf('string')
      }
    }
  })

  it('le studio ne dit plus « CHF » : les anciens libellés de coût sont partis', () => {
    for (const lng of LANGS) {
      const l = lire(lng, 'labs')
      for (const cle of ['prompt.estimate', 'prompt.estimateVideo', 'prompt.estimateMany_other']) {
        expect(chemin(l, cle), `${lng}: labs.${cle}`).not.toMatch(/CHF/)
      }
      expect(chemin(l, 'menu.quotaImages')).toBeUndefined()
      expect(chemin(l, 'errors.quota_exceeded')).toBeUndefined()
    }
  })
})

/**
 * ── LE REÇU DU RETOUR DE STRIPE ──────────────────────────────────────────────
 *
 * ⛔ `credits-checkout-status` CRÉDITE. C'est la seule edge où un identifiant venu du
 * navigateur (`?session_id=`) décide d'un mouvement d'argent, et son unique rempart est
 * la confrontation de `session.metadata.agency_id` avec l'agence du JETON. Sans elle,
 * qui devine l'identifiant d'une session d'une autre agence crédite la SIENNE avec le
 * paiement d'un tiers — et la porte `edge-guard-order` ne le verrait pas : le garde
 * d'authentification, lui, est bien à sa place.
 */
describe('crédits — le reçu est cloisonné par agence', () => {
  const SOURCE = readFileSync('supabase/functions/credits-checkout-status/index.ts', 'utf8')

  it('confronte l’agence de la session à celle du jeton, et rend `not_found`', () => {
    expect(SOURCE).toMatch(/session\.metadata\?\.agency_id\s*!==\s*profile\.agency_id/)
    // `not_found` et non `forbidden` : distinguer « pas à vous » de « n'existe pas »
    // confirmerait à un curieux qu'un identifiant deviné est réel.
    expect(SOURCE).not.toMatch(/'forbidden'/)
  })

  it('ne crédite QUE l’agence du jeton, jamais celle de la session', () => {
    const achat = SOURCE.slice(SOURCE.indexOf('credits_purchase'))
    expect(achat).toMatch(/p_agency:\s*profile\.agency_id/)
    expect(achat).not.toMatch(/p_agency:\s*(session|body|pack)/)
  })

  it('ne crédite que sur un paiement RÉELLEMENT abouti', () => {
    // ⚠ On vise l'APPEL (`admin.rpc('credits_purchase'`), pas le nom : l'en-tête du
    // fichier explique le crédit idempotent et le cite bien avant tout garde.
    const garde = SOURCE.indexOf("payment_status !== 'paid'")
    const credit = SOURCE.indexOf("admin.rpc('credits_purchase'")
    expect(garde).toBeGreaterThan(-1)
    expect(credit).toBeGreaterThan(-1)
    expect(garde).toBeLessThan(credit)
  })

  it('la session vient de Stripe, pas du corps de la requête', () => {
    // L'appelant n'envoie qu'un identifiant de forme connue ; le pack, le montant et
    // l'état sont relus chez Stripe. Un pack pris dans le corps serait un tarif choisi
    // par l'acheteur.
    expect(SOURCE).toMatch(/checkout\.sessions\.retrieve\(sessionId/)
    expect(SOURCE).toMatch(/packParId\(session\.metadata\?\.pack\)/)
  })
})

describe('crédits — les lectures du reçu', () => {
  it('formatChf : point décimal et apostrophe suisse, quelle que soit la langue', () => {
    expect(formatChf(22)).toBe('CHF 22.00')
    expect(formatChf(109)).toBe('CHF 109.00')
    expect(formatChf(1090.5)).toBe("CHF 1'090.50")
  })

  it('creditRecuFromJson : un statut inconnu échoue FERMÉ (`unpaid`), jamais en `paid`', () => {
    expect(creditRecuFromJson({ status: 'paid', pack: '500', credits: 500, chf: 22, balance: 1743 }).statut).toBe('paid')
    expect(creditRecuFromJson({ status: 'processing' }).statut).toBe('processing')
    expect(creditRecuFromJson({ status: 'n’importe quoi' }).statut).toBe('unpaid')
    expect(creditRecuFromJson({}).statut).toBe('unpaid')
    expect(creditRecuFromJson(null).balance).toBeNull()
  })

  it('creditRecuFromJson : un pack inconnu ne devient pas un pack', () => {
    expect(creditRecuFromJson({ status: 'paid', pack: '99999' }).pack).toBeNull()
  })
})
