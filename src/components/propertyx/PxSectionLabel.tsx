// MEGGA Marketplace — Property X section label (eyebrow uppercase).
// Suit le style "Display/1/Uppercase/Medium" du DS : 14px, weight 500, ls -0.42,
// uppercase, color neutral 400 sur fond clair / neutral 300 sur fond ink.

import { PX } from './tokens'

interface PxSectionLabelProps {
  children: string
  invert?: boolean
}

export default function PxSectionLabel({ children, invert = false }: PxSectionLabelProps) {
  const color = invert ? PX.neutral400 : PX.neutral400

  return (
    <span style={{
      display: 'inline-block',
      fontFamily: PX.font.sans,
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: '-0.42px',
      color,
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}
