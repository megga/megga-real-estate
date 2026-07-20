// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Graph3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.6786 3.3486C12.9706 4.1636 12.6886 9.2886 13.5116 10.1126C14.3346 10.9346 19.2796 10.5186 20.4676 9.5836C23.3256 7.3326 15.9386 0.746597 13.6786 3.3486Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.1376 13.7901C19.2216 14.8741 16.3476 21.0541 10.6516 21.0541C6.39758 21.0541 2.94958 17.6061 2.94958 13.3531C2.94958 8.05305 8.17859 4.66305 9.67759 6.16205C10.5406 7.02505 9.56858 11.0861 11.1166 12.6351C12.6646 14.1841 17.0536 12.7061 18.1376 13.7901Z" stroke="currentColor"></path>
    </svg>
  ),
)

Graph3.displayName = 'Graph3'

export default Graph3
