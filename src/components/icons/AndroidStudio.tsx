// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AndroidStudio = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M15.0827 7.43782C15.0827 5.73513 13.702 4.35547 12.0003 4.35547C10.2976 4.35547 8.91699 5.73513 8.91699 7.43782C8.91699 9.1405 10.2976 10.5202 12.0003 10.5202C13.702 10.5202 15.0827 9.1405 15.0827 7.43782Z" stroke="currentColor"></path>
<path d="M3.62695 12.6719C5.37245 15.4623 8.46647 17.3129 12.0003 17.3129C15.5224 17.3129 18.6271 15.4623 20.3726 12.6719" stroke="currentColor"></path>
<path d="M17.3483 21.0015L15.6631 16.6562" stroke="currentColor"></path>
<path d="M6.71875 21.0014L10.8684 10.3008" stroke="currentColor"></path>
<path d="M12.0001 4.35588L12 3" stroke="currentColor"></path>
<path d="M14.4621 13.5583L13.1992 10.3008" stroke="currentColor"></path>
    </svg>
  ),
)

AndroidStudio.displayName = 'AndroidStudio'

export default AndroidStudio
