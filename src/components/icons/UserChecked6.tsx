// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserChecked6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.4062 11.2534L17.9075 12.6916L20.9996 9.73242" stroke="currentColor"></path>
<path d="M3 19.9996C3 17.891 4.66364 15.2656 9.45878 15.2656C14.253 15.2656 15.9166 17.8719 15.9166 19.9815" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.5844 8.12567C13.5844 10.4043 11.7374 12.2513 9.4587 12.2513C7.18099 12.2513 5.33398 10.4043 5.33398 8.12567C5.33398 5.847 7.18099 4 9.4587 4C11.7374 4 13.5844 5.847 13.5844 8.12567Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserChecked6.displayName = 'UserChecked6'

export default UserChecked6
