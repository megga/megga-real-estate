// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSearch4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.5161 18.7075C16.5839 19.6396 15.0727 19.6396 14.1405 18.7075C13.2084 17.7753 13.2084 16.2641 14.1405 15.3319C15.0727 14.3998 16.5839 14.3998 17.5161 15.3319C18.4482 16.2641 18.4482 17.7753 17.5161 18.7075ZM17.5161 18.7075L18.8095 20.0005" stroke="currentColor"></path>
<path d="M5.19141 19.5617C5.19141 17.5108 6.80953 14.957 11.4729 14.957" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4859 8.01246C15.4859 10.2281 13.689 12.0249 11.4734 12.0249C9.25778 12.0249 7.46094 10.2281 7.46094 8.01246C7.46094 5.79685 9.25778 4 11.4734 4C13.689 4 15.4859 5.79685 15.4859 8.01246Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserSearch4.displayName = 'UserSearch4'

export default UserSearch4
