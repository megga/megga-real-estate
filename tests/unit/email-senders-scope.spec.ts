/**
 * Les expéditeurs pilotés par un agent passent par la garde de sortie, DANS L'ORDRE.
 *
 * ⛔ POURQUOI UNE GARDE SUR LA SOURCE, alors que `lint:edge-auth` existe déjà. Cette porte-là
 * vérifie qu'une garde d'AUTHENTIFICATION est importée. Elle était verte le 13.09.2026 sur
 * trois fonctions qui relayaient vers n'importe quelle adresse : authentifier l'appelant ne
 * dit rien de ce qu'on le laisse envoyer. Ce fichier tient la propriété que l'audit a
 * trouvée manquante : chaque expéditeur consulte `guardOutboundEmail` (périmètre →
 * suppression → quota) AVANT d'appeler Resend, et plus aucun d'eux n'accepte un document
 * HTML fourni par l'appelant.
 *
 * Remplace `email-repli-html.spec.ts`, dont l'échéance (15.09.2026) est ainsi tenue deux
 * jours avant terme : le repli `data.html` est retiré, et sa garde avec lui.
 *
 * ⚠ LA RELANCE A DEUX PORTES ET UN SEUL ENVOI (14.09.2026). `send-relance-email` (le CRM, sous
 * le JWT d'un agent) et l'exécuteur WhatsApp `executeSendClientEmail` (le « oui » de l'agent au
 * copilote) appellent tous deux `_shared/relance-email-send.ts`, qui porte la garde et l'appel
 * à Resend. L'exécuteur passait par l'edge, en HTTP sous la clé de service : 401 à chaque
 * « oui », l'edge exigeant un agent. D'où deux lectures : la garde dans le MODULE, l'agence et
 * l'agent dans chaque PORTE. Le comportement est éprouvé par
 * supabase/functions/_shared/relance-email-send.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
// @ts-expect-error — helper Node de `scripts/` : pas de types, et c'est voulu (CLAUDE.md §4).
import { lexer } from '../../scripts/_shared/edge-guard-order.mjs'

const lex = lexer as (source: string) => { code: string; masque: string }

/** Les expéditeurs qui appellent Resend EUX-MÊMES : la garde se lit dans leur index.ts. */
const EXPEDITEURS = ['send-email', 'send-property-email'] as const

function lire(chemin: string): string {
  const lu = readFileSafely(repoPath(chemin))
  return lu.status === 'ok' ? lu.value : ''
}

function source(fn: string): string {
  return lire(`supabase/functions/${fn}/index.ts`)
}

/** Le code seul — commentaires blanchis, chaînes intactes : une note n'appelle rien. */
const code = (chemin: string): string => lex(lire(chemin)).code

/** Texte des arguments du premier appel `nom(`, parenthèses équilibrées sur le masque. */
function argumentsDe(chemin: string, nom: string): string {
  const { code: c, masque } = lex(lire(chemin))
  const m = new RegExp(`(?<![\\w$.])${nom}\\s*\\(`).exec(masque)
  if (!m) return ''
  const debut = m.index + m[0].length
  let prof = 1
  for (let j = debut; j < masque.length; j++) {
    if (masque[j] === '(') prof++
    else if (masque[j] === ')' && --prof === 0) return c.slice(debut, j)
  }
  return ''
}

describe('expéditeurs e-mail pilotés par un agent', () => {
  for (const fn of EXPEDITEURS) {
    describe(fn, () => {
      const src = source(fn)

      // Contrôle positif : un fichier illisible rendrait toutes les clauses vertes pour la
      // pire des raisons.
      it('a une source lisible', () => {
        expect(src.length, `${fn}/index.ts illisible`).toBeGreaterThan(1000)
      })

      it('importe la garde de sortie depuis _shared/email-recipient.ts', () => {
        expect(src).toMatch(/import \{[^}]*\bguardOutboundEmail\b[^}]*\} from '\.\.\/_shared\/email-recipient\.ts'/)
      })

      it('consulte la garde AVANT l’appel Resend', () => {
        const garde = src.indexOf('guardOutboundEmail(')
        const resend = src.indexOf('https://api.resend.com/emails')
        expect(garde, 'guardOutboundEmail( absent').toBeGreaterThan(-1)
        expect(resend, 'appel Resend absent').toBeGreaterThan(-1)
        expect(garde, 'la garde doit précéder l’appel Resend').toBeLessThan(resend)
      })

      it('juge le périmètre sur l’agence de l’appelant, jamais sur le corps', () => {
        // Le contexte passé à la garde vient de requireAgentAuth (`profile.agency_id`).
        expect(src).toMatch(/agencyId:\s*(?:auth\.)?profile\.agency_id/)
      })

      it('n’accepte plus de document HTML fourni par l’appelant', () => {
        expect(src).not.toMatch(/data\.html/)
      })
    })
  }
})

const MODULE_RELANCE = 'supabase/functions/_shared/relance-email-send.ts'

describe('la relance — un seul envoi, dans _shared/relance-email-send.ts', () => {
  const src = code(MODULE_RELANCE)

  it('a une source lisible', () => {
    expect(src.length, `${MODULE_RELANCE} illisible`).toBeGreaterThan(1000)
  })

  it('importe la garde de sortie depuis ./email-recipient.ts', () => {
    expect(src).toMatch(/import \{[^}]*\bguardOutboundEmail\b[^}]*\} from '\.\/email-recipient\.ts'/)
  })

  it('consulte la garde AVANT l’appel Resend', () => {
    const garde = src.indexOf('guardOutboundEmail(')
    const resend = src.indexOf('https://api.resend.com/emails')
    expect(garde, 'guardOutboundEmail( absent').toBeGreaterThan(-1)
    expect(resend, 'appel Resend absent').toBeGreaterThan(-1)
    expect(garde, 'la garde doit précéder l’appel Resend').toBeLessThan(resend)
  })

  it('juge en finalité « relance » : un STOP la bloque, un transactionnel passerait outre', () => {
    expect(argumentsDe(MODULE_RELANCE, 'guardOutboundEmail')).toMatch(/purpose:\s*'relance'/)
  })

  it('compose le HTML lui-même, par le gabarit — jamais celui de l’appelant', () => {
    expect(src).toMatch(/const \{ html \} = buildRelanceEmail\(/)
    expect(src).not.toMatch(/data\.html/)
  })
})

/** Les deux portes de la relance, et le contexte VÉRIFIÉ que chacune doit passer. */
const PORTES = [
  {
    nom: 'send-relance-email (le CRM, JWT d’agent)',
    chemin: 'supabase/functions/send-relance-email/index.ts',
    importe: /import \{[^}]*\bsendRelanceEmail\b[^}]*\} from '\.\.\/_shared\/relance-email-send\.ts'/,
    agence: /agencyId:\s*profile\.agency_id\b/,
    acteur: /actorId:\s*auth\.user\.id\b/,
    expediteur: 'send-relance-email',
  },
  {
    nom: 'executeSendClientEmail (le « oui » WhatsApp, lien vérifié)',
    chemin: 'supabase/functions/_shared/whatsapp-actions.ts',
    importe: /import \{[^}]*\bsendRelanceEmail\b[^}]*\} from '\.\/relance-email-send\.ts'/,
    agence: /agencyId:\s*ctx\.agencyId\b/,
    acteur: /actorId:\s*ctx\.profileId\b/,
    expediteur: 'whatsapp-webhook',
  },
] as const

describe('la relance — ses deux portes', () => {
  for (const p of PORTES) {
    describe(p.nom, () => {
      const src = code(p.chemin)
      const args = argumentsDe(p.chemin, 'sendRelanceEmail')

      it('a une source lisible, et appelle le module de relance', () => {
        expect(src.length, `${p.chemin} illisible`).toBeGreaterThan(1000)
        expect(src).toMatch(p.importe)
        expect(args, 'appel sendRelanceEmail( absent').not.toBe('')
      })

      it('passe l’agence et l’agent de son contexte VÉRIFIÉ, et se nomme', () => {
        expect(args).toMatch(p.agence)
        expect(args).toMatch(p.acteur)
        expect(args).toContain(`sender: '${p.expediteur}'`)
      })

      it('n’appelle pas Resend lui-même', () => {
        expect(src).not.toContain('api.resend.com')
      })
    })
  }

  it('le CRM : la garde d’agent précède l’envoi', () => {
    const src = code(PORTES[0].chemin)
    const garde = src.indexOf('requireAgentAuth(')
    expect(garde, 'requireAgentAuth( absent').toBeGreaterThan(-1)
    expect(garde).toBeLessThan(src.indexOf('sendRelanceEmail('))
  })

  it('⛔ le « oui » WhatsApp ne passe plus par l’edge send-relance-email', () => {
    // Le défaut du 13.09.2026 : `fetch(urlFonction(…, 'send-relance-email'))` sous la clé de
    // service, refusé en 401 par requireAgentAuth. La classe entière est tenue par
    // tests/unit/appels-internes-cle-service.spec.ts ; ce cas-ci est nommé pour mémoire.
    expect(code(PORTES[1].chemin)).not.toContain("'send-relance-email'")
  })
})
