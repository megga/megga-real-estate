// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TouchIdSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.30591 16.1428C4.27091 15.8658 4.25195 15.5828 4.25195 15.2958V10.6108C4.25195 6.94179 7.22691 3.9668 10.8969 3.9668C14.5659 3.9668 17.5409 6.94179 17.5409 10.6108" stroke="currentColor"></path>
<path d="M10.896 7.66211C8.999 7.66211 7.45898 9.20111 7.45898 11.0991V12.0361" stroke="currentColor"></path>
<path d="M7.45898 14.834C7.45898 15.938 7.98002 16.92 8.78802 17.548" stroke="currentColor"></path>
<path d="M10.8965 12.9149V11.0059" stroke="currentColor"></path>
<path d="M14.3309 11.1015C14.3309 10.2025 13.9859 9.38348 13.4199 8.77148" stroke="currentColor"></path>
<path d="M10.8978 21.9678C8.51977 21.9678 6.43477 20.7188 5.25977 18.8418" stroke="currentColor"></path>
<path d="M18.1713 19.6712L19.7483 21.2452L18.1713 19.6712ZM16.0383 14.2402C17.7693 14.2402 19.1723 15.6432 19.1723 17.3742C19.1723 19.1052 17.7693 20.5092 16.0383 20.5092C14.3073 20.5092 12.9043 19.1052 12.9043 17.3742C12.9043 15.6432 14.3073 14.2402 16.0383 14.2402Z" stroke="currentColor"></path>
    </svg>
  ),
)

TouchIdSearch.displayName = 'TouchIdSearch'

export default TouchIdSearch
