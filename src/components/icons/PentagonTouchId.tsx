// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PentagonTouchId = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.792 3.95898H9.20999C8.61099 3.95898 8.03598 4.19597 7.61298 4.62097L3.66199 8.57199C3.23899 8.99499 3 9.56898 3 10.169V15.749C3 16.349 3.23899 16.923 3.66199 17.346L7.61298 21.297C8.03598 21.721 8.61099 21.959 9.20999 21.959H14.792C15.39 21.959 15.964 21.721 16.387 21.297L20.34 17.346C20.763 16.923 21 16.349 21 15.749V10.169C21 9.56898 20.763 8.99499 20.34 8.57199L16.387 4.62097C15.964 4.19597 15.39 3.95898 14.792 3.95898Z" stroke="currentColor"></path>
<path d="M13.7447 17.4142V13.1912C13.7447 12.2062 12.9467 11.4082 11.9627 11.4082C10.9777 11.4082 10.1797 12.2062 10.1797 13.1912V13.6682" stroke="currentColor"></path>
<path d="M15.7012 10.4199C16.2212 11.1569 16.5272 12.0569 16.5272 13.0269V16.3879" stroke="currentColor"></path>
<path d="M8.06445 10.7929C8.84245 9.42394 10.3135 8.50195 12.0005 8.50195C12.6185 8.50195 13.2085 8.62494 13.7455 8.84894" stroke="currentColor"></path>
<path d="M7.47656 16.3909V13.5879" stroke="currentColor"></path>
<path d="M10.1797 17.4146V15.8105" stroke="currentColor"></path>
    </svg>
  ),
)

PentagonTouchId.displayName = 'PentagonTouchId'

export default PentagonTouchId
