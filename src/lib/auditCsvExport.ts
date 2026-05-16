// MEGGA CRM Sprint 1 — Export CSV du journal d'audit nLPD
// Format compatible Excel (BOM UTF-8, séparateur ;).
// Référence : KYC_ENRICHISSEMENTS §4 — export CSV + PDF horodaté.
// Le PDF horodaté hash-chain est traité Sprint 2 (Edge Function dédié).

import type { AuditEvent } from '@/types/kyc'

const COLUMNS = [
  { key: 'created_at', label: 'Date/heure' },
  { key: 'category', label: 'Catégorie' },
  { key: 'severity', label: 'Sévérité' },
  { key: 'action', label: 'Action' },
  { key: 'object_label', label: 'Objet' },
  { key: 'entity_type', label: 'Type entité' },
  { key: 'entity_id', label: 'ID entité' },
  { key: 'actor_id', label: 'Acteur (ID)' },
  { key: 'ip_address', label: 'IP' },
  { key: 'metadata', label: 'Métadonnées (JSON)' },
] as const

function escapeCsvCell(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  // Échappe les guillemets et entoure si contient ; " ou newline
  const needsQuotes = /[";\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

/**
 * Convertit un tableau d'AuditEvent en CSV séparé par `;` (compatible Excel FR).
 * Première ligne : BOM UTF-8 + headers.
 */
export function auditEventsToCsv(events: AuditEvent[]): string {
  const lines: string[] = []
  // Header
  lines.push(COLUMNS.map((c) => escapeCsvCell(c.label)).join(';'))
  // Rows
  events.forEach((e) => {
    const cells = COLUMNS.map((c) => {
      const v = e[c.key as keyof AuditEvent]
      return escapeCsvCell(v)
    })
    lines.push(cells.join(';'))
  })
  // BOM UTF-8 pour qu'Excel détecte l'encodage correctement
  return '﻿' + lines.join('\n')
}

/**
 * Télécharge un blob CSV dans le navigateur.
 */
export function downloadAuditCsv(events: AuditEvent[], filename?: string) {
  const csv = auditEventsToCsv(events)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename ?? `megga-audit-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
