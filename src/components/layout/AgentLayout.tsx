import { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/layout/CommandPalette'
import Breadcrumb from '@/components/layout/Breadcrumb'
import CopilotPanel from '@/components/ai-copilot/CopilotPanel'
import NewContactDialog from '@/components/contacts/NewContactDialog'
import BottomTabBar from '@/components/layout/BottomTabBar'

function AgentLayoutInner() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickContactOpen, setQuickContactOpen] = useState(false)

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])
  const openQuickContact = useCallback(() => setQuickContactOpen(true), [])
  const closeQuickContact = useCallback(() => setQuickContactOpen(false), [])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K — Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
      // Cmd+Shift+C / Ctrl+Shift+C — Quick contact creation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setQuickContactOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-theme-section isolate">
      <Sidebar
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onOpenCommandPalette={openCommandPalette}
        onQuickContact={openQuickContact}
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
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-4 overflow-y-auto">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={closeCommandPalette} onCreateContact={() => { closeCommandPalette(); openQuickContact() }} />

      {/* Quick Contact Creation — accessible globalement via ⌘⇧C */}
      <NewContactDialog open={quickContactOpen} onClose={closeQuickContact} />

      {/* Copilot IA — bouton flottant accessible depuis toute page agent */}
      <CopilotPanel />

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  )
}

// Wrap with ThemeProvider so dark mode only applies to the dashboard
export default function AgentLayout() {
  return (
    <ThemeProvider>
      <CopilotContextProvider>
        <AgentLayoutInner />
      </CopilotContextProvider>
    </ThemeProvider>
  )
}
