// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Reels = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.0077 21H7.99503C5.19484 21 3.45117 19.0234 3.45117 16.2251V7.77583C3.45117 4.97758 5.19484 3 7.99601 3H16.0077C18.8089 3 20.5506 4.97758 20.5506 7.77583V16.2251C20.5506 19.0234 18.8001 21 16.0077 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.141 15.1712C13.4148 15.8281 12.5084 16.4197 11.5104 16.8222C10.6605 17.1575 9.94896 16.7394 9.84467 15.9022C9.71699 14.6673 9.71991 13.486 9.84467 12.3836C9.9587 11.5133 10.7423 11.1439 11.5104 11.4675C12.4928 11.87 13.3749 12.4158 14.141 13.1185C14.7959 13.7121 14.8115 14.5552 14.141 15.1712Z" stroke="currentColor"></path>
<path d="M3.45703 7.47656H20.5428" stroke="currentColor"></path>
<path d="M9.02344 7.47563V3M14.9766 7.47563V3" stroke="currentColor"></path>
    </svg>
  ),
)

Reels.displayName = 'Reels'

export default Reels
