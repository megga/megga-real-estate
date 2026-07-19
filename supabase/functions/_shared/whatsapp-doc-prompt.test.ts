// Invariant « aucune PII sensible vers DeepSeek » sur la lecture de document (read_document /
// file_document) — dernière frontière DeepSeek de la famille prepare_meeting → email/annonce/groupe.
//
// Ce que ce spec protège vraiment : l'OCR d'un mandat ou d'un relevé bancaire part au LLM. Sans
// épinglage, un futur refactor qui remet une troncature avant la redaction (ou qui retire la
// redaction) passerait deno check ET la CI sans que rien ne le signale.

import { describe, it, expect } from 'vitest'
import { buildDocReadPrompt } from './whatsapp-doc-prompt'
import { redactPII } from './pii-redaction'

const RELEVE = [
  'BANQUE CANTONALE DE GENÈVE — Relevé de compte',
  'Titulaire : Marie Dupont, Rue du Rhône 42, 1204 Genève',
  'IBAN CH93 0076 2011 6238 5295 7',
  'N° AVS 756.1234.5678.90',
  'Solde au 30.06.2026 : CHF 128’450.00',
  'Virement du 12.03.2026 — acompte vente Champel : CHF 45’000.00',
].join('\n')

describe('buildDocReadPrompt — redaction PII de la lecture de document', () => {
  it('marque IBAN et AVS, et ne laisse aucune valeur brute dans le prompt', () => {
    const prompt = buildDocReadPrompt({ ocrText: RELEVE, focus: null, lang: 'fr' })
    expect(prompt).toContain('[REDACTED:IBAN]')
    expect(prompt).toContain('[REDACTED:AVS]')
    expect(prompt).not.toContain('CH93')
    expect(prompt).not.toContain('756.1234')
  })

  it('laisse intact ce dont la lecture a besoin : parties, montants, dates', () => {
    // La contrepartie assumée du marquage : le digest reste utile à l'agent. Si un jour un
    // pattern se met à mordre sur les CHF ou les dates DD.MM.YYYY, ce test tombe.
    const prompt = buildDocReadPrompt({ ocrText: RELEVE, focus: null, lang: 'fr' })
    expect(prompt).toContain('Marie Dupont')
    expect(prompt).toContain('CHF 128’450.00')
    expect(prompt).toContain('30.06.2026')
    expect(prompt).toContain('acompte vente Champel')
  })

  it('rédige AVANT de tronquer : un IBAN à cheval sur la borne ne fuit pas par fragment', () => {
    // Le piège central de toute la famille. Le décalage est choisi avec soin : l'IBAN démarre à
    // l'index 7991, donc seul « CH93 0076 » survit à la troncature — 4 caractères après le
    // préfixe pays, trop peu pour que le pattern IBAN (qui en exige 11+) rattrape le fragment.
    // Avec un décalage plus petit, le reste tronqué serait ENCORE assez long pour matcher, et le
    // test passerait même sur le code bogué : c'est ainsi qu'une première version de ce test
    // était VACUOUS. Ne pas changer 7990 sans revérifier le contrôle ci-dessous.
    const ocrText = 'a'.repeat(7990) + ' CH93 0076 2011 6238 5295 7 fin du document'

    // CONTRÔLE — l'ordre inverse (tronquer PUIS rédiger) laisse bien « CH93 » en clair. Cette
    // assertion est ce qui rend le test discriminant : si elle tombe, c'est le test qu'il faut
    // corriger, pas le code.
    expect(redactPII(ocrText.slice(0, 8000)).redactedText).toContain('CH93')

    expect(buildDocReadPrompt({ ocrText, focus: null, lang: 'fr' })).not.toContain('CH93')
  })

  it('rédige aussi la consigne de l’agent (focus)', () => {
    const prompt = buildDocReadPrompt({
      ocrText: 'Mandat de vente.',
      focus: 'vérifie que le compte CH93 0076 2011 6238 5295 7 correspond',
      lang: 'fr',
    })
    expect(prompt).toContain('CONSIGNE de l')
    expect(prompt).toContain('[REDACTED:IBAN]')
    expect(prompt).not.toContain('CH93')
  })

  it('borne la part OCR du prompt (anti-explosion de tokens)', () => {
    const prompt = buildDocReadPrompt({ ocrText: 'x'.repeat(50_000), focus: null, lang: 'fr' })
    const ocrPart = prompt.split('TEXTE OCR :\n')[1]
    expect(ocrPart).toHaveLength(8000)
  })

  it('sans focus : aucune ligne CONSIGNE parasite', () => {
    const prompt = buildDocReadPrompt({ ocrText: 'Attestation.', focus: null, lang: 'fr' })
    expect(prompt).not.toContain('CONSIGNE')
  })

  it('bascule la langue de sortie demandée (fr/en)', () => {
    expect(buildDocReadPrompt({ ocrText: 'x', focus: null, lang: 'en' })).toContain('anglais')
    expect(buildDocReadPrompt({ ocrText: 'x', focus: null, lang: 'fr' })).toContain('français')
  })

  it('idempotent : un texte déjà rédigé ne se re-marque pas en cascade', () => {
    // Le webhook peut un jour rédiger en amont ; la 2e passe doit être neutre.
    const once = buildDocReadPrompt({ ocrText: RELEVE, focus: null, lang: 'fr' })
    const ocrOnce = once.split('TEXTE OCR :\n')[1]
    const twice = buildDocReadPrompt({ ocrText: ocrOnce, focus: null, lang: 'fr' })
    expect(twice.split('TEXTE OCR :\n')[1]).toBe(ocrOnce)
  })
})
