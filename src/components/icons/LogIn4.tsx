// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LogIn4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.25781 7.75C5.71891 5.20934 8.4498 3.5 11.5776 3.5C16.2446 3.5 20.0279 7.30558 20.0279 12C20.0279 16.6944 16.2446 20.5 11.5776 20.5C8.4498 20.5 5.71891 18.7907 4.25781 16.25" stroke="currentColor"></path>
<path d="M10.5779 8.6001L13.958 12.0001M13.958 12.0001L10.5779 15.4001M13.958 12.0001H2.97266" stroke="currentColor"></path>
    </svg>
  ),
)

LogIn4.displayName = 'LogIn4'

export default LogIn4
