// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PasswordLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.33301 21.2816L6.22202 18.3926M3.33301 18.3926L6.22202 21.2816L3.33301 18.3926Z" stroke="currentColor"></path>
<path d="M17.7783 21.2806L20.6673 18.3926M17.7783 18.3926L20.6673 21.2806L17.7783 18.3926Z" stroke="currentColor"></path>
<path d="M10.5557 21.2806L13.4447 18.3926M10.5557 18.3926L13.4447 21.2806L10.5557 18.3926Z" stroke="currentColor"></path>
<path d="M9.79825 13.9133H14.2012C15.4072 13.9133 16.3853 12.9353 16.3853 11.7283V9.25726C16.3853 8.05026 15.4072 7.07227 14.2012 7.07227H9.79825C8.59125 7.07227 7.61426 8.05026 7.61426 9.25726V11.7283C7.61426 12.9353 8.59125 13.9133 9.79825 13.9133Z" stroke="currentColor"></path>
<path d="M12.001 10.1738V10.8128" stroke="currentColor"></path>
<path d="M14.6281 7.11642V5.87844C14.6091 4.42744 13.4181 3.26541 11.9671 3.28341C10.5461 3.30141 9.39707 4.44539 9.37207 5.86739V7.11642" stroke="currentColor"></path>
    </svg>
  ),
)

PasswordLock2.displayName = 'PasswordLock2'

export default PasswordLock2
