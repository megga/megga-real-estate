// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashElectric = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 8.46913V6.89195C3 4.74265 4.74259 3.00006 6.89286 3.00006H8.18205" stroke="currentColor"></path>
<path d="M3 15.5312V17.1084C3 19.2577 4.74259 21.0003 6.89286 21.0003H8.14994" stroke="currentColor"></path>
<path d="M21.0004 15.5312V17.1084C21.0004 19.2577 19.2578 21.0003 17.1075 21.0003H15.8184" stroke="currentColor"></path>
<path d="M20.9995 8.46907V6.89189C20.9995 4.74259 19.257 3 17.1067 3H15.8496" stroke="currentColor"></path>
<path d="M8.36907 12.2237L10.3872 7.29931C10.4325 7.17583 10.5501 7.09375 10.6816 7.09375H13.3871C13.6035 7.09375 13.7548 7.30776 13.6827 7.51178L12.4862 10.3198C12.4141 10.5239 12.5655 10.7379 12.7819 10.7379H15.3365C15.606 10.7379 15.7499 11.0553 15.5724 11.258L10.7218 16.7946C10.5032 17.044 10.0975 16.8276 10.183 16.5072L11.1076 13.0395C11.1607 12.8405 11.0107 12.6452 10.8047 12.6452H8.66343C8.44546 12.6452 8.294 12.4283 8.36907 12.2237Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashElectric.displayName = 'FlashElectric'

export default FlashElectric
