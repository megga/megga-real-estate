// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterRefresh = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.6312 5.16797C19.0003 5.16797 20.1104 6.27816 20.1104 7.64716V8.90719C20.1104 9.8938 19.6921 10.8337 18.9594 11.4944L14.4106 15.9925C14.1119 16.2621 13.9407 16.6464 13.9407 17.0482V18.8852C13.9407 19.4681 13.5865 19.9906 13.0455 20.2066L11.3078 20.8984C10.3737 21.2701 9.35983 20.5821 9.35983 19.578V16.5997C9.35983 16.2222 9.20998 15.8612 8.94338 15.5946L4.9113 12.0033C4.25744 11.3504 3.89062 10.4649 3.89062 9.54158V7.64716C3.89062 6.27816 5.00081 5.16797 6.36981 5.16797" stroke="currentColor"></path>
<path d="M14.6762 3V4.74166H12.9336" stroke="currentColor"></path>
<path d="M11.0688 7.25977H9.32617V8.8798" stroke="currentColor"></path>
<path d="M9.38672 4.60319C9.87419 3.74988 10.7898 3.18359 11.8435 3.18359C13.7341 3.18359 14.6749 4.75109 14.6749 4.75109" stroke="currentColor"></path>
<path d="M14.2923 7.42618C13.8039 8.27172 12.8893 8.83703 11.8443 8.83703C10.2846 8.83703 9.32617 7.26953 9.32617 7.26953" stroke="currentColor"></path>
    </svg>
  ),
)

FilterRefresh.displayName = 'FilterRefresh'

export default FilterRefresh
