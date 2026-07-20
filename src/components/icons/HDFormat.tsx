// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HDFormat = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M14.4986 14.6959H13.5996V9.30078H14.4986C15.9883 9.30078 17.1957 10.5092 17.1957 11.9988C17.1957 13.4885 15.9883 14.6959 14.4986 14.6959Z" stroke="currentColor"></path>
<path d="M7.30664 9.30078V14.6959M7.30664 11.9985H10.9037M10.9035 9.30078V14.6959" stroke="currentColor"></path>
    </svg>
  ),
)

HDFormat.displayName = 'HDFormat'

export default HDFormat
