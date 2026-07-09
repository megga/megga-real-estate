// MEGGA CRM — Contacts · État « Compte neuf » (premier lancement).
// Port fidèle de `crm-contacts-firstrun.jsx` (ContactsFirstRun) : colonne centrée,
// illustration ScanCard, 2 cartes méthode (À la main / Associer WhatsApp), et
// l'animation SKELETON qui enchaîne sur la vraie modale (durées 900/1300ms,
// shimmer 1.25s, cascade, respect prefers-reduced-motion).
//
// La modale WhatsApp est gérée en interne (état `waOpen`) → l'API se limite à
// { sp, dark, onManual }. `onManual` est appelé APRÈS le skeleton (le parent
// ouvre alors la modale Nouveau contact qui recouvre le skeleton).

import { useEffect, useRef, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import ScanCardIllustration from '@/components/illustrations/ScanCardIllustration'
import { WhatsAppGlyph } from '@/components/crm-sugar/contacts-pager/glyphs'
import { NcvIcon } from '@/components/crm-sugar/contacts-pager/ncvIcon'
import WhatsAppConnectModal from '@/components/crm-sugar/contacts-pager/WhatsAppConnectModal'

const WA_GREEN = '#25D366'

// ── Carte « méthode » (bouton plein-surface, Sugar) ────────────────────
function CfrMethodCard({
  sp, soft, iconNode, title, desc, onClick,
}: {
  sp: SugarPalette
  soft: string
  iconNode: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
        padding: '22px 22px 24px', borderRadius: 18, border: 0, cursor: 'pointer',
        background: sp.cardBg, boxShadow: sp.shadow, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: 14, lineHeight: 0 }}>{iconNode}</div>
      <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: -0.3, color: sp.ink }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: soft, textWrap: 'pretty' }}>{desc}</div>
    </button>
  )
}

// ── Skeleton « création de la fiche » — mime la mise en page de NewContactModal
//    pour enchaîner sans rupture sur le vrai formulaire. ─────────────────
function CfrBuildSkeleton({ sp, dark }: { sp: SugarPalette; dark: boolean }) {
  const skVars = {
    '--sk': dark ? 'rgba(255,255,255,.08)' : '#E7EAF0',
    '--skHi': dark ? 'rgba(255,255,255,.17)' : '#F5F7FA',
  } as React.CSSProperties
  return (
    <div
      aria-hidden="true"
      className="cfr-build"
      style={{
        position: 'absolute', inset: 0, zIndex: 50, background: sp.pageBg,
        display: 'flex', flexDirection: 'column', cursor: 'default', ...skVars,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 26px' }}>
        <div className="cfr-sk" style={{ width: 36, height: 36, borderRadius: 999 }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '2px 26px 18px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="cfr-build-card" style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, animationDelay: '40ms' }}>
            <div className="cfr-sk" style={{ width: 360, height: 30, borderRadius: 10 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="cfr-build-card"
                style={{
                  background: sp.solidBg, borderRadius: 18, boxShadow: sp.shadow, minHeight: 118,
                  padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  animationDelay: `${140 + i * 65}ms`,
                }}
              >
                <div className="cfr-sk" style={{ width: 30, height: 30, borderRadius: 9 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div className="cfr-sk" style={{ width: '68%', height: 11, borderRadius: 6 }} />
                  <div className="cfr-sk" style={{ width: '44%', height: 9, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="cfr-build-card"
              style={{
                background: sp.solidBg, borderRadius: 22, boxShadow: sp.shadow, padding: '22px 24px',
                display: 'flex', flexDirection: 'column', gap: 14, animationDelay: `${420 + i * 110}ms`,
              }}
            >
              <div className="cfr-sk" style={{ width: 120, height: 12, borderRadius: 6 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="cfr-sk" style={{ height: 44, borderRadius: 12 }} />
                <div className="cfr-sk" style={{ height: 44, borderRadius: 12 }} />
              </div>
              <div className="cfr-sk" style={{ height: 44, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ContactsFirstRun({
  sp,
  dark,
  onManual,
}: {
  sp: SugarPalette
  dark: boolean
  onManual: () => void
}): JSX.Element {
  const { t } = useTranslation('contacts')
  const soft = sp.soft || sp.sub
  const ring = dark ? '#8DA4FF' : '#0041D9'
  const [waOpen, setWaOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const openNew = () => {
    if (building) return
    setBuilding(true)
    timers.current.push(setTimeout(() => onManual(), 900))
    timers.current.push(setTimeout(() => setBuilding(false), 1300))
  }

  return (
    <div
      className="cfr-root"
      style={{
        position: 'absolute', inset: 0, background: sp.pageBg, overflowY: 'auto',
        fontFamily: "'Inter Tight', system-ui, sans-serif", color: sp.ink, fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`
        @keyframes cfrFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cfrOv { from { opacity: 0; } to { opacity: 1; } }
        .cfr-root button:focus-visible { outline: 2.5px solid ${ring}; outline-offset: 3px; }
        .cfr-root :focus:not(:focus-visible) { outline: none; }
        @keyframes cfrShimmer { 0% { background-position: -40% 0; } 100% { background-position: 160% 0; } }
        .cfr-build { animation: cfrOv .26s ease both; }
        .cfr-build-card { animation: cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both; }
        .cfr-sk { background-color: var(--sk); background-image: linear-gradient(90deg, transparent, var(--skHi), transparent);
          background-size: 220% 100%; background-repeat: no-repeat; animation: cfrShimmer 1.25s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cfr-sk { animation: none; } .cfr-build-card { animation: none; } }
        @media (max-width: 620px) { .cfr-cards { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{
        minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '56px 40px',
      }}>
        <div style={{
          maxWidth: 528, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <ScanCardIllustration dark={dark} size={208} style={{ marginBottom: 4 }} />

          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: -1.1, lineHeight: 1.08, color: sp.ink }}>
            {t('firstRun.title')}
          </h1>

          <div className="cfr-cards" style={{ marginTop: 26, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CfrMethodCard
              sp={sp}
              soft={soft}
              iconNode={<NcvIcon name="edit" size={44} stroke={sp.ink} sw={1.6} />}
              title={t('firstRun.manualTitle')}
              desc={t('firstRun.manualDesc')}
              onClick={openNew}
            />
            <CfrMethodCard
              sp={sp}
              soft={soft}
              iconNode={<WhatsAppGlyph size={46} color={WA_GREEN} />}
              title={t('firstRun.whatsappTitle')}
              desc={t('firstRun.whatsappDesc')}
              onClick={() => setWaOpen(true)}
            />
          </div>
        </div>
      </div>

      {building && <CfrBuildSkeleton sp={sp} dark={dark} />}

      <WhatsAppConnectModal open={waOpen} onClose={() => setWaOpen(false)} sp={sp} dark={dark} />
    </div>
  )
}
