/**
 * « Rapprocher l'adresse » vise un correspondant EXTERNE du fil, jamais la boîte — et un
 * refus de l'edge se lit à l'écran.
 *
 * ⛔ Mesuré le 13.09.2026 : sur un fil sans message entrant (dossier « Envoyés »), le bandeau
 * visait l'expéditeur du PREMIER message, c'est-à-dire la boîte elle-même. La rapprocher
 * apprenait « adresse de la boîte → contact » à toute l'agence. L'edge la refuse désormais
 * (`email_not_in_thread`, `_shared/mail/ingest.ts` `linkThreadToContact`) ; sans ce correctif
 * d'écran, le geste passait d'un succès nuisible à un échec muet — la modale ne lisait aucune
 * erreur.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cibleDeRattachement } from '@/lib/mail/format'
import { repoPath } from './helpers/fs-scan'

const BOX = 'contact@agence.ch'
const entrant = (email: string, name: string | null = null) => ({ direction: 'inbound', from_email: email, from_name: name })
const sortant = () => ({ direction: 'outbound', from_email: BOX, from_name: 'Agence' })

describe('Messagerie — la cible de « Rapprocher l’adresse »', () => {
  it('l’expéditeur du dernier message entrant', () => {
    expect(cibleDeRattachement([entrant('a@ex.ch'), sortant(), entrant('zoe@ex.ch', 'Zoé')], [], BOX)).toEqual({ name: 'Zoé', email: 'zoe@ex.ch' })
  })

  it('un fil sans entrant : le premier participant externe, JAMAIS la boîte', () => {
    const cible = cibleDeRattachement([sortant(), sortant()], [{ name: 'Agence', email: 'CONTACT@agence.ch' }, { name: 'Me Tiers', email: 'notaire@etude.ch' }], BOX)
    expect(cible).toEqual({ name: 'Me Tiers', email: 'notaire@etude.ch' })
  })

  it('aucun correspondant externe : pas de bandeau', () => {
    expect(cibleDeRattachement([sortant()], [{ name: null, email: BOX }], BOX)).toBeNull()
  })

  it('un « entrant » venu de la boîte elle-même ne la désigne pas', () => {
    expect(cibleDeRattachement([entrant(BOX.toUpperCase())], [{ name: null, email: 'zoe@ex.ch' }], BOX)).toEqual({ name: null, email: 'zoe@ex.ch' })
  })

  // Un alias d'envoi (« envoyer en tant que ») n'est pas la boîte, mais c'est NOUS : l'edge le
  // refuse (`email_is_internal`), le bandeau ne doit pas le proposer.
  it('un alias d’envoi n’est jamais la cible, ni en participant ni en copie de soi-même', () => {
    const alias = { direction: 'outbound', from_email: 'Info@Agence.ch', from_name: 'Agence' }
    expect(cibleDeRattachement([alias], [{ name: 'Agence', email: 'info@agence.ch' }, { name: 'Me Tiers', email: 'notaire@etude.ch' }], BOX))
      .toEqual({ name: 'Me Tiers', email: 'notaire@etude.ch' })
    // L'agent en Cc de lui-même : la copie reçue est un ENTRANT venu de l'alias.
    expect(cibleDeRattachement([entrant('zoe@ex.ch', 'Zoé'), alias, entrant('info@agence.ch')], [], BOX)).toEqual({ name: 'Zoé', email: 'zoe@ex.ch' })
  })
})

describe('Messagerie — l’écran lit la cible et le refus', () => {
  const lire = (f: string) => readFileSync(repoPath(f), 'utf8')

  it('le bandeau vise cibleDeRattachement, plus l’expéditeur du premier message', () => {
    const reader = lire('src/components/crm/messagerie/MailReader.tsx')
    expect(reader).toMatch(/cibleDeRattachement\(p\.messages, p\.thread\.participants/)
    expect(reader).toContain('p.onLinkContact(cible.email, cible.name)')
    expect(reader).not.toContain("p.onLinkContact(inboundLast.from_email")
  })

  it('la modale affiche le refus de l’edge, et l’erreur ne survit pas à la fermeture', () => {
    const modale = lire('src/components/crm/messagerie/MailLinkContactModal.tsx')
    expect(modale).toMatch(/role="alert"[\s\S]{0,200}mail\.link\.error\./)
    const app = lire('src/components/crm/messagerie/MessagerieApp.tsx')
    expect(app).toContain('error={actions.linkContact.error?.message ?? null}')
    expect(app).toContain('actions.linkContact.reset()')
  })

  it('les refus connus ont un texte dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const j = JSON.parse(lire(`src/i18n/locales/${langue}/messages.json`)) as { mail: { link: { error?: Record<string, string> } } }
      for (const code of ['email_not_in_thread', 'email_is_internal', 'contact_not_in_agency', 'generic']) {
        expect(j.mail.link.error?.[code], `${langue} : mail.link.error.${code}`).toBeTruthy()
      }
    }
  })
})
