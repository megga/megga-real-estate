// Invitation à rejoindre une agence — le premier contact du destinataire avec MEGGA.
//
// ⚠ Le gabarit d'origine interpolait `inviterName` et `agencyName` BRUTS dans le HTML :
// deux valeurs de saisie, dans un e-mail. C'est le premier invariant ci-dessous.
import { describe, it, expect } from 'vitest'
import { buildTeamInviteEmail } from '../../supabase/functions/_shared/team-invite-email'

const base = {
  inviterName: 'Gregory Lyonnet',
  agencyName: 'Régie du Rhône',
  role: 'manager',
  acceptUrl: 'https://app.megga.ch/accept-invite/jeton-abc',
}

describe('buildTeamInviteEmail', () => {
  it('⛔ échappe le nom de l’invitant et celui de l’agence', () => {
    const html = buildTeamInviteEmail({
      ...base, inviterName: '<script>alert(1)</script>', agencyName: 'Régie <img src=x> SA',
    }).html
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('⛔ AUCUNE pilule « Ouvrir mon espace » : le destinataire n’a pas ENCORE de compte', () => {
    // Raison différente des e-mails clients : ici le compte n'existe pas du tout, et
    // c'est le bouton du corps qui le crée. L'envoyer se connecter le ferait buter sur
    // des identifiants inexistants.
    expect(buildTeamInviteEmail(base).html).not.toContain('Ouvrir mon espace')
  })

  it('l’objet s’ouvre sur l’agence', () => {
    expect(buildTeamInviteEmail(base).subject).toMatch(/^Régie du Rhône/)
  })

  it('porte le rôle en clair, pas son code technique', () => {
    expect(buildTeamInviteEmail(base).html).toContain('Manager')
    expect(buildTeamInviteEmail({ ...base, role: 'assistant' }).html).toContain('Assistant')
  })

  it('un rôle inconnu s’affiche tel quel plutôt que de disparaître', () => {
    expect(buildTeamInviteEmail({ ...base, role: 'auditeur' }).html).toContain('auditeur')
  })

  it('porte le lien d’acceptation et l’expiration', () => {
    const html = buildTeamInviteEmail(base).html
    expect(html).toContain('https://app.megga.ch/accept-invite/jeton-abc')
    expect(html).toContain('expire dans 7 jours')
  })

  it('dit quoi faire si l’invitation n’était pas attendue', () => {
    expect(buildTeamInviteEmail(base).html).toContain('ignorez ce message')
  })

  it('porte l’habillage commun, jamais l’ancien wordmark', () => {
    const html = buildTeamInviteEmail(base).html
    expect(html).toContain('app.megga.ch/email/megga-logo-white.png')
    expect(html).not.toContain('Immobilier Suisse')
  })
})
