// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AiIntent = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.8916 10.1028C4.8916 13.0378 6.67124 15.5514 9.20924 16.6214V18.2031C9.20924 19.7412 10.4681 21 12.0051 21C13.5431 21 14.802 19.7412 14.802 18.2031V16.6336C17.7603 15.3829 19.6851 12.1231 18.9511 8.58715C18.3856 5.88063 16.1968 3.70405 13.4913 3.15077C8.92092 2.22491 4.8916 5.68876 4.8916 10.1028Z" stroke="currentColor"></path>
<path d="M12.2656 16.6406H14.8097" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.739 6.61974L9.22435 10.0834C9.04492 10.3304 9.22143 10.6765 9.52657 10.6765H11.5836V12.8512C11.5836 13.213 12.0474 13.364 12.2601 13.0705L14.7747 9.60722C14.9541 9.36018 14.7776 9.01375 14.4725 9.01375H12.415V6.83937C12.415 6.47722 11.9516 6.32666 11.739 6.61974Z" stroke="currentColor"></path>
    </svg>
  ),
)

AiIntent.displayName = 'AiIntent'

export default AiIntent
