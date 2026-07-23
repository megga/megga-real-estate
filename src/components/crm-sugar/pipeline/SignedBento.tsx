/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : bento « suites naturelles » après
 * signature. Port du handoff crm-screen-pipeline-sugar.jsx §signedDeal :
 * overlay plein écran flouté + panneau 420px opaque qui arrive du haut en
 * ressort (framer-motion). 3 options (planifier l'acte / féliciter / ouvrir le
 * dossier) + pied « Rouvrir dans le pipeline » / « Terminer ». Clic hors
 * panneau = Terminer.
 */

import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'

interface Props {
  sp: SugarPalette
  dark: boolean
  /** Prénom du contact (option « Féliciter {prénom} ») — null si contact non résolu. */
  firstName: string | null
  onScheduleAct: () => void
  onCongrats: () => void
  onOpenFile: () => void
  onReopen: () => void
  onFinish: () => void
}

export function SignedBento({
  sp, dark, firstName, onScheduleAct, onCongrats, onOpenFile, onReopen, onFinish,
}: Props) {
  const { t } = useTranslation('pipeline')
  const panelBg = dark ? '#17181A' : '#FFFFFF'
  const rowBg = dark ? '#1E1F21' : '#F7F8FA'
  const hair = dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)'

  const opt = (icon: MEIconName, label: string, sub: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 14, border: 0, cursor: 'pointer',
      fontFamily: 'inherit', background: rowBg,
    }}>
      <span style={{ width: 30, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MEIcon name={icon} size={22} color={sp.ink} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: sp.sub, marginTop: 2 }}>{sub}</span>}
      </span>
      <MEIcon name="chevron-right" size={15} color={sp.sub} />
    </button>
  )

  return createPortal(
    <div onClick={onFinish} style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: dark ? 'rgba(6,7,9,.55)' : 'rgba(15,23,42,.28)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'grid', placeItems: 'center', animation: 'sgSignVeil .25s ease-out both',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -80, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: 'calc(100vw - 48px)', background: panelBg, borderRadius: 28,
          boxShadow: '0 40px 100px rgba(15,23,42,0.28), 0 8px 24px rgba(15,23,42,0.14)',
          padding: '28px 26px 22px',
          fontFamily: '"Inter Tight", system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 999, background: '#059669',
            display: 'grid', placeItems: 'center', animation: 'sgSealIn .35s ease-out both',
          }}>
            <MEIcon name="check" size={24} color="#fff" />
          </span>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, color: sp.ink }}>
            {t('board.sign.sealed')}
          </div>
        </div>
        <div style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
          color: sp.sub, margin: '22px 4px 10px',
        }}>{t('board.sign.eyebrow')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opt('calendar', t('board.sign.scheduleAct'), t('board.sign.scheduleActSub'), onScheduleAct)}
          {opt('send', t('board.sign.congrats', { name: firstName ?? t('deal.buyer_fallback') }), t('board.sign.congratsSub'), onCongrats)}
          {opt('file', t('board.sign.openFile'), t('board.sign.openFileSub'), onOpenFile)}
        </div>
        <div style={{
          borderTop: `1px solid ${hair}`, marginTop: 18, paddingTop: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={onReopen} style={{
            height: 42, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', color: sp.sub, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          }}>{t('board.sign.reopen')}</button>
          <div style={{ flex: 1 }} />
          <button onClick={onFinish} style={{
            height: 44, padding: '0 24px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: sp.accent, color: sp.accentInk, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
          }}>{t('board.sign.finish')}</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
