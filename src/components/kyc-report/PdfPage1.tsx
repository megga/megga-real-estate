// MEGGA — Page 1 du rapport PDF KYC : Synthèse exécutive
// Sections : 01 Client · 02 Transaction · 03 Verdict global
// (la section "Analyse contextuelle IA" du modèle est volontairement supprimée)

import { useTranslation } from 'react-i18next'
import { PdfShell, PdfSectionRule, PdfDef, PdfCheckIcon } from './PdfShell'
import { PDF, fmtCHF, fmtDateTimeSwiss, fmtHashShort } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage1({ data }: Props) {
  const { t } = useTranslation('kyc')
  return (
    <PdfShell pageNum={1} pageTotal={3}>
      {/* TITRE PRINCIPAL */}
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
          {t('report.pdf.page1.eyebrow')}
        </div>
        <h1
          style={{
            margin: '10px 0 18px',
            fontSize: 42,
            fontWeight: 800,
            color: PDF.ink,
            letterSpacing: -1.4,
            lineHeight: 0.98,
          }}
        >
          {t('report.pdf.page1.title')}
          <span style={{ color: PDF.muted, fontWeight: 500 }}>.</span>
        </h1>

        {/* Bandeau réf + émetteur */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 24,
            padding: '16px 0',
            borderTop: `1px solid ${PDF.hair}`,
            borderBottom: `1px solid ${PDF.hair}`,
          }}
        >
          <PdfDef label={t('report.pdf.label.reference')} value={data.reference} mono />
          <PdfDef label={t('report.pdf.label.emittedOn')} value={fmtDateTimeSwiss(data.emitted_at)} />
          <PdfDef label={t('report.pdf.label.by')} value={data.agent.full_name} />
        </div>
      </div>

      {/* 01 CLIENT */}
      <PdfSectionRule num={1}>{t('report.pdf.section.client')}</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 24,
        }}
      >
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

      {/* 02 TRANSACTION */}
      <PdfSectionRule num={2}>{t('report.pdf.section.transaction')}</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 24,
        }}
      >
        <PdfDef
          label={t('report.pdf.label.property')}
          value={data.transaction.property_label ?? t('report.pdf.value.propertyUnderMandate')}
        />
        <PdfDef label={t('report.pdf.label.mandate')} value={data.transaction.reference} mono />
        <PdfDef label={t('report.pdf.label.amount')} value={fmtCHF(data.transaction.amount)} />
        <PdfDef
          label={t('report.pdf.label.pipelineStage')}
          value={data.transaction.stage ?? '—'}
        />
      </div>

      {/* 03 VERDICT GLOBAL — bandeau hero */}
      <PdfSectionRule num={3}>{t('report.pdf.section.verdict')}</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          border: `1px solid ${PDF.hairStrong}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {[
          {
            label: t('report.pdf.verdictCol.vigilance'),
            value: data.verdict.vigilance_label,
            sub: data.verdict.vigilance_sub,
          },
          {
            label: t('report.pdf.verdictCol.risk'),
            value: data.verdict.risk_label,
            sub: data.verdict.risk_sub,
            dot: data.verdict.risk_dot,
          },
          {
            label: t('report.pdf.verdictCol.status'),
            value: data.verdict.status_label,
            sub: data.verdict.status_sub,
            icon: data.verdict.status_icon,
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              padding: '20px 22px',
              borderRight:
                i < 2 ? `1px solid ${PDF.hairStrong}` : 'none',
              background: i === 1 ? PDF.cardSubtle : PDF.card,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: PDF.muted,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              {c.dot && (
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: c.dot,
                  }}
                />
              )}
              {c.icon === 'check' && <PdfCheckIcon size={18} />}
              {c.icon === 'alert' && (
                <PdfCheckIcon bg={PDF.errDot} size={18} />
              )}
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: PDF.ink,
                  letterSpacing: -0.6,
                  lineHeight: 1,
                }}
              >
                {c.value}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: PDF.muted,
                fontWeight: 500,
                letterSpacing: -0.05,
              }}
            >
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* VALIDATION FOOTER — éditorial fin */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 22,
          borderTop: `1px solid ${PDF.hairStrong}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'flex-end',
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
              marginBottom: 8,
            }}
          >
            {t('report.pdf.label.validation')}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: PDF.ink,
              letterSpacing: -0.1,
            }}
          >
            {data.validated_at ? (
              <span style={{ fontWeight: 700 }}>
                {t('report.pdf.validatedBy', {
                  date: fmtDateTimeSwiss(data.validated_at),
                  name: data.agent.full_name,
                })}
              </span>
            ) : (
              <span style={{ color: PDF.muted, fontStyle: 'italic' }}>
                {t('report.pdf.validationPending')}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: PDF.muted,
              fontWeight: 500,
              marginTop: 4,
              letterSpacing: 0.1,
            }}
          >
            {t('report.pdf.label.integrityHash')}{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>
              {fmtHashShort(data.integrity_hash)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              width: 140,
              height: 50,
              marginLeft: 'auto',
              borderBottom: `1px solid ${PDF.hairStrong}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              paddingBottom: 6,
              fontFamily: 'Caveat, cursive',
              fontSize: 26,
              color: PDF.ink,
              letterSpacing: -0.5,
            }}
          >
            {data.validated_at
              ? buildSignatureInitials(data.agent.full_name)
              : ''}
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: PDF.muted,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            {t('report.pdf.signatureCaption')}
          </div>
        </div>
      </div>

      {/* Mention confidentielle (italique éditorial) */}
      <div
        style={{
          marginTop: 18,
          fontSize: 9.5,
          color: PDF.muted,
          fontStyle: 'italic',
          fontWeight: 500,
          letterSpacing: 0.1,
          textAlign: 'center',
        }}
      >
        {t('report.pdf.confidentialNotice', { agency: data.agent.agency_name })}
      </div>
    </PdfShell>
  )
}

// "Sophie Marchand" → "S. Marchand"
function buildSignatureInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0]![0]}. ${parts.slice(1).join(' ')}`
}
