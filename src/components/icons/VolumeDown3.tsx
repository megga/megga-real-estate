// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VolumeDown3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.6559 8.63464C19.9092 10.9058 19.9092 13.6773 18.6559 15.9404" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M4.66723 12.2873C4.66367 13.506 4.66723 14.9353 5.67345 15.7896C6.67967 16.6447 7.47878 16.2918 8.781 16.7202C10.0841 17.1496 11.909 19.7967 13.925 18.6011C15.0148 17.8269 15.5286 16.3656 15.5286 12.2873C15.5286 8.20912 15.0379 6.76379 13.925 5.97357C11.909 4.7789 10.0841 7.42601 8.781 7.85445C7.47878 8.28379 6.67967 7.9309 5.67345 8.78512C4.66723 9.63934 4.66367 11.0687 4.66723 12.2873Z" stroke="currentColor"></path>
    </svg>
  ),
)

VolumeDown3.displayName = 'VolumeDown3'

export default VolumeDown3
