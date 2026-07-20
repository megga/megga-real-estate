// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DonutBarChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.9248 20.9128C17.3845 20.9128 20.9999 17.2975 20.9999 12.8377C20.9999 10.5476 20.0466 8.48024 18.5152 7.01066C17.1795 5.72877 15.4038 4.90175 13.4373 4.77859C13.1547 4.76089 12.9248 4.99213 12.9248 5.27529V7.60416C12.9248 7.88731 13.1551 8.11393 13.4366 8.14428C14.5278 8.26192 15.5076 8.75138 16.2467 9.48342C17.1105 10.339 17.6456 11.5258 17.6456 12.8377C17.6456 15.4449 15.532 17.5585 12.9248 17.5585C10.4905 17.5585 8.48656 15.7161 8.23139 13.3496C8.20103 13.0681 7.97441 12.8377 7.69125 12.8377H5.36239C5.07923 12.8377 4.84799 13.0679 4.8657 13.3505C5.13021 17.5713 8.63728 20.9128 12.9248 20.9128Z" stroke="currentColor"></path>
<path d="M15.1826 17.0449L16.6729 19.8867" stroke="currentColor"></path>
<path d="M9.74992 3.58322C9.74992 3.30006 9.51957 3.06849 9.2372 3.08965C5.90826 3.339 3.2507 5.99656 3.00134 9.32551C2.98019 9.60787 3.21176 9.83822 3.49492 9.83822H5.28071C5.56387 9.83822 5.78993 9.60747 5.82618 9.32664C6.05547 7.55066 7.46236 6.14377 9.23834 5.91449C9.51917 5.87823 9.74992 5.65217 9.74992 5.36901V3.58322Z" stroke="currentColor"></path>
<path d="M16.2471 9.48321L18.5156 7.01045" stroke="currentColor"></path>
    </svg>
  ),
)

DonutBarChart2.displayName = 'DonutBarChart2'

export default DonutBarChart2
