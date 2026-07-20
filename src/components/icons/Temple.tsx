// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Temple = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M19.1416 11.5039C19.1416 7.55952 15.9438 4.36157 11.9994 4.36157C8.05505 4.36157 4.85693 7.55952 4.85693 11.5039" stroke="currentColor"></path>
<path d="M11.9995 4.36157L12.0003 3" stroke="currentColor"></path>
<path d="M3.51904 21H20.4807" stroke="currentColor"></path>
<path d="M3.51904 11.5039H20.4807" stroke="currentColor"></path>
<path d="M15.5709 11.5039V21M19.1416 11.5039V21M12.0002 11.5039V21M4.85693 11.5039V21M8.42952 11.5039V21" stroke="currentColor"></path>
    </svg>
  ),
)

Temple.displayName = 'Temple'

export default Temple
