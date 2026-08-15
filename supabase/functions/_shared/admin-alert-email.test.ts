// L'alerte plateforme : le message que l'équipe reçoit quand ça va mal.
//
// Il partait en TEXTE SEUL. Ces tests figent les deux parts, parce que supprimer la
// part texte serait la régression tentante le jour où quelqu'un trouvera qu'un e-mail
// « ne devrait avoir qu'un HTML ».
import { describe, it, expect } from 'vitest'
import { buildAdminAlertEmail, formatCH } from './admin-alert-email'
import type { Alert } from './admin-alerts'

const MAINTENANT = new Date('2026-08-15T21:15:02.528Z')

const cron: Alert = {
  key: 'cron:weekly-digest-friday',
  subject: 'Cron weekly-digest-friday en retard',
  body: 'Le job pg_cron « weekly-digest-friday » est sans exécution depuis plus de 25h. Dernier run : 14.08.2026 19:00.',
}
const kyb: Alert = {
  key: 'kyb:agence-x',
  subject: 'Dossier KYB à valider · Régie du Rhône',
  body: 'L’agence « Régie du Rhône » (CH) attend une revue humaine depuis 3 jours.',
}

describe('formatCH — l’ISO brut était illisible', () => {
  it('rend une date suisse dans le fuseau de l’équipe', () => {
    // « 2026-08-14T17:00:00.549114+00:00 » demandait une conversion mentale à qui lit
    // son téléphone le soir. Zurich est UTC+2 en août.
    expect(formatCH('2026-08-14T17:00:00.549114+00:00')).toBe('14.08.2026 19:00')
  })

  it('« jamais » quand il n’y a rien, et non une date de 1970', () => {
    expect(formatCH(null)).toBe('jamais')
    expect(formatCH(undefined)).toBe('jamais')
    expect(formatCH('')).toBe('jamais')
  })

  it('⛔ une entrée illisible ressort TELLE QUELLE, jamais « Invalid Date »', () => {
    // Perdre l'information brute serait pire que l'afficher mal : c'est peut-être
    // elle qui explique la panne.
    expect(formatCH('pas-une-date')).toBe('pas-une-date')
  })
})

describe('buildAdminAlertEmail', () => {
  it('⛔ envoie les DEUX parts : le HTML ET le texte', () => {
    // Une alerte doit rester lisible dans un client qui bloque le HTML, dans une
    // notification de téléphone et dans une passerelle d'astreinte.
    const m = buildAdminAlertEmail([cron], MAINTENANT)
    expect(m.html).toContain('<!DOCTYPE')
    expect(m.text).toContain('• Cron weekly-digest-friday en retard')
    expect(m.text).not.toContain('<')
  })

  it('passe par la coquille MEGGA X : logo, fond sombre, pilule vers la console', () => {
    const { html } = buildAdminAlertEmail([cron], MAINTENANT)
    expect(html).toContain('https://app.megga.ch/email/megga-logo-white.png')
    expect(html).toContain('#090909')
    expect(html).toContain('Ouvrir le monitoring')
  })

  it('INTERNE : aucune mention légale, aucun lien de désinscription', () => {
    // Le destinataire est l'équipe MEGGA, pas un client : la mention transactionnelle
    // serait fausse ici.
    const { html } = buildAdminAlertEmail([cron], MAINTENANT)
    expect(html).not.toContain('communication marketing')
    expect(html).not.toContain('désinscription')
  })

  it('⛔ le lien mène à app.megga.ch, JAMAIS à megga.ch', () => {
    // Quatrième occurrence de cette confusion d'hôte dans le dépôt : la vitrine est
    // derrière un mot de passe et rend 401.
    const { html, text } = buildAdminAlertEmail([cron], MAINTENANT)
    expect(html).toContain('https://app.megga.ch/dashboard/admin/monitoring')
    expect(text).toContain('https://app.megga.ch/dashboard/admin/monitoring')
    expect(html).not.toContain('https://megga.ch/dashboard')
  })

  it('une seule alerte : l’objet la NOMME, il ne la compte pas', () => {
    // « 1 alerte plateforme » ne se trie pas dans une boîte ; le nom du job, si.
    expect(buildAdminAlertEmail([cron], MAINTENANT).subject)
      .toBe('[MEGGA Admin] Cron weekly-digest-friday en retard')
  })

  it('plusieurs alertes : l’objet compte, l’aperçu nomme la première', () => {
    const m = buildAdminAlertEmail([cron, kyb], MAINTENANT)
    expect(m.subject).toBe('[MEGGA Admin] 2 alertes plateforme')
    expect(m.html).toContain('Cron weekly-digest-friday en retard')
    expect(m.html).toContain('Dossier KYB à valider')
  })

  it('l’horodatage du relevé est lisible, pas de l’ISO', () => {
    const { html, text } = buildAdminAlertEmail([cron], MAINTENANT)
    expect(html).toContain('15.08.2026 23:15')
    expect(text).toContain('15.08.2026 23:15')
    expect(html).not.toContain('2026-08-15T21:15')
  })

  it('aucun tiret cadratin, objet et texte compris (règle maison)', () => {
    const m = buildAdminAlertEmail([cron, kyb], MAINTENANT)
    for (const part of [m.subject, m.html, m.text]) expect(part).not.toMatch(/[–—]/)
  })

  it('⛔ le corps d’une alerte est ÉCHAPPÉ', () => {
    // Les corps portent des noms d'agence et des noms de job venus de la base.
    const { html } = buildAdminAlertEmail(
      [{ key: 'k', subject: 'Test', body: '<img src=x onerror=alert(1)>' }],
      MAINTENANT,
    )
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
})
