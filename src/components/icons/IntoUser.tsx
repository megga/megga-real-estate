// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const IntoUser = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.52596 14.875C6.15051 14.875 3.27148 15.3853 3.27148 17.428C3.27148 19.4707 6.13408 19.9991 9.52596 19.9991C12.8997 19.9991 15.7804 19.4872 15.7804 17.4461C15.7804 15.4034 12.9187 14.875 9.52596 14.875Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.5214 7.99553C13.5214 10.2017 11.733 11.9911 9.52591 11.9911C7.31972 11.9911 5.53125 10.2017 5.53125 7.99553C5.53125 5.78934 7.31972 4 9.52591 4C11.733 4 13.5214 5.78934 13.5214 7.99553Z" stroke="currentColor"></path>
<path d="M16.2031 11.7398H20.7288M16.2031 11.7398L18.0288 9.92188M16.2031 11.7398L18.0288 13.5568" stroke="currentColor"></path>
    </svg>
  ),
)

IntoUser.displayName = 'IntoUser'

export default IntoUser
