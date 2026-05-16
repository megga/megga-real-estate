// supabase/functions/_shared/pii-redaction.test.ts
// Tests Deno pour le layer PII redaction.
//
// Exécution locale : `deno test --allow-all supabase/functions/_shared/pii-redaction.test.ts`
//
// Ces tests sont déterministes (pures regex). Ils tournent indépendamment
// du LLM et garantissent qu'on ne régresse pas sur les patterns critiques
// (AVS, IBAN, mots de passe) qui ne doivent JAMAIS être envoyés à Claude.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { redactPII, formatRedactionSummary } from './pii-redaction.ts'

Deno.test('redactPII — AVS suisse format officiel', () => {
  const r = redactPII('Mon AVS est 756.1234.5678.90, merci.')
  assertEquals(r.redactedText, 'Mon AVS est [REDACTED:AVS], merci.')
  assertEquals(r.counts.AVS, 1)
  assertEquals(r.total, 1)
})

Deno.test('redactPII — AVS avec espaces et sans séparateurs', () => {
  const r1 = redactPII('AVS 756 1234 5678 90')
  assertEquals(r1.counts.AVS, 1)

  const r2 = redactPII('AVS 7561234567890')
  assertEquals(r2.counts.AVS, 1)
})

Deno.test('redactPII — IBAN CH avec et sans espaces', () => {
  const r1 = redactPII('Versez sur CH93 0076 2011 6238 5295 7')
  assertEquals(r1.counts.IBAN, 1)
  // L'IBAN doit être remplacé, et le reste du texte préservé
  assertEquals(r1.redactedText.includes('[REDACTED:IBAN]'), true)
  assertEquals(r1.redactedText.includes('Versez sur'), true)

  const r2 = redactPII('IBAN: CH9300762011623852957')
  assertEquals(r2.counts.IBAN, 1)
})

Deno.test('redactPII — mot de passe avec différents marqueurs FR/EN', () => {
  const cases = [
    'mot de passe: SuperSecret42!',
    'mdp = mypass',
    'password : 1234abcd',
    'pwd:azerty',
  ]
  for (const c of cases) {
    const r = redactPII(c)
    assertEquals(r.counts.PASSWORD, 1, `Échec sur: ${c}`)
    assertEquals(
      r.redactedText.toLowerCase().includes('superpass') ||
      r.redactedText.toLowerCase().includes('mypass') ||
      r.redactedText.toLowerCase().includes('1234abcd') ||
      r.redactedText.toLowerCase().includes('azerty'),
      false,
      `Mot de passe leakage sur: ${c}`,
    )
  }
})

Deno.test('redactPII — passeport CH 1 lettre + 7 chiffres', () => {
  const r = redactPII("Mon passeport: X1234567 (CH)")
  assertEquals(r.counts.PASSPORT, 1)

  // Faux positif à éviter : ref propriété ne contenant pas le mot "passeport"
  const safe = redactPII('Référence du bien: MG-2026-101')
  assertEquals(safe.counts.PASSPORT, 0)
})

Deno.test('redactPII — clés API typiques', () => {
  const cases = [
    'sk-proj-abc123def456ghi789jkl',
    'AKIAIOSFODNN7EXAMPLE',
    'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456',
  ]
  for (const c of cases) {
    const r = redactPII(`Token: ${c}`)
    assertEquals(r.counts.API_KEY, 1, `Échec sur: ${c}`)
  }
})

Deno.test('redactPII — date de naissance explicite seulement', () => {
  const r1 = redactPII('Né le 12.03.1985')
  assertEquals(r1.counts.DOB, 1)

  // Date neutre (deadline projet) ne doit PAS être scrubée
  const r2 = redactPII('Échéance : 30.06.2026 pour signer')
  assertEquals(r2.counts.DOB, 0)
})

Deno.test('redactPII — message Import Lead réaliste (aucune PII sensible)', () => {
  const text = `Bonjour Marie,

Je m'appelle Sophie Marchand, je cherche un 4 pièces dans les Eaux-Vives.
Budget aux alentours de 1.5M CHF. Mon mobile : +41 79 555 12 34
Email : sophie.marchand@example.com

Bien à vous,
Sophie`

  const r = redactPII(text)
  // Email + téléphone NE SONT PAS dans la liste — ils sont le résultat
  // attendu de l'extraction, pas une PII à scrubber.
  assertEquals(r.total, 0)
  assertEquals(r.redactedText, text)
})

Deno.test('redactPII — message piégé (AVS + IBAN + password)', () => {
  const text = `Je m'appelle Test User.
AVS 756.1111.2222.33
Compte CH93 0076 2011 6238 5295 7
mdp: hunter2`

  const r = redactPII(text)
  assertEquals(r.counts.AVS, 1)
  assertEquals(r.counts.IBAN, 1)
  assertEquals(r.counts.PASSWORD, 1)
  assertEquals(r.total, 3)

  // Aucune donnée sensible ne doit subsister
  assertEquals(r.redactedText.includes('756.1111'), false)
  assertEquals(r.redactedText.includes('CH93'), false)
  assertEquals(r.redactedText.includes('hunter2'), false)

  // Le nom reste (pas une PII LBA)
  assertEquals(r.redactedText.includes('Test User'), true)
})

Deno.test('formatRedactionSummary — vide vs renseigné', () => {
  assertEquals(
    formatRedactionSummary({ AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0 }),
    '',
  )
  assertEquals(
    formatRedactionSummary({ AVS: 2, IBAN: 1, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0 }),
    'AVS×2, IBAN×1',
  )
})
