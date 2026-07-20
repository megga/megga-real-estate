// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Swap = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <g id="Iconly/Light/Swap" stroke="none" fill="none" fillRule="evenodd"> <g id="Swap" transform="translate(2.000000, 3.000000)" stroke="currentColor"> <line x1="14.8395556" y1="17.1642222" x2="14.8395556" y2="3.54644444" id="Stroke-1"></line> <polyline id="Stroke-3" points="18.9172222 13.0681111 14.8394444 17.1647778 10.7616667 13.0681111"></polyline> <line x1="4.91111111" y1="0.832888889" x2="4.91111111" y2="14.4506667" id="Stroke-5"></line> <polyline id="Stroke-7" points="0.833444444 4.929 4.91122222 0.832333333 8.989 4.929"></polyline> </g> </g>
    </svg>
  ),
)

Swap.displayName = 'Swap'

export default Swap
