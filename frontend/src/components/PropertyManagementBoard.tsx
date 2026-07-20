import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  HelpCircle,
  Landmark,
  Lock,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  PackageOpen,
  ParkingCircle,
  Plus,
  Train,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react'
import { Game, PMAuctionState, PropertyManagementState } from '../types/game'
import type { GameActionErrorReporter } from '../types/gameFeedback'
import { User } from '../types/user'
import {
  BOARD_SQUARES,
  GROUP_STRIP_CLASSES,
  PMSquareDef,
  PLAYER_COLORS,
  canBuildHouse,
  canMortgage,
  canSellHouse,
  getBuildLabel,
} from '../lib/propertyManagement'
import {
  PROPERTY_BOARD_BASE_SIZE,
  PROPERTY_BOARD_MAX_ZOOM,
  PROPERTY_BOARD_MIN_ZOOM,
  PROPERTY_BOARD_TRACK_TEMPLATE,
  clampPropertyBoardZoom,
  fitPropertyBoardZoom,
  getPropertyBoardPosition,
  getPropertyBoardSide,
  resolvePropertyActionMode,
  stepPropertyBoardZoom,
  validatePropertyAuctionBid,
} from '../lib/propertyManagementBoard'
import { multiplayerActions, type PropertyManagementMove } from '../lib/multiplayerActions'
import GameChat from './GameChat'
import Modal from './Modal'
import PlayerAvatar from './PlayerAvatar'
import { TabletopBottomSheet, TabletopDockButtons, TabletopTabs, type TabletopTab } from './TabletopShell'
import { Button } from './ui'
import './property-management.css'

type InspectorTab = 'tile' | 'portfolio' | 'players' | 'chat'

interface Props {
  game: Game
  user: User | null
  onMove: (move: PropertyManagementMove) => Promise<{ success: boolean; error?: string; handledGlobally?: boolean }>
  onSendChat: (text: string) => Promise<{ success: boolean; error?: string; handledGlobally?: boolean }>
  onActionError?: GameActionErrorReporter
}

const EMPTY_PLAYER_ORDER: string[] = []
const INSPECTOR_TABS: TabletopTab<InspectorTab>[] = [
  { id: 'tile', label: 'Tile', icon: MapPin },
  { id: 'portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
]

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`
}

function isPurchasable(square: PMSquareDef): boolean {
  return square.price != null
}

function getOwnerDisplay(state: PropertyManagementState, ownership: { ownerId: string | null; mortgaged: boolean } | undefined): string {
  if (!ownership?.ownerId) return 'Unowned'
  const ownerName = state.playerStates[ownership.ownerId]?.username ?? 'Unknown'
  return ownership.mortgaged ? `${ownerName} · mortgaged` : ownerName
}

function getBuildDisplay(square: PMSquareDef, ownership: { ownerId: string | null; houses: number } | undefined): string | null {
  if (square.type !== 'property' || !ownership?.ownerId) return null
  return ownership.houses > 0 ? getBuildLabel(ownership.houses) : 'No buildings'
}

function getBuildActionLabel(houses: number): string {
  return houses >= 4 ? 'Build hotel' : 'Build house'
}

function getDiceKey(dice: [number, number] | null | undefined): string {
  return dice ? `${dice[0]}-${dice[1]}` : 'none'
}

function getRentRows(square: PMSquareDef): Array<{ label: string; value: string }> {
  if (square.type === 'property') {
    const labels = ['Base', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel']
    return square.rent.map((rent, index) => ({ label: labels[index] ?? `Rent ${index + 1}`, value: formatMoney(rent) }))
  }

  if (square.type === 'railroad') {
    return square.rent.map((rent, index) => ({ label: `${index + 1} line${index === 0 ? '' : 's'}`, value: formatMoney(rent) }))
  }

  if (square.type === 'utility') {
    return [
      { label: '1 utility', value: `${square.rent[0] ?? 4}× roll` },
      { label: '2 utilities', value: `${square.rent[1] ?? 10}× roll` },
    ]
  }

  return []
}

function getSquareIcon(type: string, className = 'h-4 w-4') {
  switch (type) {
    case 'go': return <CircleDollarSign className={className} />
    case 'jail': return <Lock className={className} />
    case 'freeParking': return <ParkingCircle className={className} />
    case 'goToJail': return <Landmark className={className} />
    case 'chance': return <HelpCircle className={className} />
    case 'communityChest': return <PackageOpen className={className} />
    case 'tax': return <CircleDollarSign className={className} />
    case 'railroad': return <Train className={className} />
    case 'utility': return <Zap className={className} />
    default: return <Building2 className={className} />
  }
}

function getMapLabel(square: PMSquareDef): string {
  const labels: Record<string, string> = {
    'Community Chest': 'Community Chest',
    'Free Parking': 'Free Parking',
    'Go To Jail': 'Go To Jail',
    'Income Tax': 'Income Tax',
    'Luxury Tax': 'Luxury Tax',
    'Transit Line 1': 'Transit 1',
    'Transit Line 2': 'Transit 2',
    'Transit Line 3': 'Transit 3',
    'Transit Line 4': 'Transit 4',
  }

  return labels[square.name] ?? square.name.replace(/\s+(Street|Avenue|Road|Lane|Drive|Way|Court|Square|Rise|Gate|Field|Junction|Close|Estate|Terrace|Boulevard|Crescent)$/i, '')
}

export default function PropertyManagementBoard({ game, user, onMove, onSendChat, onActionError }: Props) {
  const state = game.gameState as unknown as PropertyManagementState
  const isDesktopLayout = useTabletopDesktopLayout()
  const [selectedSquareIndex, setSelectedSquareIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<InspectorTab>('tile')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [auctionBidAmount, setAuctionBidAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false)
  const [displayDice, setDisplayDice] = useState<[number, number] | null>(state.dice ?? null)
  const [rollAnimationId, setRollAnimationId] = useState(0)
  const [focusRequest, setFocusRequest] = useState(0)
  const lastDiceKeyRef = useRef(getDiceKey(state.dice))
  const hasProcessedInitialDiceRef = useRef(false)
  const previousPositionsRef = useRef<Record<string, number>>({})
  const activeAuction = state.pendingAction?.type === 'auction' ? state.pendingAction.auction : null
  const auctionDraftKey = activeAuction
    ? `${activeAuction.squareIndex}:${activeAuction.activeUserIds[activeAuction.currentBidderIndex] ?? 'none'}`
    : 'none'
  const previousAuctionDraftKeyRef = useRef(auctionDraftKey)

  const myId = user?._id ?? ''
  const playerOrder = state.playerOrder ?? EMPTY_PLAYER_ORDER
  const myPlayer = state.playerStates[myId]
  const isInLobby = state.phase === 'lobby'
  const isCompleted = state.phase === 'completed'
  const isMyTurn = state.currentPlayerUserId === myId
  const currentPlayer = state.playerStates[state.currentPlayerUserId]
  const currentPlayerName = currentPlayer?.username ?? 'Unknown'
  const focusedSquareIndex = selectedSquareIndex ?? myPlayer?.position ?? currentPlayer?.position ?? 0

  useEffect(() => {
    if (previousAuctionDraftKeyRef.current !== auctionDraftKey) setAuctionBidAmount('')
    previousAuctionDraftKeyRef.current = auctionDraftKey
  }, [auctionDraftKey])

  useEffect(() => {
    if (isDesktopLayout) setSheetOpen(false)
  }, [isDesktopLayout])

  useEffect(() => {
    const nextDiceKey = getDiceKey(state.dice)
    const previousDiceKey = lastDiceKeyRef.current

    if (state.dice) {
      setDisplayDice(state.dice)
      if (hasProcessedInitialDiceRef.current && nextDiceKey !== previousDiceKey) {
        setRollAnimationId((current) => current + 1)
      }
    }

    lastDiceKeyRef.current = nextDiceKey
    hasProcessedInitialDiceRef.current = true
  }, [state.dice])

  useEffect(() => {
    const nextPositions: Record<string, number> = {}
    let movedTo: number | null = null

    playerOrder.forEach((id) => {
      const position = state.playerStates[id]?.position
      if (position == null) return
      nextPositions[id] = position
      if (previousPositionsRef.current[id] != null && previousPositionsRef.current[id] !== position) movedTo = position
    })

    previousPositionsRef.current = nextPositions
    if (movedTo != null) {
      setSelectedSquareIndex(movedTo)
      setFocusRequest((current) => current + 1)
    }
  }, [playerOrder, state.playerStates])

  const playerSummary = useMemo(() => (
    playerOrder.map((id) => state.playerStates[id]).filter(Boolean)
  ), [playerOrder, state.playerStates])

  async function act(move: PropertyManagementMove): Promise<boolean> {
    if (loading) return false
    const restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setLoading(true)
    try {
      const result = await onMove(move)
      if (!result.success) {
        if (!result.handledGlobally) onActionError?.(result.error ?? 'Action failed', restoreFocusTo)
        return false
      }
      return true
    } catch {
      onActionError?.('The action could not reach the game server. Try again.', restoreFocusTo)
      return false
    } finally {
      setLoading(false)
    }
  }

  function confirmBankruptcy() {
    setShowBankruptcyModal(false)
    void act(multiplayerActions.propertyManagement.declareBankruptcy())
  }

  function selectSquare(squareIndex: number) {
    setSelectedSquareIndex(squareIndex)
    setActiveTab('tile')
    if (window.matchMedia('(max-width: 1119px)').matches) setSheetOpen(true)
  }

  function focusSquare(squareIndex: number) {
    setSelectedSquareIndex(squareIndex)
    setActiveTab('tile')
    setFocusRequest((current) => current + 1)
  }

  function openInspector(tab: InspectorTab) {
    setActiveTab(tab)
    setSheetOpen(true)
  }

  function renderActionPanel(compact = false) {
    const mode = resolvePropertyActionMode(state.phase, state.turnPhase, isMyTurn)
    const pending = state.pendingAction

    if (mode === 'complete') {
      const winnerName = state.winnerId ? state.playerStates[state.winnerId]?.username : 'Nobody'
      return (
        <ActionSurface compact={compact} eyebrow="Game complete" title={`${winnerName} wins`} tone="success">
          <p className="text-sm text-text-secondary">The final deed has changed hands.</p>
        </ActionSurface>
      )
    }

    if (mode === 'lobby') {
      const isHost = myId === state.hostUserId
      return (
        <ActionSurface compact={compact} eyebrow="Private table" title="Waiting room">
          <p className="text-sm leading-6 text-text-secondary">
            Invite up to eight players with the code shown above the board.
          </p>
          <div className="mt-4">{renderPlayerList(true)}</div>
          {isHost ? (
            <PrimaryButton
              disabled={playerOrder.length < 2 || loading}
              onClick={() => void act(multiplayerActions.propertyManagement.startGame())}
            >
              {playerOrder.length < 2 ? 'Waiting for another player' : 'Start the game'}
            </PrimaryButton>
          ) : (
            <p className="mt-4 text-sm text-text-muted">The host will start when everyone is ready.</p>
          )}
        </ActionSurface>
      )
    }

    if (mode === 'waiting') {
      return (
        <ActionSurface compact={compact} eyebrow="Current action" title={`${currentPlayerName} is deciding`}>
          <p className="text-sm text-text-secondary">The table will update as soon as their move is complete.</p>
        </ActionSurface>
      )
    }

    if (mode === 'auction' && pending?.type === 'auction') {
      return (
        <ActionSurface compact={compact} eyebrow="Live auction" title={BOARD_SQUARES[pending.auction.squareIndex]?.name ?? 'Property'} tone="warning">
          {renderAuctionBlock(pending.auction, compact)}
        </ActionSurface>
      )
    }

    return (
      <ActionSurface compact={compact} eyebrow="Your move" title={getActionTitle(mode)} tone="accent">
        <div className="space-y-3">
          {mode === 'card' && pending?.type === 'card' && (
            <>
              <div className="pm-drawn-card">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Card drawn</p>
                <p className="mt-2 text-sm leading-6 text-text-primary">{pending.cardText}</p>
              </div>
              <PrimaryButton onClick={() => void act(multiplayerActions.propertyManagement.acknowledgeCard())} disabled={loading}>Continue</PrimaryButton>
            </>
          )}

          {mode === 'buyOrAuction' && pending?.type === 'buyOrAuction' && renderBuyOrAuction(pending.squareIndex)}

          {(mode === 'preRoll' || mode === 'postRoll') && (
            <>
              {mode === 'preRoll' && myPlayer?.inJail && (
                <div className="space-y-2">
                  <div className="pm-inline-notice pm-inline-notice--warning">
                    In jail · attempt {(myPlayer.jailRollCount ?? 0) + 1} of 3
                  </div>
                  <SecondaryButton onClick={() => void act(multiplayerActions.propertyManagement.payJailFine())} disabled={(myPlayer.money ?? 0) < 50 || loading}>Pay $50 fine</SecondaryButton>
                  {(myPlayer.getOutOfJailFreeCards ?? 0) > 0 && (
                    <SecondaryButton onClick={() => void act(multiplayerActions.propertyManagement.useGetOutOfJailCard())} disabled={loading}>Use jail card</SecondaryButton>
                  )}
                </div>
              )}
              {mode === 'preRoll' && <PrimaryButton onClick={() => void act(multiplayerActions.propertyManagement.rollDice())} disabled={loading}>Roll the dice</PrimaryButton>}
              {mode === 'postRoll' && <PrimaryButton onClick={() => void act(multiplayerActions.propertyManagement.endTurn())} disabled={loading}>End turn</PrimaryButton>}
              <Button variant="danger" fullWidth disabled={loading} onClick={() => setShowBankruptcyModal(true)} className="mt-3">
                Declare bankruptcy
              </Button>
            </>
          )}

        </div>
      </ActionSurface>
    )
  }

  function renderBuyOrAuction(squareIndex: number) {
    const square = BOARD_SQUARES[squareIndex]
    const canAfford = (myPlayer?.money ?? 0) >= (square?.price ?? 0)

    return (
      <div className="space-y-3">
        <PropertySummary square={square} />
        <PrimaryButton
          disabled={!canAfford || loading}
          onClick={() => void act(multiplayerActions.propertyManagement.buyProperty())}
        >
          {canAfford ? `Buy for ${formatMoney(square?.price ?? 0)}` : `Need ${formatMoney(square?.price ?? 0)}`}
        </PrimaryButton>
        <SecondaryButton onClick={() => void act(multiplayerActions.propertyManagement.declineProperty())} disabled={loading}>Send to auction</SecondaryButton>
      </div>
    )
  }

  function renderAuctionBlock(auction: PMAuctionState, compact: boolean) {
    const highBidder = auction.highBidderUserId ? state.playerStates[auction.highBidderUserId]?.username : null
    const isBidder = auction.activeUserIds[auction.currentBidderIndex] === myId
    const bidValidation = validatePropertyAuctionBid(auctionBidAmount, auction.currentBid, myPlayer?.money ?? 0)
    const bidInputId = `property-auction-bid-${compact ? 'mobile' : 'desktop'}`
    const bidHelpId = `${bidInputId}-help`

    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Current bid <span className="font-mono font-bold text-warning-text">{formatMoney(auction.currentBid)}</span>
          {highBidder ? ` · ${highBidder}` : ''}
        </p>
        {isBidder ? (
          <div className="space-y-2">
            <label className="sr-only" htmlFor={bidInputId}>Your bid</label>
            <input
              id={bidInputId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              value={auctionBidAmount}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) setAuctionBidAmount(event.target.value)
              }}
              placeholder={`Minimum ${formatMoney(auction.currentBid + 1)}`}
              className="pm-input"
              aria-invalid={Boolean(auctionBidAmount && !bidValidation.valid) || undefined}
              aria-describedby={bidHelpId}
            />
            <p id={bidHelpId} className={`text-xs ${auctionBidAmount && !bidValidation.valid ? 'text-danger-text' : 'text-text-muted'}`}>
              {auctionBidAmount && !bidValidation.valid ? bidValidation.error : `Available cash: ${formatMoney(myPlayer?.money ?? 0)}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!bidValidation.valid || loading}
                onClick={() => {
                  if (!bidValidation.valid) return
                  void act(multiplayerActions.propertyManagement.auctionBid(bidValidation.amount)).then((success) => {
                    if (success) setAuctionBidAmount('')
                  })
                }}
                className="pm-primary-button mt-0"
              >
                Bid
              </Button>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  void act(multiplayerActions.propertyManagement.auctionPass()).then((success) => {
                    if (success) setAuctionBidAmount('')
                  })
                }}
                className="pm-secondary-button mt-0"
              >
                Pass
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Waiting for <span className="font-semibold text-text-primary">{state.playerStates[auction.activeUserIds[auction.currentBidderIndex]]?.username ?? 'the next bidder'}</span>
          </p>
        )}
      </div>
    )
  }

  function renderTileInspector() {
    const square = BOARD_SQUARES[focusedSquareIndex] ?? BOARD_SQUARES[0]
    const ownership = state.properties[String(square.index)]
    const playersHere = playerOrder
      .map((id) => state.playerStates[id])
      .filter((player) => player && !player.isBankrupt && player.position === square.index)

    return (
      <div className="space-y-5">
        <PropertySummary square={square} large />
        {isPurchasable(square) && (
          <dl className="pm-detail-list">
            <DetailItem label="Owner" value={getOwnerDisplay(state, ownership)} />
            {getBuildDisplay(square, ownership) && <DetailItem label="Buildings" value={getBuildDisplay(square, ownership) ?? ''} />}
            {square.mortgageValue != null && <DetailItem label="Mortgage" value={formatMoney(square.mortgageValue)} />}
          </dl>
        )}
        <RentSummary square={square} />
        <div>
          <p className="pm-section-label">Players here</p>
          {playersHere.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {playersHere.map((player) => <PlayerPill key={player.userId} playerId={player.userId} username={player.username} playerOrder={playerOrder} />)}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-muted">This tile is currently empty.</p>
          )}
        </div>
      </div>
    )
  }

  function renderPortfolioInspector() {
    const jailCards = myPlayer?.getOutOfJailFreeCards ?? 0
    const properties = Object.entries(state.properties)
      .filter(([, ownership]) => ownership.ownerId === myId)
      .map(([key]) => BOARD_SQUARES[Number(key)])
      .filter(Boolean) as PMSquareDef[]
    const canManage = isMyTurn && (state.turnPhase === 'preRoll' || state.turnPhase === 'postRoll')

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <p className="pm-section-label">Cash on hand</p>
            <p className="mt-1 font-mono text-2xl font-black text-text-primary">{formatMoney(myPlayer?.money ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="pm-section-label">Jail cards</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{jailCards}</p>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="py-6 text-center">
            <WalletCards className="mx-auto h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-muted">Your first deed will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((square) => {
              const ownership = state.properties[String(square.index)]
              const stripClass = square.colorGroup ? GROUP_STRIP_CLASSES[square.colorGroup] : 'bg-slate-500'
              const unmortgageCost = Math.floor((square.mortgageValue ?? 0) * 1.1)

              return (
                <article key={square.index} className="pm-property-deed">
                  <div className={`pm-property-deed__band ${stripClass}`}>
                    <span>{square.name}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {ownership.mortgaged && <DeedBadge>Mortgaged</DeedBadge>}
                      {ownership.houses > 0 && <DeedBadge>{getBuildLabel(ownership.houses)}</DeedBadge>}
                    </span>
                  </div>
                  <RentSummary square={square} compact />
                  {canManage && (
                    <div className="flex flex-wrap gap-2 border-t border-border/50 px-3 py-3">
                      {canBuildHouse(state, myId, square.index) && (
                        <SmallButton onClick={() => void act(multiplayerActions.propertyManagement.buildHouse(square.index))} disabled={loading}>
                          {getBuildActionLabel(ownership.houses)} · {formatMoney(square.houseCost ?? 0)}
                        </SmallButton>
                      )}
                      {canSellHouse(state, myId, square.index) && (
                        <SmallButton onClick={() => void act(multiplayerActions.propertyManagement.sellHouse(square.index))} disabled={loading}>
                          Sell · +{formatMoney(Math.floor((square.houseCost ?? 0) / 2))}
                        </SmallButton>
                      )}
                      {canMortgage(state, myId, square.index) && (
                        <SmallButton onClick={() => void act(multiplayerActions.propertyManagement.mortgageProperty(square.index))} disabled={loading}>
                          Mortgage · +{formatMoney(square.mortgageValue ?? 0)}
                        </SmallButton>
                      )}
                      {ownership.mortgaged && (
                        <SmallButton onClick={() => void act(multiplayerActions.propertyManagement.unmortgageProperty(square.index))} disabled={loading || (myPlayer?.money ?? 0) < unmortgageCost}>
                          Unmortgage · {formatMoney(unmortgageCost)}
                        </SmallButton>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function renderPlayerList(compact = false) {
    return (
      <div className="divide-y divide-border/50">
        {playerSummary.map((player, index) => {
          const isCurrent = player.userId === state.currentPlayerUserId && state.phase === 'playing'
          const square = BOARD_SQUARES[player.position]
          const connected = game.players.find((gamePlayer) => gamePlayer.userId === player.userId)?.isConnected !== false

          return (
            <div key={player.userId} className={`pm-player-row ${isCurrent ? 'pm-player-row--current' : ''} ${player.isBankrupt ? 'opacity-50' : ''}`}>
              <PlayerToken username={player.username} color={PLAYER_COLORS[index % PLAYER_COLORS.length]} size={compact ? 'sm' : 'md'} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-words text-sm font-bold text-text-primary">{player.username}</span>
                  {player.userId === myId && <span className="pm-mini-label">You</span>}
                  {player.userId === state.hostUserId && <span className="pm-mini-label">Host</span>}
                  {!connected && (
                    <span className="pm-mini-label inline-flex items-center gap-1 text-danger-text">
                      <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
                      Offline
                    </span>
                  )}
                </div>
                {!compact && (
                  <p className="mt-0.5 text-xs leading-5 text-text-muted">
                    {player.isBankrupt ? 'Bankrupt' : `${square?.name ?? `Square ${player.position}`}${player.inJail ? ' · in jail' : ''}`}
                  </p>
                )}
              </div>
              {!compact && <span className="shrink-0 font-mono text-sm font-black text-text-primary">{formatMoney(player.money)}</span>}
            </div>
          )
        })}
      </div>
    )
  }

  function renderInspectorContent() {
    switch (activeTab) {
      case 'portfolio': return renderPortfolioInspector()
      case 'players': return renderPlayerList()
      case 'chat': return <GameChat messages={game.chatMessages || []} currentUserId={myId} onSend={onSendChat} onError={onActionError} variant="embedded" />
      default: return renderTileInspector()
    }
  }

  if (isInLobby) {
    return (
      <div className="property-management-theme mx-auto max-w-2xl py-3 sm:py-8">
        <div className="pm-lobby-surface">
          <div className="text-center">
            <p className="pm-section-label">Property Management</p>
            <h2 className="pm-display-title mt-2 text-3xl text-text-primary">Gather around the table</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">Build a portfolio, collect rent, and stay solvent until the final deed changes hands.</p>
          </div>
          <div className="mt-6">{renderActionPanel()}</div>
        </div>
        <BankruptcyModal isOpen={showBankruptcyModal} onClose={() => setShowBankruptcyModal(false)} onConfirm={confirmBankruptcy} />
      </div>
    )
  }

  return (
    <div className="property-management-theme min-w-0">
      <section className="pm-hud" aria-label="Game status">
        <div className="pm-hud__turn">
          <PlayerToken
            username={currentPlayerName}
            color={PLAYER_COLORS[Math.max(0, playerOrder.indexOf(state.currentPlayerUserId)) % PLAYER_COLORS.length]}
            size="lg"
          />
          <div className="min-w-0">
            <p className="pm-section-label">{isCompleted ? 'Final result' : isMyTurn ? 'Your turn' : 'Current turn'}</p>
            <p className="break-words text-base font-black text-text-primary sm:text-lg">{isCompleted ? 'Game complete' : currentPlayerName}</p>
          </div>
        </div>
        <div className="pm-hud__stat">
          <span>Phase</span>
          <strong>{state.phase === 'playing' ? state.turnPhase.replace(/([A-Z])/g, ' $1') : state.phase}</strong>
        </div>
        {myPlayer && (
          <div className="pm-hud__stat">
            <span>Your balance</span>
            <strong className="font-mono">{formatMoney(myPlayer.money)}</strong>
          </div>
        )}
        <div className="pm-hud__dice">
          <DiceDisplay dice={state.phase === 'playing' ? displayDice : null} rollAnimationId={rollAnimationId} compact />
        </div>
        {state.lastEventMessage && <p className="pm-hud__event">{state.lastEventMessage}</p>}
      </section>

      <div className="pm-game-layout">
        <GameMap
          state={state}
          playerOrder={playerOrder}
          selectedSquareIndex={focusedSquareIndex}
          myPosition={myPlayer?.position ?? null}
          focusRequest={focusRequest}
          onSelectSquare={selectSquare}
          onFocusSquare={focusSquare}
        />

        {isDesktopLayout && (
          <aside className="pm-desktop-rail" aria-label="Game controls and information">
            {renderActionPanel()}
            <div className="pm-inspector-surface">
              <TabletopTabs tabs={INSPECTOR_TABS} activeTab={activeTab} onSelect={setActiveTab} ariaLabel="Game information" idBase="pm-desktop-inspector" />
              <div id="pm-desktop-inspector-panel" role="tabpanel" aria-labelledby={`pm-desktop-inspector-tab-${activeTab}`} className="pm-inspector-content">{renderInspectorContent()}</div>
            </div>
          </aside>
        )}
      </div>

      {!isDesktopLayout && (
        <>
          <div className="pm-mobile-dock">
            {renderActionPanel(true)}
            <TabletopDockButtons tabs={INSPECTOR_TABS} activeTab={activeTab} onSelect={openInspector} ariaLabel="Open game information" isOpen={sheetOpen} />
          </div>

          <TabletopBottomSheet
            isOpen={sheetOpen}
            title={INSPECTOR_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Game details'}
            onClose={() => setSheetOpen(false)}
            idBase="pm-inspector-sheet"
            contentKey={activeTab}
          >
            <TabletopTabs tabs={INSPECTOR_TABS} activeTab={activeTab} onSelect={setActiveTab} ariaLabel="Game information" idBase="pm-sheet-tabs" />
            <div id="pm-sheet-tabs-panel" role="tabpanel" aria-labelledby={`pm-sheet-tabs-tab-${activeTab}`} className="mt-5">{renderInspectorContent()}</div>
          </TabletopBottomSheet>
        </>
      )}

      <BankruptcyModal isOpen={showBankruptcyModal} onClose={() => setShowBankruptcyModal(false)} onConfirm={confirmBankruptcy} />
    </div>
  )
}

function GameMap({
  state,
  playerOrder,
  selectedSquareIndex,
  myPosition,
  focusRequest,
  onSelectSquare,
  onFocusSquare,
}: {
  state: PropertyManagementState
  playerOrder: string[]
  selectedSquareIndex: number
  myPosition: number | null
  focusRequest: number
  onSelectSquare: (squareIndex: number) => void
  onFocusSquare: (squareIndex: number) => void
}) {
  const [zoom, setZoom] = useState(() => window.matchMedia('(max-width: 519px)').matches ? 0.75 : 1)
  const cameraRef = useRef<HTMLDivElement>(null)
  const pendingCenterRef = useRef<{ x: number; y: number } | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const boardSize = Math.round(PROPERTY_BOARD_BASE_SIZE * zoom)

  const centerSquare = useCallback((squareIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const camera = cameraRef.current
    const tile = camera?.querySelector<HTMLElement>(`[data-square-index="${squareIndex}"]`)
    if (!camera || !tile) return
    const cameraRect = camera.getBoundingClientRect()
    const tileRect = tile.getBoundingClientRect()
    camera.scrollTo({
      left: camera.scrollLeft + tileRect.left - cameraRect.left + tileRect.width / 2 - camera.clientWidth / 2,
      top: camera.scrollTop + tileRect.top - cameraRect.top + tileRect.height / 2 - camera.clientHeight / 2,
      behavior: prefersReducedMotion ? 'auto' : behavior,
    })
  }, [prefersReducedMotion])

  useEffect(() => {
    const frame = requestAnimationFrame(() => centerSquare(selectedSquareIndex, 'auto'))
    return () => cancelAnimationFrame(frame)
  }, [centerSquare, focusRequest, selectedSquareIndex])

  useEffect(() => {
    const pending = pendingCenterRef.current
    if (!pending) return
    pendingCenterRef.current = null
    const frame = requestAnimationFrame(() => {
      const camera = cameraRef.current
      if (!camera) return
      camera.scrollTo({
        left: pending.x * camera.scrollWidth - camera.clientWidth / 2,
        top: pending.y * camera.scrollHeight - camera.clientHeight / 2,
        behavior: 'auto',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [zoom])

  function changeZoom(nextZoom: number) {
    const camera = cameraRef.current
    const next = clampPropertyBoardZoom(nextZoom)
    if (next === zoom) return
    if (camera) {
      pendingCenterRef.current = {
        x: (camera.scrollLeft + camera.clientWidth / 2) / Math.max(1, camera.scrollWidth),
        y: (camera.scrollTop + camera.clientHeight / 2) / Math.max(1, camera.scrollHeight),
      }
    }
    setZoom(next)
  }

  function fitBoard() {
    const camera = cameraRef.current
    if (!camera) return
    changeZoom(fitPropertyBoardZoom(camera.clientWidth, camera.clientHeight, 12))
  }

  function handleTileKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, squareIndex: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (squareIndex + 1) % BOARD_SQUARES.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (squareIndex - 1 + BOARD_SQUARES.length) % BOARD_SQUARES.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = BOARD_SQUARES.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    onFocusSquare(nextIndex)
    window.requestAnimationFrame(() => {
      cameraRef.current?.querySelector<HTMLButtonElement>(`[data-square-index="${nextIndex}"]`)?.focus({ preventScroll: true })
    })
  }

  return (
    <section className="pm-board-surface" aria-label="Property Management board">
      <div className="pm-camera-toolbar">
        <div>
          <p className="pm-section-label">Board camera</p>
          <p className="text-sm font-bold text-text-primary" aria-live="polite">{Math.round(zoom * 100)}% zoom</p>
        </div>
        <div className="pm-camera-controls">
          <button type="button" className="tactile-button tactile-button--secondary" onClick={() => changeZoom(stepPropertyBoardZoom(zoom, -1))} disabled={zoom <= PROPERTY_BOARD_MIN_ZOOM} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" className="tactile-button tactile-button--secondary" onClick={() => changeZoom(stepPropertyBoardZoom(zoom, 1))} disabled={zoom >= PROPERTY_BOARD_MAX_ZOOM} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" className="tactile-button tactile-button--secondary pm-camera-action-button" onClick={fitBoard} aria-label="Fit whole board">
            <Maximize2 className="h-4 w-4" /><span>Fit</span>
          </button>
          <button type="button" className="tactile-button tactile-button--secondary pm-camera-action-button" onClick={() => centerSquare(myPosition ?? selectedSquareIndex)} aria-label="Center on my tile">
            <MapPin className="h-4 w-4" /><span>My tile</span>
          </button>
        </div>
      </div>

      <div ref={cameraRef} className="pm-board-camera" tabIndex={0} aria-label="Scrollable game board">
        <div className="pm-board-stage" style={{ width: boardSize, height: boardSize }}>
          <div
            className={`pm-board-grid ${zoom <= 0.5 ? 'pm-board-grid--overview' : ''}`}
            style={{
              width: boardSize,
              height: boardSize,
              gridTemplateColumns: PROPERTY_BOARD_TRACK_TEMPLATE,
              gridTemplateRows: PROPERTY_BOARD_TRACK_TEMPLATE,
              '--pm-board-scale': zoom,
            } as React.CSSProperties}
          >
            {BOARD_SQUARES.map((square) => {
              const { row, col } = getPropertyBoardPosition(square.index)
              return (
                <MapTile
                  key={square.index}
                  square={square}
                  state={state}
                  playerOrder={playerOrder}
                  selected={selectedSquareIndex === square.index}
                  onSelect={() => onSelectSquare(square.index)}
                  onKeyDown={(event) => handleTileKeyDown(event, square.index)}
                  style={{ gridRow: row, gridColumn: col }}
                />
              )
            })}
            <div className="pm-board-center" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
              <div className="pm-board-center__ornament" />
              <p className="pm-board-center__kicker">A game of deeds &amp; deals</p>
              <p className="pm-display-title pm-board-center__title">Property Management</p>
              <p className="pm-board-center__subtitle">Estates · Transit · Utilities</p>
              <div className="pm-board-center__turn">
                <span>{state.currentPlayerUserId ? state.playerStates[state.currentPlayerUserId]?.username : 'Waiting'}</span>
                <small>{state.phase === 'completed' ? 'Game complete' : 'At the table'}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="pm-camera-hint">Drag or scroll to explore. Use Fit for a full-board overview.</p>
    </section>
  )
}

function MapTile({
  square,
  state,
  playerOrder,
  selected,
  onSelect,
  onKeyDown,
  style,
}: {
  square: PMSquareDef
  state: PropertyManagementState
  playerOrder: string[]
  selected: boolean
  onSelect: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  style: React.CSSProperties
}) {
  const ownership = state.properties[String(square.index)]
  const ownerIndex = ownership?.ownerId ? playerOrder.indexOf(ownership.ownerId) : -1
  const side = getPropertyBoardSide(square.index)
  const stripClass = square.colorGroup ? GROUP_STRIP_CLASSES[square.colorGroup] ?? 'bg-slate-500' : ''
  const buildLabel = ownership?.houses ? (ownership.houses >= 5 ? 'Hotel' : `${ownership.houses}H`) : null
  const ownerName = ownership?.ownerId ? state.playerStates[ownership.ownerId]?.username : null
  const occupants = playerOrder.flatMap((id) => {
    const player = state.playerStates[id]
    return player && !player.isBankrupt && player.position === square.index
      ? [player.username]
      : []
  })
  const accessibleLabel = [
    square.name,
    square.price != null ? formatMoney(square.price) : null,
    ownerName ? `owned by ${ownerName}` : square.price != null ? 'unowned' : null,
    ownership?.mortgaged ? 'mortgaged' : null,
    ownership?.houses ? ownership.houses >= 5 ? 'hotel' : `${ownership.houses} houses` : null,
    occupants.length ? `players here: ${occupants.join(', ')}` : 'no players here',
    selected ? 'selected' : null,
  ].filter(Boolean).join(', ')

  return (
    <button
      type="button"
      data-square-index={square.index}
      tabIndex={selected ? 0 : -1}
      aria-pressed={selected}
      aria-label={accessibleLabel}
      title={square.name}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`pm-board-tile pm-board-tile--${side} ${selected ? 'pm-board-tile--selected' : ''} ${ownership?.mortgaged ? 'pm-board-tile--mortgaged' : ''}`}
      style={style}
    >
      {square.colorGroup && <span className={`pm-property-band ${stripClass}`} aria-hidden="true" />}
      {ownerIndex >= 0 && (
        <span className="pm-owner-marker" style={{ backgroundColor: PLAYER_COLORS[ownerIndex % PLAYER_COLORS.length] }} title={`Owned by ${state.playerStates[ownership?.ownerId ?? '']?.username ?? 'player'}`} aria-hidden="true" />
      )}
      {ownership?.mortgaged && <span className="pm-mortgage-stamp">M</span>}
      {buildLabel && <span className="pm-building-marker">{buildLabel}</span>}
      <span className="pm-tile-content">
        {square.price != null && <span className="pm-tile-price">{formatMoney(square.price)}</span>}
        <span className="pm-tile-icon">{getSquareIcon(square.type, 'h-full w-full')}</span>
        <span className="pm-tile-label">{getMapLabel(square)}</span>
      </span>
      <TokenCluster squareIndex={square.index} state={state} playerOrder={playerOrder} />
    </button>
  )
}

function TokenCluster({ squareIndex, state, playerOrder }: {
  squareIndex: number
  state: PropertyManagementState
  playerOrder: string[]
}) {
  const tokens = playerOrder.filter((id) => {
    const player = state.playerStates[id]
    return player && !player.isBankrupt && player.position === squareIndex
  })

  if (tokens.length === 0) return null

  return (
    <span className="pm-token-cluster" aria-label={`${tokens.length} player${tokens.length === 1 ? '' : 's'} on this tile`}>
      {tokens.slice(0, 3).map((id) => {
        const player = state.playerStates[id]
        return (
          <PlayerAvatar
            key={id}
            name={player?.username ?? '?'}
            accent={PLAYER_COLORS[playerOrder.indexOf(id) % PLAYER_COLORS.length]}
            size="sm"
            className="pm-map-token"
            ariaLabel={`${player?.username ?? 'Player'} token`}
            title={player?.username}
          />
        )
      })}
      {tokens.length > 3 && <span className="pm-map-token pm-map-token--more">+{tokens.length - 3}</span>}
    </span>
  )
}

function ActionSurface({
  eyebrow,
  title,
  tone = 'default',
  compact = false,
  children,
}: {
  eyebrow: string
  title: string
  tone?: 'default' | 'accent' | 'warning' | 'success'
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`pm-action-surface pm-action-surface--${tone} ${compact ? 'pm-action-surface--compact' : ''}`}>
      <div className="mb-3">
        <p className="pm-section-label">{eyebrow}</p>
        <h2 className="mt-1 break-words text-lg font-black text-text-primary">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function getActionTitle(mode: ReturnType<typeof resolvePropertyActionMode>): string {
  switch (mode) {
    case 'preRoll': return 'Ready to roll'
    case 'postRoll': return 'Settle the table'
    case 'buyOrAuction': return 'A deed is available'
    case 'card': return 'Read your card'
    default: return 'Current action'
  }
}

function PropertySummary({ square, large = false }: { square: PMSquareDef; large?: boolean }) {
  return (
    <div className={`pm-property-summary ${large ? 'pm-property-summary--large' : ''}`}>
      <span className="pm-property-summary__icon">{getSquareIcon(square.type, large ? 'h-6 w-6' : 'h-5 w-5')}</span>
      <div className="min-w-0 flex-1">
        <p className="pm-display-title break-words text-lg text-text-primary">{square.name}</p>
        <p className="mt-1 text-sm text-text-muted">{square.price == null ? 'No purchase price' : `Purchase price · ${formatMoney(square.price)}`}</p>
      </div>
      {square.colorGroup && <span className={`pm-property-summary__swatch ${GROUP_STRIP_CLASSES[square.colorGroup] ?? 'bg-slate-500'}`} />}
    </div>
  )
}

function RentSummary({ square, compact = false }: { square: PMSquareDef; compact?: boolean }) {
  const rows = getRentRows(square)
  if (rows.length === 0) return null

  return (
    <div className={compact ? 'px-3 py-3' : ''}>
      {!compact && <p className="pm-section-label">{square.type === 'utility' ? 'Rent multiplier' : 'Rent schedule'}</p>}
      <dl className={`pm-rent-grid ${compact ? 'mt-0' : 'mt-2'}`}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}

function PlayerToken({ username, color, size = 'md' }: { username: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  return <PlayerAvatar name={username} accent={color} size={size} />
}

function PlayerPill({ playerId, username, playerOrder }: { playerId: string; username: string; playerOrder: string[] }) {
  const color = PLAYER_COLORS[Math.max(0, playerOrder.indexOf(playerId)) % PLAYER_COLORS.length]
  return (
    <span className="pm-player-pill">
      <PlayerAvatar name={username} accent={color} size="sm" />
      {username}
    </span>
  )
}

function DeedBadge({ children }: { children: React.ReactNode }) {
  return <span className="pm-deed-badge">{children}</span>
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <Button fullWidth disabled={disabled} onClick={onClick} className="pm-primary-button">{children}</Button>
}

function SecondaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <Button fullWidth variant="secondary" disabled={disabled} onClick={onClick} className="pm-secondary-button">{children}</Button>
}

function SmallButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <Button size="sm" variant="secondary" disabled={disabled} onClick={onClick} className="pm-small-button">{children}</Button>
}

function BankruptcyModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      isOpen={isOpen}
      title="Declare bankruptcy?"
      variant="danger"
      primaryAction={{ label: 'Declare bankruptcy', onClick: onConfirm }}
      secondaryAction={{ label: 'Cancel', onClick: onClose }}
      onClose={onClose}
    >
      All your properties return to the bank and you leave the match. This cannot be undone.
    </Modal>
  )
}

function DiceDisplay({ dice, rollAnimationId, compact = false }: { dice: [number, number] | null; rollAnimationId: number; compact?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [rollStyles, setRollStyles] = useState<[React.CSSProperties, React.CSSProperties]>([
    createDieRollStyle(0),
    createDieRollStyle(1),
  ])

  useEffect(() => {
    if (rollAnimationId > 0 && dice && !prefersReducedMotion) setRollStyles([createDieRollStyle(0), createDieRollStyle(1)])
  }, [rollAnimationId, dice, prefersReducedMotion])

  const shouldAnimate = Boolean(rollAnimationId > 0 && dice && !prefersReducedMotion)

  return (
    <div className={`pm-dice-display ${compact ? 'pm-dice-display--compact' : ''}`}>
      <style>{`
        @keyframes property-management-die-roll {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          22% { transform: rotateX(var(--die-spin-x-1)) rotateY(var(--die-spin-y-1)) rotateZ(var(--die-spin-z-1)); }
          46% { transform: rotateX(var(--die-spin-x-2)) rotateY(var(--die-spin-y-2)) rotateZ(var(--die-spin-z-2)); }
          72% { transform: rotateX(var(--die-spin-x-3)) rotateY(var(--die-spin-y-3)) rotateZ(var(--die-spin-z-3)); }
          100% { transform: var(--die-final-transform); }
        }
        @media (prefers-reduced-motion: reduce) {
          .property-management-die-cube { animation: none !important; }
        }
      `}</style>
      <div className="flex gap-1.5">
        {[0, 1].map((index) => (
          <AnimatedDie
            key={`${index}-${rollAnimationId}`}
            value={dice ? dice[index] : null}
            label={`Die ${index + 1}${dice ? `: ${dice[index]}` : ''}`}
            animate={shouldAnimate}
            rollStyle={rollStyles[index]}
            compact={compact}
          />
        ))}
      </div>
      {dice && <span className="whitespace-nowrap text-xs font-black text-text-primary">{dice[0] + dice[1]} total{dice[0] === dice[1] ? ' · doubles' : ''}</span>}
    </div>
  )
}

function createDieRollStyle(index: number): React.CSSProperties {
  const direction = index === 0 ? 1 : -1
  const randomDegrees = (base: number, variance: number) => `${direction * (base + Math.floor(Math.random() * variance))}deg`

  return {
    '--die-spin-x-1': randomDegrees(180, 180),
    '--die-spin-y-1': randomDegrees(120, 220),
    '--die-spin-z-1': `${(index === 0 ? 1 : -1) * (40 + Math.floor(Math.random() * 120))}deg`,
    '--die-spin-x-2': randomDegrees(430, 220),
    '--die-spin-y-2': `${-direction * (300 + Math.floor(Math.random() * 260))}deg`,
    '--die-spin-z-2': `${direction * (120 + Math.floor(Math.random() * 220))}deg`,
    '--die-spin-x-3': `${-direction * (680 + Math.floor(Math.random() * 300))}deg`,
    '--die-spin-y-3': randomDegrees(520, 340),
    '--die-spin-z-3': `${-direction * (240 + Math.floor(Math.random() * 260))}deg`,
    '--die-roll-duration': `${760 + Math.floor(Math.random() * 220)}ms`,
    '--die-roll-delay': `${index * 70 + Math.floor(Math.random() * 80)}ms`,
  } as React.CSSProperties
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  return prefersReducedMotion
}

function useTabletopDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1120px)').matches
  ))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1120px)')
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}

const DIE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
}

const DIE_FACE_TRANSFORMS: Record<number, string> = {
  1: 'translateZ(1rem)',
  2: 'rotateY(90deg) translateZ(1rem)',
  3: 'rotateX(90deg) translateZ(1rem)',
  4: 'rotateX(-90deg) translateZ(1rem)',
  5: 'rotateY(-90deg) translateZ(1rem)',
  6: 'rotateY(180deg) translateZ(1rem)',
}

const DIE_PIPS: Record<number, string[]> = {
  1: ['top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'],
  2: ['left-1.5 top-1.5', 'bottom-1.5 right-1.5'],
  3: ['left-1.5 top-1.5', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-1.5 right-1.5'],
  4: ['left-1.5 top-1.5', 'right-1.5 top-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'],
  5: ['left-1.5 top-1.5', 'right-1.5 top-1.5', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'],
  6: ['left-1.5 top-1', 'left-1.5 top-1/2 -translate-y-1/2', 'bottom-1 left-1.5', 'right-1.5 top-1', 'right-1.5 top-1/2 -translate-y-1/2', 'bottom-1 right-1.5'],
}

function AnimatedDie({ value, label, animate, rollStyle, compact }: {
  value: number | null
  label: string
  animate: boolean
  rollStyle: React.CSSProperties
  compact: boolean
}) {
  const finalTransform = DIE_TRANSFORMS[value ?? 1]

  return (
    <div role="img" aria-label={label} className={`pm-die ${compact ? 'pm-die--compact' : ''}`}>
      <div
        className={`property-management-die-cube pm-die__cube ${animate ? 'pm-die__cube--rolling' : ''}`}
        style={{ ...rollStyle, '--die-final-transform': finalTransform, transform: finalTransform } as React.CSSProperties}
      >
        {[1, 2, 3, 4, 5, 6].map((face) => <DieFace key={face} value={face} />)}
      </div>
    </div>
  )
}

function DieFace({ value }: { value: number }) {
  return (
    <div className="pm-die__face" style={{ transform: DIE_FACE_TRANSFORMS[value] }}>
      {DIE_PIPS[value].map((positionClass, index) => (
        <span key={index} className={`pm-die__pip ${positionClass}`} />
      ))}
    </div>
  )
}
