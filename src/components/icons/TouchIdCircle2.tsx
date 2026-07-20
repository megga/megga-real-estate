// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TouchIdCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.959C21 7.98798 16.971 3.95898 12 3.95898C7.029 3.95898 3 7.98798 3 12.959C3 17.93 7.029 21.959 12 21.959C16.971 21.959 21 17.93 21 12.959Z" stroke="currentColor"></path>
<path d="M13.7447 17.4142V13.1912C13.7447 12.2062 12.9467 11.4082 11.9627 11.4082C10.9777 11.4082 10.1797 12.2062 10.1797 13.1912V13.6682" stroke="currentColor"></path>
<path d="M10.1797 17.4146V15.8105" stroke="currentColor"></path>
<path d="M8.06445 10.7929C8.84245 9.42394 10.3135 8.50195 12.0005 8.50195C12.6185 8.50195 13.2085 8.62494 13.7455 8.84894" stroke="currentColor"></path>
<path d="M15.7012 10.4199C16.2212 11.1569 16.5272 12.0569 16.5272 13.0269V16.3879" stroke="currentColor"></path>
<path d="M7.47656 16.3909V13.5879" stroke="currentColor"></path>
    </svg>
  ),
)

TouchIdCircle2.displayName = 'TouchIdCircle2'

export default TouchIdCircle2
