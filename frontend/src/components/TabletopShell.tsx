import { useRef } from 'react'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { getTabletopTabIndex } from '../lib/tabletopUi'
import type { GameActionErrorReporter } from '../types/gameFeedback'
import InviteCodeButton from './InviteCodeButton'
import {
  AnimatedSheetBody,
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  Button,
} from './ui'
import './tabletop-shell.css'

export interface TabletopAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface TabletopRouteMastheadProps {
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
  announceStatus?: boolean
}

export function TabletopRouteMasthead({
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
  announceStatus = false,
}: TabletopRouteMastheadProps) {
  return (
    <header className="tabletop-route-masthead">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="tabletop-route-masthead__back">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back</span>
      </Button>
      <div className="min-w-0">
        <p className="tabletop-eyebrow">{eyebrow}</p>
        <h1 className="tabletop-route-masthead__title">{title}</h1>
        {gameCode && (
          <InviteCodeButton
            gameCode={gameCode}
            copyable={gameCodeCopyable}
            onCopyError={(message, trigger) => onInviteCopyError?.(message, trigger)}
            className="tabletop-route-masthead__code"
          />
        )}
      </div>
      <div className="tabletop-route-masthead__actions">
        <span className={`tabletop-route-status tabletop-route-status--${statusTone}`} aria-live={announceStatus ? 'polite' : undefined}>
          {statusLabel}
        </span>
        {primaryAction && (
          <Button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="tabletop-route-primary"
          >
            {primaryAction.label}
          </Button>
        )}
        {onClose && (
          <Button type="button" variant="danger" size="sm" onClick={onClose} className="tabletop-route-close">Close game</Button>
        )}
      </div>
    </header>
  )
}

export interface TabletopTab<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  badge?: string | number
}

interface TabletopTabsProps<T extends string> {
  tabs: TabletopTab<T>[]
  activeTab: T
  onSelect: (tab: T) => void
  ariaLabel: string
  idBase: string
  controlsIdBase?: string
  variant?: 'default' | 'dock'
}

export function TabletopTabs<T extends string>({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
  idBase,
  controlsIdBase = idBase,
  variant = 'default',
}: TabletopTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  function selectAt(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length]
    if (!tab) return
    onSelect(tab.id)
    window.requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`#${idBase}-tab-${tab.id}`)?.focus()
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const targetIndex = getTabletopTabIndex(event.key, index, tabs.length)
    if (targetIndex === null) return
    event.preventDefault()
    selectAt(targetIndex)
  }

  return (
    <div
      ref={listRef}
      className={`tabletop-tabs ${variant === 'dock' ? 'tabletop-tabs--dock' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon
        const selected = activeTab === tab.id
        return (
          <button
            key={tab.id}
            id={`${idBase}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${controlsIdBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={selected ? 'is-active' : ''}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== 0 && <span className="tabletop-tab-badge">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

interface TabletopDockButtonsProps<T extends string> {
  tabs: TabletopTab<T>[]
  activeTab: T
  onSelect: (tab: T) => void
  ariaLabel: string
  isOpen: boolean
}

export function TabletopDockButtons<T extends string>({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
  isOpen,
}: TabletopDockButtonsProps<T>) {
  return (
    <div className="tabletop-tabs tabletop-tabs--dock" role="group" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const selected = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isOpen && selected}
            onClick={() => onSelect(tab.id)}
            className={selected ? 'is-active' : ''}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== 0 && <span className="tabletop-tab-badge">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

interface TabletopBottomSheetProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  contentKey?: string | number
  idBase?: string
}

export function TabletopBottomSheet({
  isOpen,
  title,
  onClose,
  children,
  contentKey,
  idBase = 'tabletop-sheet',
}: TabletopBottomSheetProps) {
  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <BottomSheetContent
        className="sm:max-w-3xl"
        aria-labelledby={`${idBase}-title`}
        onSwipeDismiss={onClose}
      >
        <BottomSheetHeader>
          <BottomSheetTitle id={`${idBase}-title`}>{title}</BottomSheetTitle>
          <BottomSheetDescription className="sr-only">Game information and controls.</BottomSheetDescription>
        </BottomSheetHeader>
        <AnimatedSheetBody contentKey={contentKey}>{children}</AnimatedSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  )
}
