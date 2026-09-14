// Invitation à rejoindre une agence — le premier contact du destinataire avec MEGGA.
//
// ⚠ Le gabarit d'origine interpolait `inviterName` et `agencyName` BRUTS dans le HTML :
// deux valeurs de saisie, dans un e-mail. C'est le premier invariant ci-dessous.
//
// ⚠ Et depuis le 14.09.2026, BORNÉES : tout inscrit choisit le nom de son agence solo, sans
// limite en base, et ce nom ouvre l'objet d'un e-mail signé DKIM getmegga.com.
import { describe, it, expect } from 'vitest'
import { buildTeamInviteEmail, nomAffichable, NOM_MAX } from '../../supabase/functions/_shared/team-invite-email'

const base = {
  inviterName: 'Gregory Lyonnet',
  agencyName: 'Régie du Rhône',
  role: 'manager',
  acceptUrl: 'https://app.getmegga.com/accept-invite/jeton-abc',
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
    expect(html).toContain('https://app.getmegga.com/accept-invite/jeton-abc')
    expect(html).toContain('expire dans 7 jours')
  })

  it('dit quoi faire si l’invitation n’était pas attendue', () => {
    expect(buildTeamInviteEmail(base).html).toContain('ignorez ce message')
  })

  it('porte l’habillage commun, jamais l’ancien wordmark', () => {
    const html = buildTeamInviteEmail(base).html
    expect(html).toContain('app.getmegga.com/email/megga-logo-white.png')
    expect(html).not.toContain('Immobilier Suisse')
  })
})

describe('nomAffichable — un nom saisi ne dicte ni la longueur ni les en-têtes', () => {
  const long = 'Votre compte est suspendu, confirmez vos identifiants sur la page qui suit '.repeat(8)

  it('⛔ borne l’agence et l’invitant à NOM_MAX caractères, dans l’objet ET dans le corps', () => {
    const { subject, html } = buildTeamInviteEmail({ ...base, agencyName: long, inviterName: long })
    const borne = nomAffichable(long)
    expect(Array.from(borne)).toHaveLength(NOM_MAX)
    expect(borne.endsWith('…')).toBe(true)
    expect(subject.startsWith(borne)).toBe(true)
    // Le texte complet n'apparaît nulle part : ni dans l'objet, ni dans le HTML.
    expect(subject).not.toContain(long.trim())
    expect(html).not.toContain(long.slice(0, NOM_MAX + 10))
    // Contrôle positif : la version bornée, elle, est bien affichée (agence et invitant).
    expect(html.split(borne).length - 1).toBeGreaterThanOrEqual(3)
  })

  it('⛔ aucun saut de ligne ni caractère de contrôle n’atteint l’objet', () => {
    const { subject } = buildTeamInviteEmail({ ...base, agencyName: 'Régie\r\nBcc: cible@example.com\u0000' })
    expect(subject).not.toMatch(/\p{Cc}/u)
    expect(subject.startsWith('Régie Bcc: cible@example.com ·')).toBe(true)
  })

  it('⛔ retire les marques de direction invisibles qui retournent un texte', () => {
    expect(nomAffichable('Agence\u202Egnp.exe\u202C Genève')).toBe('Agencegnp.exe Genève')
    expect(nomAffichable('\uFEFF\u200B Régie \u200E du Rhône ')).toBe('Régie du Rhône')
  })

  it('ne coupe jamais une paire de substitution, et laisse un nom ordinaire intact', () => {
    const emoji = `${'a'.repeat(NOM_MAX - 2)}🏠🏠🏠`
    const borne = nomAffichable(emoji)
    expect(Array.from(borne)).toHaveLength(NOM_MAX)
    expect(borne).toBe(`${'a'.repeat(NOM_MAX - 2)}🏠…`)
    // Contrôle : exactement NOM_MAX caractères passent sans ellipse.
    expect(nomAffichable('b'.repeat(NOM_MAX))).toBe('b'.repeat(NOM_MAX))
    expect(nomAffichable('Régie du Rhône SA')).toBe('Régie du Rhône SA')
  })
})
