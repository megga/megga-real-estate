// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CalendarSignals = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.4486 20.33C15.0361 20.7591 14.4669 21.0023 13.8714 21.0023H8.19413C5.55056 21.0023 3.90039 19.4952 3.90039 16.7466V8.60178C3.90039 5.89594 5.55056 4.42285 8.19413 4.42285H15.8145C18.4658 4.42285 20.1082 5.89594 20.1004 8.60178V14.605C20.1004 15.1694 19.8825 15.7113 19.4913 16.119L15.4486 20.33Z" stroke="currentColor"></path>
<path d="M14.3867 20.9375V17.8532C14.3857 16.347 15.6049 15.126 17.1101 15.1221H20.0309" stroke="currentColor"></path>
<path d="M15.6403 3.00098V5.96271M8.36914 3.00098V5.96271" stroke="currentColor"></path>
<path d="M10.0733 17.0257V14.165" stroke="currentColor"></path>
<path d="M12.6882 17.0252V16.2515" stroke="currentColor"></path>
<path d="M7.38303 17.0252V16.2515" stroke="currentColor"></path>
<path d="M7.03613 13.0633L9.79454 10.0744L12.9415 12.1344L15.6404 9.22852" stroke="currentColor"></path>
    </svg>
  ),
)

CalendarSignals.displayName = 'CalendarSignals'

export default CalendarSignals
