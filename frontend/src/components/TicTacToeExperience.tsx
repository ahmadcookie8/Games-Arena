import { useEffect, useMemo, useState } from 'react'
import { Bot, Clock3, History, MessageCircle, Radio, Users } from 'lucide-react'
import GameChat from './GameChat'
import MoveHistory from './MoveHistory'
import { TabletopBottomSheet, TabletopTabs } from './TabletopShell'
import type { TabletopTab } from './TabletopShell'
import {
  formatTicTacToeMove,
  getLatestTicTacToeMoveIndex,
  getTicTacToeParticipants,
  getTicTacToeWinningLine,
  normalizeTicTacToeBoard,
  resolveTicTacToeActionMode,
  TicTacToeActionMode,
  TicTacToeParticipant,
  TicTacToeSymbol,
} from '../lib/ticTacToeUi'
import { Game, GameMode, TicTacToeDifficulty } from '../types/game'
import TicTacToeBoard, { TicTacToeMark } from './TicTacToeBoard'

type InspectorTabId = 'players' | 'history' | 'chat'

interface ChatResponse {
  success: boolean
  error?: string
}

export interface TicTacToeExperienceProps {
  game: Game
  currentUserId?: string
  connected?: boolean
  isMoving?: boolean
  isReplaying?: boolean
  onMove: (move: string) => void | Promise<unknown>
  onPlayAgain?: () => void | Promise<unknown>
  onDifficultyChange?: (difficulty: TicTacToeDifficulty) => void | Promise<unknown>
  onSendChat?: (text: string) => Promise<ChatResponse>
}

const DIFFICULTIES: readonly TicTacToeDifficulty[] = ['easy', 'medium', 'hard']
const DESKTOP_QUERY = '(min-width: 1120px)'

export default function TicTacToeExperience({
  game,
  currentUserId,
  connected = true,
  isMoving = false,
  isReplaying = false,
  onMove,
  onPlayAgain,
  onDifficultyChange,
  onSendChat,
}: TicTacToeExperienceProps) {
  const [activeTab, setActiveTab] = useState<InspectorTabId>('players')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const isDesktop = useDesktopLayout()

  const mode: GameMode = game.metadata?.mode === 'singlePlayer' ? 'singlePlayer' : 'multiplayer'
  const difficulty = game.metadata?.difficulty || 'easy'
  const board = normalizeTicTacToeBoard(game.gameState.board)
  const currentSymbol: TicTacToeSymbol = game.gameState.currentSymbol === 'O' ? 'O' : 'X'
  const winningLine = getTicTacToeWinningLine(board)
  const winningSymbol = winningLine ? board[winningLine[0]] : null
  const displaySymbol = winningSymbol || currentSymbol
  const latestMoveIndex = getLatestTicTacToeMoveIndex(game.moveHistory)
  const participants = getTicTacToeParticipants(game.players, mode, difficulty)
  const myParticipant = participants.find((participant) => participant.id === currentUserId)
  const isWaitingForPlayer = mode === 'multiplayer' && game.players.length < 2
  const isActive = game.status === 'active'
  const isMyTurn = isActive
    && !isWaitingForPlayer
    && !isMoving
    && (mode === 'singlePlayer'
      ? game.players[0]?.userId === currentUserId
      : game.players[game.currentTurnIndex]?.userId === currentUserId)
  const currentParticipant = mode === 'singlePlayer' && isMoving
    ? participants.find((participant) => participant.isComputer)
    : participants[game.currentTurnIndex]
  const turnText = game.status === 'completed'
    ? 'Complete'
    : isWaitingForPlayer
      ? 'Waiting for player'
      : currentParticipant
        ? `${currentParticipant.name} / ${currentSymbol}`
        : 'Pending'
  const actionMode = resolveTicTacToeActionMode({
    status: game.status,
    mode,
    playerCount: game.players.length,
    isMyTurn,
    isMoving,
  })
  const resultText = getResultText(game, currentUserId)
  const latestMove = game.moveHistory[game.moveHistory.length - 1]
  const latestEvent = latestMove
    ? `${latestMove.playerName} chose ${formatTicTacToeMove(latestMove.move).toLowerCase()}`
    : 'The board is ready for the opening move'
  const disconnectedParticipants = participants.filter((participant) => !participant.isConnected)
  const connectionText = !connected
    ? 'Reconnecting'
    : disconnectedParticipants.length > 0
      ? `${disconnectedParticipants[0].name} is offline`
      : mode === 'singlePlayer'
        ? 'Solo game ready'
        : 'Table connected'
  const settingsLocked = game.moveHistory.length > 0 || !isActive || isMoving

  const inspectorTabs = useMemo<TabletopTab[]>(() => {
    const tabs: TabletopTab[] = [
      { id: 'players', label: 'Players', icon: Users },
      { id: 'history', label: 'History', icon: History, badge: game.moveHistory.length || undefined },
    ]

    if (mode === 'multiplayer') {
      tabs.push({
        id: 'chat',
        label: 'Chat',
        icon: MessageCircle,
        badge: game.chatMessages?.length || undefined,
      })
    }

    return tabs
  }, [game.chatMessages?.length, game.moveHistory.length, mode])

  useEffect(() => {
    if (isDesktop) setIsSheetOpen(false)
  }, [isDesktop])

  useEffect(() => {
    if (mode === 'singlePlayer' && activeTab === 'chat') setActiveTab('players')
  }, [activeTab, mode])

  async function copyInviteCode() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable')
      await navigator.clipboard.writeText(game.gameCode)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
    }
  }

  function selectMobileTab(tabId: string) {
    setActiveTab(tabId as InspectorTabId)
    setIsSheetOpen(true)
  }

  function renderInspectorContent() {
    if (activeTab === 'players') {
      return (
        <PlayersPanel
          participants={participants}
          currentParticipantId={currentParticipant?.id}
          currentUserId={currentUserId}
          connected={connected}
        />
      )
    }

    if (activeTab === 'history') {
      return <MoveHistory moves={game.moveHistory} variant="embedded" formatMove={(move) => formatTicTacToeMove(move.move)} />
    }

    return (
      <GameChat
        messages={game.chatMessages || []}
        currentUserId={currentUserId}
        onSend={onSendChat || unavailableChat}
        variant="embedded"
      />
    )
  }

  const desktopIdBase = `ttt-${game._id}-desktop`
  const mobileIdBase = `ttt-${game._id}-mobile`
  const activeTabLabel = inspectorTabs.find((tab) => tab.id === activeTab)?.label || 'Table details'

  return (
    <div className="ttt-experience">
      <div className="ttt-layout">
        <div className="ttt-main">
          <TicTacToeHud
            participants={participants}
            myParticipant={myParticipant}
            turnText={turnText}
            moveCount={game.moveHistory.length}
            connectionText={connectionText}
            isConnectionWarning={!connected || disconnectedParticipants.length > 0}
            difficulty={mode === 'singlePlayer' ? difficulty : undefined}
            latestEvent={game.status === 'completed' ? resultText : latestEvent}
          />

          <section className="ttt-table" aria-labelledby="ttt-board-heading">
            <div className="ttt-table__heading">
              <div>
                <p className="ttt-eyebrow">Raised tabletop</p>
                <h2 id="ttt-board-heading">Three in a row</h2>
              </div>
              <span className={`ttt-turn-chip ttt-turn-chip--${displaySymbol.toLowerCase()}`}>
                <TicTacToeMark symbol={displaySymbol} size="small" />
                {game.status === 'completed' ? 'Final board' : `${currentSymbol} to play`}
              </span>
            </div>

            <div className="ttt-board-stage">
              <TicTacToeBoard
                gameState={game.gameState}
                isMyTurn={isMyTurn}
                isBusy={isMoving}
                isComplete={game.status === 'completed'}
                onMove={(move) => { void onMove(move) }}
                latestMoveIndex={latestMoveIndex}
                winningCells={winningLine || []}
                disabledReason={getDisabledBoardReason(actionMode, currentParticipant?.name)}
              />
            </div>
          </section>

          <CurrentAction
            actionMode={actionMode}
            gameCode={game.gameCode}
            currentParticipantName={currentParticipant?.name}
            resultText={resultText}
            mode={mode}
            difficulty={difficulty}
            settingsLocked={settingsLocked}
            isReplaying={isReplaying}
            copyStatus={copyStatus}
            onCopyCode={() => { void copyInviteCode() }}
            onPlayAgain={onPlayAgain}
            onDifficultyChange={onDifficultyChange}
          />
        </div>

        {isDesktop && (
          <aside className="ttt-inspector" aria-label="Tic Tac Toe table details">
            <TabletopTabs
              tabs={inspectorTabs}
              activeTab={activeTab}
              onSelect={(tabId) => setActiveTab(tabId as InspectorTabId)}
              ariaLabel="Tic Tac Toe table details"
              idBase={desktopIdBase}
            />
            <div
              className="ttt-inspector__panel"
              id={`${desktopIdBase}-panel`}
              role="tabpanel"
              aria-labelledby={`${desktopIdBase}-tab-${activeTab}`}
            >
              {renderInspectorContent()}
            </div>
          </aside>
        )}
      </div>

      {!isDesktop && (
        <>
          <nav className="ttt-mobile-dock" aria-label="Tic Tac Toe table details">
            <TabletopTabs
              tabs={inspectorTabs}
              activeTab={activeTab}
              onSelect={selectMobileTab}
              ariaLabel="Open Tic Tac Toe table details"
              idBase={mobileIdBase}
              variant="dock"
            />
          </nav>
          <TabletopBottomSheet
            isOpen={isSheetOpen}
            title={activeTabLabel}
            onClose={() => setIsSheetOpen(false)}
          >
            <div
              className="ttt-inspector__panel ttt-inspector__panel--sheet"
              id={`${mobileIdBase}-panel`}
              role="tabpanel"
              aria-labelledby={`${mobileIdBase}-tab-${activeTab}`}
            >
              {renderInspectorContent()}
            </div>
          </TabletopBottomSheet>
        </>
      )}
    </div>
  )
}

function TicTacToeHud({
  participants,
  myParticipant,
  turnText,
  moveCount,
  connectionText,
  isConnectionWarning,
  difficulty,
  latestEvent,
}: {
  participants: TicTacToeParticipant[]
  myParticipant?: TicTacToeParticipant
  turnText: string
  moveCount: number
  connectionText: string
  isConnectionWarning: boolean
  difficulty?: TicTacToeDifficulty
  latestEvent: string
}) {
  const matchup = participants.length > 0
    ? participants.map((participant) => `${participant.name} (${participant.symbol})`).join(' vs ')
    : 'Waiting for players'

  return (
    <dl className="ttt-hud" aria-label="Match overview">
      <div className="ttt-hud__item ttt-hud__item--matchup">
        <dt>Players</dt>
        <dd title={matchup}>{matchup}</dd>
      </div>
      <div className="ttt-hud__item">
        <dt>Your mark</dt>
        <dd>{myParticipant ? <><TicTacToeMark symbol={myParticipant.symbol} size="small" /> {myParticipant.symbol}</> : 'Spectating'}</dd>
      </div>
      <div className="ttt-hud__item">
        <dt>Turn</dt>
        <dd>{turnText}</dd>
      </div>
      <div className="ttt-hud__item">
        <dt>Moves</dt>
        <dd><Clock3 aria-hidden="true" /> {moveCount} / 9</dd>
      </div>
      {difficulty && (
        <div className="ttt-hud__item">
          <dt>Difficulty</dt>
          <dd className="ttt-capitalize"><Bot aria-hidden="true" /> {difficulty}</dd>
        </div>
      )}
      <div className={`ttt-hud__item${isConnectionWarning ? ' ttt-hud__item--warning' : ''}`}>
        <dt>Connection</dt>
        <dd><Radio aria-hidden="true" /> {connectionText}</dd>
      </div>
      <div className="ttt-hud__item ttt-hud__item--event">
        <dt>Latest</dt>
        <dd>{latestEvent}</dd>
      </div>
    </dl>
  )
}

function CurrentAction({
  actionMode,
  gameCode,
  currentParticipantName,
  resultText,
  mode,
  difficulty,
  settingsLocked,
  isReplaying,
  copyStatus,
  onCopyCode,
  onPlayAgain,
  onDifficultyChange,
}: {
  actionMode: TicTacToeActionMode
  gameCode: string
  currentParticipantName?: string
  resultText: string
  mode: GameMode
  difficulty: TicTacToeDifficulty
  settingsLocked: boolean
  isReplaying: boolean
  copyStatus: 'idle' | 'copied' | 'failed'
  onCopyCode: () => void
  onPlayAgain?: () => void | Promise<unknown>
  onDifficultyChange?: (difficulty: TicTacToeDifficulty) => void | Promise<unknown>
}) {
  const content = getActionCopy(actionMode, currentParticipantName, resultText)

  return (
    <section className={`ttt-action ttt-action--${actionMode}`} aria-labelledby="ttt-current-action-heading" aria-live="polite">
      <div className="ttt-action__copy">
        <p className="ttt-eyebrow">Current action</p>
        <h2 id="ttt-current-action-heading">{content.title}</h2>
        <p>{content.description}</p>
      </div>

      {actionMode === 'waitingForPlayer' && (
        <div className="ttt-invite">
          <span className="ttt-invite__code" aria-label={`Game code ${gameCode}`}>{gameCode}</span>
          <button type="button" className="ttt-button ttt-button--primary" onClick={onCopyCode}>
            {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Try copy again' : 'Copy code'}
          </button>
        </div>
      )}

      {actionMode === 'computerThinking' && <span className="ttt-thinking" aria-hidden="true" />}

      {actionMode === 'complete' && onPlayAgain && (
        <button
          type="button"
          className="ttt-button ttt-button--primary"
          onClick={() => { void onPlayAgain() }}
          disabled={isReplaying}
        >
          {isReplaying ? 'Starting...' : 'Play Again'}
        </button>
      )}

      {mode === 'singlePlayer' && (actionMode === 'play' || actionMode === 'computerThinking') && (
        <fieldset className="ttt-difficulty" disabled={settingsLocked || !onDifficultyChange}>
          <legend>
            Difficulty
            <span>{settingsLocked ? 'Locked after the first move' : 'Choose before move one'}</span>
          </legend>
          <div className="ttt-difficulty__options">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                className={`ttt-difficulty__option${difficulty === level ? ' ttt-difficulty__option--selected' : ''}`}
                aria-pressed={difficulty === level}
                onClick={() => { void onDifficultyChange?.(level) }}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  )
}

function PlayersPanel({
  participants,
  currentParticipantId,
  currentUserId,
  connected,
}: {
  participants: TicTacToeParticipant[]
  currentParticipantId?: string
  currentUserId?: string
  connected: boolean
}) {
  return (
    <div className="ttt-players">
      {participants.map((participant) => {
        const isCurrent = participant.id === currentParticipantId
        const isMe = participant.id === currentUserId
        const isConnected = participant.isComputer || (participant.isConnected && (!isMe || connected))

        return (
          <article key={participant.id} className={`ttt-player${isCurrent ? ' ttt-player--current' : ''}`}>
            <span className={`ttt-player__mark ttt-player__mark--${participant.symbol.toLowerCase()}`}>
              <TicTacToeMark symbol={participant.symbol} size="small" />
            </span>
            <div className="ttt-player__copy">
              <h3>{participant.name}</h3>
              <p className={isConnected ? 'ttt-player__online' : 'ttt-player__offline'}>
                {participant.isComputer ? 'Computer opponent' : isConnected ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className="ttt-player__badges">
              {isMe && <span>You</span>}
              {participant.isComputer && <span>CPU</span>}
              {isCurrent && <span>Turn</span>}
            </div>
          </article>
        )
      })}
      {participants.length < 2 && (
        <p className="ttt-players__empty">The second seat is ready for another player.</p>
      )}
    </div>
  )
}

function getActionCopy(actionMode: TicTacToeActionMode, currentPlayerName: string | undefined, resultText: string) {
  switch (actionMode) {
    case 'complete':
      return { title: resultText, description: 'The final line is highlighted on the board.' }
    case 'waitingForPlayer':
      return { title: 'Invite your opponent', description: 'Share the private code. Play begins as soon as the second seat is filled.' }
    case 'computerThinking':
      return { title: 'Computer is thinking', description: 'Your move is in. The opponent is choosing a response.' }
    case 'play':
      return { title: 'Your move', description: 'Choose any open square and build a line of three.' }
    case 'waitingTurn':
      return { title: `${currentPlayerName || 'Opponent'} is up`, description: 'The board will update as soon as the next move lands.' }
    case 'closed':
      return { title: 'Game closed', description: 'This table is no longer accepting moves.' }
  }
}

function getDisabledBoardReason(actionMode: TicTacToeActionMode, currentPlayerName?: string): string {
  switch (actionMode) {
    case 'complete': return 'game complete'
    case 'waitingForPlayer': return 'waiting for another player'
    case 'computerThinking': return 'computer is thinking'
    case 'waitingTurn': return `waiting for ${currentPlayerName || 'the other player'}`
    case 'closed': return 'game closed'
    case 'play': return 'square unavailable'
  }
}

function getResultText(game: Game, currentUserId?: string): string {
  if (game.result?.isDraw) return 'Draw game'
  if (!game.result?.winnerName) return game.status === 'completed' ? 'Game complete' : 'Game in progress'
  if (game.result.winner && String(game.result.winner) === currentUserId) return 'You won'
  return `${game.result.winnerName} won`
}

async function unavailableChat(): Promise<ChatResponse> {
  return { success: false, error: 'Chat is unavailable for this table.' }
}

function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}
