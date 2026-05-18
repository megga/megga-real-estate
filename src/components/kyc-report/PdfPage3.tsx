// MEGGA — Page 3 du rapport PDF KYC : Annexes
// Sections (renumérotées) :
//   07 Documents joints au dossier (ex 09)
//   08 Piste d'audit & conservation (ex 10)

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
          Annexes
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
          Pièces justificatives.
        </h2>
      </div>

      {/* 07 — Documents joints */}
      <PdfSectionRule num={7}>
        Documents joints au dossier · {docCount}
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
          Aucun document n'est joint au dossier à ce jour.
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
              {['#', 'Nom du fichier', 'Catégorie', 'Date', 'Taille', 'Hash'].map(
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
      <PdfSectionRule num={8}>Piste d'audit &amp; conservation</PdfSectionRule>
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
            label="Durée de conservation"
            value={`10 ans à compter du ${fmtDateSwiss(data.retention_until)}`}
          />
          <div style={{ marginTop: 14 }}>
            Conformément à l'art. 7 al. 3 LBA, l'intégralité du dossier
            (pièces, screening, piste d'audit) est conservée sous forme intègre
            et accessible pendant dix ans, y compris après la fin de la
            relation d'affaires.
          </div>
        </div>
        <div>
          <PdfDef label="Base légale" value="LBA · OBA-FINMA · nLPD" />
          <div style={{ marginTop: 14 }}>
            Le présent rapport vaut documentation au sens de l'art. 7 LBA et
            de l'art. 22 OBA-FINMA. Le traitement des données personnelles
            respecte les principes de la nLPD (proportionnalité, finalité,
            sécurité). Droit d'accès garanti au client conformément à l'art.
            25 nLPD.
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
            Attestation finale
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
            Le présent rapport KYC est complet, daté et signé par
            l'intermédiaire financier soumis à la LBA. Aucune information
            matérielle n'a été omise.
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
