// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TouchId = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.40942 16.1428C5.37442 15.8648 5.35645 15.5818 5.35645 15.2948V10.6098C5.35645 6.9408 8.33043 3.9668 12.0004 3.9668C15.6694 3.9668 18.6444 6.9408 18.6444 10.6098V15.2948C18.6444 15.6848 18.6104 16.0668 18.5464 16.4378C18.3554 17.3608 18.0644 18.1738 17.6384 18.8398C17.3444 19.3088 16.9935 19.7398 16.5955 20.1198" stroke="currentColor"></path>
<path d="M13.4272 21.8138C12.9682 21.9148 12.4903 21.9678 12.0013 21.9678C9.62328 21.9678 7.53726 20.7198 6.36426 18.8418" stroke="currentColor"></path>
<path d="M8.56348 14.8395C8.56348 16.7365 10.1015 18.2745 11.9995 18.2745C13.8975 18.2745 15.4355 16.7365 15.4355 14.8395V11.1025C15.4355 10.2025 15.0895 9.38448 14.5245 8.77148" stroke="currentColor"></path>
<path d="M11.9995 7.66211C10.1025 7.66211 8.56348 9.2001 8.56348 11.0981V12.0361" stroke="currentColor"></path>
<path d="M11.9971 14.9379V11.0059" stroke="currentColor"></path>
    </svg>
  ),
)

TouchId.displayName = 'TouchId'

export default TouchId
