/**
 * L'économie du studio Labs — la MARGE, mesurée là où elle vit.
 *
 * ⛔ Ce fichier est le seul du dépôt qui lise le coût fournisseur ET le tarif client
 * côte à côte, et c'est voulu : il tourne sous Node, jamais dans un bundle, et c'est
 * lui qui empêche qu'un tarif « arrondi pour faire joli » passe sous le coût. Trois
 * cibles, toutes écrites dans `_shared/credits.ts` :
 *
 *   · ≥ 2,0× pour toute production au tarif de base (CHF 0,05 le crédit) ;
 *   · ≥ 1,5× au prix du pack le moins cher — le plancher RÉEL, celui d'un client qui
 *     achète en gros ;
 *   · la dotation mensuelle d'un plan, dépensée ENTIÈREMENT en vidéo 720p (le pire cas
 *     pour MEGGA), coûte moins de la moitié du prix du plan.
 *
 * ⚠ Les barèmes fournisseurs (0,101 $ l'image 2K ; 0,0214 $ les mille jetons Seedance)
 * sont des RELEVÉS du 20.09.2026. Le jour où fal.ai ou Google changent de prix, c'est
 * ce fichier qui rougit — et le tarif en crédits se rediscute, pas le test.
 */
import { describe, expect, it } from 'vitest'
import {
  AUTO_TOPUP_SEUILS, CREDIT_CHF_BASE, CREDIT_PACKS, CREDITS_DOTATION_MENSUELLE, CREDITS_IMAGE,
  CREDITS_VIDEO_PAR_SECONDE, CREDITS_VOIX_OFF, PRIX_PLAN_CHF,
  carteGardeePourRecharge, chfParCredit, clientStripeReel, coutFournisseurImageChf, coutFournisseurVideoChf,
  coutPireCasDotationChf, creditsPourImage, creditsPourVideo, dotationMensuelle, margeImage, margeVideo,
  packLeMoinsCher, packParId, rechargeDue,
} from '../../supabase/functions/_shared/credits'

const RESOLUTIONS = ['720p', '1080p'] as const
const DUREES = [4, 8, 15, 30]

describe('crédits — le tarif', () => {
  it('une image se paie un nombre ENTIER de crédits, une vidéo à la seconde entière', () => {
    expect(creditsPourImage('2K')).toBe(CREDITS_IMAGE['2K'])
    expect(Number.isInteger(creditsPourImage('1K'))).toBe(true)
    expect(creditsPourVideo('720p', 8, false)).toBe(8 * CREDITS_VIDEO_PAR_SECONDE['720p'])
    expect(creditsPourVideo('720p', 8, true)).toBe(8 * CREDITS_VIDEO_PAR_SECONDE['720p'] + CREDITS_VOIX_OFF)
    // 7,2 s se facturent 8 : le fournisseur arrondit à la seconde, nous aussi.
    expect(creditsPourVideo('1080p', 7.2, false)).toBe(8 * CREDITS_VIDEO_PAR_SECONDE['1080p'])
    expect(creditsPourVideo('720p', 0, false)).toBe(0)
  })

  it('le 1080p coûte plus que le 720p, et la voix off n’est jamais gratuite', () => {
    expect(CREDITS_VIDEO_PAR_SECONDE['1080p']).toBeGreaterThan(CREDITS_VIDEO_PAR_SECONDE['720p'])
    expect(CREDITS_VOIX_OFF).toBeGreaterThan(0)
  })
})

describe('crédits — la marge, mesurée', () => {
  const plancher = chfParCredit(packLeMoinsCher())

  it('le pack le moins cher reste au-dessus de la moitié du tarif de base', () => {
    // Une remise de volume qui passerait sous 50 % ferait mentir la mesure de marge
    // au tarif de base : c'est le plancher, pas la référence, qui garde le produit.
    expect(plancher).toBeGreaterThan(CREDIT_CHF_BASE * 0.5)
    expect(plancher).toBeLessThanOrEqual(CREDIT_CHF_BASE)
  })

  it('≥ 2,0× sur chaque production au tarif de base', () => {
    for (const taille of ['1K', '2K'] as const) {
      expect(margeImage(taille, CREDIT_CHF_BASE), `image ${taille}`).toBeGreaterThanOrEqual(2.0)
    }
    for (const res of RESOLUTIONS) {
      for (const s of DUREES) {
        for (const vo of [false, true]) {
          expect(margeVideo(res, s, vo, CREDIT_CHF_BASE), `vidéo ${res} ${s} s vo=${vo}`).toBeGreaterThanOrEqual(2.0)
        }
      }
    }
  })

  it('≥ 1,5× sur chaque production au prix du pack le moins cher', () => {
    for (const taille of ['1K', '2K'] as const) {
      expect(margeImage(taille, plancher), `image ${taille}`).toBeGreaterThanOrEqual(1.5)
    }
    for (const res of RESOLUTIONS) {
      for (const s of DUREES) {
        for (const vo of [false, true]) {
          expect(margeVideo(res, s, vo, plancher), `vidéo ${res} ${s} s vo=${vo}`).toBeGreaterThanOrEqual(1.5)
        }
      }
    }
  })

  it('le coût fournisseur est bien celui relevé le 20.09.2026', () => {
    // Contrôle positif : si quelqu'un « corrige » le barème pour faire passer la marge,
    // c'est ici que ça se voit.
    expect(coutFournisseurImageChf('2K')).toBeCloseTo(0.101 * 0.9, 4)
    expect(coutFournisseurVideoChf('720p', 1, false)).toBeCloseTo(0.462 * 0.9, 2)
    expect(coutFournisseurVideoChf('1080p', 1, false)).toBeCloseTo(1.04 * 0.9, 2)
  })

  it('la dotation d’un plan, tout en vidéo 720p, coûte moins de la moitié du plan', () => {
    for (const plan of ['pro', 'entreprise'] as const) {
      const cout = coutPireCasDotationChf(plan)
      expect(cout, `${plan} : CHF ${cout.toFixed(2)} sur ${PRIX_PLAN_CHF[plan]}`).toBeLessThan(PRIX_PLAN_CHF[plan] * 0.5)
    }
    expect(coutPireCasDotationChf('starter')).toBe(0)
  })
})

describe('crédits — les packs et les plans', () => {
  it('quatre packs, prix au crédit DÉCROISSANT avec la taille', () => {
    expect(CREDIT_PACKS).toHaveLength(4)
    for (let i = 1; i < CREDIT_PACKS.length; i++) {
      expect(chfParCredit(CREDIT_PACKS[i])).toBeLessThan(chfParCredit(CREDIT_PACKS[i - 1]))
    }
    // L'identifiant EST la taille : il se lit dans le grand livre sans table.
    for (const p of CREDIT_PACKS) expect(p.id).toBe(String(p.credits))
    expect(packParId('500')?.chf).toBe(22)
    expect(packParId('999')).toBeNull()
    expect(packParId(undefined)).toBeNull()
  })

  it('les francs sont ENTIERS — Stripe reçoit des centimes exacts', () => {
    for (const p of CREDIT_PACKS) expect(Number.isInteger(p.chf)).toBe(true)
  })

  it('la dotation mensuelle suit le plan, Starter n’en a pas', () => {
    expect(dotationMensuelle('starter')).toBe(0)
    expect(dotationMensuelle('pro')).toBe(CREDITS_DOTATION_MENSUELLE.pro)
    expect(dotationMensuelle('Entreprise')).toBe(CREDITS_DOTATION_MENSUELLE.entreprise)
    expect(dotationMensuelle(null)).toBe(0)
    expect(dotationMensuelle('inconnu')).toBe(0)
  })

  it('la dotation mensuelle vaut MOINS que le prix du plan au tarif de base', () => {
    // Sans quoi le plan vendrait ses crédits à perte par rapport aux packs.
    for (const plan of ['pro', 'entreprise'] as const) {
      expect(dotationMensuelle(plan) * CREDIT_CHF_BASE).toBeLessThan(PRIX_PLAN_CHF[plan])
    }
  })
})

describe('crédits — la recharge automatique', () => {
  it('ne part que sous le seuil, activée, avec une carte', () => {
    expect(rechargeDue({ enabled: true, hasCard: true, balance: 99, threshold: 100 })).toBe(true)
    expect(rechargeDue({ enabled: true, hasCard: true, balance: 100, threshold: 100 })).toBe(false)
    expect(rechargeDue({ enabled: false, hasCard: true, balance: 0, threshold: 100 })).toBe(false)
    expect(rechargeDue({ enabled: true, hasCard: false, balance: 0, threshold: 100 })).toBe(false)
  })
  it('les seuils sont ceux que la base accepte (CHECK de `credit_wallets`)', () => {
    expect([...AUTO_TOPUP_SEUILS]).toEqual([50, 100, 200, 500])
  })
})

// Revue post-fusion de #1338 (21.09.2026). `credits-checkout` demande la garde de la carte
// PAR MOYEN DE PAIEMENT ; Stripe la range sous `payment_method_options.card`, et le champ
// de premier niveau reste `null`. Ne lire que celui-ci ne gardait JAMAIS la carte.
describe('crédits — la carte gardée pour la recharge', () => {
  it('lit la demande posée par moyen de paiement', () => {
    expect(carteGardeePourRecharge({ setup_future_usage: null, payment_method_options: { card: { setup_future_usage: 'off_session' } } })).toBe(true)
  })
  it('lit aussi la demande de premier niveau', () => {
    expect(carteGardeePourRecharge({ setup_future_usage: 'off_session' })).toBe(true)
  })
  it('ne garde rien sans demande hors session', () => {
    expect(carteGardeePourRecharge({ setup_future_usage: null, payment_method_options: { card: {} } })).toBe(false)
    expect(carteGardeePourRecharge({ setup_future_usage: 'on_session' })).toBe(false)
    expect(carteGardeePourRecharge(null)).toBe(false)
  })
})

// `admin_set_agency_plan` pose `manual_<agence>` dans `subscriptions` : Stripe refuse ce
// client, et l'achat de crédits d'une agence passée en Pro par la console échouait.
describe('crédits — le client Stripe', () => {
  it('écarte le client factice de la console', () => {
    expect(clientStripeReel('manual_0b2f3c4d-0000-4000-8000-000000000000', 'cus_Q1w2E3r4')).toBe('cus_Q1w2E3r4')
    expect(clientStripeReel('manual_0b2f3c4d-0000-4000-8000-000000000000', null)).toBeNull()
  })
  it('garde l’ordre de préférence entre deux vrais clients', () => {
    expect(clientStripeReel('cus_Abonnement', 'cus_Agence')).toBe('cus_Abonnement')
    expect(clientStripeReel(undefined, '', 'cus_Agence')).toBe('cus_Agence')
  })
})
