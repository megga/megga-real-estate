// MEGGA CRM Sugar v2 — KYC Mode non-bloquant (Tier 4 — VariationE)
// 1:1 port from `megga-kyc-variations.jsx` VariationENonBlocking (lines 817-950).
// 3 composants : Banner doux fiche contact + Badge persistant carte deal + Tableau de dette.

import { useState, type ReactNode } from 'react'
import {
  Avatar, GhostBtn, KycIcon, Pill, SectionLabel, SP,
  type KycIconName, type KycTone,
} from './atoms'

// ─── Banner non-bloquant fiche contact ───────────────────────────────────
export interface KycSoftBannerProps {
  title: string
  desc: string
  onComplete?: () => void
  onDismiss?: () => void
}

export function KycSoftBanner({ title, desc, onComplete, onDismiss }: KycSoftBannerProps) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        background: SP.warnSoft,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <KycIcon name="alert" size={16} stroke={SP.warn} sw={2} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: SP.ink }}>{title}</div>
        <div
          style={{
            fontSize: 11.5,
            color: SP.inkSoft,
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <GhostBtn
        onClick={onComplete}
        style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
      >
        Compléter
      </GhostBtn>
      <button
        onClick={onDismiss}
        style={{
          height: 28,
          width: 28,
          borderRadius: 999,
          border: 0,
          background: 'transparent',
          color: SP.muted,
          cursor: 'pointer',
        }}
      >
        <KycIcon name="x" size={12} sw={2} />
      </button>
    </div>
  )
}

// ─── Badge persistant carte deal pipeline ────────────────────────────────
export interface KycDealBadgeProps {
  done: number
  total: number
  /** title on hover */
  hint?: string
}

export function KycDealBadge({ done, total, hint }: KycDealBadgeProps) {
  return (
    <span
      title={hint || `${total - done} pièces manquantes — non bloquant`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: SP.warnSoft,
        fontSize: 10.5,
        fontWeight: 700,
        color: SP.warn,
      }}
    >
      <KycIcon name="shield" size={10} stroke={SP.warn} sw={2.4} />
      KYC {done}/{total}
    </span>
  )
}

// ─── Action item (utility) ────────────────────────────────────────────────
interface ContactActionRow {
  l: string
  icon: KycIconName
  hint?: string
}

interface KycContactActionsProps {
  actions: ContactActionRow[]
}

export function KycContactActions({ actions }: KycContactActionsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: SP.muted,
        }}
      >
        Actions disponibles
      </div>
      {actions.map(a => (
        <div
          key={a.l}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: SP.cardSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <KycIcon name={a.icon} size={14} stroke={SP.inkSoft} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.l}</div>
            {a.hint && (
              <div
                style={{ fontSize: 10.5, color: SP.warn, marginTop: 2 }}
              >
                {a.hint}
              </div>
            )}
          </div>
          <KycIcon name="chev" size={12} stroke={SP.muted} />
        </div>
      ))}
    </div>
  )
}

// ─── Carte deal pipeline (avec badge) ────────────────────────────────────
export interface KycDealCardData {
  stage: string
  stageTone: KycTone
  name: string
  amount: string
  scoreText?: string
  due?: string
  dueLabel?: string
  kycDone: number
  kycTotal: number
}

interface KycDealCardProps {
  data: KycDealCardData
}

export function KycDealCard({ data }: KycDealCardProps) {
  return (
    <div
      style={{
        background: SP.surface,
        borderRadius: 18,
        padding: 16,
        boxShadow: SP.shadow,
        fontFamily: SP.font,
        color: SP.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Pill tone={data.stageTone} dot>
          {data.stage}
        </Pill>
        <div style={{ flex: 1 }} />
        <KycDealBadge done={data.kycDone} total={data.kycTotal} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{data.name}</div>
      <div
        style={{ fontSize: 11.5, color: SP.muted, marginTop: 2 }}
      >
        {data.amount}
        {data.scoreText && ` · ${data.scoreText}`}
      </div>
      {data.due && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 10,
            background: SP.cardSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <KycIcon name="clock" size={12} stroke={SP.warn} />
          <span style={{ fontSize: 11, color: SP.inkSoft }}>
            {data.dueLabel || 'Compléter KYC avant signature'}
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{ fontSize: 10.5, fontWeight: 700, color: SP.muted }}
          >
            {data.due}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Tableau de dette KYC (vue responsable) ──────────────────────────────
export interface KycDebtRow {
  name: string
  info: string
  days: number
  tone: KycTone
}

interface KycDebtTableProps {
  rows: KycDebtRow[]
  onRelance?: (name: string) => void
}

export function KycDebtTable({ rows, onRelance }: KycDebtTableProps) {
  return (
    <div
      style={{
        background: SP.surface,
        borderRadius: 18,
        padding: 16,
        boxShadow: SP.shadow,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        fontFamily: SP.font,
        color: SP.ink,
      }}
    >
      <div
        style={{ fontSize: 12, color: SP.muted, marginBottom: 10 }}
      >
        Aucune action n'est jamais bloquée. Le responsable conformité voit ici la dette
        accumulée et relance.
      </div>
      {rows.map(r => (
        <div
          key={r.name}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto auto',
            gap: 10,
            alignItems: 'center',
            padding: '10px 4px',
            borderTop: `1px solid ${SP.cardSubtle}`,
          }}
        >
          <Avatar name={r.name} size={28} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.name}</div>
            <div
              style={{ fontSize: 11, color: SP.muted, marginTop: 1 }}
            >
              {r.info}
            </div>
          </div>
          <Pill tone={r.tone}>{r.days}j</Pill>
          <button
            onClick={() => onRelance?.(r.name)}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              border: 0,
              background: SP.cardSubtle,
              color: SP.ink,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: SP.font,
            }}
          >
            Relancer
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Showcase combiné (3 contextes) — utilisé dans la page démo ──────────
const SHOWCASE_DEBT_ROWS: KycDebtRow[] = [
  { name: 'S. Volkov', info: '2 pièces manquantes', days: 6, tone: 'warn' },
  { name: 'ATR Holding SA', info: 'Bénéf. effectif à signer', days: 4, tone: 'warn' },
  { name: 'A. Reinhardt', info: 'Screening > 12 mois', days: 12, tone: 'pending' },
  { name: 'C. Loreau', info: 'Identité non saisie', days: 5, tone: 'warn' },
  { name: 'P. Vionnet', info: 'Validation en attente', days: 3, tone: 'pending' },
]

const SHOWCASE_ACTIONS: ContactActionRow[] = [
  { l: 'Planifier une visite', icon: 'clock' },
  { l: 'Envoyer 3 nouveaux matchs', icon: 'spark' },
  {
    l: 'Préparer une offre',
    icon: 'doc',
    hint: '⚠ KYC requis avant signature finale',
  },
  {
    l: 'Lancer compromis (signature)',
    icon: 'flag',
    hint: '⚠ Validation conformité requise — sera demandée à la signature',
  },
]

export function KycNonBlockingShowcase({
  fiche,
  pipeline,
  debt,
}: {
  fiche?: ReactNode
  pipeline?: ReactNode
  debt?: ReactNode
}) {
  const [bannerVisible, setBannerVisible] = useState(true)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        gap: 18,
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Gauche — fiche contact avec banner doux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel>
          Fiche contact — banner doux (n'empêche aucune action)
        </SectionLabel>
        {fiche || (
          <div
            style={{
              background: SP.surface,
              borderRadius: 22,
              padding: 20,
              boxShadow: SP.shadow,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 14,
              }}
            >
              <Avatar name="S Volkov" size={48} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: -0.3,
                  }}
                >
                  Sergey Volkov
                </div>
                <div style={{ fontSize: 12, color: SP.muted }}>
                  Acheteur · CHF 2.75M · Cologny
                </div>
              </div>
              <Pill tone="warn" dot>
                KYC incomplet · 6j
              </Pill>
            </div>
            {bannerVisible && (
              <div style={{ marginBottom: 14 }}>
                <KycSoftBanner
                  title="2 pièces manquantes au dossier KYC"
                  desc="Justificatif de domicile · attestation d'origine des fonds. Vous pouvez continuer à travailler ce dossier — pensez à compléter avant la signature."
                  onDismiss={() => setBannerVisible(false)}
                />
              </div>
            )}
            <KycContactActions actions={SHOWCASE_ACTIONS} />
          </div>
        )}
      </div>
      {/* Droite — pipeline + dette */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0,
        }}
      >
        <SectionLabel>Carte deal — badge persistant</SectionLabel>
        {pipeline || (
          <KycDealCard
            data={{
              stage: 'Intérêt confirmé',
              stageTone: 'warn',
              name: 'Sergey Volkov — Cologny 7p',
              amount: "CHF 2'750'000",
              scoreText: 'score 88',
              due: '06/05',
              dueLabel: 'Compléter KYC avant signature',
              kycDone: 4,
              kycTotal: 6,
            }}
          />
        )}
        <SectionLabel>Tableau de dette — vu par le responsable</SectionLabel>
        {debt || <KycDebtTable rows={SHOWCASE_DEBT_ROWS} />}
      </div>
    </div>
  )
}
