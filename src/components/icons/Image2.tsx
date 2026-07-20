// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Image2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6.05762 18.8144H18.7411L18.7657 18.7821L14.8759 12.2573H14.7804L11.7655 16.2582L8.42777 14.5738H8.31122L6.03809 18.7822L6.05762 18.8144Z" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.678 8.71595C10.678 9.77696 9.81847 10.6365 8.75746 10.6365C7.69645 10.6365 6.83691 9.77696 6.83691 8.71595C6.83691 7.65495 7.69645 6.79541 8.75746 6.79541C9.81847 6.79651 10.678 7.65495 10.678 8.71595Z" stroke="currentColor" strokeLinecap="round"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.854L21.5 3.354L3 3.354L3 21.854L21.5 21.854Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Image2.displayName = 'Image2'

export default Image2
