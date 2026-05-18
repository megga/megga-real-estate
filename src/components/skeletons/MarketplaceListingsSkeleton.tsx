import Shimmer from '@/components/ui/Shimmer'

/**
 * Skeleton mimicking the structure of /louer + /acheter (PropertyXListingsPage).
 * Rendered as Suspense fallback while the listings chunk + first data are loading.
 *
 * Composition:
 *   - Top nav bar (faked solid block, no shimmer — it's the chrome)
 *   - Hero with title + search bar shimmer
 *   - Filter chips row
 *   - 8 card placeholders in a 2/4 grid (matches the real PxListingsGrid layout)
 *
 * Volume target: the user sees this for 200–1500 ms while the lazy chunk
 * downloads. It's not a pixel-perfect mock, just a structural promise:
 * "Yes, you're about to see the listings page."
 */

export default function MarketplaceListingsSkeleton() {
  return (
    <div className="min-h-screen bg-theme-page">
      {/* Top nav — solid chrome, not shimmer */}
      <div className="h-16 border-b border-theme-border bg-theme-card flex items-center px-6 gap-8">
        <Shimmer className="h-5 w-20 rounded" />
        <div className="flex gap-5 flex-1">
          <Shimmer className="h-3 w-12 rounded" />
          <Shimmer className="h-3 w-12 rounded" />
          <Shimmer className="h-3 w-20 rounded" />
        </div>
        <Shimmer className="h-9 w-24 rounded-full" />
      </div>

      {/* Hero */}
      <section className="bg-[#0E1410] py-16 px-6 text-center">
        <Shimmer className="h-12 w-72 mx-auto rounded-lg mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Shimmer className="h-4 w-96 mx-auto rounded mb-10" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <Shimmer className="h-14 w-full max-w-2xl mx-auto rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
      </section>

      {/* Filter chips */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex gap-2 overflow-hidden border-b border-theme-border">
        {[60, 80, 90, 70, 100, 75].map((w, i) => (
          <Shimmer key={i} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Card grid */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Shimmer className="aspect-[4/3] rounded-2xl" />
            <div className="space-y-2 px-1">
              <Shimmer className="h-5 w-2/3 rounded" />
              <Shimmer className="h-4 w-full rounded" />
              <Shimmer className="h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
