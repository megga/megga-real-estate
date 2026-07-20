// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectingCableSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.12513 16.8742C5.94552 15.6945 5.94552 13.782 7.12513 12.6024L7.7965 11.931C8.03031 11.6972 8.40939 11.6972 8.6432 11.931L12.0682 15.3561C12.3021 15.5899 12.3021 15.969 12.0682 16.2028L11.3969 16.8742C10.2173 18.0538 8.30474 18.0538 7.12513 16.8742Z" stroke="currentColor"></path>
<path d="M7.12258 16.8764L4.38574 19.6133" stroke="currentColor"></path>
<path d="M16.8742 7.12415C15.6945 5.94454 13.782 5.94454 12.6024 7.12415L11.931 7.79552C11.6972 8.02933 11.6972 8.40841 11.931 8.64223L15.3561 12.0673C15.5899 12.3011 15.969 12.3011 16.2028 12.0673L16.8742 11.3959C18.0538 10.2163 18.0538 8.30376 16.8742 7.12415Z" stroke="currentColor"></path>
<path d="M16.8779 7.12307L19.6377 4.36328" stroke="currentColor"></path>
<path d="M9.24219 12.5312L10.5655 11.2079M11.4703 14.7594L12.7937 13.4361" stroke="currentColor"></path>
<path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectingCableSquare.displayName = 'ConnectingCableSquare'

export default ConnectingCableSquare
