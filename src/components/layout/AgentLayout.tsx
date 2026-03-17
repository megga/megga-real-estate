import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

export default function AgentLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-section">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-14 bg-white border-b border-border flex items-center px-4 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-section focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5 text-primary-700" aria-hidden="true" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="h-6 w-6 bg-primary-900 rounded flex items-center justify-center" aria-hidden="true">
              <span className="text-[9px] font-bold text-white">GG</span>
            </div>
            <span className="text-sm font-bold text-primary-900">MEGGA</span>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
