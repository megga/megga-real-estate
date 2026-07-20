// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Hide3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.42 17.7297C4.19 16.2697 2.75 14.0697 2.75 12.1397C2.75 8.85972 6.89 4.83972 12 4.83972C14.09 4.83972 16.03 5.50972 17.59 6.54972" stroke="currentColor"></path>
<path d="M19.8498 8.61023C20.7408 9.74023 21.2598 10.9902 21.2598 12.1402C21.2598 15.4202 17.1098 19.4402 11.9998 19.4402C11.0898 19.4402 10.2008 19.3102 9.36975 19.0802" stroke="currentColor"></path>
<path d="M9.76572 14.3669C9.17072 13.7779 8.83772 12.9749 8.84072 12.1379C8.83672 10.3929 10.2487 8.97493 11.9947 8.97193C12.8347 8.96993 13.6407 9.30293 14.2347 9.89693" stroke="currentColor"></path>
<path d="M15.1095 12.6991C14.8755 13.9911 13.8645 15.0041 12.5725 15.2411" stroke="currentColor"></path>
<path d="M19.8917 4.24988L4.11768 20.0239" stroke="currentColor"></path>
    </svg>
  ),
)

Hide3.displayName = 'Hide3'

export default Hide3
