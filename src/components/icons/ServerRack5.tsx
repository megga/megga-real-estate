// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerRack5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.72567 21.0002H17.2739C19.312 21.0002 20.9644 19.3478 20.9644 17.3097C20.9644 15.2715 19.312 13.6191 17.2739 13.6191H6.72567C4.68755 13.6191 3.03516 15.2715 3.03516 17.3097C3.03516 19.3478 4.68755 21.0002 6.72567 21.0002Z" stroke="currentColor"></path>
<path d="M15.6484 13.7227V20.8982" stroke="currentColor"></path>
<path d="M7.39453 17.3105H8.88605" stroke="currentColor"></path>
<path d="M6.72567 10.381H17.2739C19.312 10.381 20.9644 8.72863 20.9644 6.69051C20.9644 4.6524 19.312 3 17.2739 3H6.72567C4.68755 3 3.03516 4.6524 3.03516 6.69051C3.03516 8.72863 4.68755 10.381 6.72567 10.381Z" stroke="currentColor"></path>
<path d="M15.6484 3.10352V10.2791" stroke="currentColor"></path>
<path d="M7.39453 6.69043H8.88605" stroke="currentColor"></path>
    </svg>
  ),
)

ServerRack5.displayName = 'ServerRack5'

export default ServerRack5
