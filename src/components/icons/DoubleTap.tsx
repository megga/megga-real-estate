// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DoubleTap = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.8068 12.6903C19.7107 15.1301 18.8214 18.3585 17.2375 19.9423C15.2166 21.9632 9.56901 22.1168 7.72004 19.8175C6.54671 18.3585 5.63476 16.5877 5.05992 15.001C4.75161 14.15 5.20402 13.2323 6.04908 12.9082C6.79714 12.6212 7.64438 12.8838 8.09906 13.5435L9.23448 15.1908V6.08708C9.23448 5.21056 9.94504 4.5 10.8216 4.5C11.6886 4.5 12.3951 5.19579 12.4085 6.06271L12.4715 10.1687C14.6926 10.3808 17.9087 10.2662 18.8068 12.6903Z" stroke="currentColor"></path>
<path d="M9.08373 9.5C7.99657 8.86052 7.26172 7.63895 7.26172 6.23711C7.26172 4.17316 8.85466 2.5 10.8196 2.5C12.7846 2.5 14.3776 4.17316 14.3776 6.23711C14.3776 7.61658 13.666 8.82148 12.6073 9.46894" stroke="currentColor"></path>
<path d="M5.32301 8.36256C5.0088 7.72742 4.83203 7.0123 4.83203 6.2555C4.83203 5.4987 5.0088 4.78358 5.32301 4.14844" stroke="currentColor"></path>
<path d="M16.2285 8.36256C16.5427 7.72742 16.7195 7.0123 16.7195 6.2555C16.7195 5.4987 16.5427 4.78358 16.2285 4.14844" stroke="currentColor"></path>
    </svg>
  ),
)

DoubleTap.displayName = 'DoubleTap'

export default DoubleTap
