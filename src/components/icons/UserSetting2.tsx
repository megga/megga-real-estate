// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSetting2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2675 14.5547V15.4624M16.2675 19.0926V20.0003M13.9072 15.9162L14.6908 16.3701M17.8443 18.1848L18.6278 18.6386M13.9072 18.6386L14.6908 18.1848M17.8443 16.3697L18.6278 15.9158M17.5494 15.9929C18.2584 16.702 18.2584 17.852 17.5494 18.5611C16.8403 19.2692 15.6912 19.2692 14.983 18.5611C14.2739 17.852 14.2739 16.702 14.983 15.9929C15.6912 15.2848 16.8403 15.2848 17.5494 15.9929Z" stroke="currentColor"></path>
<path d="M5.37207 19.2118C5.37207 17.2071 6.9537 14.7109 11.5119 14.7109" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4328 7.92197C15.4328 10.0876 13.6765 11.8439 11.5108 11.8439C9.34519 11.8439 7.58887 10.0876 7.58887 7.92197C7.58887 5.75632 9.34519 4 11.5108 4C13.6765 4 15.4328 5.75632 15.4328 7.92197Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserSetting2.displayName = 'UserSetting2'

export default UserSetting2
