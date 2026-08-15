// supabase/functions/_shared/weekly-report-email.ts
//
// Rapport hebdomadaire de la PLATEFORME, envoyé chaque lundi aux super-admins MEGGA.
//
// ⚠ DESTINATAIRE : l'équipe MEGGA, pas les agences. La liste `A_MIGRER` de la porte le
// décrivait comme « rapport à l'agent » — c'était faux, il est lu par `profiles` de rôle
// `super_admin`. Un e-mail interne, donc : pilule utile, aucune mention légale.
//
// ⛔ SON BOUTON ÉTAIT MORT. Il pointait sur `megga.ch/dashboard/admin` : la vitrine est
// derrière un mot de passe et rend 401 (mesuré le 15.08.2026). La console vit sur
// `app.megga.ch/dashboard/admin`, qui rend 200. TROISIÈME occurrence de cette confusion
// d'hôte après le logo de la coquille et le bouton de l'alerte de sécurité — d'où la
// constante `ASSETS` et cette note : dans un e-mail, `megga.ch` n'est JAMAIS la bonne
// adresse pour un lien applicatif.

import { INK, MUTED, FONT, escapeHtml, shell, p, row, button } from './email-shell.ts'

/** ⚠ app.megga.ch, jamais megga.ch : cf. l'en-tête. */
const URL_CONSOLE = 'https://app.megga.ch/dashboard/admin'

/**
 * Une ligne du rapport. `delta` n'est rendu que s'il est positif : « +0 » n'apprend rien,
 * et une semaine sans nouveauté se lit déjà au total.
 */
export interface ReportRow {
  label: string
  value: number
  delta?: number | null
  /** Vrai quand une valeur NON NULLE est une mauvaise nouvelle (erreurs, KYC à risque). */
  alertIfPositive?: boolean
}

export interface WeeklyReportInput {
  /** Bornes de la semaine, déjà formatées par l'appelant dans le bon fuseau. */
  periode: string
  rows: ReportRow[]
}

/** Vert de progression et rouge d'alerte, réglés pour un fond sombre (cf. CLAUDE.md §3). */
const VERT = '#6ee7a8'
const ROUGE = '#ff8a8a'

function ligne(r: ReportRow): string {
  const alerte = r.alertIfPositive && r.value > 0
  const valeur = `<strong style="font-size:16px;color:${alerte ? ROUGE : INK};">${r.value}</strong>`
    + ((r.delta ?? 0) > 0 ? `<span style="font-size:11px;color:${VERT};margin-left:6px;">+${r.delta}</span>` : '')
  return row(r.label, valeur)
}

export function buildWeeklyReportEmail(i: WeeklyReportInput): { subject: string; html: string } {
  return {
    // Sans tiret cadratin (règle maison) ; la période ouvre, c'est ce qui distingue deux
    // rapports dans une boîte.
    subject: `Rapport hebdomadaire MEGGA · ${i.periode}`,
    html: shell({
      title: 'Rapport hebdomadaire',
      // Le chiffre le plus actionnable du lot, quand il y en a un : ouvrir ou non se
      // décide là-dessus. Sinon, la période.
      preheader: i.rows.find((r) => r.alertIfPositive && r.value > 0)
        ? `${i.rows.find((r) => r.alertIfPositive && r.value > 0)!.label} : à regarder.`
        : `Plateforme, ${i.periode}.`,
      // Interne à l'équipe : aucune mention légale, comme l'avis à l'hôte.
      legalNote: null,
      headerCta: { href: URL_CONSOLE, label: 'Ouvrir la console' },
      bodyHtml: `
     ${p(`<span style="color:${MUTED};">${escapeHtml(i.periode)}</span>`, 24)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${i.rows.map(ligne).join('')}
     </table>
     <div style="margin:0 0 8px;">${button(URL_CONSOLE, 'Ouvrir la console')}</div>
     <p style="margin:28px 0 0;font-family:${FONT};font-size:11.5px;color:${MUTED};">
       Rapport automatique, envoyé chaque lundi à 8 h.
     </p>`,
    }),
  }
}
