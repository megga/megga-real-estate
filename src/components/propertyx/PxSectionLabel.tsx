// MEGGA Marketplace — Property X section label.
// Petit pill avec dot + texte, sert d'eyebrow au-dessus du titre de section.
// Variants : sur fond clair (default) ou sur fond noir (invert).

import { PX } from './tokens'

interface PxSectionLabelProps {
  children: string
  invert?: boolean
}

export default function PxSectionLabel({ children, invert = false }: PxSectionLabelProps) {
  const bg = invert ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.04)'
  const dot = invert ? PX.inkInverse : PX.ink
  const text = invert ? PX.inkInverse : PX.ink

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px 6px 10px',
      borderRadius: PX.radiusPill,
      background: bg,
      fontFamily: PX.font.sans,
      fontSize: PX.type.caption.size,
      fontWeight: 500,
      color: text,
      letterSpacing: 0.2,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0,
      }} />
      {children}
    </span>
  )
}
