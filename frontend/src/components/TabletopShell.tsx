import { useEffect, useRef } from 'react'
import { LucideIcon, X } from 'lucide-react'
import { getTabletopTabIndex, shouldWrapSheetFocus } from '../lib/tabletopUi'
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
  statusLabel: string
  statusTone?: 'default' | 'success' | 'warning'
  onBack: () => void
  onClose?: () => void
  primaryAction?: TabletopAction
}

export function TabletopRouteMasthead({
  eyebrow,
  title,
  gameCode,
  statusLabel,
  statusTone = 'default',
  onBack,
  onClose,
  primaryAction,
}: TabletopRouteMastheadProps) {
  return (
    <header className="tabletop-route-masthead">
      <button type="button" onClick={onBack} className="tabletop-route-masthead__back">Back</button>
      <div className="min-w-0">
        <p className="tabletop-eyebrow">{eyebrow}</p>
        <h1 className="tabletop-route-masthead__title">{title}</h1>
        {gameCode && (
          <p className="tabletop-route-masthead__code">
            Game code <span>{gameCode}</span>
          </p>
        )}
      </div>
      <div className="tabletop-route-masthead__actions">
        <span className={`tabletop-route-status tabletop-route-status--${statusTone}`} aria-live="polite">
          {statusLabel}
        </span>
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="tabletop-route-primary"
          >
            {primaryAction.label}
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="tabletop-route-close">Close game</button>
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

interface TabletopBottomSheetProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  idBase?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function TabletopBottomSheet({ isOpen, title, onClose, children, idBase = 'tabletop-sheet' }: TabletopBottomSheetProps) {
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const desktopQuery = window.matchMedia('(min-width: 1120px)')
    if (desktopQuery.matches) {
      onCloseRef.current()
      return
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      const activeIndex = focusable.findIndex((element) => element === document.activeElement)
      const wrapIndex = shouldWrapSheetFocus(activeIndex, focusable.length, event.shiftKey)
      if (wrapIndex === -1) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      if (wrapIndex !== null) {
        event.preventDefault()
        focusable[wrapIndex]?.focus()
      }
    }

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) onCloseRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    desktopQuery.addEventListener('change', handleDesktopChange)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      desktopQuery.removeEventListener('change', handleDesktopChange)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="tabletop-bottom-sheet" role="presentation">
      <button type="button" className="tabletop-bottom-sheet__backdrop" aria-label="Close game information" onClick={onClose} tabIndex={-1} />
      <section
        ref={panelRef}
        className="tabletop-bottom-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-title`}
        tabIndex={-1}
      >
        <div className="tabletop-bottom-sheet__handle" aria-hidden="true" />
        <header className="tabletop-bottom-sheet__header">
          <h2 id={`${idBase}-title`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="tabletop-sheet-close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="tabletop-bottom-sheet__content">{children}</div>
      </section>
    </div>
  )
}
