// MEGGA CRM Sugar v3 — Onglet Synthèse de la fiche dossier (handoff §5)
// Port de crm-screen-kyc-sugar.jsx §KycSynthese.
//
// Atterrissage « où j'en suis · quoi faire » :
//   • carte État du dossier + actions (Re-screener, Tout marquer vérifié/Exporter)
//   • aperçu des 5 contrôles (→ onglet Contrôles)
//   • bloc Informations (risque, type, dates, dernier screening, référence)
//
// Politique KYC NON-BLOQUANTE (CLAUDE.md) : le message d'état reste un rappel
// doux, jamais un verrou pipeline. Les micro-animations des boutons sont câblées
// au VRAI état des mutations (pas un timer fictif comme le prototype).

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { KYC_CHECK_LABELS, KYC_CHECK_ICONS, KYC_STATUS_LABELS, KYC_RISK_LABELS, fmtDateLong } from '../tokens'
import { SgIcon } from '../icons'
import { useKycPalette } from './kycPalette'
import { KycBlackPill, KycMetaRow } from './kycPrimitives'
import type {
  KycCaseWithChecklist,
  KycCheckCategory,
  KycChecklistItem,
  KycDossierStatus,
} from '@/types/kyc'

const CHECK_KEYS: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

interface Props {
  dossier: KycCaseWithChecklist
  checksByCategory: Record<KycCheckCategory, KycChecklistItem | null>
  done: number
  total: number
  lastScreeningAt: string | null
  isVerified: boolean
  // Actions (logique + garde compliance portées par KycDossierDetail)
  onRescreen: () => void
  rescreening: boolean
  onMarkAll: () => void
  markAllPending: boolean
  canMarkAll: boolean
  markAllBlockedLabel: string | null
  onExport: () => void
  goControles: () => void
  /** Encart compliance (match sanctions/PEP, faux positif) rendu par le parent. */
  alert?: ReactNode
}

export function KycSynthese({
  dossier,
  checksByCategory,
  lastScreeningAt,
  isVerified,
  onRescreen,
  rescreening,
  onMarkAll,
  markAllPending,
  canMarkAll,
  markAllBlockedLabel,
  onExport,
  goControles,
  alert,
}: Props) {
  const sp = useKycPalette()

  const bento = {
    background: sp.card,
    borderRadius: 22,
    padding: '24px 26px',
    border: `1px solid ${sp.cardBorder}`,
    boxShadow: sp.shadow,
  } as const
  const eyebrow = {
    fontSize: 11,
    fontWeight: 600,
    color: sp.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  } as const

  const typeLabel = dossier.type.startsWith('buyer') ? 'Acheteur' : 'Vendeur'
  const ref = (dossier.id || '').slice(0, 8).toUpperCase() || '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {alert}

      {/* État du dossier + prochaine étape */}
      <div style={bento}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={eyebrow}>État du dossier</div>
            <div
              style={{ fontSize: 16.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}
            >
              {isVerified ? 'Dossier vérifié — transaction autorisée' : 'Vérifications à compléter'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: sp.muted,
                fontWeight: 500,
                marginTop: 4,
                lineHeight: 1.55,
                maxWidth: 460,
              }}
            >
              {isVerified
                ? 'Tous les contrôles LBA sont validés.'
                : 'Vous pouvez continuer à faire avancer le deal — le KYC reste recommandé avant la signature, mais il n\'est pas bloquant.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            <KycReScreenButton pending={rescreening} onClick={onRescreen} />
            {isVerified ? (
              <KycExportButton onClick={onExport} />
            ) : (
              <KycBlackPill
                size="md"
                onClick={onMarkAll}
                disabled={markAllPending || !canMarkAll}
                title={markAllBlockedLabel ?? undefined}
                icon={<SgIcon name="checkAll" size={14} stroke={sp.onAccent} />}
              >
                {markAllPending ? 'Validation…' : 'Tout marquer vérifié'}
              </KycBlackPill>
            )}
          </div>
        </div>
      </div>

      {/* Aperçu contrôles + informations */}
      <div className="sg-grid-synthese" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16 }}>
        <div style={bento}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ ...eyebrow, marginBottom: 0, whiteSpace: 'nowrap' }}>
              Contrôles · LBA art. 3-7
            </div>
            <button
              onClick={goControles}
              style={{
                border: 0,
                background: 'transparent',
                color: sp.ink,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Voir le détail
              <SgIcon name="arrowR" size={13} stroke={sp.ink} />
            </button>
          </div>
          {CHECK_KEYS.map((k, i) => (
            <KycCheckMini
              key={k}
              category={k}
              check={checksByCategory[k]}
              onClick={goControles}
              last={i === CHECK_KEYS.length - 1}
            />
          ))}
        </div>

        <div style={bento}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Informations</div>
          <KycMetaRow label="Niveau de risque">
            {KYC_RISK_LABELS[dossier.risk_level]?.label ?? '—'}
          </KycMetaRow>
          <KycMetaRow label="Type de contact">{typeLabel}</KycMetaRow>
          <KycMetaRow label="Dossier ouvert le">{fmtDateLong(dossier.created_at)}</KycMetaRow>
          <KycMetaRow label="Dernier screening">{fmtDateLong(lastScreeningAt)}</KycMetaRow>
          <KycMetaRow label="Échéance">{fmtDateLong(dossier.expires_at)}</KycMetaRow>
          <KycMetaRow label="Référence" last>
            <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0.2 }}>{ref}</span>
          </KycMetaRow>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne contrôle compacte (aperçu synthèse → onglet Contrôles) ───────
interface CheckMiniProps {
  category: KycCheckCategory
  check: KycChecklistItem | null
  onClick: () => void
  last?: boolean
}

function KycCheckMini({ category, check, onClick, last }: CheckMiniProps) {
  const sp = useKycPalette()
  const label = KYC_CHECK_LABELS[category]
  const verified = !!(check?.is_completed || check?.is_required === false)
  const uiStatus: KycDossierStatus = verified ? 'verified' : 'pending'
  const meta = KYC_STATUS_LABELS[uiStatus]
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: last ? 'none' : `1px solid ${sp.cardSubtle}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          flexShrink: 0,
          background: verified ? sp.black : sp.cardSubtle,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SgIcon
          name={KYC_CHECK_ICONS[category] || 'shield'}
          size={16}
          stroke={verified ? sp.onAccent : sp.inkSoft}
        />
      </div>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          fontWeight: 600,
          color: sp.ink,
          letterSpacing: -0.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label.title}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          fontSize: 11.5,
          fontWeight: 700,
          color: verified ? sp.muted : meta.tone,
        }}
      >
        {meta.label}
      </span>
    </button>
  )
}

// ─── Bouton « Re-screener » (animation câblée à la mutation réelle) ──────
// idle → (pending) running ⟳ « Screening en cours… » → (résolu) done ✓ vert
// « Screening à jour » ~1.9s → idle. Le pending vient de screen.isPending.
function KycReScreenButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)
  const [justDone, setJustDone] = useState(false)
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending) {
      wasPending.current = pending
      // transition running → repos : flash « à jour ». setState différé dans des
      // callbacks de timeout (jamais synchrone dans le corps de l'effet → pas de
      // re-render en cascade).
      const flash = setTimeout(() => setJustDone(true), 0)
      const reset = setTimeout(() => setJustDone(false), 1900)
      return () => {
        clearTimeout(flash)
        clearTimeout(reset)
      }
    }
    wasPending.current = pending
  }, [pending])

  const done = justDone && !pending
  const label = pending ? 'Screening en cours…' : done ? 'Screening à jour' : 'Re-screener'
  const tint = done ? '#10B981' : sp.inkSoft

  return (
    <button
      onClick={() => !pending && onClick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={pending}
      style={{
        height: 40,
        padding: '0 18px',
        borderRadius: 999,
        border: 0,
        background: hover && !pending && !done ? sp.card : 'transparent',
        color: tint,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: pending ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        boxShadow: hover && !pending && !done ? sp.shadow : 'none',
        transition: 'all .18s ease',
        transform: hover && !pending && !done ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          animation: pending ? 'kycSpin .8s linear infinite' : 'none',
        }}
      >
        <SgIcon name={done ? 'check' : 'refresh'} size={14} stroke={tint} sw={done ? 2.2 : 1.8} />
      </span>
      <span style={{ color: tint }}>{label}</span>
    </button>
  )
}

// ─── Bouton « Exporter le dossier » (accent, animation au clic) ─────────
function KycExportButton({ onClick }: { onClick: () => void }) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')

  useEffect(() => {
    if (state === 'running') {
      const t = setTimeout(() => setState('done'), 1200)
      return () => clearTimeout(t)
    }
    if (state === 'done') {
      const t = setTimeout(() => setState('idle'), 1900)
      return () => clearTimeout(t)
    }
  }, [state])

  const running = state === 'running'
  const done = state === 'done'
  const label = running ? 'Génération…' : done ? 'Dossier exporté' : 'Exporter le dossier'
  const bg = done ? '#10B981' : running || hover ? sp.blackHover : sp.black

  return (
    <button
      onClick={() => {
        if (state !== 'idle') return
        setState('running')
        onClick()
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={running}
      style={{
        height: 44,
        padding: '0 18px',
        borderRadius: 999,
        border: 0,
        background: bg,
        color: sp.onAccent,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        cursor: running ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        transition: 'background .2s ease, transform .18s ease',
        transform: hover && state === 'idle' ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          animation: running ? 'kycSpin .8s linear infinite' : 'none',
        }}
      >
        <SgIcon
          name={done ? 'check' : running ? 'refresh' : 'download'}
          size={14}
          stroke={sp.onAccent}
          sw={done ? 2.2 : 1.8}
        />
      </span>
      {label}
    </button>
  )
}
