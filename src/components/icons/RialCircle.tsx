// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RialCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M13.5091 15.4395H12.2676" stroke="currentColor"></path>
<path d="M15.0201 11.2528V12.2325C15.0201 12.935 14.45 13.5062 13.7465 13.5062H13.5412C12.8377 13.5062 12.2676 12.936 12.2676 12.2325V8.56055" stroke="currentColor"></path>
<path d="M16.928 11.1562V13.3211C16.9085 14.2727 16.3063 15.1143 15.4121 15.4393" stroke="currentColor"></path>
<path d="M7.07031 12.6675V13.5529C7.07031 14.4393 7.78837 15.1573 8.67475 15.1573C9.56112 15.1573 10.2792 14.4393 10.2792 13.5529V8.56152" stroke="currentColor"></path>
    </svg>
  ),
)

RialCircle.displayName = 'RialCircle'

export default RialCircle
