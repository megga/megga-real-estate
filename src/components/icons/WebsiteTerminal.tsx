// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WebsiteTerminal = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78301 3H16.2175C19.1655 3 20.9995 5.08016 20.9995 8.02625V15.9733C20.9995 18.9184 19.1655 20.9995 16.2165 20.9995H7.78301C4.83498 20.9995 3 18.9184 3 15.9733V8.02625C3 5.08016 4.84374 3 7.78301 3Z" stroke="currentColor"></path>
<path d="M12.7422 17.207H15.4781" stroke="currentColor"></path>
<path d="M8.52344 12.8047L10.4878 14.7691L8.52344 16.7334" stroke="currentColor"></path>
<path d="M20.9995 9.49219H3" stroke="currentColor"></path>
<path d="M6.29906 6.55078H6.28906M11.2712 6.55078H11.2612M8.7849 6.55078H8.7749" stroke="currentColor"></path>
    </svg>
  ),
)

WebsiteTerminal.displayName = 'WebsiteTerminal'

export default WebsiteTerminal
