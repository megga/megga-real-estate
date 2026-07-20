// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSearch3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.6931 19.0759C17.6382 20.1307 15.928 20.1307 14.8732 19.0759C13.8183 18.021 13.8183 16.3108 14.8732 15.256C15.928 14.2011 17.6382 14.2011 18.6931 15.256C19.7479 16.3108 19.7479 18.021 18.6931 19.0759ZM18.6931 19.0759L20.1567 20.5391" stroke="currentColor"></path>
<circle cx="10.3335" cy="8.16165" r="4.70071" stroke="currentColor"></circle>
<path d="M3.91818 19.4875C3.80733 18.8493 3.85312 18.1879 3.85312 17.5433C3.85312 15.1139 5.82252 13.1445 8.2519 13.1445H12.5352C12.8617 13.1445 13.1799 13.1801 13.4861 13.2476" stroke="currentColor"></path>
    </svg>
  ),
)

UserSearch3.displayName = 'UserSearch3'

export default UserSearch3
