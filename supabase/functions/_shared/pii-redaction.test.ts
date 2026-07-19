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

  // Les résultats d'outils CRM réinjectés dans les boucles LLM sont du JSON COMPACT : plus rien
  // n'est blanc après une valeur. Une capture gloutonne (\S+) avalait le guillemet fermant puis
  // tout le reste du document — perte silencieuse d'enregistrements entiers.
  it('ne tronque plus le JSON compact : le reste du document survit', () => {
    const payload = JSON.stringify({
      contacts: [
        { id: '3f2a9c1e-77b4-4d21-9a55-0e1b2c3d4e5f', first_name: 'Marie', note: 'mdp: Hunter2' },
        { id: 'b2c3d4e5-6f70-4812-934a-5b6c7d8e9f01', first_name: 'Luc', last_name: 'Perret', note: 'RAS' },
      ],
      total: 2,
    })
    const out = redactPII(payload).redactedText

    expect(out).not.toContain('Hunter2')          // le secret est bien masqué
    expect(() => JSON.parse(out)).not.toThrow()   // …sans casser la structure
    expect(out).toContain('Perret')               // le 2e enregistrement survit
    expect(out).toContain('b2c3d4e5-6f70-4812-934a-5b6c7d8e9f01')
    expect(JSON.parse(out).total).toBe(2)
  })

  it('borne au guillemet seulement : un mot de passe à virgule reste couvert en entier', () => {
    // Exclure aussi `,;}]` fermerait le JSON de la même façon mais laisserait fuir la queue du
    // secret. Le guillemet suffit, et c'est le choix le plus sûr.
    for (const [input, secret] of [
      ['mdp: p@ss,word', 'p@ss,word'],
      ['mdp: p@ss}word', 'p@ss}word'],
      ['mdp: p@ss;word', 'p@ss;word'],
      ["mdp: p@ss'word", "p@ss'word"],
    ]) {
      const out = redactPII(input).redactedText
      expect(out, `fuite sur ${input}`).toBe('[REDACTED:PASSWORD]')
      expect(out).not.toContain(secret.split(/[,;}']/)[1])
    }
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

describe('ordre du catalogue — un motif à valeur libre ne doit pas désarmer les suivants', () => {
  // PASSWORD capture une valeur LIBRE, donc il peut avaler le token qui suit son marqueur.
  // Tant qu'il tournait AVANT CARD et DOB, ce token avalé fragmentait le secret d'après et le
  // rendait invisible au détecteur suivant. Ces tests épinglent l'ORDRE, pas le motif : ils
  // tombent si quelqu'un remonte PASSWORD dans le tableau PATTERNS.

  it('une date de naissance à la ligne suivante reste détectée', () => {
    // Avant correction : « [REDACTED:PASSWORD] le 12.03.1985 » — l'ancre « Né » mangée par la
    // capture (le \s* du séparateur traverse le saut de ligne), la date en clair.
    const r = redactPII('Mot de passe :\nNé le 12.03.1985')
    expect(r.redactedText).not.toContain('12.03.1985')
  })

  it('un numéro de carte à la ligne suivante reste détecté', () => {
    const r = redactPII('mdp :\n4111 1111 1111 1111')
    expect(r.redactedText).not.toContain('1111 1111 1111')
  })

  it('le cas nominal sur une seule ligne reste couvert', () => {
    // Garde-fou : la correction d'ordre ne doit pas coûter de vrai positif.
    expect(redactPII('mdp: hunter2').redactedText).not.toContain('hunter2')
    expect(redactPII('mot de passe :\nHunter2Geneve').redactedText).not.toContain('Hunter2Geneve')
  })
})

describe('redactPII — ACCESS_CODE (digicode, wifi, boîte à clés)', () => {
  // Le marqueur seul produirait des faux positifs : en note d'agent, « code d'accès : » sert
  // surtout à dire qui détient le code. C'est la CONTRAINTE DE FORME sur la valeur qui sépare
  // les deux usages — 3-12 caractères alphanumériques dont au moins un chiffre.

  it.each([
    'Digicode : 4521B',
    'Code d’accès : 78A45',
    'Code wifi : Chalet2026',
    'code du portail: 9981',
    'Code PIN = 4417',
    'Code de la boîte à clés : 7788',
  ])('marque un vrai code : %s', (input) => {
    const r = redactPII(input)
    expect(r.counts.ACCESS_CODE).toBe(1)
    expect(r.redactedText).toContain('[REDACTED:ACCESS_CODE]')
  })

  it.each([
    "Code d'accès : le propriétaire le donnera chez le notaire.",
    'Code wifi : la fibre n’est pas encore installée.',
    'Digicode : à demander à la régie.',
    "Code d'accès : à convenir avec la régie.",
    'Code wifi : demander au concierge.',
  ])('laisse intacte la prose logistique : %s', (input) => {
    const r = redactPII(input)
    expect(r.counts.ACCESS_CODE).toBe(0)
    expect(r.redactedText).toBe(input)
  })

  // Régression attrapée en revue : une première version du lookahead « au moins un chiffre »
  // utilisait [^ \t]*, qui traverse un deux-points. « Code d'accès : mdp:Hunter2024 » validait
  // alors « mdp » comme valeur de code, ACCESS_CODE avalait le marqueur de PASSWORD, et le mot
  // de passe partait EN CLAIR — la classe de panne même que ce catalogue documente.
  it.each([
    ["Code d'accès : mdp:Hunter2024", 'Hunter2024'],
    ['Code wifi : pwd:abc123', 'abc123'],
    ['Code du portail: password=Qwerty12', 'Qwerty12'],
    ["Code d'accès : mot de passe:Secret99", 'Secret99'],
  ])('ne mange pas le marqueur de PASSWORD : %s', (input, secret) => {
    const r = redactPII(input)
    expect(r.redactedText, `secret en clair sur « ${input} »`).not.toContain(secret)
    expect(r.counts.PASSWORD).toBe(1)
  })

  it('n’attrape PAS le marqueur « code » nu — un code postal n’est pas un secret', () => {
    // 48 des 155 phrases du corpus immobilier contiennent « code » (code postal, EGID, CO…),
    // et « Code : 1201 » est indiscernable d'un secret par la seule forme.
    for (const s of ['Code : 1201 pour les Pâquis.', 'Code postal : 1206', 'Code EGID : 302145']) {
      expect(redactPII(s).counts.ACCESS_CODE, `mordu sur ${s}`).toBe(0)
    }
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
    expect(formatRedactionSummary({ AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0, ACCESS_CODE: 0 })).toBe('')
    expect(formatRedactionSummary({ AVS: 2, IBAN: 1, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0, ACCESS_CODE: 0 })).toBe('AVS×2, IBAN×1')
  })
})
