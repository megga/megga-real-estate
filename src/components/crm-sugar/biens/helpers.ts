// MEGGA CRM Sugar v2 — Biens helpers
// 1:1 port from the Claude Design bundle (`crm-screen-biens-sugar.jsx`).

export function bnFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return 'CHF ' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'
  return 'CHF ' + n.toLocaleString('fr-CH').replace(/,/g, "'")
}

export function bnFmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function bnRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const h = ms / 3600000
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min'
  if (h < 24) return Math.round(h) + ' h'
  const j = Math.round(h / 24)
  if (j < 30) return j + ' j'
  return Math.round(j / 30) + ' mois'
}

export interface BnStatusMeta {
  label: string
  color: string
  bg: string
}

export function bnStatus(s: string): BnStatusMeta {
  return (
    (
      {
        active: { label: 'Actif', color: '#0E9F6E', bg: '#0E9F6E1A' },
        reserved: { label: 'Réservé', color: '#8B5CF6', bg: '#8B5CF61F' },
        draft: { label: 'Brouillon', color: '#7A8079', bg: '#7A80791F' },
        paused: { label: 'En pause', color: '#F59E0B', bg: '#F59E0B1F' },
        sold: { label: 'Vendu', color: '#0E1410', bg: '#0E14101A' },
      } as const
    )[s as keyof BnStatusMap] || { label: s, color: '#7A8079', bg: '#7A80791F' }
  )
}

interface BnStatusMap {
  active: BnStatusMeta
  reserved: BnStatusMeta
  draft: BnStatusMeta
  paused: BnStatusMeta
  sold: BnStatusMeta
}
