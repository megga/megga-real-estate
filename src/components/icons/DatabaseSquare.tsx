// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.7257 10.6405C16.7257 9.88936 16.1167 9.28125 15.3655 9.28125H13.5938V11.9997H15.3655C16.1167 11.9997 16.7257 11.3916 16.7257 10.6405Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.7257 13.3592C16.7257 12.6081 16.1167 12 15.3655 12H13.5938V14.7185H15.3655C16.1167 14.7185 16.7257 14.1104 16.7257 13.3592Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.38361 14.6832H7.27734V9.28809H8.38361C9.87324 9.28809 11.0807 10.4955 11.0807 11.9861C11.0807 13.4748 9.87324 14.6832 8.38361 14.6832Z" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseSquare.displayName = 'DatabaseSquare'

export default DatabaseSquare
