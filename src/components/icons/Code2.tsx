// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Code2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9198 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9198 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M10.5332 10.9297L7.88379 13.5791L10.5332 16.2285" stroke="currentColor"></path>
<path d="M13.4678 7.76953L16.1172 10.4189L13.4678 13.0683" stroke="currentColor"></path>
    </svg>
  ),
)

Code2.displayName = 'Code2'

export default Code2
