// MEGGA CRM Sugar v2 — Mes biens · Galerie — carte bien
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx, GalCard).
// Survol = renfort d'ombre seul (pas de soulèvement). Pilule de statut KYC en
// overlay. Stats de pied en sp.ink (adaptatif). Photo réelle via coverPhoto.
// La photo porte un `layoutId` partagé → transition vers BnDetailOverlay (FM).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '../../mockData'
import type { SugarPalette } from '../../tokens'
import { galFmtCHF, galCompact, type GalSurfaces } from './galHelpers'
import { GalPhoto, GalStatusPill } from './GalleryAtoms'
import { BnScoreBadge } from '../BnScoreBadge'

interface GalCardProps {
  bien: CrmBien
  onOpen: () => void
  /** Brouillon → « Finir » : reprend l'édition (sinon retombe sur onOpen). */
  onFinish?: () => void
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
}

export function GalCard({ bien, onOpen, onFinish, sp, surf, dark }: GalCardProps) {
  const { t } = useTranslation('listings')
  const [hov, setHov] = useState(false)
  const isRent = bien.transaction === 'location'
  const isDraft = bien.status === 'draft'
  const price = isRent ? bien.rent : bien.price
  const noPhoto = isDraft && bien.photoCount === 0

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        background: surf.card,
        borderRadius: 'var(--crm-radius-3xl)',
        overflow: 'hidden',
        cursor: 'pointer',
        border: surf.hairline,
        boxShadow: hov ? surf.shadowHov : surf.shadow,
        transition: 'box-shadow .22s',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', aspectRatio: '4 / 3', flexShrink: 0, background: surf.cardSub }}>
        {noPhoto ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: surf.cardSub,
              backgroundImage: dark
                ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 9px, transparent 9px 18px)'
                : 'repeating-linear-gradient(45deg, rgba(15,23,42,.03) 0 9px, transparent 9px 18px)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--crm-radius-pill)',
                  background: surf.card,
                  boxShadow: surf.shadow,
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <MEIcon name="plus" size={18} color={sp.sub} />
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 600 }}>{t('biens.photosToAdd')}</div>
            </div>
          </div>
        ) : (
          <motion.div
            layoutId={`crm-bien-photo-${bien.id}`}
            style={{ position: 'absolute', inset: 0 }}
          >
            <GalPhoto id={bien.id} src={bien.coverPhoto} dark={dark} />
          </motion.div>
        )}
        {/* Statut — pilule KYC en overlay haut-gauche */}
        {!noPhoto && (
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <GalStatusPill
              status={bien.status}
              dark={dark}
              style={{ boxShadow: '0 2px 8px rgba(15,23,42,.18)' }}
            />
          </div>
        )}
      </div>

      {/* Contenu */}
      <div style={{ padding: 'var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
          <div
            style={{
              fontSize: 'var(--crm-text-2xl)',
              fontWeight: 600,
              color: sp.ink,
              letterSpacing: -0.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {bien.title}
          </div>
          {bien.health && <BnScoreBadge health={bien.health} sp={sp} size="md" />}
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-md)',
            color: sp.sub,
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bien.addr}
        </div>

        <div style={{ flex: 1, minHeight: 14 }} />

        {/* Prix + pied */}
        <div
          style={{
            borderTop: surf.hairline,
            marginTop: 14,
            paddingTop: 'var(--crm-space-2xl)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 'var(--crm-space-lg)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--crm-text-4xl)',
                fontWeight: 500,
                color: sp.ink,
                letterSpacing: -0.7,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {price ? galFmtCHF(price) : t('biens.toEstimate')}
              {isRent && price && (
                <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600 }}>{t('biens.perMonth')}</span>
              )}
            </div>
          </div>

          {isDraft ? (
            <button
              onClick={e => {
                e.stopPropagation()
                ;(onFinish ?? onOpen)()
              }}
              style={{
                height: 34,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: sp.ink,
                color: sp.pageBg,
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-sm)',
                boxShadow: sp.focusShadow,
              }}
            >
              {t('biens.finish')} <MEIcon name="arrow-right" size={12} color={sp.pageBg} />
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 'var(--crm-space-xl)',
                alignItems: 'center',
                color: sp.ink,
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }} title={t('biens.kpi.views')}>
                <MEIcon name="eye" size={13} color={sp.ink} /> {galCompact(bien.stats?.views || 0)}
              </span>
              <span
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}
                title={t('biens.kpi.visitRequests')}
              >
                <MEIcon name="calendar" size={13} color={sp.ink} /> {bien.stats?.visitRequests || 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
