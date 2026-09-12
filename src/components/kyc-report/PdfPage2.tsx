// MEGGA — Page 2 du rapport PDF KYC : Contrôles & pièces
// Sections :
//   Screening listes officielles · Dilisense (une ligne par liste, un statut par ligne)
//   Contrôles LBA validés · art. 3 à 7
//   Source des fonds
//   Examen complémentaire — seulement si un humain a tranché un match (kyc_screening_decisions)

import { useTranslation } from 'react-i18next'
import { PdfCell, PdfDef, PdfKicker, PdfPara, PdfPill, PdfSection, PdfShell, PdfStrong, PdfTable, PdfTitle } from './PdfShell'
import { fmtCHF, fmtDateSwiss, fmtDateTimeSwiss } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage2({ data }: Props) {
  const { t } = useTranslation('kyc')
  const screeningTitle = data.screening_date
    ? t('report.pdf.section.screeningDated', { provider: data.screening_provider, date: fmtDateTimeSwiss(data.screening_date) })
    : t('report.pdf.section.screening', { provider: data.screening_provider })

  return (
    <PdfShell pageNum={2} pageTotal={3} reference={data.reference}>
      <PdfTitle level={2}>{t('report.pdf.page2.title')}</PdfTitle>
      <PdfKicker>{t('report.pdf.page2.kicker')}</PdfKicker>

      <PdfSection tight title={screeningTitle}>
        <PdfTable
          columns={[
            { label: t('report.pdf.col.list') },
            { label: t('report.pdf.col.result') },
            { label: '', align: 'right' },
          ]}
        >
          {data.screening_rows.map((r) => (
            <tr key={r.key}>
              <PdfCell tight kind="key">{t(`report.pdf.page2.list.${r.key}`)}</PdfCell>
              <PdfCell tight>{t(`report.pdf.page2.result.${r.status}`)}</PdfCell>
              <PdfCell tight align="right">
                {r.status === 'clear' && <PdfPill>{t('report.pdf.page2.clear')}</PdfPill>}
                {r.status === 'match' && <PdfPill>{t('report.pdf.page2.toReview')}</PdfPill>}
              </PdfCell>
            </tr>
          ))}
        </PdfTable>
      </PdfSection>

      <PdfSection tight title={t('report.pdf.section.lbaChecks')}>
        <PdfTable
          columns={[
            { label: t('report.pdf.col.control') },
            { label: t('report.pdf.col.supportingDoc') },
            { label: t('report.pdf.col.date') },
            { label: t('report.pdf.col.agent') },
          ]}
        >
          {data.lba_checks.map((c) => (
            <tr key={c.key}>
              <PdfCell tight kind="key">{c.label}</PdfCell>
              <PdfCell tight>{c.justificatif}</PdfCell>
              <PdfCell tight kind="muted">{fmtDateSwiss(c.date)}</PdfCell>
              <PdfCell tight>{c.agent}</PdfCell>
            </tr>
          ))}
        </PdfTable>
      </PdfSection>

      <PdfSection tight title={t('report.pdf.section.sourceOfFunds')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <PdfDef label={t('report.pdf.label.type')} value={data.source_of_funds.type_label} />
          <PdfDef label={t('report.pdf.label.supportingDoc')} value={data.source_of_funds.document_name ?? '—'} />
          <PdfDef label={t('report.pdf.label.attestedAmount')} value={fmtCHF(data.source_of_funds.amount)} />
        </div>
        {data.source_of_funds.note && <PdfPara style={{ marginTop: 18 }}>{data.source_of_funds.note}</PdfPara>}
      </PdfSection>

      {data.complementary_reviews.length > 0 && (
        <PdfSection tight title={t('report.pdf.section.complementaryReview')}>
          {data.complementary_reviews.map((r, i) => (
            <PdfPara key={i} style={{ marginTop: i === 0 ? 0 : 10 }}>
              {r.target_label} — <PdfStrong>{r.verdict_label}</PdfStrong>
              {', '}
              {t('report.pdf.examinedBy', { date: fmtDateSwiss(r.date), name: r.decided_by })}
              {'. '}
              {r.justification}
            </PdfPara>
          ))}
        </PdfSection>
      )}
    </PdfShell>
  )
}
