// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircularChart = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 3.00073C14.0405 3.00073 16.0204 3.69412 17.6151 4.96719C19.2098 6.24026 20.3245 8.01743 20.7764 10.0072C21.2284 11.9971 20.9908 14.0814 20.1026 15.9184C19.2143 17.7555 17.7282 19.2361 15.8879 20.1176C14.0477 20.9991 11.9625 21.2291 9.97432 20.7698C7.98617 20.3105 6.2131 19.1893 4.9459 17.59C3.67869 15.9907 2.99257 14.0082 3.00006 11.9677C3.00755 9.92721 3.7082 7.94984 4.98712 6.35986" stroke="currentColor"></path>
<path d="M12 6.50082C13.0639 6.50082 14.105 6.80939 14.997 7.38913C15.8891 7.96887 16.5939 8.7949 17.026 9.76712C17.4581 10.7393 17.5989 11.816 17.4314 12.8666C17.2639 13.9173 16.7953 14.8968 16.0824 15.6865C15.3695 16.4762 14.4428 17.0421 13.4147 17.3158C12.3866 17.5894 11.3011 17.559 10.29 17.2282C9.27879 16.8974 8.38526 16.2805 7.71765 15.4521C7.05004 14.6238 6.63701 13.6195 6.52862 12.5612" stroke="currentColor"></path>
<path d="M11.9998 10.0007C12.3866 10.0007 12.7652 10.1129 13.0896 10.3238C13.414 10.5346 13.6703 10.8349 13.8274 11.1885C13.9845 11.542 14.0357 11.9335 13.9748 12.3156C13.9139 12.6976 13.7435 13.0538 13.4843 13.341C13.225 13.6281 12.888 13.8339 12.5142 13.9334C12.1403 14.033 11.7456 14.0219 11.3779 13.9016" stroke="currentColor"></path>
    </svg>
  ),
)

CircularChart.displayName = 'CircularChart'

export default CircularChart
