/**
 * Export CSV côté client : sérialise `rows` et déclenche le téléchargement du fichier.
 *
 * `columns` fige l'ordre + les libellés d'en-tête ; sinon les clés du 1er objet sont
 * reprises telles quelles. Écrit un BOM UTF-8 pour qu'Excel lise correctement les accents.
 * No-op si `rows` est vide.
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[], columns?: { key: string; label: string }[]) {
  if (rows.length === 0) return

  const cols = columns ?? Object.keys(rows[0]).map(key => ({ key, label: key }))
  const header = cols.map(c => c.label).join(',')
  const body = rows.map(row =>
    cols.map(c => {
      const val = row[c.key]
      const str = val === null || val === undefined ? '' : String(val)
      // Escape commas and quotes
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  ).join('\n')

  const csv = `\uFEFF${header}\n${body}` // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
