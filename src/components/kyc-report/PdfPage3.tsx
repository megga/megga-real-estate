// MEGGA — Page 3 du rapport PDF KYC : Pièces justificatives
// Sections : Annexes (table des pièces, plafonnée) · Conservation & base légale
// Pied : attestation finale + SHA-256 du dossier.

import { useTranslation } from 'react-i18next'
import { PdfCell, PdfDef, PdfKicker, PdfPara, PdfSection, PdfShell, PdfTable, PdfTitle } from './PdfShell'
import { PDF, PDF_LABEL, PDF_MONO, fmtBytes, fmtDateSwiss, fmtHashShort } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage3({ data }: Props) {
  const { t } = useTranslation('kyc')
  const shown = data.documents.length
  const hidden = data.documents_total - shown

  return (
    <PdfShell pageNum={3} pageTotal={3} reference={data.reference} bottom={<Attestation data={data} />}>
      <PdfTitle level={2}>{t('report.pdf.page3.title')}</PdfTitle>
      <PdfKicker>{t('report.pdf.page3.kicker', { count: data.documents_total })}</PdfKicker>

      <PdfSection title={t('report.pdf.section.annexes')}>
        {shown === 0 ? (
          <PdfPara style={{ color: PDF.muted, fontStyle: 'italic' }}>{t('report.pdf.page3.noDocuments')}</PdfPara>
        ) : (
          <PdfTable
            columns={[
              { label: t('report.pdf.col.fileName') },
              { label: t('report.pdf.col.category') },
              { label: t('report.pdf.col.date'), align: 'right' },
              { label: t('report.pdf.col.size'), align: 'right' },
              { label: t('report.pdf.col.hash'), align: 'right' },
            ]}
          >
            {data.documents.map((d, i) => (
              <tr key={`${d.filename}-${i}`}>
                <PdfCell kind="key" mono>{d.filename}</PdfCell>
                <PdfCell>{d.category}</PdfCell>
                <PdfCell kind="muted" align="right">{fmtDateSwiss(d.date)}</PdfCell>
                <PdfCell kind="muted" align="right">{fmtBytes(d.size_bytes)}</PdfCell>
                <PdfCell align="right" mono>{fmtHashShort(d.hash, 2)}</PdfCell>
              </tr>
            ))}
            {hidden > 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '9px 0', color: PDF.muted, fontStyle: 'italic', fontWeight: 500 }}>
                  {t('report.pdf.page3.moreDocuments', { count: hidden })}
                </td>
              </tr>
            )}
          </PdfTable>
        )}
      </PdfSection>

      <PdfSection title={t('report.pdf.section.retention')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <PdfDef
              label={t('report.pdf.label.retentionPeriod')}
              value={t('report.pdf.retentionValue', { date: fmtDateSwiss(data.retention_until) })}
            />
            <PdfPara style={{ marginTop: 14 }}>{t('report.pdf.retentionBody')}</PdfPara>
          </div>
          <div>
            <PdfDef label={t('report.pdf.label.legalBasis')} value={t('report.pdf.legalBasisValue')} />
            <PdfPara style={{ marginTop: 14 }}>{t('report.pdf.legalBasisBody')}</PdfPara>
          </div>
        </div>
      </PdfSection>
    </PdfShell>
  )
}

/** Pied de la page 3 : attestation à gauche, empreinte SHA-256 du dossier à droite. */
function Attestation({ data }: Props) {
  const { t } = useTranslation('kyc')
  return (
    <div
      style={{
        paddingTop: 20,
        borderTop: `1px solid ${PDF.ink}`,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 32,
        alignItems: 'end',
      }}
    >
      <div>
        <div style={PDF_LABEL}>{t('report.pdf.finalAttestationLabel')}</div>
        <PdfPara style={{ marginTop: 8, color: PDF.ink, fontWeight: 600 }}>{t('report.pdf.finalAttestationBody')}</PdfPara>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={PDF_LABEL}>SHA-256</div>
        <div style={{ fontFamily: PDF_MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2, marginTop: 6 }}>
          {fmtHashShort(data.integrity_hash, 6)}
        </div>
      </div>
    </div>
  )
}
