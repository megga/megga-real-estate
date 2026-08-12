// MEGGA CRM Sugar v2 — Mes biens · Liste — ligne compacte
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx, GalRow).
// Survol = renfort d'ombre seul (pas de soulèvement). Pilule de statut KYC à
// côté du titre. Pas de rangée specs (m²·pièces·DPE retirée, cf. §7).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmContactById, type CrmBien } from '../../mockData'
import { crmInitials, type SugarPalette } from '../../tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { galFmtCHF, type GalSurfaces } from './galHelpers'
import { GalPhoto, GalStatusPill } from './GalleryAtoms'
import { BnScoreBadge } from '../BnScoreBadge'

interface GalRowProps {
  bien: CrmBien
  onOpen: () => void
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
}

export function GalRow({ bien, onOpen, sp, surf, dark }: GalRowProps) {
  const { t } = useTranslation('listings')
  const [hov, setHov] = useState(false)
  const isRent = bien.transaction === 'location'
  const price = isRent ? bien.rent : bien.price
  const owner = bien.ownerContactId ? crmContactById(bien.ownerContactId) : null

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '84px 1fr auto auto',
        alignItems: 'center',
        gap: 'var(--crm-space-4xl)',
        background: surf.card,
        borderRadius: 'var(--crm-radius-xl)',
        padding: 'var(--crm-space-xl) var(--crm-space-3xl)',
        cursor: 'pointer',
        border: surf.hairline,
        boxShadow: hov ? surf.shadowHov : surf.shadow,
        transition: 'box-shadow .15s',
      }}
    >
      <motion.div
        layoutId={`crm-bien-photo-${bien.id}`}
        style={{
          position: 'relative',
          width: 84,
          height: 60,
          borderRadius: 'var(--crm-radius-md)',
          overflow: 'hidden',
          background: surf.cardSub,
        }}
      >
        {bien.photoCount === 0 && !bien.coverPhoto ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <MEIcon name="home" size={18} color={sp.sub} />
          </div>
        ) : (
          <GalPhoto id={bien.id} src={bien.coverPhoto} dark={dark} radius={10} />
        )}
      </motion.div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <span
            style={{
              fontSize: 'var(--crm-text-xl)',
              fontWeight: 600,
              color: sp.ink,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bien.title}
          </span>
          <GalStatusPill status={bien.status} dark={dark} style={{ flexShrink: 0 }} />
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
        {bien.health && (
          <div style={{ marginTop: 6 }}>
            <BnScoreBadge health={bien.health} sp={sp} size="sm" />
          </div>
        )}
      </div>

      <div
        style={{
          minWidth: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--crm-space-xs)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--crm-text-xs)',
            color: sp.sub,
            fontWeight: 600,
          }}
        >
          {t('biens.seller')}
        </span>
        {owner ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 'var(--crm-radius-pill)',
                flexShrink: 0,
                background: owner.avatarBg || sp.ink,
                // `avatarBg` vient de la DONNÉE (palette déterministe par id) :
                // cinq de ses huit couleurs échouaient l'AA sous encre blanche,
                // `#F59E0B` à 2,15:1. L'encre descend donc de l'aplat.
                color: encreSur(owner.avatarBg || sp.ink),
                fontSize: 'var(--crm-text-xs)',
                fontWeight: 600,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {crmInitials(owner.firstName + ' ' + owner.lastName)}
            </div>
            <span style={{ fontSize: 'var(--crm-text-md)', color: sp.ink, fontWeight: 600 }}>
              {owner.firstName} {owner.lastName[0]}.
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>—</span>
        )}
      </div>

      <div style={{ minWidth: 130, textAlign: 'right' }}>
        <div
          style={{
            fontSize: 'var(--crm-text-2xl)',
            fontWeight: 600,
            color: sp.ink,
            letterSpacing: -0.5,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {price ? galFmtCHF(price) : t('biens.toEstimate')}
          {isRent && price && (
            <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 600 }}>{t('biens.perMonth')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
