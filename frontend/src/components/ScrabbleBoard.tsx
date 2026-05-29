import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { Game, Player, ScrabblePremium, ScrabbleScoreEvent, ScrabbleState, ScrabbleTile } from '../types/game'
import { User } from '../types/user'
import api from '../lib/api'
import Modal from './Modal'

type ScrabbleMove =
  | { type: 'placeTiles'; placements: Array<{ rackTileId: string; row: number; col: number; blankLetter?: string }> }
  | { type: 'exchangeWithBag'; rackTileIds: string[] }
  | { type: 'offerTrade'; targetUserId: string; rackTileIds: string[] }
  | { type: 'respondTrade'; accept: boolean; rackTileIds?: string[] }
  | { type: 'pass' }
  | { type: 'giveUp' }

interface Props {
  game: Game
  user: User | null
  isMyTurn: boolean
  onMove: (move: ScrabbleMove) => Promise<{ success: boolean; game?: Game; error?: string }>
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
  kind: string
  wordSquares: string[]
  letterSquare?: string
}

const BOARD_SIZE = 15

const PREMIUMS: Record<string, ScrabblePremium> = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW', '7,0': 'TW', '7,14': 'TW', '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '2,2': 'DW', '3,3': 'DW', '4,4': 'DW', '10,10': 'DW', '11,11': 'DW', '12,12': 'DW', '13,13': 'DW',
  '1,13': 'DW', '2,12': 'DW', '3,11': 'DW', '4,10': 'DW', '10,4': 'DW', '11,3': 'DW', '12,2': 'DW', '13,1': 'DW',
  '1,5': 'TL', '1,9': 'TL', '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL', '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL', '13,5': 'TL', '13,9': 'TL',
  '0,3': 'DL', '0,11': 'DL', '2,6': 'DL', '2,8': 'DL', '3,0': 'DL', '3,7': 'DL', '3,14': 'DL', '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL', '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL', '11,0': 'DL', '11,7': 'DL', '11,14': 'DL', '12,6': 'DL', '12,8': 'DL', '14,3': 'DL', '14,11': 'DL',
}

export default function ScrabbleBoard({ game, user, isMyTurn, onMove }: Props) {
  const state = game.gameState as unknown as ScrabbleState
  const myId = user?._id || ''
  const myRack = state.racks[myId] || []
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

  const closeBlankLetterModal = useCallback(() => {
    setBlankPlacement(null)
    setBlankLetterInput('')
    setBlankLetterError(null)
  }, [])

  const pendingTilesBySquare = useMemo(() => {
    const rackById = new Map(myRack.map((tile) => [tile.id, tile]))
    return Object.fromEntries(placements.map((placement) => {
      const tile = rackById.get(placement.rackTileId)
      const letter = tile?.isBlank ? placement.blankLetter || '?' : tile?.letter || '?'
      return [`${placement.row},${placement.col}`, { tile, letter }]
    }))
  }, [myRack, placements])

  useEffect(() => {
    setPlacements([])
    setSelectedTileId(null)
    setSelectedRackIds([])
    setSwapMode(false)
    closeBlankLetterModal()
  }, [state.lastScoreEvent?.moveNumber, game.currentTurnIndex, closeBlankLetterModal])

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
      if (next) {
        setSelectedTileId(null)
      } else {
        setSelectedRackIds([])
      }
      return next
    })
  }

  function handleRackTileClick(tile: ScrabbleTile) {
    if (swapMode) {
      toggleRackSelection(tile.id)
      return
    }
    chooseTile(tile)
  }

  function placeSelected(row: number, col: number) {
    if (!isMyTurn || !selectedTileId || state.board[row][col] || pendingTilesBySquare[`${row},${col}`]) return
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

  async function submitPlacements() {
    if (placements.length === 0) return
    await onMove({ type: 'placeTiles', placements })
  }

  async function exchangeSelected() {
    if (selectedRackIds.length === 0) return
    await onMove({ type: 'exchangeWithBag', rackTileIds: selectedRackIds })
  }

  async function offerTrade() {
    if (!tradeTargetId || selectedRackIds.length === 0) return
    await onMove({ type: 'offerTrade', targetUserId: tradeTargetId, rackTileIds: selectedRackIds })
  }

  async function acceptTrade() {
    if (!state.pendingTrade || selectedRackIds.length !== state.pendingTrade.offeredTiles.length) return
    await onMove({ type: 'respondTrade', accept: true, rackTileIds: selectedRackIds })
  }

  const pendingTradeForMe = state.pendingTrade?.targetUserId === myId ? state.pendingTrade : null
  const offeredByMe = state.pendingTrade?.fromUserId === myId
  const activePlayers = game.players.filter((player) => !state.givenUpUserIds.includes(player.userId))
  const currentPlayer = game.players[game.currentTurnIndex]
  const nextPlayer = activePlayers.length > 1
    ? activePlayers[(activePlayers.findIndex((player) => player.userId === currentPlayer?.userId) + 1) % activePlayers.length]
    : null
  const isHost = game.players[0]?.userId === myId
  const settingsLocked = game.moveHistory.length > 0

  useEffect(() => {
    if (pendingTradeForMe) {
      setSwapMode(true)
      setSelectedTileId(null)
      return
    }
    setSelectedRackIds([])
  }, [pendingTradeForMe?.offerId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName.toLowerCase()
      if (!isMyTurn || swapMode || tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.ctrlKey || event.metaKey || event.altKey) return
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
  }, [isMyTurn, myRack, placements, selectedTileId, swapMode])

  async function updateInfiniteLetters(infiniteLetters: boolean) {
    setIsSavingSettings(true)
    try {
      await api.patch(`/api/games/${game._id}/settings`, { infiniteLetters })
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusPanel label="Supply" value={state.infiniteLetters ? 'Infinite' : `${state.bag.length} in bag`} />
        <StatusPanel label="Active" value={`${activePlayers.length} player${activePlayers.length === 1 ? '' : 's'}`} />
        <StatusPanel label="Turn" value={currentPlayer ? `${currentPlayer.username}${currentPlayer.isConnected ? '' : ' (offline)'}` : 'Unknown'} />
      </div>

      <section className="rounded-xl border border-accent/30 bg-accent-subtle p-4 text-accent">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider">Current Turn</p>
            <p className="text-lg font-bold">{currentPlayer ? `${currentPlayer.username}${currentPlayer.isConnected ? '' : ' (offline)'}` : 'Unknown'}</p>
          </div>
          {nextPlayer && <p className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold shadow-sm">Up next: {nextPlayer.username}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Game Options</h3>
            <p className="text-sm text-text-muted">{settingsLocked ? 'Options are locked after the first move.' : 'Room options are set here before play starts.'}</p>
          </div>
          <label className={`flex w-fit items-center gap-2 rounded-lg border border-border bg-page px-3 py-2 text-sm font-medium ${isHost && !settingsLocked ? 'cursor-pointer text-text-secondary' : 'cursor-not-allowed text-text-muted'}`}>
            <input
              type="checkbox"
              checked={state.infiniteLetters}
              disabled={!isHost || settingsLocked || isSavingSettings}
              onChange={(event) => void updateInfiniteLetters(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed"
            />
            Infinite letters
          </label>
        </div>
      </section>

      <ScoreAnimation event={state.lastScoreEvent} onHighlight={setScoreHighlight} />

      {state.pendingTrade && (
        <section className="rounded-xl border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-text">
          {pendingTradeForMe ? (
            <div className="space-y-3">
              <p className="font-medium">{playerName(game.players, state.pendingTrade.fromUserId)} offered {state.pendingTrade.offeredTiles.length} tile{state.pendingTrade.offeredTiles.length === 1 ? '' : 's'}.</p>
              <div className="flex flex-wrap gap-2">{state.pendingTrade.offeredTiles.map((tile) => <TileFace key={tile.id} tile={tile} variant="rack" />)}</div>
              <p>Select {state.pendingTrade.offeredTiles.length} tile{state.pendingTrade.offeredTiles.length === 1 ? '' : 's'} from your rack to accept.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={acceptTrade} disabled={selectedRackIds.length !== state.pendingTrade.offeredTiles.length} className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-text-on-accent disabled:cursor-not-allowed disabled:opacity-50">Accept</button>
                <button onClick={() => onMove({ type: 'respondTrade', accept: false })} className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm font-medium text-text-primary">Decline</button>
              </div>
            </div>
          ) : (
            <p>{offeredByMe ? 'Waiting for trade response.' : `${playerName(game.players, state.pendingTrade.targetUserId)} is considering a trade.`}</p>
          )}
        </section>
      )}

      <div className="flex justify-center rounded-xl border border-border bg-page p-1.5 sm:p-2">
        <div className="grid aspect-square w-full max-w-[42rem] gap-0.5 sm:gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
            const row = Math.floor(index / BOARD_SIZE)
            const col = index % BOARD_SIZE
            const square = `${row},${col}`
            const cell = state.board[row][col]
            const pending = pendingTilesBySquare[square]
            const premium = PREMIUMS[square]
            const usedPremium = state.usedPremiumSquares.includes(square)
            const isWordHighlighted = Boolean(scoreHighlight?.wordSquares.includes(square))
            const isLetterHighlighted = scoreHighlight?.letterSquare === square
            return (
              <button
                key={square}
                type="button"
                onClick={() => pending ? removePending(row, col) : placeSelected(row, col)}
                disabled={!isMyTurn && !pending}
                className={`relative aspect-square overflow-hidden rounded-[3px] border text-[0.5rem] font-bold transition-all duration-150 sm:rounded-md sm:text-[0.65rem] ${
                  cell || pending
                    ? pending ? 'border-accent bg-accent-subtle text-accent' : 'border-border-strong bg-warning-subtle text-warning-text'
                    : row === 7 && col === 7
                      ? 'border-accent/40 bg-accent-subtle text-lg text-accent'
                    : premium && !usedPremium
                      ? premiumClass(premium)
                      : 'border-border bg-elevated text-text-muted'
                } ${isWordHighlighted ? 'ring-2 ring-warning ring-offset-1 ring-offset-page' : ''} ${isLetterHighlighted ? 'z-10 scale-105 ring-4 ring-accent ring-offset-1 ring-offset-page' : ''}`}
              >
                {cell ? (
                  <TileFace tile={cell.tile} variant="board" />
                ) : pending?.tile ? (
                  <TileFace tile={{ ...pending.tile, letter: pending.letter }} variant="board" />
                ) : row === 7 && col === 7 ? (
                  <Star className="mx-auto h-4 w-4 fill-current sm:h-5 sm:w-5" aria-hidden="true" />
                ) : premium || ''}
              </button>
            )
          })}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-text-primary">Your Rack</h3>
          <p className="text-sm text-text-muted">
            {pendingTradeForMe
              ? `Choose ${pendingTradeForMe.offeredTiles.length} tile${pendingTradeForMe.offeredTiles.length === 1 ? '' : 's'} to send back.`
              : isMyTurn
                ? (swapMode ? 'Swap mode: tap tiles to mark them green.' : 'Tap a tile to place it on the board.')
                : 'Waiting for your turn.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {myRack.map((tile) => {
            const placed = placements.some((placement) => placement.rackTileId === tile.id)
            const selectedForAction = selectedRackIds.includes(tile.id)
            return (
              <button
                key={tile.id}
                type="button"
                disabled={placed}
                aria-pressed={selectedTileId === tile.id || selectedForAction}
                title={selectedForAction ? 'Selected for exchange or trade' : selectedTileId === tile.id ? 'Selected to place on the board' : swapMode ? 'Tap to select for exchange or trade' : 'Tap to select for board placement'}
                onClick={() => handleRackTileClick(tile)}
                className={`relative rounded-lg border p-1 transition-all duration-150 ${
                  selectedForAction
                    ? 'border-success bg-success-subtle shadow-[0_0_0_3px_var(--success-subtle)]'
                    : selectedTileId === tile.id
                      ? 'border-accent bg-accent-subtle shadow-accent'
                      : 'border-border bg-elevated'
                } ${placed ? 'opacity-30' : ''}`}
              >
                {selectedForAction && <span className="absolute -right-1 -top-1 z-10 rounded-full bg-success px-1.5 py-0.5 text-[0.55rem] font-bold uppercase leading-none text-text-on-accent">Swap</span>}
                <TileFace tile={tile} variant="rack" />
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={submitPlacements} disabled={!isMyTurn || placements.length === 0 || Boolean(state.pendingTrade)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent disabled:cursor-not-allowed disabled:opacity-50">Play Tiles</button>
          <button
            type="button"
            onClick={toggleSwapMode}
            disabled={Boolean(pendingTradeForMe) || !isMyTurn || Boolean(state.pendingTrade)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
              swapMode
                ? 'border-success bg-success text-text-on-accent'
                : 'border-border bg-elevated text-text-primary'
            }`}
          >
            Swap
          </button>
          <button onClick={exchangeSelected} disabled={!isMyTurn || selectedRackIds.length === 0 || Boolean(state.pendingTrade)} className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50">Exchange</button>
          <button onClick={() => onMove({ type: 'pass' })} disabled={!isMyTurn || Boolean(state.pendingTrade)} className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50">Pass</button>
          <button onClick={() => onMove({ type: 'giveUp' })} disabled={!isMyTurn || Boolean(state.pendingTrade)} className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2 text-sm font-medium text-danger-text disabled:cursor-not-allowed disabled:opacity-50">Give Up</button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {pendingTradeForMe
            ? 'Swap mode is active for this trade. Tap your rack tiles to mark them green, then accept or decline above.'
            : swapMode
              ? 'Swap mode is active. Tap rack tiles to mark them green, then exchange them with the bag or offer a trade.'
              : 'Tap a tile to select it for board placement. Turn on Swap to choose tiles for exchange or trade.'}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-text-primary">Scores</h3>
          <div className="space-y-2">
            {game.players.map((player) => (
              <div key={player.userId} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${player.userId === currentPlayer?.userId ? 'bg-accent-subtle text-accent' : 'bg-page'}`}>
                <span className={state.givenUpUserIds.includes(player.userId) ? 'text-text-muted line-through' : 'text-text-primary'}>{player.username}</span>
                <span className="font-mono font-bold text-accent">{state.scores[player.userId] || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-text-primary">Tile Trade</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={tradeTargetId} onChange={(event) => setTradeTargetId(event.target.value)} disabled={!isMyTurn || Boolean(state.pendingTrade)} className="min-h-10 flex-1 rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text-primary">
              <option value="">Choose player</option>
              {game.players.filter((player) => player.userId !== myId && !state.givenUpUserIds.includes(player.userId)).map((player) => (
                <option key={player.userId} value={player.userId}>{player.username}</option>
              ))}
            </select>
            <button onClick={offerTrade} disabled={!isMyTurn || !tradeTargetId || selectedRackIds.length === 0 || Boolean(state.pendingTrade)} className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-text-on-accent disabled:cursor-not-allowed disabled:opacity-50">Offer</button>
          </div>
          <p className="mt-2 text-xs text-text-muted">The other player chooses the same number of tiles back, or declines.</p>
        </div>
      </section>

      <Modal
        isOpen={Boolean(blankPlacement)}
        title="Choose Blank Letter"
        variant="info"
        primaryAction={{ label: 'Place', onClick: confirmBlankLetter }}
        secondaryAction={{ label: 'Cancel', onClick: closeBlankLetterModal }}
        onClose={closeBlankLetterModal}
      >
        <label className="block text-sm font-medium text-text-secondary">
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
            className="mt-2 h-12 w-full rounded-lg border border-border bg-overlay px-4 text-center font-mono text-2xl font-black uppercase text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-describedby={blankLetterError ? 'blank-letter-error' : undefined}
          />
        </label>
        {blankLetterError && <p id="blank-letter-error" className="mt-2 text-sm font-medium text-danger-text">{blankLetterError}</p>}
      </Modal>
    </div>
  )
}

function ScoreAnimation({ event, onHighlight }: { event: ScrabbleScoreEvent | null; onHighlight: (highlight: ScoreHighlight | null) => void }) {
  const [step, setStep] = useState(0)
  const [displayTotal, setDisplayTotal] = useState(0)
  const steps = useMemo<ScoreStep[]>(() => {
    if (!event) return []
    let running = 0
    return event.words.flatMap((word) => {
      const wordStart = running
      const wordSquares = word.cells.map((cell) => `${cell.row},${cell.col}`)
      const additions = word.cells.map((cell) => {
        running += cell.baseValue
        return { label: `${cell.letter}`, detail: `+${cell.baseValue}`, total: running, kind: 'add', wordSquares, letterSquare: `${cell.row},${cell.col}` }
      })
      const letterMultipliers = word.cells.filter((cell) => cell.letterMultiplier > 1).map((cell) => {
        const bonus = cell.afterLetterMultiplier - cell.baseValue
        running += bonus
        return { label: `${cell.letter}`, detail: `x${cell.letterMultiplier} letter`, total: running, kind: 'letter', wordSquares, letterSquare: `${cell.row},${cell.col}` }
      })
      running = wordStart + word.subtotal
      const subtotal = { label: word.word.toUpperCase(), detail: `subtotal ${word.subtotal}`, total: running, kind: 'subtotal', wordSquares }
      const multiplier = word.wordMultiplier > 1
        ? [{ label: word.word.toUpperCase(), detail: `x${word.wordMultiplier} word`, total: wordStart + word.total, kind: 'word', wordSquares }]
        : []
      running = wordStart + word.total
      return [...additions, ...letterMultipliers, subtotal, ...multiplier]
    }).concat([{ label: 'Turn Total', detail: `+${event.total}`, total: event.total, kind: 'final', wordSquares: [] }])
  }, [event])

  useEffect(() => {
    setStep(0)
    setDisplayTotal(0)
    onHighlight(null)
    if (steps.length === 0) return
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
  }, [steps.length, onHighlight])

  useEffect(() => {
    const current = steps[step]
    if (!current || current.wordSquares.length === 0) {
      onHighlight(null)
      return
    }
    onHighlight({ wordSquares: current.wordSquares, letterSquare: current.letterSquare })
    return () => onHighlight(null)
  }, [step, steps, onHighlight])

  useEffect(() => {
    const target = steps[step]?.total || 0
    const start = displayTotal
    const delta = target - start
    if (delta === 0) return
    const startedAt = performance.now()
    let frame = 0
    function animate(now: number) {
      const progress = Math.min((now - startedAt) / 360, 1)
      setDisplayTotal(Math.round(start + delta * progress))
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [step, steps])

  if (!event || steps.length === 0) return null

  return (
    <section className="rounded-xl border border-accent/30 bg-accent-subtle p-4 text-accent">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider">Score</p>
          <p className="text-sm font-semibold">{event.playerName}</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 shadow-sm">
          <div className="animate-pulse-once rounded-md bg-accent px-3 py-2 font-mono text-2xl font-black text-text-on-accent">{displayTotal}</div>
          <div>
            <p className="font-mono text-lg font-black">{steps[step]?.label}</p>
            <p className="text-sm font-semibold">{steps[step]?.detail}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatusPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function TileFace({ tile, variant }: { tile: ScrabbleTile; variant: 'board' | 'rack' }) {
  const isBoard = variant === 'board'
  return (
    <span className={`flex items-stretch justify-stretch rounded-md border border-warning/30 bg-warning-subtle font-mono text-warning-text shadow-sm ${
      isBoard ? 'h-full w-full rounded-[inherit] border-0 shadow-none' : 'h-12 w-12'
    }`}>
      <TileContent letter={tile.letter} value={tile.value} variant={variant} />
    </span>
  )
}

function TileContent({ letter, value, variant }: { letter: string; value: number; variant: 'board' | 'rack' }) {
  const isBoard = variant === 'board'
  return (
    <span className={`relative block h-full w-full leading-none ${isBoard ? 'min-h-0 min-w-0' : 'min-h-9 min-w-9'}`}>
      <span className={`absolute inset-0 flex items-center justify-center font-black ${isBoard ? 'text-[clamp(0.52rem,2.8vw,1rem)]' : 'text-xl'}`}>{letter}</span>
      <span className={`absolute font-bold leading-none ${isBoard ? 'bottom-[12%] right-[12%] text-[clamp(0.28rem,1.35vw,0.55rem)]' : 'bottom-1 right-1 text-[0.6rem]'}`}>{value}</span>
    </span>
  )
}

function premiumClass(premium: ScrabblePremium): string {
  switch (premium) {
    case 'DL': return 'border-info/40 bg-info-subtle text-info'
    case 'TL': return 'border-accent/40 bg-accent-subtle text-accent'
    case 'DW': return 'border-warning/40 bg-warning-subtle text-warning-text'
    case 'TW': return 'border-danger/40 bg-danger-subtle text-danger-text'
  }
}

function playerName(players: Player[], userId: string): string {
  return players.find((player) => player.userId === userId)?.username || 'Unknown'
}
