// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserChecked3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.3111 14.875C7.93567 14.875 5.05664 15.3853 5.05664 17.428C5.05664 19.4707 7.91924 19.9991 11.3111 19.9991" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.3046 7.99553C15.3046 10.2017 13.5162 11.9911 11.3091 11.9911C9.10293 11.9911 7.31445 10.2017 7.31445 7.99553C7.31445 5.78934 9.10293 4 11.3091 4C13.5162 4 15.3046 5.78934 15.3046 7.99553Z" stroke="currentColor"></path>
<path d="M13.8926 17.0378L15.5427 18.6913L18.9432 15.2891" stroke="currentColor"></path>
    </svg>
  ),
)

UserChecked3.displayName = 'UserChecked3'

export default UserChecked3
