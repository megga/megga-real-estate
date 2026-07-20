// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarBadge2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.21793 5.27692V9.58428V17.8205C8.21793 19.2595 7.05231 20.4251 5.61328 20.4251H17.7511C19.8352 20.4251 20.9911 19.0211 20.9911 16.7531L20.9999 5.27692C20.9999 4.44698 20.2059 3.90795 19.5171 4.26114L18.8642 4.60557C18.475 4.80892 18.0255 4.81768 17.6188 4.6406L15.774 3.81941C15.0239 3.49346 14.1939 3.49346 13.4438 3.81941L11.599 4.6406C11.1923 4.81768 10.7418 4.80892 10.3536 4.60557L9.70074 4.26114C9.01188 3.90795 8.21793 4.45574 8.21793 5.27692Z" stroke="currentColor"></path>
<path d="M15.9631 9.62646H13.7564C13.1006 9.62646 12.5684 10.1587 12.5684 10.8145C12.5684 11.4712 13.1006 12.0025 13.7564 12.0025H15.1146C15.7704 12.0025 16.3026 12.5347 16.3026 13.1914C16.3026 13.8472 15.7704 14.3794 15.1146 14.3794H12.9079" stroke="currentColor"></path>
<path d="M14.4355 14.3792V15.3765M14.4355 8.62305V9.6291" stroke="currentColor"></path>
<path d="M5.61341 20.4252C4.88951 20.4252 4.23665 20.1342 3.76865 19.6662C3.29189 19.1895 3 18.5356 3 17.8205V10.5728C3 9.74289 3.79492 9.20484 4.48378 9.55803L5.13665 9.90246C5.52487 10.1058 5.97535 10.1146 6.38108 9.93749L7.62649 9.38192C7.72281 9.33716 7.97092 9.45197 8.21805 9.5843" stroke="currentColor"></path>
    </svg>
  ),
)

DollarBadge2.displayName = 'DollarBadge2'

export default DollarBadge2
