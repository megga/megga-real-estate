// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Leaves = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0824 7.19624C11.4547 7.2878 10.8165 7.19536 10.1827 7.21033C8.7134 7.24554 7.56194 8.48768 6.44392 9.32928C5.87171 9.76064 5.07237 9.70342 4.56706 9.19547C4.00629 8.63294 4.00629 7.72004 4.56706 7.15663C5.77487 5.94442 6.84183 4.81848 8.47924 4.182C10.7514 3.29815 12.8589 3.72775 15.16 4.182M12.0842 7.22423H10.8438" stroke="currentColor"></path>
<path d="M4.14648 20.5H5.07699C5.78742 20.5 6.22934 19.9991 6.22934 19.2895V15.1353C6.22934 14.4257 5.78742 13.924 5.07699 13.924H4.14648" stroke="currentColor"></path>
<path d="M13.5458 13.7501C12.5246 13.4939 11.5052 13.2923 10.4391 13.3187C8.74889 13.3592 7.56749 14.3012 6.22852 15.1982" stroke="currentColor"></path>
<path d="M11.9184 16.8029C12.5461 16.7113 13.1844 16.8037 13.8182 16.7888C15.2875 16.7536 16.4389 15.5114 17.5569 14.6698C18.1292 14.2385 18.9285 14.2957 19.4338 14.8036C19.9946 15.3662 19.9946 16.2791 19.4338 16.8425C18.226 18.0547 17.159 19.1806 15.5216 19.8171C13.2495 20.701 11.142 20.2714 8.84082 19.8171M11.9167 16.7749H13.1571" stroke="currentColor"></path>
<path d="M10.4546 10.2508C11.4758 10.507 12.4952 10.7086 13.5613 10.6822C15.2515 10.6417 16.4329 9.69973 17.7719 8.80267" stroke="currentColor"></path>
<path d="M19.8543 3.5H18.9238C18.2134 3.5 17.7715 4.00091 17.7715 4.71045V8.86472C17.7715 9.57426 18.2134 10.076 18.9238 10.076H19.8543" stroke="currentColor"></path>
    </svg>
  ),
)

Leaves.displayName = 'Leaves'

export default Leaves
