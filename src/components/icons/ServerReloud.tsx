// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerReloud = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 11.352V7.78216C21 4.84281 18.9188 3 15.9736 3H8.02638C5.08119 3 3 4.83405 3 7.78216V16.2159C3 19.165 5.08119 21 8.02638 21H11.1088" stroke="currentColor"></path>
<path d="M7.36328 16.1357H7.88577" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88577M12.1017 7.86523H16.6358" stroke="currentColor"></path>
<path d="M12.22 12H3.02344" stroke="currentColor"></path>
<path d="M16.7611 16.4145L15.0098 16.4155V14.6729" stroke="currentColor"></path>
<path d="M15.1294 19.4735C15.684 20.3881 16.6891 20.9991 17.8372 20.9991C19.5837 20.9991 21.0004 19.5834 21.0004 17.836C21.0004 16.0885 19.5837 14.6719 17.8372 14.6719C16.6006 14.6719 15.5303 15.3812 15.0098 16.4154" stroke="currentColor"></path>
    </svg>
  ),
)

ServerReloud.displayName = 'ServerReloud'

export default ServerReloud
