// MEGGA CRM Sugar v2 — Mes biens · Galerie — carte bien
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx, GalCard).
// Survol = renfort d'ombre seul (pas de soulèvement). Pilule de statut KYC en
// overlay. Stats de pied en sp.ink (adaptatif). Photo réelle via coverPhoto.
// La photo porte un `layoutId` partagé → transition vers BnDetailOverlay (FM).

import { useState } from 'react'
import { motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '../../mockData'
import type { SugarPalette } from '../../tokens'
import { galFmtCHF, galCompact, type GalSurfaces } from './galHelpers'
import { GalPhoto, GalStatusPill } from './GalleryAtoms'

interface GalCardProps {
  bien: CrmBien
  onOpen: () => void
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
}

export function GalCard({ bien, onOpen, sp, surf, dark }: GalCardProps) {
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
        borderRadius: 18,
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
                  borderRadius: 999,
                  background: surf.card,
                  boxShadow: surf.shadow,
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <MEIcon name="plus" size={18} color={sp.sub} />
              </div>
              <div style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600 }}>Photos à ajouter</div>
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
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div
            style={{
              fontSize: 15.5,
              fontWeight: 700,
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
        </div>
        <div
          style={{
            fontSize: 12.5,
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
            paddingTop: 14,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -0.7,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {price ? galFmtCHF(price) : 'À estimer'}
              {isRent && price && (
                <span style={{ fontSize: 12, color: sp.sub, fontWeight: 600 }}>/mois</span>
              )}
            </div>
          </div>

          {isDraft ? (
            <button
              onClick={e => {
                e.stopPropagation()
                onOpen()
              }}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: sp.ink,
                color: sp.pageBg,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: sp.focusShadow,
              }}
            >
              Finir <MEIcon name="arrow-right" size={12} color={sp.pageBg} />
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                color: sp.ink,
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title="Vues">
                <MEIcon name="eye" size={13} color={sp.ink} /> {galCompact(bien.stats?.views || 0)}
              </span>
              <span
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title="Demandes de visite"
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
