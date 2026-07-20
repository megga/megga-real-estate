// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FolderCode = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.6409 20.9855C18.9967 20.9855 20.9738 19.0074 20.9738 15.6526L21 10.9969C21 7.57414 19.7584 5.86226 16.3948 5.86226H13.7415C13.0682 5.86032 12.4348 5.54359 12.0296 5.00535L11.1737 3.86766C10.7695 3.32845 10.1361 3.01172 9.46278 3.01172H7.58768C4.23193 3.01172 3 4.98883 3 8.33876V15.6526C3 19.0074 4.981 20.9855 8.34452 20.9855H15.6409Z" stroke="currentColor"></path>
<path d="M10.0837 10.9922L7.94043 13.1354L10.1167 15.3117" stroke="currentColor"></path>
<path d="M13.9178 10.9922L16.061 13.1354L13.8848 15.3117" stroke="currentColor"></path>
    </svg>
  ),
)

FolderCode.displayName = 'FolderCode'

export default FolderCode
