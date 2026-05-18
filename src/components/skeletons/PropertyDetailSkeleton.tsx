import Shimmer from '@/components/ui/Shimmer'

/**
 * Skeleton for /propriete/:id and /listing/:id (single property detail page).
 * Mimics PxSinglePropertyHero's 1-large + 2×2 grid layout, then title/price/
 * description blocks.
 *
 * Used as Suspense fallback during chunk + data fetch for the property page.
 */

export default function PropertyDetailSkeleton() {
  return (
    <div className="min-h-screen bg-theme-page">
      {/* Nav chrome */}
      <div className="h-16 border-b border-theme-border bg-theme-card flex items-center px-6 gap-8">
        <Shimmer className="h-5 w-20 rounded" />
        <div className="flex gap-5 flex-1">
          <Shimmer className="h-3 w-12 rounded" />
          <Shimmer className="h-3 w-12 rounded" />
        </div>
        <Shimmer className="h-9 w-24 rounded-full" />
      </div>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-4">
        <Shimmer className="h-3 w-64 rounded" />
      </div>

      {/* Hero gallery: 1.5fr + 1fr×1fr grid (matches PxSinglePropertyHero) */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ aspectRatio: '1.366 / 1' }}>
          <Shimmer className="rounded-2xl" />
          <div className="grid grid-cols-2 grid-rows-2 gap-3">
            <Shimmer className="rounded-xl" />
            <Shimmer className="rounded-xl" />
            <Shimmer className="rounded-xl" />
            <Shimmer className="rounded-xl" />
          </div>
        </div>
      </div>

      {/* Title bar + price card */}
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 mb-10">
        <div className="space-y-3">
          <Shimmer className="h-9 w-3/4 rounded-lg" />
          <Shimmer className="h-4 w-1/2 rounded" />
          <div className="flex gap-2 mt-4">
            <Shimmer className="h-7 w-20 rounded-full" />
            <Shimmer className="h-7 w-24 rounded-full" />
            <Shimmer className="h-7 w-16 rounded-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-theme-border p-5 space-y-3">
          <Shimmer className="h-3 w-20 rounded" />
          <Shimmer className="h-10 w-32 rounded-lg" />
          <Shimmer className="h-3 w-28 rounded" />
          <Shimmer className="h-12 w-full rounded-full mt-2" />
        </div>
      </div>

      {/* Description + specs */}
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 mb-16">
        <div className="space-y-3">
          <Shimmer className="h-5 w-32 rounded" />
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-5/6 rounded" />
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-4/5 rounded" />
        </div>
        <div className="rounded-2xl border border-theme-border p-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Shimmer className="h-3 w-16 rounded" />
              <Shimmer className="h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
