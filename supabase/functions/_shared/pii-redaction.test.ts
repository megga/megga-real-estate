// supabase/functions/_shared/pii-redaction.test.ts
// Tests du layer PII redaction — le catalogue de motifs partagé par TOUS les sites de
// redaction (wa-agent-redaction/redactLlmMessages, copilot-redaction, agent-style, et les
// prompts autonomes de whatsapp-actions : prepare_meeting, email, annonce, groupe, OCR).
//
// Harnais : vitest (et non Deno.test comme à l'origine). La CI type-check bien les edge
// functions (`deno check`, gate bloquant de unit-tests.yml) mais la commande EXCLUT les
// *.test.ts, et aucun job n'exécute `deno test` : ce fichier était donc le SEUL des 45 specs
// de _shared à n'être ni exécuté ni même type-checké — et c'était précisément celui qui garde
// des motifs de sécurité. Il est désormais dans l'allowlist `include` de vitest.config.ts et
// tourne à chaque PR. Le module testé est du TS pur (regex, aucune API Deno, aucun import
// `https:`), donc il se charge tel quel sous Node.
//
// Ces tests sont déterministes (pures regex) : ils tournent sans réseau ni LLM.

import { describe, it, expect } from 'vitest'
import { redactPII, formatRedactionSummary } from './pii-redaction'

describe('redactPII — identifiants suisses', () => {
  it('AVS suisse format officiel', () => {
    const r = redactPII('Mon AVS est 756.1234.5678.90, merci.')
    expect(r.redactedText).toBe('Mon AVS est [REDACTED:AVS], merci.')
    expect(r.counts.AVS).toBe(1)
    expect(r.total).toBe(1)
  })

  it('AVS avec espaces et sans séparateurs', () => {
    expect(redactPII('AVS 756 1234 5678 90').counts.AVS).toBe(1)
    expect(redactPII('AVS 7561234567890').counts.AVS).toBe(1)
  })

  it('IBAN CH avec et sans espaces', () => {
    const r1 = redactPII('Versez sur CH93 0076 2011 6238 5295 7')
    expect(r1.counts.IBAN).toBe(1)
    expect(r1.redactedText).toContain('[REDACTED:IBAN]')
    expect(r1.redactedText).toContain('Versez sur')

    expect(redactPII('IBAN: CH9300762011623852957').counts.IBAN).toBe(1)
  })

  it('passeport CH 1 lettre + 7 chiffres, sans mordre sur une réf de bien', () => {
    expect(redactPII('Mon passeport: X1234567 (CH)').counts.PASSPORT).toBe(1)
    expect(redactPII('Référence du bien: MG-2026-101').counts.PASSPORT).toBe(0)
  })

  it('clés API typiques', () => {
    for (const c of [
      'sk-proj-abc123def456ghi789jkl',
      'AKIAIOSFODNN7EXAMPLE',
      'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456',
    ]) {
      expect(redactPII(`Token: ${c}`).counts.API_KEY, `échec sur ${c}`).toBe(1)
    }
  })

  it('date de naissance explicite seulement (une échéance n’est pas une DOB)', () => {
    expect(redactPII('Né le 12.03.1985').counts.DOB).toBe(1)
    expect(redactPII('Échéance : 30.06.2026 pour signer').counts.DOB).toBe(0)
  })
})

describe('redactPII — motif PASSWORD', () => {
  // Positifs : les tournures RÉELLES d'un mot de passe. Aucune ne doit régresser — c'est la
  // contrepartie du retrait de l'alternative `passe` nue.
  it.each([
    ['mot de passe: SuperSecret42!', 'SuperSecret42!'],
    ['mot de passe : hunter2', 'hunter2'],
    ['mot-de-passe=abc123', 'abc123'],
    ['motdepasse: xyz789', 'xyz789'],
    ['MOT DE PASSE : Secret1', 'Secret1'],
    ['mdp = mypass', 'mypass'],
    ['mdp: hunter2', 'hunter2'],
    ['password : 1234abcd', '1234abcd'],
    ['Password=Qwerty123', 'Qwerty123'],
    ['pwd:azerty', 'azerty'],
    ['PWD = root', 'root'],
  ])('marque %s et n’en laisse pas fuir la valeur', (input, secret) => {
    const r = redactPII(input)
    expect(r.counts.PASSWORD).toBe(1)
    expect(r.redactedText).not.toContain(secret)
    expect(r.redactedText).toContain('[REDACTED:PASSWORD]')
  })

  // Négatifs : en français « passe » est d'abord un VERBE. L'alternative nue mordait sur de la
  // prose courante d'agent immobilier et mutilait le texte envoyé au LLM (la capture (\S+)
  // avalait aussi le mot suivant). Ces cas sont la raison d'être du retrait.
  it.each([
    'dis-lui ce qui se passe: on attend le notaire',
    'dis-lui ce qui se passe : on attend le notaire',
    'dis-lui que le dossier passe: au notaire jeudi',
    'voilà ce qui se passe = rien de neuf',
    'explique ce qu’il se passe : la banque bloque',
    'le mandat passe : signature mardi',
    'tout se passe : bien pour le moment',
    'ce qui se passe:rien',
  ])('laisse intacte la prose française « %s »', (input) => {
    const r = redactPII(input)
    expect(r.counts.PASSWORD).toBe(0)
    expect(r.redactedText).toBe(input)
  })

  // Le vrai enjeu du retrait, au-delà du texte mutilé : PASSWORD tourne AVANT CARD et DOB dans
  // le catalogue, et le mot avalé par (\S+) fragmentait le secret SUIVANT — ce qui désarmait le
  // détecteur d'après. L'alternative nue était donc un danger, pas un filet.
  it('ne désarme plus CARD : un numéro de carte après « se passe : » est bien marqué', () => {
    const r = redactPII('ce qui se passe : 4111 1111 1111 1111 sur sa carte')
    expect(r.counts.CARD).toBe(1)
    // L'ancien motif laissait 12 chiffres en clair (CARD exige 13-19 chiffres : le reste
    // amputé de son premier groupe ne matchait plus).
    expect(r.redactedText).not.toContain('1111 1111 1111')
    expect(r.redactedText).toContain('[REDACTED:CARD]')
  })

  it('ne désarme plus DOB : une date de naissance après « se passe : » garde son ancre', () => {
    const r = redactPII('ce qui se passe : Né le 12.03.1985 selon la pièce')
    expect(r.counts.DOB).toBe(1)
    expect(r.redactedText).not.toContain('12.03.1985')
  })

  it('« mot de passe » reste couvert même collé à de la prose contenant « se passe »', () => {
    // Garde-fou d'alternance : le retrait de `passe` nu ne doit pas empêcher l'alternative
    // longue de matcher quand les deux tournures cohabitent dans le même message.
    const r = redactPII('Voilà ce qui se passe : je te donne le mot de passe: hunter2')
    expect(r.counts.PASSWORD).toBe(1)
    expect(r.redactedText).not.toContain('hunter2')
    expect(r.redactedText).toContain('ce qui se passe :')
  })
})

describe('redactPII — messages réalistes', () => {
  it('message Import Lead réaliste : aucune PII sensible, texte inchangé', () => {
    const text = `Bonjour Marie,

Je m'appelle Sophie Marchand, je cherche un 4 pièces dans les Eaux-Vives.
Budget aux alentours de 1.5M CHF. Mon mobile : +41 79 555 12 34
Email : sophie.marchand@example.com

Bien à vous,
Sophie`

    // Email + téléphone NE SONT PAS dans la liste — ils sont le résultat attendu de
    // l'extraction, pas une PII à scrubber.
    const r = redactPII(text)
    expect(r.total).toBe(0)
    expect(r.redactedText).toBe(text)
  })

  it('message piégé (AVS + IBAN + password) : tout est marqué, le nom reste', () => {
    const text = `Je m'appelle Test User.
AVS 756.1111.2222.33
Compte CH93 0076 2011 6238 5295 7
mdp: hunter2`

    const r = redactPII(text)
    expect(r.counts.AVS).toBe(1)
    expect(r.counts.IBAN).toBe(1)
    expect(r.counts.PASSWORD).toBe(1)
    expect(r.total).toBe(3)
    expect(r.redactedText).not.toContain('756.1111')
    expect(r.redactedText).not.toContain('CH93')
    expect(r.redactedText).not.toContain('hunter2')
    expect(r.redactedText).toContain('Test User') // pas une PII LBA
  })
})

describe('formatRedactionSummary', () => {
  it('vide vs renseigné', () => {
    expect(formatRedactionSummary({ AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0 })).toBe('')
    expect(formatRedactionSummary({ AVS: 2, IBAN: 1, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0 })).toBe('AVS×2, IBAN×1')
  })
})
