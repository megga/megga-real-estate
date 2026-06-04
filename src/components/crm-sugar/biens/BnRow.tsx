// MEGGA CRM Sugar v2 — Catalog row
// 1:1 port from `crm-screen-biens-sugar.jsx` (BnRow).

import { useState } from 'react'
import { motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmContactById, type CrmBien } from '../mockData'
import { crmInitials, type SugarPalette } from '../tokens'
import { BnPhoto } from './BnPhoto'
import { BnSpec } from './BnFilterDropdown'
import { bnFmtCHF, bnStatus } from './helpers'

interface BnRowProps {
  bien: CrmBien
  onOpen: () => void
  sp: SugarPalette
  isFirst: boolean
}

export function BnRow({ bien, onOpen, sp, isFirst }: BnRowProps) {
  const [hov, setHov] = useState(false)
  const meta = bnStatus(bien.status)
  const isRent = bien.transaction === 'location'
  const priceLabel = isRent
    ? bien.rent
      ? bnFmtCHF(bien.rent)
      : '—'
    : bien.price
      ? bnFmtCHF(bien.price)
      : '—'
  const owner = bien.ownerContactId ? crmContactById(bien.ownerContactId) : null

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto auto auto',
        alignItems: 'center',
        gap: 20,
        padding: '16px 24px',
        background: hov ? sp.cardSubBg : 'transparent',
        borderTop: isFirst ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: 'pointer',
        transition: 'background .12s',
      }}
      onClick={onOpen}
    >
      {/* Photo + status chip */}
      <div style={{ position: 'relative', width: 96 }}>
        <motion.div
          // Shared element source — when the row is clicked and the detail
          // overlay opens, the same `layoutId` on its hero photo causes
          // framer-motion to interpolate this 96×72 thumb into the overlay's
          // ~600×450 hero. iOS Photos feel inside the CRM.
          layoutId={`crm-bien-photo-${bien.id}`}
          style={{ width: 96, height: 72, borderRadius: 8, overflow: 'hidden' }}
        >
          <BnPhoto
            id={bien.id}
            sp={sp}
            w={96}
            h={72}
            signed={bien.signedPhotoCount === bien.photoCount}
          />
        </motion.div>
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            fontSize: 9,
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: 999,
            background: meta.color,
            color: '#fff',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }}
        >
          {meta.label}
        </span>
      </div>
      {/* (motion wrapper closes above) */}

      {/* Titre + adresse + specs */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
        >
          {bien.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: sp.sub,
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          {bien.addr}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <BnSpec value={bien.area} label="m²" sp={sp} />
          <BnSpec value={bien.rooms} label="pièces" sp={sp} />
          <BnSpec value={bien.beds} label="ch." sp={sp} />
          <BnSpec value={bien.baths} label="sdb" sp={sp} />
          <BnSpec value={bien.energy || '—'} label="DPE" sp={sp} />
          {bien.year && <BnSpec value={bien.year} label="" sp={sp} />}
        </div>
      </div>

      {/* Vendeur */}
      <div style={{ minWidth: 130, textAlign: 'left' }}>
        <div
          style={{
            fontSize: 10.5,
            color: sp.sub,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 4,
          }}
        >
          Vendeur
        </div>
        {owner ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                background: owner.avatarBg || '#0041D9',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {crmInitials(owner.firstName + ' ' + owner.lastName)}
            </div>
            <span
              style={{
                fontSize: 12,
                color: sp.ink,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 110,
              }}
            >
              {owner.firstName} {owner.lastName[0]}.
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: sp.sub, fontStyle: 'italic' }}>
            Non lié
          </span>
        )}
      </div>

      {/* Prix */}
      <div style={{ minWidth: 140, textAlign: 'right' }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: sp.ink,
            letterSpacing: -0.4,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {priceLabel}
          {isRent && (
            <span style={{ fontSize: 11, color: sp.sub, fontWeight: 600 }}>
              /mois
            </span>
          )}
        </div>
        {!isRent && bien.price && bien.area && (
          <div
            style={{
              fontSize: 10.5,
              color: sp.sub,
              marginTop: 4,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            CHF{' '}
            {Math.round(bien.price / bien.area)
              .toLocaleString('fr-CH')
              .replace(/,/g, "'")}
            /m²
          </div>
        )}
      </div>

      {/* Actions edit/delete */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          opacity: hov ? 1 : 0.4,
          transition: 'opacity .15s',
        }}
      >
        <button
          onClick={e => e.stopPropagation()}
          title="Modifier"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            color: sp.sub,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MEIcon name="file" size={13} color={sp.sub} />
        </button>
        <button
          onClick={e => e.stopPropagation()}
          title="Supprimer"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            color: sp.sub,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M2 3.5h9M5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M3.5 3.5l.6 7.2a1 1 0 001 .8h3.8a1 1 0 001-.8l.6-7.2"
              stroke={sp.sub}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
