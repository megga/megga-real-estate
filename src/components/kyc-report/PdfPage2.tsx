// MEGGA — Page 2 du rapport PDF KYC : Contrôles & pièces
// Sections (renumérotées) :
//   04 Screening listes officielles · Dilisense (ex 05)
//   05 Contrôles LBA validés · art. 3 à 7   (ex 07)
//   06 Source des fonds documentée          (ex 08)
// La section "Analyse contextuelle Claude Sonnet 4.6" (ex 06) du modèle est
// volontairement supprimée — décision produit, PDF "zero AI" pour le notaire.

import { PdfShell, PdfSectionRule, PdfDef, PdfSemPill, PdfCheckIcon } from './PdfShell'
import { PDF, fmtCHF, fmtDateSwiss, fmtDateTimeSwiss, pad2 } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function PdfPage2({ data }: Props) {
  const screeningDate = fmtDateTimeSwiss(data.screening_date)
  const screeningRows: Array<[string, string, string, string]> = [
    ['PEP (Personnes Exposées Politiquement)', data.screening_provider, '0 match', screeningDate],
    ['Sanctions OFAC (États-Unis)', data.screening_provider, '0 match', screeningDate],
    ['Sanctions SECO (Suisse)', data.screening_provider, '0 match', screeningDate],
    ['Sanctions UE', data.screening_provider, '0 match', screeningDate],
    ['Sanctions ONU', data.screening_provider, '0 match', screeningDate],
    ['Listes adverse media', data.screening_provider, '0 match', screeningDate],
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
          Diligence raisonnable effectuée
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
          Contrôles &amp; pièces.
        </h2>
      </div>

      {/* 04 — Screening Dilisense */}
      <PdfSectionRule num={4}>
        Screening listes officielles · {data.screening_provider}
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
            {['Liste', 'Provider', 'Résultat', 'Horodatage', ''].map((h, i) => (
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
                {data.screening_clear ? '0 match' : r[2]}
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
                  <PdfSemPill tone="ok">Clear</PdfSemPill>
                ) : (
                  <PdfSemPill tone="warn">À examiner</PdfSemPill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 05 — Contrôles LBA validés */}
      <PdfSectionRule num={5}>
        Contrôles LBA validés · art. 3 à 7
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
            {['#', 'Contrôle', 'Pièce justificative', 'Date', 'Agent'].map(
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
      <PdfSectionRule num={6}>Source des fonds documentée</PdfSectionRule>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 24,
        }}
      >
        <PdfDef label="Type" value={data.source_of_funds.type_label} />
        <PdfDef
          label="Établissement"
          value={data.source_of_funds.establishment ?? '—'}
        />
        <PdfDef
          label="Montant attesté"
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
    </PdfShell>
  )
}
