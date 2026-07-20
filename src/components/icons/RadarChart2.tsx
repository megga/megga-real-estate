// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RadarChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.7898 3.7338C11.5114 3.2095 12.4886 3.2095 13.2102 3.7338L20.1511 8.77667C20.8728 9.30097 21.1747 10.2303 20.8991 11.0786L18.2479 19.2382C17.9723 20.0865 17.1817 20.6609 16.2897 20.6609H7.71028C6.81829 20.6609 6.02774 20.0865 5.7521 19.2382L3.10091 11.0786C2.82527 10.2303 3.12723 9.30097 3.84887 8.77667L10.7898 3.7338Z" stroke="currentColor"></path>
<path d="M16.5828 10.2415L12.694 7.94116C12.3897 7.76116 12.013 7.75521 11.7032 7.9255L7.29144 10.3504C6.83032 10.6039 6.6445 11.1713 6.86637 11.6484L8.72912 15.6541C8.92015 16.0649 9.3635 16.296 9.80965 16.2172L13.755 15.521C14.0104 15.4759 14.2382 15.3335 14.3905 15.1236L16.8829 11.6896C17.229 11.2128 17.0899 10.5415 16.5828 10.2415Z" stroke="currentColor"></path>
    </svg>
  ),
)

RadarChart2.displayName = 'RadarChart2'

export default RadarChart2
