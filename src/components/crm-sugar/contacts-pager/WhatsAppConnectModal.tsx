// MEGGA CRM — Modale « Associer votre compte WhatsApp » (refonte Contacts).
// Port fidèle de `crm-contacts-firstrun.jsx` (CfrWhatsAppConnect) : overlay .cfr-ov,
// carte .cfr-modal (fond = couleur du bento), lockup co-brandé GG × WhatsApp
// (glyphes nus, sans tuile ni ombre — Beta v1), 3 bénéfices, CTA plein noir.
// Rendue en createPortal(document.body) pour sortir du contexte d'empilement du
// pager. CÂBLAGE RÉEL via `useWhatsAppPairing` : le CTA génère un vrai code
// d'appairage (ou affiche l'état connecté si déjà vérifié).

import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { WhatsAppGlyph, GgMonogram } from '@/components/crm-sugar/contacts-pager/glyphs'
import { NcvIcon, type NcvIconName } from '@/components/crm-sugar/contacts-pager/ncvIcon'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'

const WA_GREEN = '#25D366'

function Benefit({ icon, sp, children }: { icon: NcvIconName; sp: SugarPalette; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-xl)' }}>
      <div style={{ marginTop: 1, lineHeight: 0, flexShrink: 0 }}>
        <NcvIcon name={icon} size={18} stroke={sp.ink} />
      </div>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, lineHeight: 1.45, color: sp.ink, textWrap: 'pretty' }}>
        {children}
      </div>
    </div>
  )
}

export default function WhatsAppConnectModal({
  open,
  onClose,
  sp,
  dark,
}: {
  open: boolean
  onClose: () => void
  sp: SugarPalette
  dark: boolean
}): JSX.Element | null {
  const { t } = useTranslation('contacts')
  const { status, generateCode } = useWhatsAppPairing()
  const [code, setCode] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  const verified = status.data?.verified ?? false
  const waNumber = status.data?.wa_number ?? null
  const pairingCode = code ?? (verified ? null : status.data?.pairing_code ?? null)
  const overlay = dark ? 'rgba(0,0,4,.68)' : 'rgba(14,20,16,.42)'

  const onConnect = async () => {
    setErr(null)
    try {
      const c = await generateCode.mutateAsync()
      setCode(c)
    } catch {
      setErr(t('waConnect.error'))
    }
  }

  // Portal + z-index 120 : la modale doit échapper au contexte d'empilement du
  // pager (transformé/animé), sinon elle se retrouverait clipée par la page.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-7xl)',
        background: overlay, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        animation: 'cfrOv .22s ease both',
      }}
    >
      <style>{`
        @keyframes cfrOv { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cfrPop { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(452px, 100%)',
          backgroundColor: sp.pageBg,
          backgroundImage: `linear-gradient(0deg, ${sp.cardBg}, ${sp.cardBg})`,
          borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: sp.solidShadow,
          padding: '28px 30px 26px',
          boxSizing: 'border-box',
          position: 'relative',
          fontFamily: "'Inter Tight', system-ui, sans-serif",
          animation: 'cfrPop .34s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <button
          onClick={onClose}
          aria-label={t('waConnect.close')}
          style={{
            position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', border: 0,
            cursor: 'pointer', background: sp.cardSubBg, color: sp.sub, display: 'grid', placeItems: 'center', fontFamily: 'inherit',
          }}
        >
          <NcvIcon name="x" size={16} stroke={sp.sub} />
        </button>

        {/* Lockup co-brandé : MEGGA (GG) × WhatsApp — glyphes nus, sans tuile.
            Le « × » est recentré sur l'axe des glyphes : `height: 44` + placeItems
            l'alignent sur le GG, `lineHeight: 0` neutralise la descente du cadratin
            et `marginLeft: -6` compense le blanc à gauche du monogramme (son <g>
            porte translate(3, 8.5) dans un viewBox 32). Valeurs mesurées. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-3xl)', marginTop: 4, marginBottom: 20 }}>
          <GgMonogram size={44} color={sp.ink} />
          <span
            aria-hidden="true"
            style={{ height: 44, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: sp.sub, lineHeight: 0, marginLeft: -6 }}
          >
            ×
          </span>
          <WhatsAppGlyph size={38} color={WA_GREEN} />
        </div>

        <h2 style={{ margin: 0, textAlign: 'center', fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.5, color: sp.ink }}>
          {verified ? t('waConnect.connectedTitle') : t('waConnect.title')}
        </h2>
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 'var(--crm-text-xl)', fontWeight: 500, lineHeight: 1.55, color: sp.soft, textWrap: 'pretty' }}>
          {verified ? (waNumber || t('waConnect.connectedFallback')) : t('waConnect.subtitle')}
        </p>

        {verified ? (
          <div style={{
            marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)',
            height: 46, borderRadius: 'var(--crm-radius-xl)', background: sp.cardSubBg, color: sp.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 700,
          }}>
            <NcvIcon name="check" size={18} stroke={WA_GREEN} sw={2.2} />
            {t('waConnect.connectedBadge')}
          </div>
        ) : (
          <>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
              <Benefit icon="download" sp={sp}>{t('waConnect.benefit1')}</Benefit>
              <Benefit icon="send" sp={sp}>{t('waConnect.benefit2')}</Benefit>
              <Benefit icon="check" sp={sp}>{t('waConnect.benefit3')}</Benefit>
            </div>

            {pairingCode ? (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: sp.sub, textAlign: 'center' }}>
                  {t('waConnect.codeLabel')}
                </div>
                <div style={{
                  marginTop: 10, height: 56, borderRadius: 'var(--crm-radius-xl)', background: sp.solidBg,
                  display: 'grid', placeItems: 'center', color: sp.ink,
                  fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: 6, fontVariantNumeric: 'tabular-nums',
                }}>
                  {pairingCode}
                </div>
              </div>
            ) : (
              <button
                onClick={onConnect}
                disabled={generateCode.isPending}
                style={{
                  marginTop: 24, width: '100%', height: 46, borderRadius: 'var(--crm-radius-pill)', border: 0,
                  cursor: generateCode.isPending ? 'wait' : 'pointer', fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-xl)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)',
                  background: sp.ink, color: dark ? '#0B0C0E' : '#FFFFFF', opacity: generateCode.isPending ? 0.7 : 1,
                }}
              >
                <WhatsAppGlyph size={18} color={WA_GREEN} />
                {generateCode.isPending ? t('waConnect.generating') : t('waConnect.cta')}
              </button>
            )}

            {err && (
              <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: '#B4293D' }}>{err}</p>
            )}
            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>
              {t('waConnect.note')}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
