// MEGGA — Feuille A4 du rapport KYC (concept épuré) et ses primitives.
//
// Chaque page est une feuille de 794 × 1123 px : filigrane MEGGA centré (5,5 %),
// bandeau supérieur « logo · Rapport KYC · Confidentiel » fermé par un filet
// d'encre, corps en colonne, et en pied la référence du dossier face au numéro de
// page. Le bloc `bottom` (validation, attestation) est poussé au bas de la feuille
// AVANT la ligne de pagination — c'est la maquette : `.foot { margin-top: auto }`
// puis `.pn`.

import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MeggaWordmark } from './MeggaWordmark'
import { PDF, PDF_FONT, PDF_H, PDF_LABEL, PDF_MONO, PDF_PAD_BOT, PDF_PAD_TOP, PDF_PAD_X, PDF_W } from './tokens'

/** Largeur du filigrane sur la feuille (maquette : 520 px, opacité .055). */
const WATERMARK_W = 520

interface PdfShellProps {
  pageNum: number
  pageTotal: number
  reference: string
  /** Bloc collé au bas de la feuille, juste au-dessus de la pagination. */
  bottom?: ReactNode
  children: ReactNode
}

export function PdfShell({ pageNum, pageTotal, reference, bottom, children }: PdfShellProps) {
  const { t } = useTranslation('kyc')
  return (
    <div
      className="pdf-page"
      style={{
        width: PDF_W,
        height: PDF_H,
        boxSizing: 'border-box',
        padding: `${PDF_PAD_TOP}px ${PDF_PAD_X}px ${PDF_PAD_BOT}px`,
        background: PDF.paper,
        color: PDF.ink,
        fontFamily: PDF_FONT,
        fontVariantNumeric: 'tabular-nums',
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Filigrane — la marque, sous le texte, sans jamais le gêner */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: WATERMARK_W,
          transform: 'translate(-50%, -50%)',
          opacity: 0.055,
          color: PDF.ink,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <MeggaWordmark width={WATERMARK_W} />
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Bandeau supérieur */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: PDF.muted,
            paddingBottom: 14,
            borderBottom: `1px solid ${PDF.ink}`,
          }}
        >
          <MeggaWordmark height={11} style={{ color: PDF.ink }} />
          <span>{t('report.pdf.headerTag')}</span>
          <span>{t('report.pdf.confidential')}</span>
        </div>

        {children}

        {/* Pied : bloc collé au bas, puis référence · pagination */}
        <div style={{ marginTop: 'auto' }}>
          {bottom}
          <div
            style={{
              marginTop: bottom ? 22 : 0,
              paddingTop: bottom ? 0 : 20,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: PDF.muted,
            }}
          >
            <span>{reference}</span>
            <span>{pageNum} / {pageTotal}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Primitives ─────────────────────────────────────────────────────────

interface PdfTitleProps {
  level: 1 | 2
  children: ReactNode
}

/** Titre éditorial de la page : 46 px pour la synthèse, 30 px pour les suivantes. */
export function PdfTitle({ level, children }: PdfTitleProps) {
  const style: CSSProperties =
    level === 1
      ? { margin: '44px 0 0', fontSize: 46, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1 }
      : { margin: '44px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 }
  return level === 1 ? <h1 style={style}>{children}</h1> : <h2 style={style}>{children}</h2>
}

interface PdfKickerProps {
  children: ReactNode
  style?: CSSProperties
}

export function PdfKicker({ children, style }: PdfKickerProps) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: PDF.muted, letterSpacing: -0.05, ...style }}>
      {children}
    </div>
  )
}

interface PdfSectionProps {
  title: string
  /** Page 2 serre ses sections à 30 px (maquette `#p2 section`) pour tenir sur la feuille. */
  tight?: boolean
  children: ReactNode
}

export function PdfSection({ title, tight = false, children }: PdfSectionProps) {
  return (
    <section style={{ marginTop: tight ? 30 : 40 }}>
      <div
        style={{
          ...PDF_LABEL,
          letterSpacing: 1.4,
          paddingBottom: 10,
          borderBottom: `1px solid ${PDF.hair}`,
          marginBottom: 18,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  )
}

interface PdfDefProps {
  label: string
  value: ReactNode
  mono?: boolean
}

/** Paire libellé / valeur (« Référence · KYC-2026-0431 »). */
export function PdfDef({ label, value, mono = false }: PdfDefProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={PDF_LABEL}>{label}</span>
      <span
        style={
          mono
            ? { fontFamily: PDF_MONO, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1.3 }
            : { fontSize: 13.5, fontWeight: 600, letterSpacing: -0.15, lineHeight: 1.3 }
        }
      >
        {value}
      </span>
    </div>
  )
}

interface PdfParaProps {
  children: ReactNode
  style?: CSSProperties
}

/** Corps de texte ; un `<strong>` enfant repasse en encre pleine. */
export function PdfPara({ children, style }: PdfParaProps) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.7,
        color: PDF.inkSoft,
        fontWeight: 500,
        letterSpacing: -0.05,
        textWrap: 'pretty',
        ...style,
      }}
    >
      {children}
    </p>
  )
}

/** Mise en avant à l'intérieur d'un `PdfPara` (la maquette : `p strong`). */
export function PdfStrong({ children }: { children: ReactNode }) {
  return <strong style={{ color: PDF.ink, fontWeight: 700 }}>{children}</strong>
}

/** Pilule d'état, encre pleine — la seule « couleur » du document. */
export function PdfPill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 999,
        background: PDF.ink,
        color: PDF.paper,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ─── Tables ─────────────────────────────────────────────────────────────

export type PdfAlign = 'left' | 'right'

interface PdfTableProps {
  columns: Array<{ label: string; align?: PdfAlign }>
  children: ReactNode
}

export function PdfTable({ columns, children }: PdfTableProps) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={i}
              style={{
                ...PDF_LABEL,
                letterSpacing: 1.2,
                textAlign: c.align ?? 'left',
                padding: '0 0 8px',
                borderBottom: `1px solid ${PDF.hair}`,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

interface PdfCellProps {
  /** `key` = encre pleine (la clé de la ligne) · `muted` = gris (dates, tailles) · défaut = encre douce. */
  kind?: 'key' | 'muted' | 'body'
  align?: PdfAlign
  mono?: boolean
  /** Page 2 serre ses lignes à 8 px (maquette `#p2 td`). */
  tight?: boolean
  children: ReactNode
}

export function PdfCell({ kind = 'body', align = 'left', mono = false, tight = false, children }: PdfCellProps) {
  const color = kind === 'key' ? PDF.ink : kind === 'muted' ? PDF.muted : PDF.inkSoft
  return (
    <td
      style={{
        padding: tight ? '8px 0' : '9px 0',
        borderBottom: `1px solid ${PDF.hairRow}`,
        verticalAlign: 'top',
        textAlign: align,
        color,
        fontWeight: kind === 'key' ? 600 : 500,
        letterSpacing: kind === 'key' ? -0.05 : undefined,
        fontFamily: mono ? PDF_MONO : undefined,
        fontSize: mono ? 11 : undefined,
      }}
    >
      {children}
    </td>
  )
}
