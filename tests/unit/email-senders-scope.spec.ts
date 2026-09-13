/**
 * Les trois expéditeurs pilotés par un agent passent par la garde de sortie, DANS L'ORDRE.
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
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

const EXPEDITEURS = ['send-email', 'send-property-email', 'send-relance-email'] as const

function source(fn: string): string {
  const lu = readFileSafely(repoPath(`supabase/functions/${fn}/index.ts`))
  return lu.status === 'ok' ? lu.value : ''
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

/**
 * ⛔ La fiche bien partait signée « Gregory Lyonnet · +41 22 000 00 00 » pour TOUTE agence
 * (13.09.2026) : l'appelant n'envoyait pas de nom, et le hook comblait avec celui-là. La
 * signature se lit désormais dans le profil de l'appelant ; ces clauses empêchent qu'elle
 * redevienne une saisie libre, ou qu'un nom de repli revienne côté client.
 */
describe('send-property-email — la signature vient du profil de l’appelant', () => {
  const src = source('send-property-email')
  const hook = readFileSafely(repoPath('src/hooks/useSendEmail.ts'))
  const hookSrc = hook.status === 'ok' ? hook.value : ''

  it('lit le nom et le téléphone dans `profiles`, pour l’utilisateur authentifié', () => {
    expect(src).toMatch(/\.from\('profiles'\)\s*\.select\('full_name, phone'\)\s*\.eq\('id', auth\.user\.id\)/)
  })

  it('n’utilise jamais un nom ou un téléphone lu dans le corps de la requête', () => {
    expect(src).not.toMatch(/body\.agent(?:Name|Phone)/)
    expect(src).not.toMatch(/\.\.\.body/)
  })

  it('le hook client n’invente plus de signataire', () => {
    expect(hookSrc.length, 'useSendEmail.ts illisible').toBeGreaterThan(500)
    // Le CODE, pas la prose : l'en-tête du hook raconte le défaut en le citant.
    const code = hookSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/agentName|agentPhone|Gregory|\+41 22 000/)
  })
})
