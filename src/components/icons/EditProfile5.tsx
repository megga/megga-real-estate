// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EditProfile5 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.7533 19.8582L13.9878 19.9864C13.427 20.0807 12.932 19.6134 12.9935 19.0481L13.0789 18.2585C13.1199 17.8767 13.2792 17.5179 13.5356 17.2322L16.5506 13.9109C16.9449 13.4854 17.6099 13.4596 18.0363 13.854L18.7404 14.5056C19.1659 14.8999 19.1917 15.5649 18.7974 15.9913L15.8189 19.2707C15.5402 19.5822 15.1646 19.7888 14.7533 19.8582Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.3845 8.077C15.3845 10.3291 13.5587 12.154 11.3075 12.154C9.05621 12.154 7.23047 10.3291 7.23047 8.077C7.23047 5.82575 9.05621 4 11.3075 4C13.5587 4 15.3845 5.82575 15.3845 8.077Z" stroke="currentColor"></path>
<path d="M4.92383 19.8107C4.92383 17.7268 6.56798 15.1328 11.3064 15.1328" stroke="currentColor"></path>
    </svg>
  ),
)

EditProfile5.displayName = 'EditProfile5'

export default EditProfile5
