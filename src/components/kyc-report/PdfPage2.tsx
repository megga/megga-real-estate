// MEGGA — Page 2 du rapport PDF KYC : Contrôles & pièces
// Sections :
//   04 Screening listes officielles · Dilisense
//   05 Contrôles LBA validés · art. 3 à 7
//   06 Source des fonds documentée
//   07 Analyse de risque — estimation assistée (validation humaine requise)
//      Affichée uniquement si data.risk_analysis est non-null.
//      Aucun nom de provider IA dans le rendu.

import { useTranslation } from 'react-i18next'
import { PdfShell, PdfSectionRule, PdfDef, PdfSemPill, PdfCheckIcon } from './PdfShell'
import { PDF, fmtCHF, fmtDateSwiss, fmtDateTimeSwiss, pad2 } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage2({ data }: Props) {
  const { t } = useTranslation('kyc')
  const screeningDate = fmtDateTimeSwiss(data.screening_date)
  const noMatch = t('report.pdf.page2.noMatch')
  const screeningRows: Array<[string, string, string, string]> = [
    [t('report.pdf.page2.list.pep'), data.screening_provider, noMatch, screeningDate],
    [t('report.pdf.page2.list.ofac'), data.screening_provider, noMatch, screeningDate],
    [t('report.pdf.page2.list.seco'), data.screening_provider, noMatch, screeningDate],
    [t('report.pdf.page2.list.eu'), data.screening_provider, noMatch, screeningDate],
    [t('report.pdf.page2.list.un'), data.screening_provider, noMatch, screeningDate],
    [t('report.pdf.page2.list.adverseMedia'), data.screening_provider, noMatch, screeningDate],
  ]

  return (
    <PdfShell pageNum={2} pageTotal={3}>
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
          {t('report.pdf.page2.eyebrow')}
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
          {t('report.pdf.page2.title')}
        </h2>
      </div>

      {/* 04 — Screening Dilisense */}
      <PdfSectionRule num={4}>
        {t('report.pdf.section.screening', { provider: data.screening_provider })}
      </PdfSectionRule>
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
              t('report.pdf.col.list'),
              t('report.pdf.col.provider'),
              t('report.pdf.col.result'),
              t('report.pdf.col.timestamp'),
              '',
            ].map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 4 ? 'right' : 'left',
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
            ))}
          </tr>
        </thead>
        <tbody>
          {screeningRows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${PDF.hair}` }}>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.ink,
                  fontWeight: 600,
                  letterSpacing: -0.05,
                }}
              >
                {r[0]}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.inkSoft,
                  fontWeight: 500,
                }}
              >
                {r[1]}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.ink,
                  fontWeight: 600,
                }}
              >
                {data.screening_clear ? noMatch : r[2]}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.muted,
                  fontWeight: 500,
                }}
              >
                {r[3]}
              </td>
              <td style={{ padding: '7px 0', textAlign: 'right' }}>
                {data.screening_clear ? (
                  <PdfSemPill tone="ok">{t('report.pdf.page2.clear')}</PdfSemPill>
                ) : (
                  <PdfSemPill tone="warn">{t('report.pdf.page2.toReview')}</PdfSemPill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 05 — Contrôles LBA validés */}
      <PdfSectionRule num={5}>
        {t('report.pdf.section.lbaChecks')}
      </PdfSectionRule>
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
              t('report.pdf.col.control'),
              t('report.pdf.col.supportingDoc'),
              t('report.pdf.col.date'),
              t('report.pdf.col.agent'),
            ].map(
              (h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: 'left',
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
          {data.lba_checks.map((c, i) => (
            <tr key={c.key} style={{ borderBottom: `1px solid ${PDF.hair}` }}>
              <td
                style={{
                  padding: '7px 0',
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
                  padding: '7px 0',
                  color: PDF.ink,
                  fontWeight: 600,
                  letterSpacing: -0.05,
                }}
              >
                {c.label}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.inkSoft,
                  fontWeight: 500,
                }}
              >
                {c.justificatif}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.muted,
                  fontWeight: 500,
                  width: 90,
                }}
              >
                {fmtDateSwiss(c.date)}
              </td>
              <td
                style={{
                  padding: '7px 0',
                  color: PDF.inkSoft,
                  fontWeight: 600,
                  width: 160,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {c.completed && <PdfCheckIcon size={14} />}
                  {c.agent}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 06 — Source des fonds */}
      <PdfSectionRule num={6}>{t('report.pdf.section.sourceOfFunds')}</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 24,
        }}
      >
        <PdfDef label={t('report.pdf.label.type')} value={data.source_of_funds.type_label} />
        <PdfDef
          label={t('report.pdf.label.establishment')}
          value={data.source_of_funds.establishment ?? '—'}
        />
        <PdfDef
          label={t('report.pdf.label.attestedAmount')}
          value={fmtCHF(data.source_of_funds.amount)}
        />
      </div>
      {data.source_of_funds.note && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: PDF.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
            letterSpacing: -0.05,
          }}
        >
          {data.source_of_funds.note}
        </div>
      )}

      {/* 07 — Analyse de risque (estimation assistée — masquée si ai_analysis absent) */}
      {data.risk_analysis && (
        <>
          <PdfSectionRule num={7}>{t('report.pdf.section.riskAnalysis')}</PdfSectionRule>

          {/* Niveau de risque + recommandation */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              marginBottom: 10,
            }}
          >
            {/* Niveau de risque */}
            <div
              style={{
                padding: '12px 14px',
                border: `1px solid ${PDF.hairStrong}`,
                borderRadius: 4,
                background: PDF.cardSubtle,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: PDF.muted,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {t('report.pdf.riskLevelLabel')}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: PDF.ink,
                  letterSpacing: -0.4,
                  lineHeight: 1,
                }}
              >
                {data.risk_analysis.risk_label}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: PDF.muted,
                  fontWeight: 500,
                  marginTop: 3,
                }}
              >
                {data.risk_analysis.risk_sub}
              </div>
            </div>

            {/* Recommandation de vigilance */}
            <div
              style={{
                padding: '12px 14px',
                border: `1px solid ${PDF.hairStrong}`,
                borderRadius: 4,
                background: PDF.cardSubtle,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: PDF.muted,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {t('report.pdf.recommendationLabel')}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: PDF.ink,
                  letterSpacing: -0.2,
                  lineHeight: 1.2,
                }}
              >
                {data.risk_analysis.vigilance_label}
              </div>
              {data.risk_analysis.confidence_pct !== null && (
                <div
                  style={{
                    fontSize: 10,
                    color: PDF.muted,
                    fontWeight: 500,
                    marginTop: 3,
                  }}
                >
                  {t('report.pdf.confidence', { pct: data.risk_analysis.confidence_pct })}
                </div>
              )}
            </div>
          </div>

          {/* Justification */}
          <div
            style={{
              fontSize: 11,
              color: PDF.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
              letterSpacing: -0.05,
              marginBottom: data.risk_analysis.patterns.length > 0 ? 8 : 0,
            }}
          >
            {data.risk_analysis.justification}
          </div>

          {/* Patterns détectés */}
          {data.risk_analysis.patterns.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: PDF.muted,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                {t('report.pdf.patternsDetected')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.risk_analysis.patterns.map((p, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: PDF.inkSoft,
                      background: PDF.cardDeep,
                      border: `1px solid ${PDF.hairStrong}`,
                      borderRadius: 3,
                      padding: '2px 8px',
                      letterSpacing: -0.05,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mention estimation assistée — obligatoire */}
          <div
            style={{
              marginTop: 6,
              fontSize: 9.5,
              color: PDF.muted,
              fontWeight: 500,
              fontStyle: 'italic',
              letterSpacing: 0.1,
              lineHeight: 1.4,
            }}
          >
            {t('report.pdf.assistedEstimateNotice')}
          </div>
        </>
      )}
    </PdfShell>
  )
}
