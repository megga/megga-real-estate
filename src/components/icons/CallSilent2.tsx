// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CallSilent2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M11.0592 14.78C12.6064 16.0214 14.073 16.4234 14.073 16.4234L16.9271 14.78L21.5378 18.18C20.68 19.7125 19.5986 20.794 18.066 21.6518C14.263 21.8259 10.8635 20.1352 8.25718 17.7365M6.30467 15.6331C3.87792 12.5766 2.60458 9.01789 3.0501 6.63582C3.91864 5.14337 5.0319 4.03798 6.52185 3.16406L9.76237 7.6153L8.11898 10.4694C8.11898 10.4694 8.33849 11.3911 9.04679 12.527" stroke="currentColor"></path>
<path d="M4.26489 21.9482L18.8796 6.35913" stroke="currentColor"></path>
    </svg>
  ),
)

CallSilent2.displayName = 'CallSilent2'

export default CallSilent2
