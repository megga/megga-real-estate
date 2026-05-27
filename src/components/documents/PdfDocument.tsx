// MEGGA — Generic PDF renderer for the DocumentGenerator templates.
//
// @react-pdf/renderer produces real text-based PDFs (selectable text,
// proper indexation, small file size) — not raster images like the
// html2canvas/jsPDF chain. This means a mandat exclusif is genuinely
// usable as a legal document.
//
// The component is intentionally minimal — it renders a consistent
// MEGGA-branded layout (header + section blocks + footer) populated
// from the template name + the agent's filled field values. Per-template
// custom layouts can be added later by switching on `templateId` here.

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Use system fonts to keep the bundle small — @react-pdf bundles Helvetica
// by default, which renders consistently across browsers without font
// downloads. For richer typography (DM Sans like the rest of the app),
// register a webfont via Font.register — separate chip.
Font.registerHyphenationCallback((w) => [w]) // disable hyphenation

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1f2937',
    padding: 56,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 16,
    marginBottom: 28,
    borderBottom: '1px solid #e5e7eb',
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: -0.4,
    color: '#0a0a0f',
  },
  brandSub: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0a0a0f',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 28,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0a0a0f',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid #f3f4f6',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 10,
    color: '#6b7280',
    width: 160,
  },
  rowValue: {
    fontSize: 11,
    color: '#1f2937',
    flex: 1,
  },
  rowValuePlaceholder: {
    fontSize: 11,
    color: '#d1d5db',
    fontStyle: 'italic',
    flex: 1,
  },
  rowValueLong: {
    fontSize: 11,
    color: '#1f2937',
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 12,
    borderLeft: '2px solid #e5e7eb',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 56,
    right: 56,
    paddingTop: 12,
    borderTop: '1px solid #e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
})

export interface PdfSection {
  name: string
  fields: Array<{
    label: string
    value: string
    /** true → render value on its own line with a left bar, used for
     * textarea-style long content. */
    long?: boolean
  }>
}

export interface PdfDocumentProps {
  templateName: string
  description?: string
  agencyName?: string
  agentName?: string
  generatedAt: Date
  sections: PdfSection[]
}

export function PdfDocument({
  templateName,
  description,
  agencyName,
  agentName,
  generatedAt,
  sections,
}: PdfDocumentProps) {
  const dateLabel = generatedAt.toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title={templateName} author={agentName ?? 'MEGGA'} producer="MEGGA Real Estate">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>MEGGA</Text>
            <Text style={styles.brandSub}>Immobilier Suisse</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>{agencyName ?? 'Agence'}</Text>
            <Text style={styles.headerMeta}>{dateLabel}</Text>
          </View>
        </View>

        <Text style={styles.title}>{templateName}</Text>
        {description && <Text style={styles.description}>{description}</Text>}

        {sections.map((s) => (
          <View key={s.name} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{s.name}</Text>
            {s.fields.map((f) => {
              const value = (f.value ?? '').trim()
              if (f.long) {
                return (
                  <View key={f.label}>
                    <Text style={styles.rowLabel}>{f.label}</Text>
                    {value ? (
                      <Text style={styles.rowValueLong}>{value}</Text>
                    ) : (
                      <Text style={styles.rowValuePlaceholder}>— non renseigné</Text>
                    )}
                  </View>
                )
              }
              return (
                <View key={f.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  {value ? (
                    <Text style={styles.rowValue}>{value}</Text>
                  ) : (
                    <Text style={styles.rowValuePlaceholder}>— non renseigné</Text>
                  )}
                </View>
              )
            })}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Document généré via MEGGA Real Estate · {dateLabel}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
