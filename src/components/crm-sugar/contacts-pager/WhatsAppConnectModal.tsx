// MEGGA CRM — Modale « Associer votre compte WhatsApp » (refonte Contacts).
// Port fidèle de `crm-contacts-firstrun.jsx` (CfrWhatsAppConnect) : overlay .cfr-ov,
// carte .cfr-modal (fond = couleur du bento), lockup co-brandé GG × WhatsApp,
// 3 bénéfices, CTA plein noir. CÂBLAGE RÉEL via `useWhatsAppPairing` : le CTA
// génère un vrai code d'appairage (ou affiche l'état connecté si déjà vérifié).

import { useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { WhatsAppGlyph, GgMonogram } from '@/components/crm-sugar/contacts-pager/glyphs'
import { NcvIcon, type NcvIconName } from '@/components/crm-sugar/contacts-pager/ncvIcon'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'

const WA_GREEN = '#25D366'

function Benefit({ icon, sp, children }: { icon: NcvIconName; sp: SugarPalette; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ marginTop: 1, lineHeight: 0, flexShrink: 0 }}>
        <NcvIcon name={icon} size={18} stroke={sp.ink} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45, color: sp.ink, textWrap: 'pretty' }}>
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

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center', padding: 24,
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
          borderRadius: 28,
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
            position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 999, border: 0,
            cursor: 'pointer', background: sp.cardSubBg, color: sp.sub, display: 'grid', placeItems: 'center', fontFamily: 'inherit',
          }}
        >
          <NcvIcon name="x" size={16} stroke={sp.sub} />
        </button>

        {/* Lockup co-brandé : MEGGA (GG) × WhatsApp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: sp.solidBg,
            boxShadow: dark ? '0 2px 10px rgba(0,0,0,.45)' : '0 2px 10px rgba(15,23,42,.09)', display: 'grid', placeItems: 'center',
          }}>
            <GgMonogram size={42} color={sp.ink} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 500, color: sp.sub, lineHeight: 1 }}>×</span>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: sp.solidBg,
            boxShadow: dark ? '0 2px 10px rgba(0,0,0,.45)' : '0 2px 10px rgba(15,23,42,.09)', display: 'grid', placeItems: 'center',
          }}>
            <WhatsAppGlyph size={30} color={WA_GREEN} />
          </div>
        </div>

        <h2 style={{ margin: 0, textAlign: 'center', fontSize: 21, fontWeight: 800, letterSpacing: -0.5, color: sp.ink }}>
          {verified ? t('waConnect.connectedTitle') : t('waConnect.title')}
        </h2>
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: sp.soft, textWrap: 'pretty' }}>
          {verified ? (waNumber || t('waConnect.connectedFallback')) : t('waConnect.subtitle')}
        </p>

        {verified ? (
          <div style={{
            marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            height: 46, borderRadius: 14, background: sp.cardSubBg, color: sp.ink, fontSize: 13.5, fontWeight: 700,
          }}>
            <NcvIcon name="check" size={18} stroke={WA_GREEN} sw={2.2} />
            {t('waConnect.connectedBadge')}
          </div>
        ) : (
          <>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 15 }}>
              <Benefit icon="download" sp={sp}>{t('waConnect.benefit1')}</Benefit>
              <Benefit icon="send" sp={sp}>{t('waConnect.benefit2')}</Benefit>
              <Benefit icon="check" sp={sp}>{t('waConnect.benefit3')}</Benefit>
            </div>

            {pairingCode ? (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: sp.sub, textAlign: 'center' }}>
                  {t('waConnect.codeLabel')}
                </div>
                <div style={{
                  marginTop: 10, height: 56, borderRadius: 14, background: sp.solidBg,
                  display: 'grid', placeItems: 'center', color: sp.ink,
                  fontSize: 26, fontWeight: 800, letterSpacing: 6, fontVariantNumeric: 'tabular-nums',
                }}>
                  {pairingCode}
                </div>
              </div>
            ) : (
              <button
                onClick={onConnect}
                disabled={generateCode.isPending}
                style={{
                  marginTop: 24, width: '100%', height: 46, borderRadius: 999, border: 0,
                  cursor: generateCode.isPending ? 'wait' : 'pointer', fontFamily: 'inherit',
                  fontSize: 14.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  background: sp.ink, color: dark ? '#0B0C0E' : '#FFFFFF', opacity: generateCode.isPending ? 0.7 : 1,
                }}
              >
                <WhatsAppGlyph size={18} color={WA_GREEN} />
                {generateCode.isPending ? t('waConnect.generating') : t('waConnect.cta')}
              </button>
            )}

            {err && (
              <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#B4293D' }}>{err}</p>
            )}
            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 500, color: sp.sub }}>
              {t('waConnect.note')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
