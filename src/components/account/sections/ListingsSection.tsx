import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import {
  useVendorDossiers,
  PIPELINE_STEPS,
  type PipelineStatus,
  type VendorDossier,
} from '@/hooks/useVendorDossiers'
import EmptyState from '../EmptyState'
import { HomeIcon, TrashIcon, MessageIcon, ChevronRightIcon } from '../icons'

function formatCHF(n: number): string {
  return `CHF ${n.toLocaleString('fr-CH').replace(/ |,| /g, "'")}`
}

interface PipelineProps {
  status: PipelineStatus
}

function Pipeline({ status }: PipelineProps) {
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.key === status)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, minmax(80px, 1fr))`,
        gap: 0,
        position: 'relative',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const dotBg = done ? T.ink : active ? T.accent : '#fff'
        const dotBorder = done ? T.ink : active ? T.ink : T.border
        const dotColor = done ? '#fff' : active ? '#fff' : T.ink

        return (
          <div
            key={step.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              padding: '0 4px',
            }}
          >
            {i > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 13,
                  left: '-50%',
                  right: '50%',
                  height: 2,
                  background: i <= currentIdx ? T.ink : T.border,
                  zIndex: 0,
                }}
              />
            )}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: dotBg,
                border: `2px solid ${dotBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 800,
                color: dotColor,
                boxShadow: active ? `0 0 0 4px ${T.accentSoft}` : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {done ? (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7l3 3 5-6" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 700,
                color: active || done ? T.ink : '#7A8079',
                textAlign: 'center',
                letterSpacing: -0.1,
              }}
            >
              {step.label}
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 10,
                color: '#9AA09A',
                textAlign: 'center',
                lineHeight: 1.3,
                minHeight: 26,
              }}
            >
              {step.sub}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface CountdownProps {
  due: number
}

function Countdown({ due }: CountdownProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const remaining = due - Date.now()
  if (remaining <= 0) {
    return (
      <span style={{ fontFamily: T.fontStack, fontSize: 11, color: T.warning, fontWeight: 700 }}>
        Réponse attendue
      </span>
    )
  }

  const hours = Math.floor(remaining / 3_600_000)
  const mins = Math.floor((remaining % 3_600_000) / 60_000)

  return (
    <span
      style={{
        fontFamily: T.fontStack,
        fontSize: 11,
        color: T.muted,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {hours > 0
        ? `${hours} h ${mins.toString().padStart(2, '0')} restantes`
        : `${mins} min restantes`}
    </span>
  )
}

interface EstimationPanelProps {
  dossier: VendorDossier
  onSign: () => void
}

function EstimationPanel({ dossier, onSign }: EstimationPanelProps) {
  if (!dossier.estimation) return null
  const e = dossier.estimation
  const fmt = (n: number) => formatCHF(n) + (e.isRent ? ' /mois' : '')
  const showSign = dossier.status === 'estimated'

  return (
    <div
      style={{
        borderTop: `1px solid ${T.border}`,
        padding: '20px 22px',
        background: 'linear-gradient(180deg, #fff 0%, #FAFBFD 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: T.accent,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2" />
          </svg>
        </span>
        <span
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            fontWeight: 800,
            color: T.ink,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Estimation reçue
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Émise par {dossier.agent.name}
        </span>
      </div>

      <div
        style={{
          padding: '18px 20px',
          borderRadius: 14,
          background: '#fff',
          border: `1px solid ${T.border}`,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          {[
            { k: 'Bas', v: e.low, align: 'left' as const },
            { k: 'Médiane', v: e.mid, align: 'center' as const },
            { k: 'Haut', v: e.high, align: 'right' as const },
          ].map((it, i) => (
            <div key={it.k} style={{ textAlign: it.align }}>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 10,
                  color: T.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                {it.k}
              </div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: i === 1 ? 22 : 16,
                  fontWeight: i === 1 ? 800 : 700,
                  color: T.ink,
                  letterSpacing: -0.4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(it.v)}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'relative',
            height: 8,
            borderRadius: 999,
            background: T.section,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '100%',
              background: `linear-gradient(90deg, ${T.accent} 0%, ${T.ink} 50%, ${T.accent} 100%)`,
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -3,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: T.ink,
              border: '2px solid #fff',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            marginBottom: 8,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Ventes comparables
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {e.comparables.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                gap: 14,
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 10,
                background: T.section,
                fontFamily: T.fontStack,
                fontSize: 12,
              }}
            >
              <span style={{ color: T.ink, fontWeight: 600 }}>{c.addr}</span>
              <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{c.surface} m²</span>
              <span
                style={{
                  color: T.ink,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(c.price)}
              </span>
              <span style={{ color: T.muted, fontSize: 11 }}>{c.sold}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 12,
          color: T.soft,
          lineHeight: 1.55,
          marginBottom: showSign ? 16 : 0,
        }}
      >
        {e.note}
      </div>

      {showSign && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onSign}
            style={{
              height: 42,
              padding: '0 20px',
              borderRadius: 999,
              background: T.ink,
              color: '#fff',
              border: 'none',
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Signer le mandat
            <ChevronRightIcon size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

interface PublicationPanelProps {
  dossier: VendorDossier
}

function PublicationPanel({ dossier }: PublicationPanelProps) {
  if (!dossier.publication) return null
  const p = dossier.publication
  const isRent = dossier.transaction === 'location'
  const priceLabel = formatCHF(p.listingPrice) + (isRent ? ' /mois' : '')
  const publishedDate = new Date(p.publishedAt).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
  })

  const stat = (label: string, value: string, accent: boolean) => (
    <div
      key={label}
      style={{
        flex: 1,
        padding: '12px 14px',
        borderRadius: 12,
        background: '#fff',
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 10,
          color: T.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 22,
          fontWeight: 800,
          color: accent ? T.green : T.ink,
          letterSpacing: -0.4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: '20px 22px', background: T.section }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: '#fff',
            color: T.ink,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${T.border}`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6" />
            <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
          </svg>
        </span>
        <span
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            fontWeight: 800,
            color: T.ink,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Annonce publiée
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ID {p.publicId} · le {publishedDate}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 16,
          background: '#fff',
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background:
              'repeating-linear-gradient(135deg, #EEF1EA 0 8px, #F6F8F4 8px 16px)',
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 10,
              color: T.muted,
              letterSpacing: 0.4,
            }}
          >
            Photo couverture
          </span>
        </div>
        <div style={{ padding: '14px 16px 14px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 18,
              fontWeight: 800,
              color: T.ink,
              letterSpacing: -0.3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {priceLabel}
          </div>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 600,
              color: T.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dossier.title}
          </div>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 12,
              color: T.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dossier.address}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {stat('Vues', p.views.toLocaleString('fr-CH'), false)}
        {stat('Favoris', p.favorites.toLocaleString('fr-CH'), false)}
        {stat('Contacts', p.contacts.toLocaleString('fr-CH'), true)}
        {stat('Visites', p.visits.toLocaleString('fr-CH'), false)}
      </div>
    </div>
  )
}

interface CardProps {
  dossier: VendorDossier
  onAdvance: (id: string, status: PipelineStatus) => void
  onRemove: (id: string) => void
  onSign: (dossier: VendorDossier) => void
  onOpenStats?: (dossier: VendorDossier) => void
}

function DossierCard({ dossier: d, onAdvance, onRemove, onSign, onOpenStats }: CardProps) {
  const dateStr = new Date(d.createdAt).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const transactionLabel = d.transaction === 'location' ? 'Location' : 'Vente'
  const typeLabel: Record<string, string> = {
    appartement: 'Appartement',
    maison: 'Maison',
    terrain: 'Terrain',
    commercial: 'Local commercial',
  }
  const statusStep = PIPELINE_STEPS.find((s) => s.key === d.status) ?? PIPELINE_STEPS[0]

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 22px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: T.accentSoft,
                fontFamily: T.fontStack,
                fontSize: 10,
                fontWeight: 800,
                color: T.ink,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {statusStep.label}
            </span>
            <span
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                color: T.muted,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Soumis le {dateStr}
            </span>
          </div>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 18,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: -0.3,
              lineHeight: 1.25,
              marginBottom: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {d.title}
          </div>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 12,
              color: T.muted,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <span>{transactionLabel}</span>
            <span>·</span>
            <span>{typeLabel[d.propertyType] || 'Bien'}</span>
            {d.surface && (
              <>
                <span>·</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.surface} m²</span>
              </>
            )}
            {d.rooms != null && (
              <>
                <span>·</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.rooms} pces</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => onRemove(d.id)}
          style={{
            width: 36,
            height: 36,
            border: `1px solid ${T.border}`,
            background: '#fff',
            color: T.muted,
            cursor: 'pointer',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title="Retirer ce dossier"
        >
          <TrashIcon size={14} />
        </button>
      </div>

      <div
        style={{
          padding: '8px 22px 20px',
          borderTop: `1px solid ${T.border}`,
          background: T.section,
        }}
      >
        <div style={{ paddingTop: 16 }}>
          <Pipeline status={d.status} />
        </div>
      </div>

      <div
        style={{
          padding: '16px 22px',
          borderTop: `1px solid ${T.border}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              flexShrink: 0,
              background: T.ink,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: T.fontStack,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}
          >
            {d.agent.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 13,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: -0.1,
              }}
            >
              {d.agent.name}
            </div>
            <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>{d.agent.role}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {d.status === 'received' && d.nextAction && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                background: T.accentSoft,
                fontFamily: T.fontStack,
              }}
            >
              <Countdown due={d.nextAction.due} />
            </div>
          )}
          <a
            href="#messages"
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.ink,
              fontFamily: T.fontStack,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MessageIcon size={13} /> Voir l'échange
          </a>
        </div>
      </div>

      {d.estimation && <EstimationPanel dossier={d} onSign={() => onSign(d)} />}
      {d.publication && (
        <>
          <PublicationPanel dossier={d} />
          {onOpenStats && (
            <div
              style={{
                padding: '0 22px 16px',
                background: T.section,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => onOpenStats(d)}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${T.border}`,
                  background: '#fff',
                  color: T.ink,
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden>
                  <rect x="1" y="6" width="2" height="4" fill="currentColor" rx="0.5" />
                  <rect x="4.5" y="3" width="2" height="7" fill="currentColor" rx="0.5" />
                  <rect x="8" y="1" width="2" height="9" fill="currentColor" rx="0.5" />
                </svg>
                Voir les statistiques détaillées
              </button>
            </div>
          )}
        </>
      )}

      <details
        style={{
          borderTop: `1px solid ${T.border}`,
          padding: '10px 22px',
          background: T.page,
        }}
      >
        <summary
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: 0.2,
            listStyle: 'none',
          }}
        >
          → Démo · faire avancer le dossier
        </summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {PIPELINE_STEPS.map((s) => {
            const active = s.key === d.status
            return (
              <button
                key={s.key}
                onClick={() => onAdvance(d.id, s.key)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: `1px solid ${active ? T.ink : T.border}`,
                  background: active ? T.ink : '#fff',
                  color: active ? '#fff' : T.soft,
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </details>
    </div>
  )
}

interface Props {
  onSign?: (dossier: VendorDossier) => void
  onOpenStats?: (dossier: VendorDossier) => void
}

export default function ListingsSection({ onSign, onOpenStats }: Props) {
  const { dossiers, advance, remove, submit } = useVendorDossiers()
  const { t } = useTranslation('compte')

  if (dossiers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <EmptyState
          icon={<HomeIcon size={28} />}
          title={t('empty.listings.title')}
          body={t('empty.listings.body')}
          cta={t('empty.listings.cta')}
          ctaHref="/sell"
        />
        {/* Demo seed button (only when empty) */}
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            background: T.section,
            border: `1px dashed ${T.border}`,
            fontFamily: T.fontStack,
            fontSize: 12,
            color: T.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            <strong style={{ color: T.ink, fontWeight: 700 }}>Démo —</strong> aucun dossier réel pour le moment.
          </span>
          <button
            onClick={() =>
              submit({
                propertyType: 'appartement',
                transaction: 'vente',
                address: 'Rue du Rhône 12, 1204 Genève',
                surface: '112',
                rooms: 4.5,
                photos: 8,
                title: 'Appartement 4.5 pces · Rue du Rhône',
              })
            }
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.ink,
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Créer un dossier de démonstration
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dossiers.map((d) => (
        <DossierCard
          key={d.id}
          dossier={d}
          onAdvance={advance}
          onRemove={remove}
          onSign={(dossier) => onSign?.(dossier)}
          onOpenStats={onOpenStats}
        />
      ))}
    </div>
  )
}
