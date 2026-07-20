// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lock = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g id="Iconly/Light/Lock" stroke="none" fill="none" fillRule="evenodd"> <g id="Lock" transform="translate(3.500000, 2.000000)" stroke="currentColor"> <path d="M12.9234,7.4478 L12.9234,5.3008 C12.9234,2.7878 10.8854,0.749755462 8.3724,0.749755462 C5.8594,0.7388 3.8134,2.7668 3.8024,5.2808 L3.8024,5.3008 L3.8024,7.4478" id="Stroke-1"></path> <path d="M12.1832,19.2496 L4.5422,19.2496 C2.4482,19.2496 0.7502,17.5526 0.7502,15.4576 L0.7502,11.1686 C0.7502,9.0736 2.4482,7.3766 4.5422,7.3766 L12.1832,7.3766 C14.2772,7.3766 15.9752,9.0736 15.9752,11.1686 L15.9752,15.4576 C15.9752,17.5526 14.2772,19.2496 12.1832,19.2496 Z" id="Stroke-3"></path> <line x1="8.3629" y1="12.2027" x2="8.3629" y2="14.4237" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

Lock.displayName = 'Lock'

export default Lock
