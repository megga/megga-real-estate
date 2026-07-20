// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ZoomIn = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.9331 9.22142V7.54307C18.9331 4.93555 17.3092 3.09375 14.6988 3.09375H7.23333C4.63164 3.09375 3 4.93555 3 7.54307V14.5775C3 17.185 4.62386 19.0269 7.23333 19.0269H9.20161" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.7978 12.6172H14.9157C13.5623 12.6172 12.7148 13.5755 12.7148 14.9309V18.5892C12.7148 19.9445 13.5584 20.9019 14.9157 20.9019H18.7978C20.155 20.9019 20.9996 19.9445 20.9996 18.5892V14.9309C20.9996 13.5755 20.155 12.6172 18.7978 12.6172Z" stroke="currentColor"></path>
<path d="M10.8677 11.0454L7.09184 7.26953M10.8677 11.0454L10.8608 7.64896M10.8677 11.0454L7.47125 11.0386" stroke="currentColor"></path>
    </svg>
  ),
)

ZoomIn.displayName = 'ZoomIn'

export default ZoomIn
