// MEGGA — Page 1 du rapport PDF KYC : Synthèse exécutive
// Sections : Client · Transaction · Verdict · Analyse contextuelle MEGGA AI
// (cette dernière seulement si le dossier porte une analyse — c'est une
// estimation assistée, dite comme telle, jamais un verdict).
// Pied : validation + empreinte d'intégrité, signature.

import { useTranslation } from 'react-i18next'
import { PdfDef, PdfKicker, PdfPara, PdfSection, PdfShell, PdfStrong, PdfTitle } from './PdfShell'
import { PDF, PDF_LABEL, PDF_MONO, fmtCHF, fmtDateTimeSwiss, fmtHashShort } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

const GRID4 = { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 24 } as const
const GRID3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 } as const

export function PdfPage1({ data }: Props) {
  const { t } = useTranslation('kyc')
  const kicker = data.transaction.property_label
    ? t('report.pdf.page1.kicker', { name: data.contact.full_name, property: data.transaction.property_label })
    : t('report.pdf.page1.kickerNoProperty', { name: data.contact.full_name })
  const ai = data.ai_analysis

  return (
    <PdfShell pageNum={1} pageTotal={3} reference={data.reference} bottom={<Validation data={data} />}>
      <PdfTitle level={1}>{t('report.pdf.page1.title')}</PdfTitle>
      <PdfKicker>{kicker}</PdfKicker>

      {/* Bandeau réf · émis le · par */}
      <div style={{ ...GRID3, marginTop: 36 }}>
        <PdfDef label={t('report.pdf.label.reference')} value={data.reference} mono />
        <PdfDef label={t('report.pdf.label.emittedOn')} value={fmtDateTimeSwiss(data.emitted_at)} />
        <PdfDef label={t('report.pdf.label.by')} value={data.agent.full_name} />
      </div>

      <PdfSection title={t('report.pdf.section.client')}>
        <div style={GRID4}>
          <PdfDef label={t('report.pdf.label.identity')} value={data.contact.full_name} />
          <PdfDef
            label={t('report.pdf.label.nationality')}
            value={data.contact.nationality ?? t('report.pdf.value.notProvided')}
          />
          <PdfDef label={t('report.pdf.label.type')} value={data.contact.type_label} />
          <PdfDef
            label={t('report.pdf.label.taxResidence')}
            value={data.contact.residence ?? t('report.pdf.value.notProvided')}
          />
        </div>
      </PdfSection>

      <PdfSection title={t('report.pdf.section.transaction')}>
        <div style={GRID4}>
          <PdfDef
            label={t('report.pdf.label.property')}
            value={data.transaction.property_label ?? t('report.pdf.value.propertyUnderMandate')}
          />
          <PdfDef label={t('report.pdf.label.mandate')} value={data.transaction.reference} mono />
          <PdfDef label={t('report.pdf.label.amount')} value={fmtCHF(data.transaction.amount)} />
          <PdfDef label={t('report.pdf.label.pipelineStage')} value={data.transaction.stage_label ?? '—'} />
        </div>
      </PdfSection>

      <PdfSection title={t('report.pdf.section.verdict')}>
        <div style={GRID3}>
          {[
            { value: data.verdict.vigilance_label, sub: data.verdict.vigilance_sub },
            { value: data.verdict.risk_label, sub: data.verdict.risk_sub },
            { value: data.verdict.status_label, sub: data.verdict.status_sub },
          ].map((c, i) => (
            <div key={i}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: PDF.muted, fontWeight: 500, marginTop: 8 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </PdfSection>

      {ai && (
        <PdfSection title={t('report.pdf.section.aiAnalysis')}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 28, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1 }}>
                {ai.confidence_pct !== null ? (
                  <>
                    {ai.confidence_pct}
                    <span style={{ fontSize: 16, color: PDF.muted, marginLeft: 2 }}>%</span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <PdfKicker style={{ marginTop: 6 }}>{t('report.pdf.ai.patterns', { count: ai.patterns_count })}</PdfKicker>
            </div>
            <div>
              <PdfPara>
                {ai.justification}{' '}
                <PdfStrong>{t('report.pdf.ai.recommendation', { label: ai.recommendation_label })}</PdfStrong>
              </PdfPara>
              {/* Mention estimation assistée — obligatoire (l'IA assiste, ne décide pas) */}
              <div style={{ marginTop: 10, fontSize: 9.5, color: PDF.muted, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.4 }}>
                {t('report.pdf.assistedEstimateNotice')}
              </div>
            </div>
          </div>
        </PdfSection>
      )}
    </PdfShell>
  )
}

/** Pied de la synthèse : validation + empreinte à gauche, signature à droite. */
function Validation({ data }: Props) {
  const { t } = useTranslation('kyc')
  return (
    <div
      style={{
        paddingTop: 20,
        borderTop: `1px solid ${PDF.ink}`,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'end',
      }}
    >
      <div>
        <div style={PDF_LABEL}>{t('report.pdf.label.validation')}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>
          {data.validated_at && data.validated_by ? (
            t('report.pdf.validatedBy', { date: fmtDateTimeSwiss(data.validated_at), name: data.validated_by })
          ) : (
            <span style={{ color: PDF.muted, fontStyle: 'italic' }}>{t('report.pdf.validationPending')}</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: PDF.muted, marginTop: 4, fontFamily: PDF_MONO, letterSpacing: 0.2 }}>
          {t('report.pdf.label.integrityHash')} {fmtHashShort(data.integrity_hash, 4, ' · ')}
        </div>
      </div>
      <div>
        {/* La signature manuscrite : Caveat, la seule police qui n'est pas Manrope — une
            signature en Manrope n'est plus une signature (cf. polices-domaines.spec.ts). */}
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 28, lineHeight: 1, minHeight: 28, textAlign: 'right' }}>
          {data.validated_by ? buildSignatureInitials(data.validated_by) : ''}
        </div>
        <div style={{ ...PDF_LABEL, marginTop: 8, textAlign: 'right' }}>{t('report.pdf.signatureCaption')}</div>
      </div>
    </div>
  )
}

// "Sophie Marchand" → "S. Marchand"
function buildSignatureInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0]![0]}. ${parts.slice(1).join(' ')}`
}
