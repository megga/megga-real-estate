// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0001 19.1719C10.4826 19.1719 9.25244 17.9417 9.25244 16.4242L9.25244 15.1533C9.25244 14.8526 9.49628 14.6087 9.79706 14.6087L14.2032 14.6087C14.504 14.6087 14.7478 14.8526 14.7478 15.1533L14.7478 16.4242C14.7478 17.9417 13.5177 19.1719 12.0001 19.1719Z" stroke="currentColor"></path>
<path d="M12 19.1719V20.9984" stroke="currentColor"></path>
<path d="M12 2.99981V4.82637" stroke="currentColor"></path>
<path d="M10.5669 14.6094L10.5669 12.4814M13.4333 14.6094L13.4333 12.4814" stroke="currentColor"></path>
<path d="M16.9678 14.9917C19.711 12.2484 19.711 7.80071 16.9678 5.05745C14.2245 2.31418 9.77678 2.31418 7.03352 5.05745C4.29026 7.80071 4.29026 12.2484 7.03352 14.9917" stroke="currentColor"></path>
<path d="M10.5195 9.27587V9.28125M13.4797 9.27587V9.28125" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCircle3.displayName = 'PowerOutletCircle3'

export default PowerOutletCircle3
