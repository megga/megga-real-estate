import Shimmer from '@/components/ui/Shimmer'

/**
 * Skeleton for /dashboard/* routes (agent CRM). The chrome (sidebar + header)
 * is solid (no shimmer) because it's structural — it tells the agent "you're
 * in the CRM". The content area is shimmered because that's what's loading.
 *
 * Layout matches AgentSugarLayout roughly:
 *   - 240px sidebar on the left (desktop only)
 *   - Top header bar
 *   - Main content area with placeholder KPI cards / table
 */

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-theme-page flex">
      {/* Sidebar — solid chrome, not shimmer */}
      <aside className="hidden md:flex w-60 flex-col border-r border-theme-border bg-theme-sidebar px-3 py-6 gap-2">
        <Shimmer className="h-8 w-24 rounded mb-6 mx-2" />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Shimmer shape="circle" className="h-5 w-5" />
            <Shimmer className="h-3.5 w-20 rounded" />
          </div>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b border-theme-border bg-theme-card flex items-center justify-between px-6">
          <Shimmer className="h-6 w-40 rounded" />
          <div className="flex items-center gap-3">
            <Shimmer className="h-9 w-32 rounded-full" />
            <Shimmer shape="circle" className="h-9 w-9" />
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Filter / segmented control row */}
          <div className="flex gap-2">
            <Shimmer className="h-9 w-24 rounded-full" />
            <Shimmer className="h-9 w-28 rounded-full" />
            <Shimmer className="h-9 w-24 rounded-full" />
            <div className="flex-1" />
            <Shimmer className="h-9 w-9 rounded-full" />
          </div>

          {/* KPI cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-theme-border bg-theme-card p-5 space-y-3">
                <Shimmer className="h-3 w-16 rounded" />
                <Shimmer className="h-8 w-28 rounded-lg" />
                <Shimmer className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>

          {/* Chart / table area */}
          <div className="rounded-2xl border border-theme-border bg-theme-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Shimmer className="h-5 w-32 rounded" />
              <Shimmer className="h-7 w-24 rounded-full" />
            </div>
            <Shimmer className="h-60 w-full rounded-xl" />
          </div>

          {/* List rows */}
          <div className="rounded-2xl border border-theme-border bg-theme-card overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-theme-border last:border-0">
                <Shimmer shape="circle" className="h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-3.5 w-40 rounded" />
                  <Shimmer className="h-3 w-24 rounded" />
                </div>
                <Shimmer className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
