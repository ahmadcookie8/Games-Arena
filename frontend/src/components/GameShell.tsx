import { useEffect, useState, type ReactNode } from 'react'
import { PanelRightOpen } from 'lucide-react'
import PageBackdrop from './PageBackdrop'
import { TabletopRouteMasthead, type TabletopAction } from './TabletopShell'
import type { GameActionErrorReporter } from '../types/gameFeedback'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  Button,
} from './ui'

interface GameShellProps {
  eyebrow: string
  title: string
  gameCode?: string
  gameCodeCopyable?: boolean
  onInviteCopyError?: GameActionErrorReporter
  statusLabel: string
  statusTone?: 'default' | 'success' | 'warning'
  onBack: () => void
  onClose?: () => void
  primaryAction?: TabletopAction
  children: ReactNode
  width?: 'standard' | 'wide'
  announceStatus?: boolean
}

/**
 * Shared route-level presentation for every playable game. Game boards keep
 * their own visual language while navigation, status and page spacing stay
 * consistent across multiplayer and solo modes.
 */
export default function GameShell({
  eyebrow,
  title,
  gameCode,
  gameCodeCopyable = false,
  onInviteCopyError,
  statusLabel,
  statusTone = 'default',
  onBack,
  onClose,
  primaryAction,
  children,
  width = 'wide',
  announceStatus = false,
}: GameShellProps) {
  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-x-clip bg-page text-text-primary">
      <PageBackdrop intensity="quiet" />
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 mx-auto px-4 py-4 outline-none sm:px-6 ${
          width === 'wide' ? 'max-w-[92rem]' : 'max-w-7xl sm:py-6'
        }`}
      >
        <TabletopRouteMasthead
          eyebrow={eyebrow}
          title={title}
          gameCode={gameCode}
          gameCodeCopyable={gameCodeCopyable}
          onInviteCopyError={onInviteCopyError}
          statusLabel={statusLabel}
          statusTone={statusTone}
          onBack={onBack}
          onClose={onClose}
          primaryAction={primaryAction}
          announceStatus={announceStatus}
        />
        {children}
      </main>
    </div>
  )
}

export interface GameShellLayoutProps {
  statusHud?: ReactNode
  playfield: ReactNode
  desktopInspector?: ReactNode
  inspectorTitle?: string
  inspectorDescription?: string
  mobileSheet?: ReactNode
}

/**
 * Named game-layout slots shared by solo and future arcade implementations.
 * The inspector stays beside the playfield on desktop and becomes a trapped,
 * scroll-locked bottom sheet on compact screens.
 */
export function GameShellLayout({
  statusHud,
  playfield,
  desktopInspector,
  inspectorTitle = 'Game details',
  inspectorDescription = 'Players, history, and current game information.',
  mobileSheet,
}: GameShellLayoutProps) {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  ))
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
      if (event.matches) setIsInspectorOpen(false)
    }
    setIsDesktop(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return (
    <>
      {statusHud}
      <div className={`grid grid-cols-1 gap-6 ${desktopInspector ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <div className="min-w-0">{playfield}</div>
        {isDesktop && desktopInspector && (
          <aside className="min-w-0 space-y-4" aria-label={inspectorTitle}>
            {desktopInspector}
          </aside>
        )}
      </div>

      {!isDesktop && desktopInspector && (
        <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto mt-4 w-full max-w-sm px-2">
          <Button fullWidth variant="secondary" onClick={() => setIsInspectorOpen(true)} className="bg-surface/95 shadow-lg backdrop-blur-xl">
            <PanelRightOpen aria-hidden="true" className="h-4 w-4" />
            Open {inspectorTitle.toLowerCase()}
          </Button>
        </div>
      )}

      <BottomSheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
        <BottomSheetContent onSwipeDismiss={() => setIsInspectorOpen(false)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{inspectorTitle}</BottomSheetTitle>
            <BottomSheetDescription>{inspectorDescription}</BottomSheetDescription>
          </BottomSheetHeader>
          {desktopInspector}
        </BottomSheetContent>
      </BottomSheet>

      {mobileSheet}
    </>
  )
}
