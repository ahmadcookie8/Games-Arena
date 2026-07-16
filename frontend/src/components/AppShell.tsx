import type { ReactNode } from 'react'
import Header from './Header'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col overflow-x-clip bg-page pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-text-primary">
      <a
        href="#main-content"
        className="ui-action-primary fixed left-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[100] -translate-y-24 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Header />
      <div className="relative flex-1">
        {children}
      </div>
    </div>
  )
}
