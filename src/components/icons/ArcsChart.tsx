// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArcsChart = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 3.00073C14.0405 3.00073 16.0204 3.69412 17.6151 4.96719C19.2098 6.24026 20.3245 8.01743 20.7764 10.0072C21.2284 11.9971 20.9908 14.0814 20.1026 15.9184C19.2143 17.7555 17.7282 19.2361 15.8879 20.1176C14.0477 20.9991 11.9625 21.2291 9.97432 20.7698C7.98617 20.3105 6.2131 19.1893 4.9459 17.59C3.67869 15.9907 2.99257 14.0082 3.00006 11.9677C3.00755 9.92721 3.7082 7.94984 4.98712 6.35986" stroke="currentColor"></path>
<path d="M12 6.50082C10.9361 6.50082 9.89502 6.80939 9.00295 7.38913C8.11088 7.96887 7.4061 8.7949 6.97401 9.76712C6.54193 10.7393 6.4011 11.816 6.56858 12.8666C6.73606 13.9173 7.20466 14.8968 7.9176 15.6865C8.63055 16.4762 9.55722 17.0421 10.5853 17.3158C11.6134 17.5894 12.6989 17.559 13.71 17.2282C14.7212 16.8974 15.6147 16.2805 16.2824 15.4521C16.95 14.6238 17.363 13.6195 17.4714 12.5612" stroke="currentColor"></path>
<path d="M11.9998 14.0007C12.3866 14.0007 12.7652 13.8885 13.0896 13.6777C13.414 13.4669 13.6703 13.1665 13.8274 12.813C13.9845 12.4595 14.0357 12.0679 13.9748 11.6859C13.9139 11.3038 13.7435 10.9477 13.4843 10.6605C13.225 10.3733 12.888 10.1675 12.5142 10.068C12.1403 9.96851 11.7456 9.97957 11.3779 10.0999" stroke="currentColor"></path>
    </svg>
  ),
)

ArcsChart.displayName = 'ArcsChart'

export default ArcsChart
