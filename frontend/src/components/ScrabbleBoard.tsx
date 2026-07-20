import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Crosshair, History, Maximize2, MessageSquare, Minus, Plus, Star, Users } from 'lucide-react'
import { Game, Player, ScrabblePremium, ScrabbleScoreEvent, ScrabbleState, ScrabbleTile } from '../types/game'
import type { GameActionErrorReporter } from '../types/gameFeedback'
import { User } from '../types/user'
import api from '../lib/api'
import { isInteractiveKeyTarget } from '../lib/keyboard'
import { multiplayerActions, type ScrabbleMove } from '../lib/multiplayerActions'
import {
  SCRABBLE_BOARD_BASE_SIZE,
  SCRABBLE_BOARD_DIMENSION,
  SCRABBLE_BOARD_MAX_ZOOM,
  SCRABBLE_BOARD_MIN_ZOOM,
  captureScrabbleCameraCenter,
  canExchangeScrabbleTiles,
  clampScrabbleZoom,
  fitScrabbleBoardZoom,
  getEligibleScrabbleTradePlayers,
  getScrabbleCoordinate,
  getScrabbleLastPlayCenter,
  resolveScrabbleActionMode,
  restoreScrabbleCameraCenter,
  stepScrabbleZoom,
  type ScrabblePendingTradeRole,
} from '../lib/scrabbleBoardUi'
import GameChat from './GameChat'
import Modal from './Modal'
import MoveHistory from './MoveHistory'
import PlayerAvatar from './PlayerAvatar'
import { TabletopBottomSheet, TabletopDockButtons, TabletopTabs, type TabletopTab } from './TabletopShell'
import { Select } from './ui'
import './scrabble-tabletop.css'

interface Props {
  game: Game
  user: User | null
  isMyTurn: boolean
  onMove: (move: ScrabbleMove) => Promise<{ success: boolean; game?: Game; error?: string; handledGlobally?: boolean }>
  onSendChat: (text: string) => Promise<{ success: boolean; error?: string; handledGlobally?: boolean }>
  onActionError?: GameActionErrorReporter
}

interface PendingPlacement {
  rackTileId: string
  row: number
  col: number
  blankLetter?: string
}

interface ScoreHighlight {
  wordSquares: string[]
  letterSquare?: string
}

interface ScoreStep {
  label: string
  detail: string
  total: number
  wordSquares: string[]
  letterSquare?: string
}

type InspectorTab = 'players' | 'trade' | 'history' | 'chat'

const EMPTY_RACK: ScrabbleTile[] = []

const PREMIUMS: Record<string, ScrabblePremium> = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW', '7,0': 'TW', '7,14': 'TW', '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '2,2': 'DW', '3,3': 'DW', '4,4': 'DW', '10,10': 'DW', '11,11': 'DW', '12,12': 'DW', '13,13': 'DW',
  '1,13': 'DW', '2,12': 'DW', '3,11': 'DW', '4,10': 'DW', '10,4': 'DW', '11,3': 'DW', '12,2': 'DW', '13,1': 'DW',
  '1,5': 'TL', '1,9': 'TL', '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL', '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL', '13,5': 'TL', '13,9': 'TL',
  '0,3': 'DL', '0,11': 'DL', '2,6': 'DL', '2,8': 'DL', '3,0': 'DL', '3,7': 'DL', '3,14': 'DL', '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL', '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL', '11,0': 'DL', '11,7': 'DL', '11,14': 'DL', '12,6': 'DL', '12,8': 'DL', '14,3': 'DL', '14,11': 'DL',
}

const PREMIUM_NAMES: Record<ScrabblePremium, string> = {
  DL: 'double letter score',
  TL: 'triple letter score',
  DW: 'double word score',
  TW: 'triple word score',
}

export default function ScrabbleBoard({ game, user, isMyTurn, onMove, onSendChat, onActionError }: Props) {
  const state = game.gameState as unknown as ScrabbleState
  const isDesktopLayout = useTabletopDesktopLayout()
  const myId = user?._id ?? ''
  const myRack = useMemo(() => state.racks[myId] ?? EMPTY_RACK, [myId, state.racks])
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<PendingPlacement[]>([])
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([])
  const [tradeTargetId, setTradeTargetId] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [swapMode, setSwapMode] = useState(false)
  const [scoreHighlight, setScoreHighlight] = useState<ScoreHighlight | null>(null)
  const [blankPlacement, setBlankPlacement] = useState<PendingPlacement | null>(null)
  const [blankLetterInput, setBlankLetterInput] = useState('')
  const [blankLetterError, setBlankLetterError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<InspectorTab>('players')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [showGiveUpModal, setShowGiveUpModal] = useState(false)

  const closeBlankLetterModal = useCallback(() => {
    setBlankPlacement(null)
    setBlankLetterInput('')
    setBlankLetterError(null)
  }, [])

  const handleScoreHighlight = useCallback((highlight: ScoreHighlight | null) => {
    setScoreHighlight(highlight)
  }, [])

  const pendingTilesBySquare = useMemo(() => {
    const rackById = new Map(myRack.map((tile) => [tile.id, tile]))
    return Object.fromEntries(placements.map((placement) => {
      const tile = rackById.get(placement.rackTileId)
      const letter = tile?.isBlank ? placement.blankLetter || '?' : tile?.letter || '?'
      return [`${placement.row},${placement.col}`, { tile, letter }]
    }))
  }, [myRack, placements])

  const pendingTradeForMe = useMemo(
    () => state.pendingTrade?.targetUserId === myId ? state.pendingTrade : null,
    [myId, state.pendingTrade],
  )
  const pendingTradeTiles = pendingTradeForMe?.offeredTiles ?? EMPTY_RACK
  const pendingTradeTileCount = pendingTradeForMe?.offeredTileCount ?? pendingTradeTiles.length
  const incomingTradeKey = pendingTradeForMe
    ? pendingTradeForMe.offerId ?? `legacy:${pendingTradeForMe.fromUserId}:${pendingTradeForMe.targetUserId}:${pendingTradeTileCount}`
    : null
  const offeredByMe = state.pendingTrade?.fromUserId === myId
  const canExchangeSelection = canExchangeScrabbleTiles(selectedRackIds.length, state.bagCount ?? 0, state.infiniteLetters)
  const eligibleTradePlayers = useMemo(
    () => getEligibleScrabbleTradePlayers(
      game.players,
      myId,
      state.givenUpUserIds,
      state.rackCounts ?? {},
      selectedRackIds.length,
    ),
    [game.players, myId, selectedRackIds.length, state.givenUpUserIds, state.rackCounts],
  )
  const canOfferToTarget = eligibleTradePlayers.some((player) => player.userId === tradeTargetId)
  const activePlayers = useMemo(
    () => game.players.filter((player) => !state.givenUpUserIds.includes(player.userId)),
    [game.players, state.givenUpUserIds],
  )
  const currentPlayer = game.players[game.currentTurnIndex]
  const currentActiveIndex = activePlayers.findIndex((player) => player.userId === currentPlayer?.userId)
  const nextPlayer = activePlayers.length > 1
    ? activePlayers[(Math.max(0, currentActiveIndex) + 1) % activePlayers.length]
    : null
  const isHost = game.players[0]?.userId === myId
  const settingsLocked = game.moveHistory.length > 0
  const isWaitingForPlayer = game.status === 'active' && game.players.length < 2
  const hasGivenUp = state.givenUpUserIds.includes(myId)
  const pendingTradeRole: ScrabblePendingTradeRole = pendingTradeForMe
    ? 'incoming'
    : offeredByMe
      ? 'outgoing'
      : state.pendingTrade
        ? 'other'
        : 'none'
  const actionMode = resolveScrabbleActionMode({
    status: game.status,
    waitingForPlayer: isWaitingForPlayer,
    hasGivenUp,
    pendingTradeRole,
    isMyTurn,
    swapMode,
  })

  const inspectorTabs = useMemo<TabletopTab<InspectorTab>[]>(() => {
    const tabs: TabletopTab<InspectorTab>[] = [
      { id: 'players', label: 'Players', icon: Users },
      { id: 'trade', label: 'Trade', icon: ArrowLeftRight, badge: state.pendingTrade ? '!' : undefined },
      { id: 'history', label: 'History', icon: History },
    ]
    if (game.metadata?.mode !== 'singlePlayer') tabs.push({ id: 'chat', label: 'Chat', icon: MessageSquare })
    return tabs
  }, [game.metadata?.mode, state.pendingTrade])

  useEffect(() => {
    setPlacements([])
    setSelectedTileId(null)
    setSelectedRackIds([])
    setSwapMode(false)
    closeBlankLetterModal()
  }, [state.lastScoreEvent?.moveNumber, game.currentTurnIndex, closeBlankLetterModal])

  useEffect(() => {
    if (incomingTradeKey) {
      setSwapMode(true)
      setSelectedTileId(null)
      setSelectedRackIds([])
      setActiveTab('trade')
      return
    }
    setSelectedRackIds([])
    setSwapMode(false)
  }, [incomingTradeKey])

  useEffect(() => {
    if (tradeTargetId && !canOfferToTarget) setTradeTargetId('')
  }, [canOfferToTarget, tradeTargetId])

  useEffect(() => {
    if (isDesktopLayout) setSheetOpen(false)
  }, [isDesktopLayout])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isMyTurn || swapMode || state.pendingTrade || isInteractiveKeyTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key === '?' ? '?' : event.key.toUpperCase()
      if (!/^[A-Z?]$/.test(key)) return
      const availableTiles = myRack.filter((tile) => !placements.some((placement) => placement.rackTileId === tile.id))
      const matches = availableTiles.filter((tile) => key === '?' ? tile.isBlank : tile.letter.toUpperCase() === key)
      if (matches.length === 0) return
      event.preventDefault()
      const currentIndex = selectedTileId ? matches.findIndex((tile) => tile.id === selectedTileId) : -1
      setSelectedTileId(matches[(currentIndex + 1) % matches.length].id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMyTurn, myRack, placements, selectedTileId, state.pendingTrade, swapMode])

  function openInspector(tab: InspectorTab) {
    setActiveTab(tab)
    if (window.matchMedia('(max-width: 1119px)').matches) setSheetOpen(true)
  }

  function selectInspector(tabId: InspectorTab) {
    setActiveTab(tabId)
  }

  function toggleRackSelection(tileId: string) {
    setSelectedRackIds((current) => current.includes(tileId) ? current.filter((id) => id !== tileId) : [...current, tileId])
    setSelectedTileId(null)
  }

  function chooseTile(tile: ScrabbleTile) {
    if (placements.some((placement) => placement.rackTileId === tile.id)) return
    setSelectedRackIds((current) => current.filter((id) => id !== tile.id))
    setSelectedTileId((current) => current === tile.id ? null : tile.id)
  }

  function toggleSwapMode() {
    setSwapMode((current) => {
      const next = !current
      if (next) setSelectedTileId(null)
      else setSelectedRackIds([])
      return next
    })
  }

  function handleRackTileClick(tile: ScrabbleTile) {
    if (swapMode) toggleRackSelection(tile.id)
    else chooseTile(tile)
  }

  function placeSelected(row: number, col: number) {
    if (!isMyTurn || !selectedTileId || state.pendingTrade || state.board[row][col] || pendingTilesBySquare[`${row},${col}`]) return
    const tile = myRack.find((rackTile) => rackTile.id === selectedTileId)
    if (!tile) return
    if (tile.isBlank) {
      setBlankPlacement({ rackTileId: selectedTileId, row, col })
      setBlankLetterInput('')
      setBlankLetterError(null)
      return
    }
    setPlacements((current) => [...current, { rackTileId: selectedTileId, row, col }])
    setSelectedTileId(null)
  }

  function confirmBlankLetter() {
    if (!blankPlacement) return
    const normalized = blankLetterInput.trim().toUpperCase()
    if (!/^[A-Z]$/.test(normalized)) {
      setBlankLetterError('Choose one letter from A to Z.')
      return
    }
    setPlacements((current) => [...current, { ...blankPlacement, blankLetter: normalized }])
    setSelectedTileId(null)
    closeBlankLetterModal()
  }

  function removePending(row: number, col: number) {
    setPlacements((current) => current.filter((placement) => placement.row !== row || placement.col !== col))
  }

  async function act(move: ScrabbleMove, actionName: string) {
    if (busyAction) return
    const restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setBusyAction(actionName)
    try {
      const result = await onMove(move)
      if (!result.success && !result.handledGlobally) onActionError?.(result.error ?? 'Action failed', restoreFocusTo)
    } catch {
      onActionError?.('The action could not reach the game server. Try again.', restoreFocusTo)
    } finally {
      setBusyAction(null)
    }
  }

  function submitPlacements() {
    if (placements.length > 0) void act(multiplayerActions.scrabble.placeTiles(placements), 'play')
  }

  function exchangeSelected() {
    if (canExchangeSelection) void act(multiplayerActions.scrabble.exchangeWithBag(selectedRackIds), 'exchange')
  }

  function offerTrade() {
    if (tradeTargetId && selectedRackIds.length > 0) void act(multiplayerActions.scrabble.offerTrade(tradeTargetId, selectedRackIds), 'offer')
  }

  function acceptTrade() {
    if (pendingTradeForMe && selectedRackIds.length === pendingTradeTileCount) {
      void act(multiplayerActions.scrabble.acceptTrade(pendingTradeForMe.offerId, selectedRackIds), 'accept')
    }
  }

  function cancelPendingTrade() {
    if (state.pendingTrade && (offeredByMe || isHost)) {
      void act(multiplayerActions.scrabble.cancelTrade(state.pendingTrade.offerId), 'cancelTrade')
    }
  }

  async function updateInfiniteLetters(infiniteLetters: boolean) {
    const restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsSavingSettings(true)
    try {
      await api.patch(`/api/games/${game._id}/settings`, { infiniteLetters })
    } catch {
      onActionError?.('Could not update the room setting. Try again.', restoreFocusTo)
    } finally {
      setIsSavingSettings(false)
    }
  }

  function renderRackTiles(mirrored = false) {
    const canChooseMultiple = Boolean(pendingTradeForMe) || (isMyTurn && !state.pendingTrade && (swapMode || mirrored))
    const canChoosePlacement = isMyTurn && !state.pendingTrade && !swapMode && !mirrored
    return (
      <div className="scr-rack-scroll" aria-label={mirrored ? 'Selectable trade rack' : 'Your tile rack'}>
        <div className="scr-rack">
          {myRack.length === 0 && <p className="scr-empty-rack">Your rack is empty.</p>}
          {myRack.map((tile) => {
            const placed = placements.some((placement) => placement.rackTileId === tile.id)
            const selectedForAction = selectedRackIds.includes(tile.id)
            const selectedForBoard = selectedTileId === tile.id
            const selectable = !placed && (canChooseMultiple || canChoosePlacement)
            return (
              <button
                key={tile.id}
                type="button"
                disabled={!selectable}
                aria-pressed={selectedForAction || selectedForBoard}
                aria-label={`${tile.isBlank ? 'Blank tile' : `${tile.letter}, ${tile.value} point${tile.value === 1 ? '' : 's'}`}${placed ? ', pending on board' : selectedForAction || selectedForBoard ? ', selected' : ''}`}
                onClick={() => {
                  if (mirrored) {
                    setSwapMode(true)
                    toggleRackSelection(tile.id)
                  } else {
                    handleRackTileClick(tile)
                  }
                }}
                className={`scr-rack-tile ${selectedForAction ? 'is-multi-selected' : ''} ${selectedForBoard ? 'is-place-selected' : ''}`}
              >
                <TileFace tile={tile} variant="rack" />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  function renderActionPanel(compact = false) {
    const title = actionTitle(actionMode)
    return (
      <section className={`scr-action-surface ${compact ? 'scr-action-surface--compact' : ''}`} aria-label="Current action">
        <header className="scr-action-header">
          <div>
            <p className="scr-section-label">Current action</p>
            <h2>{title}</h2>
          </div>
          {busyAction && <span className="scr-busy-label" role="status">Working…</span>}
        </header>

        {!isWaitingForPlayer && renderRackTiles()}

        {actionMode === 'completed' && (
          <p className="scr-action-copy">{game.result?.winnerName ? `${game.result.winnerName} won the table.` : 'The final scores are in.'}</p>
        )}
        {actionMode === 'waitingForPlayer' && (
          <p className="scr-action-copy">Invite another player with the code shown above the board.</p>
        )}
        {actionMode === 'observing' && <p className="scr-action-copy">You gave up this round. You can still follow the board, scores, history, and chat.</p>}
        {actionMode === 'waitingTurn' && <p className="scr-action-copy">{currentPlayer ? `${currentPlayer.username} is choosing their play.` : 'Waiting for the next play.'}</p>}
        {actionMode === 'tradePending' && (
          <div className="scr-action-stack">
            <p className="scr-action-copy">{offeredByMe ? `Waiting for ${playerName(game.players, state.pendingTrade?.targetUserId ?? '')} to answer your trade.` : 'Another player is considering a trade.'}</p>
            <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={() => openInspector('trade')}>View trade</button>
          </div>
        )}
        {actionMode === 'incomingTrade' && (
          <div className="scr-action-stack">
            <p className="scr-action-copy">{playerName(game.players, pendingTradeForMe?.fromUserId ?? '')} offered {pendingTradeTileCount} tile{pendingTradeTileCount === 1 ? '' : 's'}.</p>
            <button type="button" className="tactile-button tactile-button--primary scr-primary-button" onClick={() => openInspector('trade')}>Review trade</button>
          </div>
        )}
        {actionMode === 'place' && (
          <>
            <p className="scr-action-copy">{selectedTileId ? 'Choose an open board square.' : placements.length ? `${placements.length} tile${placements.length === 1 ? '' : 's'} ready to play.` : 'Select a rack tile, then choose its square.'}</p>
            <div className="scr-action-grid">
              <button type="button" className="tactile-button tactile-button--primary scr-primary-button" onClick={submitPlacements} disabled={placements.length === 0 || Boolean(busyAction)}>Play tiles</button>
              <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={toggleSwapMode} disabled={Boolean(busyAction)}>Swap tiles</button>
              <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={() => void act(multiplayerActions.scrabble.pass(), 'pass')} disabled={Boolean(busyAction)}>Pass</button>
              <button type="button" className="tactile-button tactile-button--danger scr-danger-button" onClick={() => setShowGiveUpModal(true)} disabled={Boolean(busyAction)}>Give up</button>
            </div>
          </>
        )}
        {actionMode === 'exchange' && (
          <>
            <p className="scr-action-copy">Select tiles, then exchange them with the bag or offer them to another player.</p>
            {!state.infiniteLetters && selectedRackIds.length > (state.bagCount ?? 0) && (
              <p className="scr-inline-error" role="status">The bag has only {state.bagCount ?? 0} tile{state.bagCount === 1 ? '' : 's'}. Reduce the selection to exchange, or offer a player trade.</p>
            )}
            <div className="scr-action-grid">
              <button type="button" className="tactile-button tactile-button--primary scr-primary-button" onClick={exchangeSelected} disabled={!canExchangeSelection || Boolean(busyAction)}>Exchange ({selectedRackIds.length})</button>
              <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={() => openInspector('trade')} disabled={selectedRackIds.length === 0}>Offer trade</button>
              <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={toggleSwapMode}>Cancel</button>
              <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={() => void act(multiplayerActions.scrabble.pass(), 'pass')} disabled={Boolean(busyAction)}>Pass</button>
              <button type="button" className="tactile-button tactile-button--danger scr-danger-button" onClick={() => setShowGiveUpModal(true)} disabled={Boolean(busyAction)}>Give up</button>
            </div>
          </>
        )}
      </section>
    )
  }

  function renderPlayersPanel() {
    return (
      <div className="scr-panel-stack">
        <div className="scr-player-list">
          {game.players.map((player, index) => {
            const gaveUp = state.givenUpUserIds.includes(player.userId)
            const current = game.status === 'active' && index === game.currentTurnIndex
            return (
              <div key={player.userId} className={`scr-player-row ${current ? 'is-current' : ''}`}>
                <PlayerAvatar
                  name={player.username}
                  size="md"
                  status={current ? 'turn' : player.isConnected === false ? 'offline' : 'online'}
                />
                <span className="scr-player-name">
                  <strong className={gaveUp ? 'line-through' : ''}>{player.username}</strong>
                  <small>{gaveUp ? 'Gave up' : player.isConnected === false ? 'Offline' : index === 0 ? 'Host' : current ? 'Playing' : 'At the table'}</small>
                </span>
                <strong className="scr-player-score">{state.scores[player.userId] ?? 0}</strong>
              </div>
            )
          })}
        </div>
        <section className="scr-setting-card">
          <div>
            <p className="scr-section-label">Room setting</p>
            <h3>Infinite letters</h3>
            <p>{settingsLocked ? 'Locked after the first move.' : 'Draw from an unlimited supply instead of a finite bag.'}</p>
          </div>
          <label className={isHost && !settingsLocked ? 'is-enabled' : ''}>
            <input
              type="checkbox"
              aria-label="Infinite letters"
              checked={state.infiniteLetters}
              disabled={!isHost || settingsLocked || isSavingSettings}
              onChange={(event) => void updateInfiniteLetters(event.target.checked)}
            />
            <span>{state.infiniteLetters ? 'On' : 'Off'}</span>
          </label>
        </section>
      </div>
    )
  }

  function renderTradePanel() {
    if (pendingTradeForMe) {
      const required = pendingTradeTileCount
      return (
        <div className="scr-panel-stack">
          <div className="scr-trade-notice">
            <p className="scr-section-label">Incoming offer</p>
            <h3>{playerName(game.players, pendingTradeForMe.fromUserId)} offers</h3>
            <div className="scr-offered-tiles">{pendingTradeTiles.map((tile) => <TileFace key={tile.id} tile={tile} variant="rack" />)}</div>
          </div>
          <div>
            <h3 className="scr-panel-title">Choose {required} tile{required === 1 ? '' : 's'} in return</h3>
            <p className="scr-panel-copy">Selected {selectedRackIds.length} of {required}</p>
            {renderRackTiles(true)}
          </div>
          <div className="scr-action-grid">
            <button type="button" className="tactile-button tactile-button--primary scr-primary-button" onClick={acceptTrade} disabled={selectedRackIds.length !== required || Boolean(busyAction)}>Accept trade</button>
            <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={() => void act(multiplayerActions.scrabble.declineTrade(pendingTradeForMe.offerId), 'decline')} disabled={Boolean(busyAction)}>Decline</button>
          </div>
        </div>
      )
    }

    if (state.pendingTrade) {
      return (
        <div className="scr-trade-notice">
          <p className="scr-section-label">Trade pending</p>
          <h3>{offeredByMe ? 'Offer sent' : 'Players are negotiating'}</h3>
          <p>{offeredByMe ? `${playerName(game.players, state.pendingTrade.targetUserId)} is choosing a response.` : 'The board will unlock when the trade is accepted or declined.'}</p>
          {(offeredByMe || isHost) && (
            <button type="button" className="tactile-button tactile-button--secondary scr-secondary-button" onClick={cancelPendingTrade} disabled={Boolean(busyAction)}>Cancel trade</button>
          )}
        </div>
      )
    }

    return (
      <div className="scr-panel-stack">
        <div>
          <p className="scr-panel-copy">Select tiles here or turn on Swap in the action panel. Your selection stays synchronized.</p>
          {renderRackTiles(true)}
        </div>
        <div className="scr-field-label">
          <span>Trade with</span>
          <Select
            label="Trade with"
            value={tradeTargetId || 'none'}
            onValueChange={(value) => setTradeTargetId(value === 'none' ? '' : value)}
            disabled={!isMyTurn || Boolean(busyAction)}
            placeholder="Choose a player"
            options={[
              { value: 'none', label: 'Choose a player' },
              ...eligibleTradePlayers
                .map((player) => ({ value: player.userId, label: player.username })),
            ]}
          />
        </div>
        <button type="button" className="tactile-button tactile-button--primary scr-primary-button" onClick={offerTrade} disabled={!isMyTurn || !canOfferToTarget || selectedRackIds.length === 0 || Boolean(busyAction)}>
          {selectedRackIds.length ? `Offer ${selectedRackIds.length} tile${selectedRackIds.length === 1 ? '' : 's'}` : 'Offer trade'}
        </button>
        <p className="scr-panel-copy">Only connected players with enough tiles are shown. They must return the same number of tiles or decline.</p>
      </div>
    )
  }

  function renderInspectorContent() {
    switch (activeTab) {
      case 'trade': return renderTradePanel()
      case 'history': return <MoveHistory moves={game.moveHistory} variant="embedded" />
      case 'chat': return <GameChat messages={game.chatMessages ?? []} currentUserId={myId} onSend={onSendChat} onError={onActionError} variant="embedded" />
      default: return renderPlayersPanel()
    }
  }

  const activeTabLabel = inspectorTabs.find((tab) => tab.id === activeTab)?.label ?? 'Game information'

  return (
    <div className="scrabble-tabletop min-w-0">
      <section className="scr-hud" aria-label="Scrabble game status">
        <div className="scr-hud-turn">
          <PlayerAvatar
            name={currentPlayer?.username ?? '?'}
            size="lg"
            status={game.status === 'active' ? 'turn' : undefined}
          />
          <div>
            <p className="scr-section-label">{game.status === 'completed' ? 'Final table' : isMyTurn ? 'Your turn' : 'Current turn'}</p>
            <strong>{game.status === 'completed' ? 'Game complete' : currentPlayer?.username ?? 'Waiting'}</strong>
          </div>
        </div>
        <HudStat label="Up next" value={nextPlayer?.username ?? '—'} />
        <HudStat label="Your score" value={`${state.scores[myId] ?? 0}`} />
        <HudStat label="Supply" value={state.infiniteLetters ? 'Infinite' : `${state.bagCount ?? 0} tiles`} />
        <HudStat label="Active" value={`${activePlayers.length}`} />
        <ScoreAnimation event={state.lastScoreEvent} onHighlight={handleScoreHighlight} />
      </section>

      <div className="scr-game-layout">
        <ScrabbleCamera
          state={state}
          selectedTileId={selectedTileId}
          pendingTilesBySquare={pendingTilesBySquare}
          scoreHighlight={scoreHighlight}
          onPlace={placeSelected}
          onRemove={removePending}
        />

        {isDesktopLayout && (
          <aside className="scr-desktop-rail" aria-label="Scrabble controls and information">
            {renderActionPanel()}
            <section className="scr-inspector-surface">
              <TabletopTabs tabs={inspectorTabs} activeTab={activeTab} onSelect={selectInspector} ariaLabel="Scrabble information" idBase="scrabble-desktop" />
              <div id="scrabble-desktop-panel" className="scr-inspector-content" role="tabpanel" aria-labelledby={`scrabble-desktop-tab-${activeTab}`}>
                {renderInspectorContent()}
              </div>
            </section>
          </aside>
        )}
      </div>

      {!isDesktopLayout && (
        <>
          <div className="scr-mobile-dock">
            {renderActionPanel(true)}
            <TabletopDockButtons tabs={inspectorTabs} activeTab={activeTab} onSelect={openInspector} ariaLabel="Open Scrabble information" isOpen={sheetOpen} />
          </div>

          <TabletopBottomSheet isOpen={sheetOpen} title={activeTabLabel} onClose={() => setSheetOpen(false)} idBase="scrabble-info-sheet" contentKey={activeTab}>
            <TabletopTabs tabs={inspectorTabs} activeTab={activeTab} onSelect={selectInspector} ariaLabel="Scrabble information" idBase="scrabble-sheet" />
            <div id="scrabble-sheet-panel" className="scr-sheet-content" role="tabpanel" aria-labelledby={`scrabble-sheet-tab-${activeTab}`}>
              {renderInspectorContent()}
            </div>
          </TabletopBottomSheet>
        </>
      )}

      <Modal
        isOpen={Boolean(blankPlacement)}
        title="Choose Blank Letter"
        variant="info"
        primaryAction={{ label: 'Place', onClick: confirmBlankLetter }}
        secondaryAction={{ label: 'Cancel', onClick: closeBlankLetterModal }}
        onClose={closeBlankLetterModal}
      >
        <label className="scr-blank-label">
          Letter
          <input
            autoFocus
            type="text"
            inputMode="text"
            maxLength={1}
            value={blankLetterInput}
            onChange={(event) => {
              setBlankLetterInput(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1))
              setBlankLetterError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmBlankLetter()
              }
            }}
            aria-describedby={blankLetterError ? 'scrabble-blank-error' : undefined}
            aria-invalid={Boolean(blankLetterError) || undefined}
          />
        </label>
        {blankLetterError && <p id="scrabble-blank-error" role="alert" className="scr-inline-error">{blankLetterError}</p>}
      </Modal>

      <Modal
        isOpen={showGiveUpModal}
        title="Give up this game?"
        variant="danger"
        primaryAction={{ label: 'Give up', onClick: () => {
          setShowGiveUpModal(false)
          void act(multiplayerActions.scrabble.giveUp(), 'give-up')
        } }}
        secondaryAction={{ label: 'Keep playing', onClick: () => setShowGiveUpModal(false) }}
        onClose={() => setShowGiveUpModal(false)}
      >
        You will leave the active turn order, but you can continue watching the table and using chat.
      </Modal>
    </div>
  )
}

function ScrabbleCamera({
  state,
  selectedTileId,
  pendingTilesBySquare,
  scoreHighlight,
  onPlace,
  onRemove,
}: {
  state: ScrabbleState
  selectedTileId: string | null
  pendingTilesBySquare: Record<string, { tile?: ScrabbleTile; letter: string }>
  scoreHighlight: ScoreHighlight | null
  onPlace: (row: number, col: number) => void
  onRemove: (row: number, col: number) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [focusedSquare, setFocusedSquare] = useState({ row: 7, col: 7 })
  const cameraRef = useRef<HTMLDivElement>(null)
  const pendingCenterRef = useRef<{ x: number; y: number } | null>(null)
  const initialCenterRef = useRef(false)
  const previousScoreMoveRef = useRef<number | null>(state.lastScoreEvent?.moveNumber ?? null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const boardSize = Math.round(SCRABBLE_BOARD_BASE_SIZE * zoom)
  const lastPlayCenter = getScrabbleLastPlayCenter(state.lastScoreEvent)

  const centerSquare = useCallback((row: number, col: number, behavior: ScrollBehavior = 'smooth') => {
    const camera = cameraRef.current
    const square = camera?.querySelector<HTMLElement>(`[data-scrabble-square="${row},${col}"]`)
    if (!camera || !square) return
    const cameraRect = camera.getBoundingClientRect()
    const squareRect = square.getBoundingClientRect()
    camera.scrollTo({
      left: camera.scrollLeft + squareRect.left - cameraRect.left + squareRect.width / 2 - camera.clientWidth / 2,
      top: camera.scrollTop + squareRect.top - cameraRect.top + squareRect.height / 2 - camera.clientHeight / 2,
      behavior: prefersReducedMotion ? 'auto' : behavior,
    })
  }, [prefersReducedMotion])

  useEffect(() => {
    if (initialCenterRef.current) return
    initialCenterRef.current = true
    const frame = requestAnimationFrame(() => centerSquare(7, 7, 'auto'))
    return () => cancelAnimationFrame(frame)
  }, [centerSquare])

  useEffect(() => {
    const nextMove = state.lastScoreEvent?.moveNumber ?? null
    const previousMove = previousScoreMoveRef.current
    previousScoreMoveRef.current = nextMove
    if (nextMove == null || nextMove === previousMove) return
    const center = getScrabbleLastPlayCenter(state.lastScoreEvent)
    if (!center) return
    const frame = requestAnimationFrame(() => centerSquare(center.row, center.col))
    return () => cancelAnimationFrame(frame)
  }, [centerSquare, state.lastScoreEvent])

  useEffect(() => {
    const pending = pendingCenterRef.current
    if (!pending) return
    pendingCenterRef.current = null
    const frame = requestAnimationFrame(() => {
      const camera = cameraRef.current
      if (!camera) return
      const position = restoreScrabbleCameraCenter(pending, camera.scrollWidth, camera.scrollHeight, camera.clientWidth, camera.clientHeight)
      camera.scrollTo({ ...position, behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [zoom])

  function changeZoom(nextZoom: number) {
    const camera = cameraRef.current
    const next = clampScrabbleZoom(nextZoom)
    if (next === zoom) return
    if (camera) {
      pendingCenterRef.current = captureScrabbleCameraCenter(
        camera.scrollLeft,
        camera.scrollTop,
        camera.clientWidth,
        camera.clientHeight,
        camera.scrollWidth,
        camera.scrollHeight,
      )
    }
    setZoom(next)
  }

  function fitBoard() {
    const camera = cameraRef.current
    if (camera) changeZoom(fitScrabbleBoardZoom(camera.clientWidth, camera.clientHeight))
  }

  function handleSquareKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    const offsets: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const nextRow = Math.min(SCRABBLE_BOARD_DIMENSION - 1, Math.max(0, row + offset[0]))
    const nextCol = Math.min(SCRABBLE_BOARD_DIMENSION - 1, Math.max(0, col + offset[1]))
    setFocusedSquare({ row: nextRow, col: nextCol })
    requestAnimationFrame(() => {
      const next = cameraRef.current?.querySelector<HTMLElement>(`[data-scrabble-square="${nextRow},${nextCol}"]`)
      next?.focus({ preventScroll: true })
      centerSquare(nextRow, nextCol)
    })
  }

  return (
    <section className="scr-board-surface" aria-label="Scrabble board">
      <header className="scr-camera-toolbar">
        <div>
          <p className="scr-section-label">Board camera</p>
          <strong aria-live="polite">{Math.round(zoom * 100)}% zoom</strong>
        </div>
        <div className="scr-camera-controls">
          <button type="button" className="tactile-button tactile-button--secondary" onClick={() => changeZoom(stepScrabbleZoom(zoom, -1))} disabled={zoom <= SCRABBLE_BOARD_MIN_ZOOM} aria-label="Zoom out"><Minus /></button>
          <button type="button" className="tactile-button tactile-button--secondary" onClick={() => changeZoom(stepScrabbleZoom(zoom, 1))} disabled={zoom >= SCRABBLE_BOARD_MAX_ZOOM} aria-label="Zoom in"><Plus /></button>
          <button type="button" className="tactile-button tactile-button--secondary scr-camera-action" onClick={fitBoard} aria-label="Fit whole board"><Maximize2 /><span>Fit</span></button>
          <button type="button" className="tactile-button tactile-button--secondary scr-camera-action" onClick={() => centerSquare(7, 7)} aria-label="Center board"><Crosshair /><span>Center</span></button>
          <button type="button" className="tactile-button tactile-button--secondary scr-camera-action" disabled={!lastPlayCenter} onClick={() => lastPlayCenter && centerSquare(lastPlayCenter.row, lastPlayCenter.col)} aria-label="Center last scoring play"><Star /><span>Last play</span></button>
        </div>
      </header>

      <div ref={cameraRef} className="scr-board-camera" tabIndex={0} aria-label="Scrollable Scrabble board">
        <div className="scr-board-stage" style={{ width: boardSize, height: boardSize }}>
          <div className={`scr-board-grid ${zoom <= 0.5 ? 'is-overview' : ''}`} style={{ width: boardSize, height: boardSize, '--scr-board-scale': zoom } as React.CSSProperties}>
            {Array.from({ length: SCRABBLE_BOARD_DIMENSION * SCRABBLE_BOARD_DIMENSION }).map((_, index) => {
              const row = Math.floor(index / SCRABBLE_BOARD_DIMENSION)
              const col = index % SCRABBLE_BOARD_DIMENSION
              const key = `${row},${col}`
              const cell = state.board[row][col]
              const pending = pendingTilesBySquare[key]
              const premium = PREMIUMS[key]
              const usedPremium = state.usedPremiumSquares.includes(key)
              const actionable = Boolean(pending) || Boolean(selectedTileId && !cell)
              const wordHighlighted = Boolean(scoreHighlight?.wordSquares.includes(key))
              const letterHighlighted = scoreHighlight?.letterSquare === key
              return (
                <button
                  key={key}
                  type="button"
                  data-scrabble-square={key}
                  tabIndex={focusedSquare.row === row && focusedSquare.col === col ? 0 : -1}
                  aria-disabled={!actionable}
                  aria-label={squareAriaLabel(row, col, cell?.tile, pending, premium, usedPremium, actionable)}
                  onFocus={() => setFocusedSquare({ row, col })}
                  onKeyDown={(event) => handleSquareKeyDown(event, row, col)}
                  onClick={() => {
                    if (pending) onRemove(row, col)
                    else if (actionable) onPlace(row, col)
                  }}
                  className={`scr-board-square ${premium && !usedPremium ? `scr-premium-${premium.toLowerCase()}` : ''} ${cell ? 'has-tile' : ''} ${pending ? 'has-pending' : ''} ${wordHighlighted ? 'is-word-highlighted' : ''} ${letterHighlighted ? 'is-letter-highlighted' : ''}`}
                >
                  {cell ? (
                    <TileFace tile={cell.tile} variant="board" />
                  ) : pending?.tile ? (
                    <TileFace tile={{ ...pending.tile, letter: pending.letter }} variant="board" pending />
                  ) : row === 7 && col === 7 ? (
                    <Star className="scr-center-star" aria-hidden="true" />
                  ) : premium && !usedPremium ? (
                    <span className="scr-premium-label">{premium}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <p className="scr-camera-hint">Drag or scroll to explore. Select a rack tile before choosing its square.</p>
    </section>
  )
}

function ScoreAnimation({ event, onHighlight }: { event: ScrabbleScoreEvent | null; onHighlight: (highlight: ScoreHighlight | null) => void }) {
  const [step, setStep] = useState(0)
  const [displayTotal, setDisplayTotal] = useState(0)
  const displayTotalRef = useRef(0)
  const prefersReducedMotion = usePrefersReducedMotion()
  const steps = useMemo<ScoreStep[]>(() => {
    if (!event) return []
    let running = 0
    return event.words.flatMap((word) => {
      const wordStart = running
      const wordSquares = word.cells.map((cell) => `${cell.row},${cell.col}`)
      const additions = word.cells.map((cell) => {
        running += cell.baseValue
        return { label: cell.letter, detail: `+${cell.baseValue}`, total: running, wordSquares, letterSquare: `${cell.row},${cell.col}` }
      })
      const letterMultipliers = word.cells.filter((cell) => cell.letterMultiplier > 1).map((cell) => {
        running += cell.afterLetterMultiplier - cell.baseValue
        return { label: cell.letter, detail: `×${cell.letterMultiplier} letter`, total: running, wordSquares, letterSquare: `${cell.row},${cell.col}` }
      })
      running = wordStart + word.subtotal
      const subtotal = { label: word.word.toUpperCase(), detail: `subtotal ${word.subtotal}`, total: running, wordSquares }
      const multiplier = word.wordMultiplier > 1
        ? [{ label: word.word.toUpperCase(), detail: `×${word.wordMultiplier} word`, total: wordStart + word.total, wordSquares }]
        : []
      running = wordStart + word.total
      return [...additions, ...letterMultipliers, subtotal, ...multiplier]
    }).concat([{ label: 'Turn total', detail: `+${event.total}`, total: event.total, wordSquares: [] }])
  }, [event])

  useEffect(() => {
    setStep(prefersReducedMotion ? Math.max(0, steps.length - 1) : 0)
    displayTotalRef.current = prefersReducedMotion ? event?.total ?? 0 : 0
    setDisplayTotal(displayTotalRef.current)
    if (steps.length === 0 || prefersReducedMotion) return
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= steps.length - 1) {
          window.clearInterval(timer)
          return current
        }
        return current + 1
      })
    }, 520)
    return () => window.clearInterval(timer)
  }, [event?.total, prefersReducedMotion, steps])

  useEffect(() => {
    if (!event) {
      onHighlight(null)
      return
    }
    if (prefersReducedMotion) {
      onHighlight({ wordSquares: [...new Set(event.words.flatMap((word) => word.cells.map((cell) => `${cell.row},${cell.col}`)))] })
      return () => onHighlight(null)
    }
    const current = steps[step]
    onHighlight(current?.wordSquares.length ? { wordSquares: current.wordSquares, letterSquare: current.letterSquare } : null)
    return () => onHighlight(null)
  }, [event, onHighlight, prefersReducedMotion, step, steps])

  useEffect(() => {
    if (prefersReducedMotion) return
    const target = steps[step]?.total ?? 0
    const start = displayTotalRef.current
    const delta = target - start
    if (delta === 0) return
    const startedAt = performance.now()
    let frame = 0
    function animate(now: number) {
      const progress = Math.min((now - startedAt) / 320, 1)
      const next = Math.round(start + delta * progress)
      displayTotalRef.current = next
      setDisplayTotal(next)
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [prefersReducedMotion, step, steps])

  if (!event || steps.length === 0) {
    return <p className="scr-hud-event">No scoring play yet.</p>
  }

  return (
    <div className="scr-hud-event">
      <span><strong>{event.playerName}</strong> scored</span>
      <span className="scr-score-count">{displayTotal}</span>
      <span><strong>{steps[step]?.label}</strong> · {steps[step]?.detail}</span>
      <span className="sr-only" aria-live="polite">{event.playerName} scored {event.total} points.</span>
    </div>
  )
}

function HudStat({ label, value }: { label: string; value: string }) {
  return <div className="scr-hud-stat"><span>{label}</span><strong>{value}</strong></div>
}

function TileFace({ tile, variant, pending = false }: { tile: ScrabbleTile; variant: 'board' | 'rack'; pending?: boolean }) {
  return (
    <span className={`scr-tile-face scr-tile-face--${variant} ${pending ? 'is-pending' : ''}`} aria-hidden="true">
      <span className="scr-tile-letter">{tile.letter}</span>
      <span className="scr-tile-value">{tile.value}</span>
    </span>
  )
}

function squareAriaLabel(
  row: number,
  col: number,
  tile: ScrabbleTile | undefined,
  pending: { tile?: ScrabbleTile; letter: string } | undefined,
  premium: ScrabblePremium | undefined,
  usedPremium: boolean,
  actionable: boolean,
): string {
  const coordinate = getScrabbleCoordinate(row, col)
  if (tile) return `${coordinate}, ${tile.isBlank ? 'blank tile' : `${tile.letter}, ${tile.value} point${tile.value === 1 ? '' : 's'}`}, occupied`
  if (pending?.tile) return `${coordinate}, pending ${pending.letter}, ${pending.tile.value} point${pending.tile.value === 1 ? '' : 's'}; activate to return it to your rack`
  const squareType = row === 7 && col === 7 ? 'center star' : premium && !usedPremium ? PREMIUM_NAMES[premium] : 'open square'
  return `${coordinate}, ${squareType}${actionable ? '; activate to place the selected tile' : '; select a rack tile to place here'}`
}

function actionTitle(mode: ReturnType<typeof resolveScrabbleActionMode>): string {
  switch (mode) {
    case 'completed': return 'Final scores'
    case 'waitingForPlayer': return 'Invite another player'
    case 'observing': return 'Watching the table'
    case 'incomingTrade': return 'Trade offered'
    case 'tradePending': return 'Trade in progress'
    case 'exchange': return 'Choose tiles to swap'
    case 'place': return 'Build your word'
    case 'waitingTurn': return 'Watch the board'
  }
}

function playerName(players: Player[], userId: string): string {
  return players.find((player) => player.userId === userId)?.username ?? 'Unknown player'
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
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
