// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldWifi = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6089C19.3237 19.7221 11.9997 21.9395 11.9997 21.9395C11.9997 21.9395 4.67668 19.7231 4.67668 13.6089C4.67668 7.49469 4.4097 7.01696 4.9977 6.42929C5.5867 5.84064 11.0397 3.93945 11.9997 3.93945C12.9607 3.93945 18.4127 5.83577 19.0017 6.42929C19.5897 7.02183 19.3237 7.49567 19.3237 13.6089Z" stroke="currentColor"></path>
<path d="M10.2607 13.559C11.2577 12.7077 12.7397 12.7077 13.7427 13.5541" stroke="currentColor"></path>
<path d="M8.5791 11.4462C10.5731 9.84865 13.4241 9.84865 15.4171 11.4462" stroke="currentColor"></path>
<path d="M11.999 15.6191V15.6599" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldWifi.displayName = 'ShieldWifi'

export default ShieldWifi
