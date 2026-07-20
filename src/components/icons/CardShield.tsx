// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CardShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 11.4044V8.11136C21 5.66836 19.48 3.94336 17.035 3.94336H6.965C4.528 3.94336 3 5.66836 3 8.11136V14.6984C3 17.1404 4.521 18.8654 6.965 18.8654H10.292" stroke="currentColor"></path>
<path d="M3 9.24023H21" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.0125 20.6213C17.0125 20.6213 20.2745 19.6333 20.2745 16.9113C20.2745 14.1903 20.3915 14.2763 20.1305 14.0133C19.8685 13.7493 17.4395 12.9043 17.0125 12.9043C16.5855 12.9043 14.1565 13.7513 13.8955 14.0133C13.6325 14.2743 13.7515 14.1893 13.7515 16.9113C13.7515 19.6343 17.0125 20.6213 17.0125 20.6213Z" stroke="currentColor"></path>
    </svg>
  ),
)

CardShield.displayName = 'CardShield'

export default CardShield
