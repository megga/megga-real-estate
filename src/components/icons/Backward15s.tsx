// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Backward15s = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.50195 11.8131C4.6012 7.3432 8.25569 3.75 12.7499 3.75C17.3063 3.75 20.9997 7.44439 20.9997 11.9999C20.9997 16.5563 17.3063 20.2497 12.7499 20.2497C9.9331 20.2497 7.44618 18.8389 5.95753 16.6838" stroke="currentColor"></path>
<path d="M3 9.80078L4.28044 12.0211L6.48812 10.7475" stroke="currentColor"></path>
<path d="M10.2734 14.6116V9.38672" stroke="currentColor"></path>
<path d="M12.9375 14.6116H14.791C15.5324 14.6116 16.1337 14.0103 16.1337 13.2699C16.1337 12.5275 15.5324 11.9272 14.791 11.9272H12.9375V9.38672H15.8788" stroke="currentColor"></path>
    </svg>
  ),
)

Backward15s.displayName = 'Backward15s'

export default Backward15s
