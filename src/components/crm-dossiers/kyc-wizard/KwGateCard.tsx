// MEGGA CRM Sugar v3 — Carte porte du wizard (Sugar Pure canonical)
// Refonte visuelle (handoff §1.3) : palette-aware (useKycPalette), accent inversé
// en sombre (onAccent / onAccentSoft / onAccentFaint), bord systématique cardBorder.

import { crmVoileEncre } from '@/components/crm/tokens'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useKycPalette } from '../kyc/kycPalette'

interface Props {
  icon: ReactNode
  title: string
  sub: string
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
}

export function KwGateCard({
  icon,
  title,
  sub,
  onClick,
  selected,
  disabled,
}: Props) {
  const { t } = useTranslation('kyc')
  const sp = useKycPalette()
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
        background: selected ? sp.black : sp.card,
        color: selected ? sp.onAccent : sp.ink,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 'var(--crm-radius-6xl)',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: selected
          ? `0 24px 60px ${crmVoileEncre(false, 0.30)}, 0 4px 16px ${crmVoileEncre(false, 0.15)}`
          : hover
            ? sp.shadowHover
            : sp.shadow,
        transform: selected || hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-2xl)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--crm-radius-3xl)',
          // ⛔ AUCUN APLAT SOUS UNE ICÔNE NON SÉLECTIONNÉE. `cardSubtle` posait un
          // carré `#050505` sur une carte `#090909` : 1,03:1 — un écart qui ne
          // SÉPARE pas (CLAUDE.md §3 : « la séparation vient de la BORDURE »),
          // et qui se lit donc comme une tache sombre plutôt que comme une
          // sous-surface. L'icône se pose directement sur la carte.
          //
          // Sur la carte SÉLECTIONNÉE le voile reste : il est clair sur l'accent,
          // donc il sépare vraiment, et il marque l'état ACTIF — le seul qui ait
          // le droit d'être marqué.
          background: selected ? sp.onAccentFaint : 'transparent',
          // ⚠ GRIS, PAS L'ACCENT. Une porte non choisie portait `sp.black`,
          // c'est-à-dire `#424bfb` : l'accent sur un élément INACTIF, exactement
          // l'inverse de la règle du 10 août 2026. `muted` tient le seuil
          // non-textuel dans les deux thèmes (7,89:1 en sombre, 5,57 en clair).
          color: selected ? sp.onAccent : sp.muted,
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
            fontSize: 'var(--crm-text-3xl)',
            fontWeight: 600,
            color: selected ? sp.onAccent : sp.ink,
            letterSpacing: -0.3,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--crm-text-lg)',
            color: selected ? sp.onAccentSoft : sp.inkSoft,
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
          paddingTop: 'var(--crm-space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-md)',
          // ⚠ `sp.ink` au survol, plus `sp.black` : l'accent en TEXTE tient en
          // clair (5,78:1) mais tombe à 3,44:1 sur la carte sombre. Le survol
          // reste un signal — il passe de l'encre secondaire à l'encre pleine.
          color: selected ? sp.onAccent : hover ? sp.ink : sp.muted,
          fontSize: 'var(--crm-text-lg)',
          fontWeight: 600,
          transition: 'color .2s',
        }}
      >
        {selected ? t('wizard.gate.selected') : t('wizard.gate.choose')}
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
