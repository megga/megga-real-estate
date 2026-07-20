// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.5266 6.79755C19.2203 6.31485 18.8565 5.85809 18.4354 5.43697C18.2201 5.22162 17.9954 5.02128 17.7627 4.83594" stroke="currentColor"></path>
<path d="M6.28524 12.1511L9.73784 3.72667C9.81533 3.51543 10.0164 3.375 10.2414 3.375H14.8699C15.2401 3.375 15.499 3.74113 15.3757 4.09016L13.3288 8.89411C13.2054 9.24314 13.4643 9.60927 13.8345 9.60927H18.205C18.666 9.60927 18.9123 10.1524 18.6085 10.4992L10.3102 19.9709C9.93625 20.3977 9.24221 20.0275 9.38841 19.4792L10.9703 13.5469C11.0611 13.2064 10.8044 12.8723 10.452 12.8723H6.78883C6.41594 12.8723 6.15682 12.5012 6.28524 12.1511Z" stroke="currentColor"></path>
<path d="M5.6433 18.1458C2.1189 14.6214 2.1189 8.90721 5.6433 5.38281" stroke="currentColor"></path>
<path d="M21.0001 12.7109C20.7919 14.6955 19.9273 16.6241 18.4064 18.1451C17.0816 19.4699 15.4474 20.2967 13.7363 20.6255" stroke="currentColor"></path>
    </svg>
  ),
)

FlashCircle3.displayName = 'FlashCircle3'

export default FlashCircle3
