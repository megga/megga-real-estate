import { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ThemeProvider } from '@/hooks/useTheme'
import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/layout/CommandPalette'
import Breadcrumb from '@/components/layout/Breadcrumb'
import CopilotPanel from '@/components/ai-copilot/CopilotPanel'

function AgentLayoutInner() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-theme-section">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onOpenCommandPalette={openCommandPalette}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden h-14 bg-theme-card border-b border-theme-border flex items-center px-4 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-theme-hover"
          >
            <Menu className="h-5 w-5 text-theme-secondary" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="h-6 w-6 bg-theme-primary rounded flex items-center justify-center">
              <span className="text-[9px] font-bold text-theme-inverse">GG</span>
            </div>
            <span className="text-sm font-bold text-theme-primary">MEGGA</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={closeCommandPalette} />

      {/* Copilot IA — bouton flottant accessible depuis toute page agent */}
      <CopilotPanel />
    </div>
  )
}

// Wrap with ThemeProvider so dark mode only applies to the dashboard
export default function AgentLayout() {
  return (
    <ThemeProvider>
      <AgentLayoutInner />
    </ThemeProvider>
  )
}
