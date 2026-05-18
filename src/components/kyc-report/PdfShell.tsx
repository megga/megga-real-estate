// MEGGA — Shell PDF du rapport KYC (Sprint 4.4)
// Format A4 (794 × 1123 px) — Manrope + Caveat
// Footer LBA art. 7 (conservation 10 ans)

import type { ReactNode } from 'react'
import { PDF, PDF_W, PDF_H, PDF_PAD_X, PDF_PAD_TOP, PDF_PAD_BOT, pad2 } from './tokens'
import { PdfIcon } from './PdfIcon'

interface PdfShellProps {
  pageNum: number
  pageTotal: number
  children: ReactNode
}

export function PdfShell({ pageNum, pageTotal, children }: PdfShellProps) {
  return (
    <div
      className="pdf-page"
      style={{
        width: PDF_W,
        height: PDF_H,
        background: '#FFFFFF',
        boxShadow:
          '0 24px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: PDF.ink,
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          padding: `${PDF_PAD_TOP}px ${PDF_PAD_X}px 14px`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${PDF.hairStrong}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: 'Manrope, system-ui, sans-serif',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: -0.4,
              color: PDF.ink,
              lineHeight: 1,
            }}
          >
            MEGGA
          </span>
        </div>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            color: PDF.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Rapport KYC · LBA
        </div>
      </header>

      {/* CONTENT */}
      <main
        style={{
          flex: 1,
          padding: `28px ${PDF_PAD_X}px ${PDF_PAD_BOT}px`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>

      {/* FOOTER */}
      <footer
        style={{
          padding: `12px ${PDF_PAD_X}px 24px`,
          borderTop: `1px solid ${PDF.hairStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 9,
          color: PDF.muted,
          fontWeight: 500,
          letterSpacing: 0.3,
        }}
      >
        <span>
          MEGGA · legal@megga.ch · LBA art. 7 · Document à conserver 10 ans
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          p. <span style={{ color: PDF.ink, fontWeight: 700 }}>{pad2(pageNum)}</span> / {pad2(pageTotal)}
        </span>
      </footer>
    </div>
  )
}

// ─── Sub-primitives ─────────────────────────────────────────────────────

interface PdfSectionRuleProps {
  children: ReactNode
  num?: number
}

export function PdfSectionRule({ children, num }: PdfSectionRuleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        margin: '20px 0 12px',
        paddingBottom: 6,
        borderBottom: `1px solid ${PDF.hairStrong}`,
      }}
    >
      {num !== undefined && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: PDF.muted,
            letterSpacing: 1.4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pad2(num)}
        </span>
      )}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: PDF.ink,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
    </div>
  )
}

interface PdfDefProps {
  label: string
  value: ReactNode
  mono?: boolean
}

export function PdfDef({ label, value, mono = false }: PdfDefProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: PDF.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: PDF.ink,
          letterSpacing: -0.1,
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, monospace'
            : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface PdfSemPillProps {
  tone: 'ok' | 'warn' | 'err' | 'neutral'
  children: ReactNode
}

export function PdfSemPill({ tone, children }: PdfSemPillProps) {
  const map = {
    ok: { bg: '#15643F', fg: '#FFFFFF' },
    warn: { bg: '#A0521E', fg: '#FFFFFF' },
    err: { bg: '#8E1F3D', fg: '#FFFFFF' },
    neutral: { bg: '#202127', fg: '#FFFFFF' },
  }
  const m = map[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.20), inset 0 -1px 0 rgba(0,0,0,0.10)',
      }}
    >
      {children}
    </span>
  )
}

interface PdfCheckIconProps {
  bg?: string
  size?: number
}

export function PdfCheckIcon({ bg = PDF.black, size = 14 }: PdfCheckIconProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <PdfIcon name="check" size={size * 0.62} stroke="#fff" sw={2.6} />
    </span>
  )
}
