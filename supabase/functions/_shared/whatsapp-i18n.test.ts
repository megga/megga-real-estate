import { describe, it, expect } from 'vitest'
import {
  detectLang, asWaLang, t, confirmSuffix, confirmSuffixCorrectable, kycTypeLabel, vigilanceLabel,
  confirmOpenKyc, openKycResult, confirmUpdatePipeline, pipelineWhoNamed,
  confirmDeleteContact, deleteContactPreview,
} from './whatsapp-i18n'

describe('detectLang', () => {
  it('détecte le français', () => {
    expect(detectLang('ouvre un dossier KYC pour Dubois')).toBe('fr')
    expect(detectLang('peux-tu déplacer le dossier de Marie en négociation ?')).toBe('fr')
  })
  it("détecte l'anglais", () => {
    expect(detectLang('open a KYC file for Dubois')).toBe('en')
    expect(detectLang('can you move the file to negotiation please')).toBe('en')
    expect(detectLang('record offer 900000 from Dubois')).toBe('en') // « from » mot-outil EN
    expect(detectLang('run KYC screening on Dubois')).toBe('en')      // « on » désormais EN seul
  })
  it('défaut FR sur vide/ambigu', () => {
    expect(detectLang('')).toBe('fr')
    expect(detectLang(null)).toBe('fr')
    expect(detectLang('Dubois')).toBe('fr') // pas de mot-outil → défaut FR
  })
})

describe('asWaLang', () => {
  it("ne reconnaît que 'en', sinon 'fr'", () => {
    expect(asWaLang('en')).toBe('en')
    expect(asWaLang('fr')).toBe('fr')
    expect(asWaLang(undefined)).toBe('fr')
    expect(asWaLang('de')).toBe('fr')
  })
})

describe('t (chaînes statiques)', () => {
  it('renvoie la bonne langue', () => {
    expect(t('fr', 'clientMsgSent')).toBe('✅ Message envoyé au client.')
    expect(t('en', 'clientMsgSent')).toBe('✅ Message sent to the client.')
    expect(t('en', 'cancelled')).toMatch(/Cancelled/)
    expect(t('fr', 'busy')).toMatch(/action en attente/)
    expect(t('en', 'busy')).toMatch(/pending action/)
  })
})

describe('confirmSuffix', () => {
  it('suffixe FR/EN', () => {
    expect(confirmSuffix('fr')).toBe('Tu confirmes ? (« oui » / « non »)')
    expect(confirmSuffix('en')).toBe('Confirm? (reply « yes » / « no »)')
  })
})

describe('confirmSuffixCorrectable', () => {
  it('invite à corriger en plus de oui/non (FR/EN)', () => {
    expect(confirmSuffixCorrectable('fr')).toBe('Tu confirmes ? (« oui » / « non », ou dis-moi quoi changer)')
    expect(confirmSuffixCorrectable('en')).toBe('Confirm? (« yes » / « no », or tell me what to change)')
  })
})

describe('confirmDeleteContact', () => {
  it('nomme le contact, marque l\'irréversibilité et rappelle la rétention KYC (FR/EN)', () => {
    const fr = confirmDeleteContact('fr', 'Jean Dubois')
    expect(fr).toContain('Jean Dubois')
    expect(fr).toMatch(/irréversible/i)
    expect(fr).toMatch(/KYC/)
    expect(fr).toContain(confirmSuffix('fr'))
    const en = confirmDeleteContact('en', 'Jean Dubois')
    expect(en).toContain('Jean Dubois')
    expect(en).toMatch(/can't be undone/i)
    expect(en).toContain(confirmSuffix('en'))
  })
})

describe('deleteContactPreview', () => {
  it('distingue ce qui part de ce qui survit (rétention) et nomme le contact (FR/EN)', () => {
    const fr = deleteContactPreview('fr', 'Mme Vaucher')
    expect(fr).toContain('Mme Vaucher')
    expect(fr).toMatch(/KYC/)
    expect(fr).toMatch(/irréversible/i)
    expect(deleteContactPreview('en', 'Mme Vaucher')).toMatch(/KYC files/i)
  })
})

describe('libellés métier', () => {
  it('type KYC', () => {
    expect(kycTypeLabel('fr', 'buyer_pp')).toBe('acheteur, personne physique')
    expect(kycTypeLabel('en', 'seller_pm')).toBe('seller, company')
  })
  it('vigilance', () => {
    expect(vigilanceLabel('fr', 'renforced')).toBe('renforcée')
    expect(vigilanceLabel('en', 'renforced')).toBe('enhanced')
    expect(vigilanceLabel('en', 'standard')).toBe('standard')
  })
})

describe('prompts/résultats paramétrés', () => {
  it('confirmOpenKyc FR/EN', () => {
    const fr = confirmOpenKyc('fr', 'Jean Dubois', 'buyer_pp', 'standard')
    expect(fr).toContain('J\'ouvre un dossier KYC pour Jean Dubois')
    expect(fr).toContain('acheteur, personne physique')
    expect(fr).toContain('Tu confirmes ?')
    const en = confirmOpenKyc('en', 'Jean Dubois', 'seller_pm', 'renforced')
    expect(en).toContain('opening a KYC file for Jean Dubois')
    expect(en).toContain('seller, company')
    expect(en).toContain('enhanced due diligence')
    expect(en).toContain('Confirm?')
  })
  it('openKycResult inclut la source des fonds seulement en renforcé', () => {
    expect(openKycResult('fr', 'standard')).not.toContain('source des fonds')
    expect(openKycResult('fr', 'renforced')).toContain('source des fonds')
    expect(openKycResult('en', 'renforced')).toContain('source of funds')
  })
  it('confirmUpdatePipeline + who', () => {
    expect(confirmUpdatePipeline('en', pipelineWhoNamed('en', 'Marie'), 'Negotiation'))
      .toBe("I'll move Marie's file to « Negotiation ». Confirm? (reply « yes » / « no »)")
    expect(pipelineWhoNamed('fr', 'Marie')).toBe('le dossier de Marie')
  })
})
