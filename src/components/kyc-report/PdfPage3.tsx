// MEGGA — Page 3 du rapport PDF KYC : Annexes
// Sections (renumérotées) :
//   07 Documents joints au dossier (ex 09)
//   08 Piste d'audit & conservation (ex 10)

import { useTranslation } from 'react-i18next'
import { PdfShell, PdfSectionRule, PdfDef } from './PdfShell'
import {
  PDF,
  fmtBytes,
  fmtDateSwiss,
  fmtHashLong,
  pad2,
} from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage3({ data }: Props) {
  const { t } = useTranslation('kyc')
  const docCount = data.documents.length

  return (
    <PdfShell pageNum={3} pageTotal={3}>
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: PDF.muted,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}
        >
          {t('report.pdf.page3.eyebrow')}
        </div>
        <h2
          style={{
            margin: '8px 0 0',
            fontSize: 28,
            fontWeight: 800,
            color: PDF.ink,
            letterSpacing: -1,
            lineHeight: 1.05,
          }}
        >
          {t('report.pdf.page3.title')}
        </h2>
      </div>

      {/* 07 — Documents joints */}
      <PdfSectionRule num={7}>
        {t('report.pdf.section.documents', { count: docCount })}
      </PdfSectionRule>
      {docCount === 0 ? (
        <div
          style={{
            padding: '24px 0',
            color: PDF.muted,
            fontSize: 12,
            fontStyle: 'italic',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {t('report.pdf.page3.noDocuments')}
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <thead>
            <tr>
              {[
                t('report.pdf.col.num'),
                t('report.pdf.col.fileName'),
                t('report.pdf.col.category'),
                t('report.pdf.col.date'),
                t('report.pdf.col.size'),
                t('report.pdf.col.hash'),
              ].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i >= 3 ? 'right' : 'left',
                      padding: '6px 0',
                      fontSize: 9,
                      fontWeight: 700,
                      color: PDF.muted,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${PDF.hairStrong}`,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d, i) => (
              <tr
                key={`${d.filename}-${i}`}
                style={{ borderBottom: `1px solid ${PDF.hair}` }}
              >
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.muted,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    width: 28,
                  }}
                >
                  {pad2(i + 1)}
                </td>
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.ink,
                    fontWeight: 600,
                    letterSpacing: -0.05,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 10.5,
                  }}
                >
                  {d.filename}
                </td>
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.inkSoft,
                    fontWeight: 500,
                  }}
                >
                  {d.category}
                </td>
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.muted,
                    fontWeight: 500,
                    textAlign: 'right',
                    width: 84,
                  }}
                >
                  {fmtDateSwiss(d.date)}
                </td>
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.muted,
                    fontWeight: 500,
                    textAlign: 'right',
                    width: 64,
                  }}
                >
                  {fmtBytes(d.size_bytes)}
                </td>
                <td
                  style={{
                    padding: '10px 0',
                    color: PDF.inkSoft,
                    fontWeight: 500,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10,
                    textAlign: 'right',
                    width: 96,
                  }}
                >
                  {d.hash_short.length > 12
                    ? `${d.hash_short.slice(0, 4)}·${d.hash_short.slice(4, 8)}`
                    : d.hash_short}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 08 — Piste d'audit & conservation */}
      <PdfSectionRule num={8}>{t('report.pdf.section.auditTrail')}</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 32,
          fontSize: 11,
          color: PDF.inkSoft,
          fontWeight: 500,
          lineHeight: 1.65,
          letterSpacing: -0.05,
        }}
      >
        <div>
          <PdfDef
            label={t('report.pdf.label.retentionPeriod')}
            value={t('report.pdf.retentionValue', { date: fmtDateSwiss(data.retention_until) })}
          />
          <div style={{ marginTop: 14 }}>
            {t('report.pdf.retentionBody')}
          </div>
        </div>
        <div>
          <PdfDef label={t('report.pdf.label.legalBasis')} value={t('report.pdf.legalBasisValue')} />
          <div style={{ marginTop: 14 }}>
            {t('report.pdf.legalBasisBody')}
          </div>
        </div>
      </div>

      {/* Bloc final attestation */}
      <div
        style={{
          marginTop: 'auto',
          padding: '22px 24px',
          background: PDF.cardSubtle,
          borderRadius: 8,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: PDF.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {t('report.pdf.finalAttestationLabel')}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: PDF.ink,
              fontWeight: 600,
              letterSpacing: -0.1,
              lineHeight: 1.5,
            }}
          >
            {t('report.pdf.finalAttestationBody')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 10,
              color: PDF.muted,
            }}
          >
            SHA-256
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11.5,
              fontWeight: 700,
              color: PDF.ink,
              letterSpacing: 0.5,
            }}
          >
            {fmtHashLong(data.integrity_hash)}
          </div>
        </div>
      </div>
    </PdfShell>
  )
}
