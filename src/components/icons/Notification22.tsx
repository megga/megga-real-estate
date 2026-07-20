// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Notification22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.25 4.29702C15.7342 4.29702 18.5587 7.1215 18.5587 10.6057V13.3988C18.5587 15.2851 19.132 17.1269 20.2028 18.6798H4.29721C5.36796 17.1269 5.94135 15.2851 5.94135 13.3989V10.6057C5.94135 7.1215 8.76583 4.29702 12.25 4.29702ZM12.25 4.29702V2.13845" stroke="currentColor"></path>
<path d="M15.4791 18.6797V18.9101C15.4791 20.6932 14.0337 22.1386 12.2506 22.1386C10.4675 22.1386 9.02206 20.6932 9.02206 18.9101V18.6797" stroke="currentColor"></path>
    </svg>
  ),
)

Notification22.displayName = 'Notification22'

export default Notification22
