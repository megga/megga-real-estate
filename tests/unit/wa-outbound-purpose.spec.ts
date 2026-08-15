/**
 * Le LECTEUR de la porte `lint:whatsapp-outbound`, éprouvé.
 *
 * POURQUOI CE BANC EXISTE. La porte rendait vert sur 13 appels, et ce vert n'était pas
 * gagné : son lecteur de ternaire perdait une branche sur un ternaire imbriqué, si bien
 * qu'une finalité RÉSERVÉE (`opt_out_ack`, `lpd_notice`) pouvait s'émettre depuis n'importe
 * quel fichier sans que la porte le voie. Une porte de conformité sans banc ne prouve que
 * l'absence de la forme qu'elle sait lire.
 *
 * Les cas marqués ⛔ RÉGRESSION échouaient avant le correctif du 15.08.2026.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — helper Node de `scripts/` : pas de types, et c'est voulu (CLAUDE.md §4).
import { purposeLisible, valeurDe, corpsArguments, sansCommentaires } from '../../scripts/_shared/wa-outbound-purpose.mjs'

describe('purposeLisible — ce qui est lisible statiquement', () => {
  it('accepte un littéral du domaine, et lui seul', () => {
    expect(purposeLisible("'service'")).toEqual(['service'])
    expect(purposeLisible("  'opt_out_ack'  ")).toEqual(['opt_out_ack'])
    // Hors domaine : un `purpose` inventé doit rougir, pas passer pour lisible.
    expect(purposeLisible("'broadcast'")).toBeNull()
  })

  it('refuse toute expression opaque — c’est la propriété que la porte protège', () => {
    for (const e of ['p', 'opts.purpose', 'PURPOSES[i]', 'getPurpose()', '`service`', '']) {
      expect(purposeLisible(e), e).toBeNull()
    }
  })

  it('accepte un ternaire de littéraux et ÉNUMÈRE ses deux valeurs', () => {
    // Forme réellement présente au dépôt (whatsapp-webhook, envoi de template).
    expect(purposeLisible("key === 'new_listings' ? 'marketing' : 'utility'"))
      .toEqual(['marketing', 'utility'])
  })

  it('refuse un ternaire dont UNE branche est opaque', () => {
    expect(purposeLisible("cond ? p : 'service'")).toBeNull()
    expect(purposeLisible("cond ? 'service' : p")).toBeNull()
  })

  it('⛔ RÉGRESSION — un ternaire IMBRIQUÉ rend TOUTES ses branches', () => {
    // L'ancien lecteur (regex `^(.+?)\?([^?:]+):([^?:]+)$`) s'accrochait au DERNIER `?` et
    // rendait ['utility','marketing'] : `opt_out_ack` disparaissait, donc échappait au
    // contrôle de réservation. C'était un laissez-passer, pas un blocage.
    expect(purposeLisible("a ? 'opt_out_ack' : b ? 'utility' : 'marketing'"))
      .toEqual(['opt_out_ack', 'utility', 'marketing'])
    // Et l'imbrication ne doit pas non plus servir à cacher une branche opaque.
    expect(purposeLisible("a ? 'service' : b ? p : 'marketing'")).toBeNull()
  })

  it('ne confond pas `?.` ni `??` avec un ternaire', () => {
    expect(purposeLisible("a?.b ? 'service' : 'utility'")).toEqual(['service', 'utility'])
    expect(purposeLisible("(a ?? b) ? 'service' : 'utility'")).toEqual(['service', 'utility'])
    // `??` seul n'énumère rien : une des deux valeurs est opaque.
    expect(purposeLisible("p ?? 'service'")).toBeNull()
  })

  it('ne se laisse pas découper par un `?` ou un `:` DANS une chaîne', () => {
    expect(purposeLisible("x === 'a:b' ? 'service' : 'utility'")).toEqual(['service', 'utility'])
    expect(purposeLisible("x === 'q?' ? 'service' : 'utility'")).toEqual(['service', 'utility'])
  })

  it('refuse un ternaire mutilé plutôt que d’en deviner la moitié', () => {
    expect(purposeLisible("cond ? 'service'")).toBeNull()
    expect(purposeLisible("cond ? 'service' : 'utility")).toBeNull()   // chaîne non close
  })
})

describe('valeurDe — la valeur d’une propriété, jusqu’à la virgule de premier niveau', () => {
  it('lit une valeur simple et s’arrête à la bonne virgule', () => {
    expect(valeurDe("admin, to: '4179', purpose: 'service', contactId: null", 'purpose'))
      .toBe("'service'")
  })

  it('⛔ RÉGRESSION — une virgule DANS la condition ne coupe plus l’expression', () => {
    // L'ancienne capture `[^\n,}]+` rendait `f(a` : la porte refusait du code correct, et
    // un blocage abusif est la seconde façon de perdre une porte (on la contourne).
    expect(valeurDe("purpose: f(a, b) ? 'service' : 'utility', contactId: null", 'purpose'))
      .toBe("f(a, b) ? 'service' : 'utility'")
  })

  it('⛔ RÉGRESSION — une expression sur PLUSIEURS LIGNES est lue en entier', () => {
    const corps = "\n  to: p,\n  purpose: cond\n    ? 'marketing'\n    : 'utility',\n  agencyId: a,\n"
    expect(purposeLisible(valeurDe(corps, 'purpose'))).toEqual(['marketing', 'utility'])
  })

  it('ignore une accolade imbriquée dans une autre propriété', () => {
    const corps = "payload: { type: 'text', body: 'x' }, purpose: 'utility', retry: true"
    expect(valeurDe(corps, 'purpose')).toBe("'utility'")
  })

  it('rend null quand la propriété est absente', () => {
    expect(valeurDe("to: p, contactId: null", 'purpose')).toBeNull()
  })

  it('⛔ RÉGRESSION — un `purpose:` IMBRIQUÉ ne fait pas écran au vrai', () => {
    // Mesuré : une regex sur tout le corps s'accroche au premier `purpose:` de n'importe
    // quelle profondeur. Il suffisait donc d'écrire un leurre pour que la porte valide
    // `'service'` et ne voie jamais `opt_out_ack` — la finalité qui écrit à un numéro BLOQUÉ,
    // émise depuis n'importe quel fichier, porte au vert.
    const corps = "admin, meta: { purpose: 'service', src: 'x' }, purpose: 'opt_out_ack', payload: { type: 'text' }"
    expect(valeurDe(corps, 'purpose')).toBe("'opt_out_ack'")
  })
})

describe('sansCommentaires — blanchir les notes sans casser les chaînes', () => {
  it('⛔ RÉGRESSION — un `//` DANS une chaîne n’est pas un commentaire', () => {
    // Le blanchiment naïf coupait `'https://cdn.megga.ch/a.jpg'` après `https:` et laissait
    // un guillemet orphelin. Le lecteur, lui, SAIT lire les chaînes : il butait alors sur une
    // chaîne non close et refusait un appel parfaitement correct — le blocage de code juste
    // que la réécriture devait précisément fermer, réintroduit par une autre porte.
    const src = "const u = 'https://cdn.megga.ch/a.jpg'  // une vraie note\nconst v = 1"
    const out = sansCommentaires(src)
    expect(out).toContain("'https://cdn.megga.ch/a.jpg'")
    expect(out).not.toContain('une vraie note')
    expect(out.split('\n')).toHaveLength(2)          // les lignes sont préservées
    expect(out.split('\n')[0]).toHaveLength(src.split('\n')[0].length)  // …et leur longueur
  })

  it('blanchit les notes de bloc sans toucher au code, et ne se laisse pas ouvrir depuis une chaîne', () => {
    expect(sansCommentaires('a /* note */ b')).toBe('a            b')
    expect(sansCommentaires("const s = '/* pas une note */'")).toBe("const s = '/* pas une note */'")
  })

  it('un appel dont un argument porte une URL reste LISIBLE de bout en bout', () => {
    const src = "await sendOutboundGuarded({ to, purpose: 'utility', payload: { type: 'image', url: 'https://cdn.megga.ch/a.jpg' } }) // envoi\n"
    const txt = sansCommentaires(src)
    const corps = corpsArguments(txt, txt.indexOf('(') + 1)
    expect(corps).not.toBeNull()
    expect(purposeLisible(valeurDe(corps, 'purpose'))).toEqual(['utility'])
  })
})

describe('corpsArguments — l’objet passé en ligne, ou rien', () => {
  it('rend le CORPS du littéral, accolades exclues, et s’arrête à l’accolade qui équilibre', () => {
    const txt = "sendOutboundGuarded({ a: 1, b: { c: 2 } }) ; suite()"
    const i = txt.indexOf('(') + 1
    expect(corpsArguments(txt, i)).toBe(" a: 1, b: { c: 2 } ")
  })

  it('⛔ RÉGRESSION — un appel SANS littéral en ligne est signalé, pas ignoré', () => {
    // `sendOutboundGuarded(args)` échappait entièrement à l'ancienne détection : ni compté,
    // ni contrôlé. Rendre `null` fait de ce cas une violation explicite.
    const txt = 'sendOutboundGuarded(args)'
    expect(corpsArguments(txt, txt.indexOf('(') + 1)).toBeNull()
  })

  it('n’est pas trompé par une accolade citée dans une chaîne', () => {
    const txt = "sendOutboundGuarded({ body: 'accolade } isolée', purpose: 'service' })"
    const corps = corpsArguments(txt, txt.indexOf('(') + 1)
    expect(valeurDe(corps, 'purpose')).toBe("'service'")
  })
})
