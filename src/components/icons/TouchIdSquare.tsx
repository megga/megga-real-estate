// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TouchIdSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3.95898H16.2169C19.165 3.95898 21 6.03999 21 8.98499V16.933C21 19.878 19.165 21.959 16.2159 21.959H7.78216C4.83405 21.959 3 19.878 3 16.933V8.98499C3 6.03999 4.84281 3.95898 7.78216 3.95898Z" stroke="currentColor"></path>
<path d="M14.3304 14.6397V12.8807C14.3304 11.5947 13.2884 10.5527 12.0021 10.5527C10.7168 10.5527 9.67383 11.5947 9.67383 12.8807V15.6777C9.67383 16.9627 10.7168 18.0057 12.0021 18.0057" stroke="currentColor"></path>
<path d="M12 15.3877V13.2637" stroke="currentColor"></path>
<path d="M16.9581 15.4961V12.8681C16.9581 10.1301 14.7388 7.91211 12.0018 7.91211C11.3246 7.91211 10.6795 8.04712 10.0918 8.29312" stroke="currentColor"></path>
<path d="M7.96711 9.95898C7.38111 10.789 7.03711 11.801 7.03711 12.894V16.527" stroke="currentColor"></path>
    </svg>
  ),
)

TouchIdSquare.displayName = 'TouchIdSquare'

export default TouchIdSquare
