// Rapport hebdomadaire de la plateforme — le seul e-mail lu par l'équipe MEGGA seule.
import { describe, it, expect } from 'vitest'
import { buildWeeklyReportEmail, type ReportRow } from '../../supabase/functions/_shared/weekly-report-email'

const rows: ReportRow[] = [
  { label: 'Agences totales', value: 13, delta: 2 },
  { label: 'Biens actifs', value: 6 },
  { label: 'KYC à risque', value: 2, alertIfPositive: true },
  { label: 'Erreurs système (7 j)', value: 0, alertIfPositive: true },
]
const base = { periode: '08.08.2026 au 15.08.2026', rows }

describe('buildWeeklyReportEmail', () => {
  it('⛔ le bouton mène à app.megga.ch, JAMAIS à megga.ch', () => {
    // Troisième occurrence de cette confusion d'hôte dans le dépôt, après le logo de la
    // coquille et le bouton de l'alerte de sécurité : megga.ch rend 401 (vitrine protégée).
    const html = buildWeeklyReportEmail(base).html
    expect(html).toContain('https://app.megga.ch/dashboard/admin')
    expect(html).not.toContain('https://megga.ch/dashboard')
  })

  it('interne à l’équipe : pilule vers la console, AUCUNE mention légale', () => {
    const html = buildWeeklyReportEmail(base).html
    expect(html).toContain('Ouvrir la console')
    expect(html).not.toContain('communication marketing')
    expect(html).not.toContain('désinscription')
  })

  it('l’objet porte la période, sans tiret cadratin', () => {
    const { subject } = buildWeeklyReportEmail(base)
    expect(subject).toBe('Rapport hebdomadaire MEGGA · 08.08.2026 au 15.08.2026')
    expect(subject).not.toMatch(/[–—]/)
  })

  it('une valeur d’ALERTE non nulle se distingue ; à zéro, elle ne crie pas', () => {
    // « KYC à risque : 2 » et « Erreurs : 0 » ne se lisent pas pareil, et c'est le seul
    // signal que ce rapport doit rendre impossible à manquer.
    const html = buildWeeklyReportEmail(base).html
    expect(html).toContain('#ff8a8a')
    // Un seul rouge : celui des KYC. Les erreurs à 0 restent en encre normale.
    expect((html.match(/#ff8a8a/g) ?? []).length).toBe(1)
  })

  it('l’aperçu remonte l’alerte quand il y en a une, la période sinon', () => {
    expect(buildWeeklyReportEmail(base).html).toContain('KYC à risque : à regarder.')
    const calme = buildWeeklyReportEmail({ ...base, rows: rows.map((r) => ({ ...r, value: 0 })) }).html
    expect(calme).toContain('Plateforme, 08.08.2026 au 15.08.2026.')
  })

  it('un delta positif s’affiche ; nul ou absent, rien — « +0 » n’apprend rien', () => {
    const html = buildWeeklyReportEmail(base).html
    expect(html).toContain('+2')
    expect(html).not.toContain('+0')
  })
})
