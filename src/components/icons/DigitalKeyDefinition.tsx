// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DigitalKeyDefinition = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.2824 19.4119L17.2824 16.5907L15.4035 16.3784L15.3435 14.7043L13.4646 14.4395L13.4634 12.8267L12.3959 11.761C13.0757 10.0174 12.7106 7.96161 11.3025 6.55351C9.40318 4.6542 6.32379 4.6542 4.42448 6.55351C2.52517 8.45282 2.52517 11.5322 4.42448 13.4315C5.81998 14.827 7.85387 15.1959 9.58734 14.5407L14.4612 19.4119L17.2824 19.4119Z" stroke="currentColor"></path>
<path d="M16.959 5.75675C19.4624 6.47234 21.1425 8.8411 20.9903 11.4403" stroke="currentColor"></path>
<path d="M15.9258 8.76512C17.2206 9.09235 18.0946 10.3245 17.9828 11.656" stroke="currentColor"></path>
<path d="M6.95792 8.9701L6.96872 8.98089M7.21659 8.9755C7.21659 9.11513 7.1034 9.22833 6.96377 9.22833C6.82413 9.22833 6.71094 9.11513 6.71094 8.9755C6.71094 8.83587 6.82413 8.72267 6.96377 8.72267C7.1034 8.72267 7.21659 8.83587 7.21659 8.9755Z" stroke="currentColor"></path>
    </svg>
  ),
)

DigitalKeyDefinition.displayName = 'DigitalKeyDefinition'

export default DigitalKeyDefinition
