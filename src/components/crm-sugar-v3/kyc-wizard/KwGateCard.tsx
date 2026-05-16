// MEGGA CRM Sugar v3 — Carte porte du wizard (Sugar Pure canonical)
// Port 1:1 de crm-kyc-wizard.jsx lignes 132-197 (KwGateCard).
// Référence visuelle absolue : crm-wizard-sugar-v2.jsx Step 0 (SgGateCard).

import { useState } from 'react'
import type { ReactNode } from 'react'
import { SugarV3 } from '../tokens'

interface Props {
  icon: ReactNode
  title: string
  sub: string
  onClick?: () => void
  recommended?: boolean
  selected?: boolean
  disabled?: boolean
}

export function KwGateCard({
  icon,
  title,
  sub,
  onClick,
  recommended,
  selected,
  disabled,
}: Props) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: '32px 28px 28px',
        background: selected ? SugarV3.black : SugarV3.card,
        color: selected ? '#fff' : SugarV3.ink,
        border: 0,
        borderRadius: 28,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: selected
          ? '0 24px 60px rgba(11,12,14,0.30), 0 4px 16px rgba(11,12,14,0.15)'
          : hover
            ? SugarV3.shadowHover
            : SugarV3.shadow,
        transform: selected || hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {recommended && (
        <span
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            padding: '5px 11px',
            borderRadius: 999,
            background: selected ? '#fff' : SugarV3.black,
            color: selected ? SugarV3.ink : '#fff',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          Recommandé
        </span>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: selected ? 'rgba(255,255,255,0.10)' : SugarV3.cardSubtle,
          color: selected ? '#fff' : SugarV3.black,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: 19,
            fontWeight: 700,
            color: selected ? '#fff' : SugarV3.ink,
            letterSpacing: -0.3,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: selected ? 'rgba(255,255,255,0.75)' : SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </p>
      </div>
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: selected ? '#fff' : hover ? SugarV3.black : SugarV3.muted,
          fontSize: 13,
          fontWeight: 600,
          transition: 'color .2s',
        }}
      >
        {selected ? 'Sélectionné' : 'Choisir'}
        <span
          style={{
            display: 'inline-flex',
            transform: hover || selected ? 'translateX(4px)' : 'translateX(0)',
            transition: 'transform .25s ease',
          }}
        >
          {selected ? '✓' : '→'}
        </span>
      </div>
    </button>
  )
}
