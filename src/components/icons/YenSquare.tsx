// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const YenSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M9.49902 12.1077H14.505" stroke="currentColor"></path>
<path d="M9.49902 14.1H14.505" stroke="currentColor"></path>
<path d="M12 16.3973V12.1064" stroke="currentColor"></path>
<path d="M9.14062 8.53223L11.9992 12.1108L14.8598 8.53223" stroke="currentColor"></path>
    </svg>
  ),
)

YenSquare.displayName = 'YenSquare'

export default YenSquare
