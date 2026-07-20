// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MonitorLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.02802 3.56641H16.971C19.196 3.56641 21 5.3704 21 7.5954V13.0524C21 15.2774 19.196 17.0814 16.971 17.0814H7.02802C4.80402 17.0814 3 15.2774 3 13.0524V7.5954C3 5.3704 4.80402 3.56641 7.02802 3.56641Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.2729 13.5117H10.7269C10.0299 13.5117 9.46289 12.9447 9.46289 12.2477V10.8177C9.46289 10.1207 10.0299 9.55469 10.7269 9.55469H13.2729C13.9709 9.55469 14.5369 10.1207 14.5369 10.8177V12.2477C14.5369 12.9447 13.9709 13.5117 13.2729 13.5117Z" stroke="currentColor"></path>
<path d="M13.5195 9.58275V8.64177C13.5095 7.80277 12.8204 7.13074 11.9814 7.14074C11.1594 7.15074 10.4935 7.81373 10.4805 8.63573V9.58275" stroke="currentColor"></path>
<path d="M7.05664 21H16.9446" stroke="currentColor"></path>
<path d="M9.88605 17.082L9.24805 20.999" stroke="currentColor"></path>
<path d="M14.1172 17.082L14.7542 20.999" stroke="currentColor"></path>
    </svg>
  ),
)

MonitorLock.displayName = 'MonitorLock'

export default MonitorLock
