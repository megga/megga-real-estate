// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabasePrivacy = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.3781 9.01127C15.4248 9.01127 18.7053 7.68789 18.7053 6.05544C18.7053 4.42298 15.4248 3.09961 11.3781 3.09961C7.33131 3.09961 4.05078 4.42298 4.05078 6.05544C4.05078 7.68789 7.33131 9.01127 11.3781 9.01127Z" stroke="currentColor"></path>
<path d="M4.05078 11.877V17.7288C4.05078 17.7288 4.05078 20.6547 11.4428 20.6547" stroke="currentColor"></path>
<path d="M18.7058 11.0458V6.02539" stroke="currentColor"></path>
<path d="M4.05078 6.02539V11.8772C4.05078 11.8772 4.05078 14.6042 10.7024 14.7932" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.9377 20.9004C16.9377 20.9004 19.925 19.9957 19.925 17.5013C19.925 15.008 20.0339 15.0871 19.7934 14.8456C19.5538 14.6041 17.3297 13.8301 16.9377 13.8301C16.5458 13.8301 14.3207 14.6061 14.0811 14.8456C13.8416 15.0852 13.9505 15.007 13.9505 17.5013C13.9505 19.9957 16.9377 20.9004 16.9377 20.9004Z" stroke="currentColor"></path>
    </svg>
  ),
)

DatabasePrivacy.displayName = 'DatabasePrivacy'

export default DatabasePrivacy
