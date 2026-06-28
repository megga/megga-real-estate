// MEGGA CRM Sugar v2 Wizard — Step 8 (Success)
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step8.jsx).

import { useState, useEffect, useMemo, type ReactNode, type CSSProperties } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { SugarV2, sgOn, fmtCHF, shade, type WizardData } from '../tokens'

interface SuccessProps {
  data: WizardData
  onClose: () => void
  onBackToCRM: () => void
}

export function Step8Success({ data, onClose, onBackToCRM }: SuccessProps) {
  const { t: tr } = useTranslation('listings')
  const [phase, setPhase] = useState<'entering' | 'settled'>('entering')
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('settled'), 900)
    const t2 = window.setTimeout(() => setShowConfetti(false), 2400)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [])

  const tx = data.transaction || 'vente'
  const price = tx === 'vente' ? data.price : data.rent
  const cover = (data.photos || [])[0]
  const photoCount = (data.photos || []).length

  const slug = (data.addr || 'nouveau-bien').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const publicUrl = `megga.ch/annonce/${slug}`

  const mode = data.publishMode || 'now'
  const titleByMode: Record<string, string> = {
    now: tr('wizard.step8.title.now'),
    schedule: tr('wizard.step8.title.schedule'),
    draft: tr('wizard.step8.title.draft'),
  }
  const subByMode: Record<string, string> = {
    now: tr('wizard.step8.subtitle.now'),
    schedule: tr('wizard.step8.subtitle.schedule', {
      date: data.scheduledAt ? formatScheduled(data.scheduledAt) : tr('wizard.step8.subtitle.scheduleFallbackDate'),
    }),
    draft: tr('wizard.step8.subtitle.draft'),
  }

  return (
    <div style={{
      maxWidth: 980, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      paddingBottom: 40,
    }}>
      {/* HÉROS */}
      <div style={{
        position: 'relative',
        textAlign: 'center', marginBottom: 36, paddingTop: 20,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -10%)',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', display: 'inline-block', marginBottom: 26,
        }}>
          <svg width="92" height="92" viewBox="0 0 100 100" style={{
            filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.18))',
          }}>
            <circle cx="50" cy="50" r="46" fill={SugarV2.black} />
            <circle cx="50" cy="50" r="46" fill="none" stroke={sgOn()}
              strokeWidth="2.5" strokeOpacity="0.10" />
            <path d="M30 52 L44 65 L70 38" fill="none" stroke={sgOn()}
              strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="60"
              strokeDashoffset={phase === 'entering' ? 60 : 0}
              style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1) .15s' }} />
          </svg>
          {phase === 'entering' && (
            <>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `2px solid ${SugarV2.black}`,
                animation: 'sgRingPulse 1.4s ease-out infinite',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `2px solid ${SugarV2.black}`,
                animation: 'sgRingPulse 1.4s ease-out .35s infinite',
                pointerEvents: 'none',
              }} />
            </>
          )}
        </div>

        <div style={{
          fontSize: 12, fontWeight: 700, color: SugarV2.muted,
          letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
        }}>{mode === 'now' ? tr('wizard.step8.eyebrow.now') : mode === 'schedule' ? tr('wizard.step8.eyebrow.schedule') : tr('wizard.step8.eyebrow.draft')}</div>

        <h1 style={{
          margin: '0 0 12px', fontSize: 44, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -1.2, lineHeight: 1.05,
        }}>{titleByMode[mode]}</h1>

        <p style={{
          margin: 0, fontSize: 16, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.5,
          maxWidth: 560, marginInline: 'auto',
        }}>{subByMode[mode]}</p>

        {showConfetti && <Confetti />}
      </div>

      {/* BENTO carte annonce */}
      <div style={{
        background: SugarV2.card, borderRadius: 24, padding: 22,
        boxShadow: SugarV2.shadow, marginBottom: 18,
        display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 18, alignItems: 'center',
      }}>
        <div style={{
          aspectRatio: '4/3', borderRadius: 14, overflow: 'hidden',
          background: cover
            ? `repeating-linear-gradient(135deg, ${cover.tone || '#D4DDE3'} 0 12px, ${shade(cover.tone || '#D4DDE3', -0.04)} 12px 24px)`
            : SugarV2.cardSubtle,
          display: 'grid', placeItems: 'center',
          color: 'rgba(0,0,0,0.20)',
        }}>
          {cover ? (
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M3 21V11l9-7 9 7v10"/><path d="M9 21v-7h6v7"/>
            </svg>
          ) : (
            <div style={{ fontSize: 11, color: SugarV2.muted, fontWeight: 600 }}>{tr('wizard.step8.noCover')}</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: SugarV2.muted,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
          }}>{tx === 'vente' ? tr('wizard.txBadge.sale') : tr('wizard.txBadge.rent')} · {data.canton || tr('wizard.country')}</div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.4, marginBottom: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{data.addr || tr('wizard.step8.noAddress')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: SugarV2.inkSoft, fontWeight: 500 }}>
            <span style={{ fontWeight: 700, color: SugarV2.ink }}>
              {fmtCHF(price) || '—'} CHF{tx === 'location' ? tr('wizard.perMonthShort') : ''}
            </span>
            <span style={{ color: SugarV2.muted }}>·</span>
            <span>{tr('wizard.photosCount', { count: photoCount })}</span>
          </div>
        </div>

        {mode === 'now' && (
          <a href="#" onClick={e => e.preventDefault()} style={{
            height: 44, padding: '0 18px', borderRadius: 999,
            background: SugarV2.black, color: sgOn(),
            fontSize: 13, fontWeight: 700, letterSpacing: 0.1,
            cursor: 'pointer', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
            transition: 'all .2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 26px rgba(0,0,0,0.30)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.22)' }}>
            {tr('wizard.step8.viewListing')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M7 7h10v10"/>
            </svg>
          </a>
        )}
      </div>

      {/* URL publique */}
      {mode === 'now' && (
        <div style={{
          background: SugarV2.card, borderRadius: 18, padding: '14px 18px',
          boxShadow: SugarV2.shadowSm, marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            display: 'grid', placeItems: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: SugarV2.cardSubtle, color: SugarV2.ink,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2,
            }}>{tr('wizard.step8.publicUrl')}</div>
            <div style={{
              fontSize: 13.5, fontWeight: 600, color: SugarV2.ink,
              fontFamily: 'ui-monospace, Menlo, monospace',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{publicUrl}</div>
          </div>
          <IconBtn icon="copy" label={tr('wizard.step8.copy')} />
          <IconBtn icon="qr" label={tr('wizard.step8.qrCode')} />
          <IconBtn icon="share" label={tr('wizard.step8.share')} />
        </div>
      )}

      {/* ACTIONS NEXT */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24,
      }}>
        <NextCard icon="plus" title={tr('wizard.step8.next.createAnother.title')}
          subtitle={tr('wizard.step8.next.createAnother.subtitle')}
          onClick={onClose} />
        <NextCard icon="dashboard" title={tr('wizard.step8.next.backToCrm.title')}
          subtitle={tr('wizard.step8.next.backToCrm.subtitle')}
          onClick={onBackToCRM} />
      </div>

      <div style={{
        textAlign: 'center', fontSize: 12, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.6,
      }}>
        <Trans
          t={tr}
          i18nKey="wizard.step8.confirmationEmail"
          values={{ email: 'gregory@megga.ch' }}
          components={{ strong: <strong style={{ color: SugarV2.ink }} /> }}
        />
      </div>
    </div>
  )
}

function NextCard({
  icon, title, subtitle, tag, onClick,
}: {
  icon: 'plus' | 'contacts' | 'dashboard'
  title: string
  subtitle: string
  tag?: string
  onClick?: () => void
}) {
  const ICON: Record<string, ReactNode> = {
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    contacts:  <><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M22 21v-2a4 4 0 0 0-3-3.87"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
  }
  return (
    <button onClick={onClick} style={{
      padding: 20, borderRadius: 18, border: 0,
      background: SugarV2.card, boxShadow: SugarV2.shadowSm,
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'all .2s ease',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = SugarV2.shadowHover || SugarV2.shadow }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = SugarV2.shadowSm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: SugarV2.cardSubtle, color: SugarV2.ink,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICON[icon]}
          </svg>
        </div>
        {tag && (
          <span style={{
            padding: '3px 9px', borderRadius: 999,
            background: SugarV2.black, color: sgOn(),
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
          }}>{tag}</span>
        )}
      </div>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2, marginBottom: 3,
        }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: SugarV2.muted, lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}

function IconBtn({ icon, label }: { icon: 'copy' | 'qr' | 'share'; label: string }) {
  const ICON: Record<string, ReactNode> = {
    copy:  <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    qr:    <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3M14 17v4M21 14v3M21 21h-4"/></>,
    share: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  }
  return (
    <button title={label} style={{
      width: 36, height: 36, borderRadius: 10, border: 0,
      background: SugarV2.cardSubtle, color: SugarV2.ink,
      cursor: 'pointer', display: 'grid', placeItems: 'center',
      transition: 'all .15s ease',
    }}
    onMouseEnter={e => e.currentTarget.style.background = '#E0E2E6'}
    onMouseLeave={e => e.currentTarget.style.background = SugarV2.cardSubtle}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICON[icon]}
      </svg>
    </button>
  )
}

function Confetti() {
  const items = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const colors = ['#0B0C0E', '#0B0C0E', '#0B0C0E', '#3C4148', '#A8B5BF', '#D4D8DC']
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        dx: (Math.random() - 0.5) * 240,
        rot: Math.random() * 720 - 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
        round: Math.random() > 0.5,
      }
    })
  }, [])
  return (
    <div style={{
      position: 'absolute', inset: -40, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {items.map(c => (
        <div key={c.id} style={{
          position: 'absolute', top: 0, left: `${c.left}%`,
          width: c.size, height: c.size,
          background: c.color,
          borderRadius: c.round ? '50%' : '1px',
          animation: `sgConfettiFall 1.8s cubic-bezier(.2,.6,.4,1) ${c.delay}s forwards`,
          ['--dx' as keyof CSSProperties]: `${c.dx}px`,
          ['--rot' as keyof CSSProperties]: `${c.rot}deg`,
        } as CSSProperties} />
      ))}
    </div>
  )
}

function formatScheduled(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' })
  } catch { return iso }
}
