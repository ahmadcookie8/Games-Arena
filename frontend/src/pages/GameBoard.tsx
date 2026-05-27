import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'
import TicTacToeBoard from '../components/TicTacToeBoard'
import WisecrackerBoard from '../components/WisecrackerBoard'
import MoveHistory from '../components/MoveHistory'
import PlayerCard from '../components/PlayerCard'
import { Game } from '../types/game'
import { getGameLabel } from '../lib/gameRules'

interface MoveResponse {
  success: boolean
  game?: Game
  error?: string
}

export default function GameBoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { game, loading, setGame } = useGameState(gameId)
  const { emit, on, connected } = useSocket()

  useEffect(() => {
    if (!gameId || !connected) return
    emit('joinRoom', { gameId }, (res: { game?: Game; error?: string }) => {
      if (res.game) setGame(res.game)
    })

    const offGameUpdated = on('gameUpdated', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    const offMoveMade = on('moveMade', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    const offGameOver = on('gameOver', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    return () => {
      offGameUpdated()
      offMoveMade()
      offGameOver()
    }
  }, [gameId, connected, emit, on, setGame])

  function handleMove(move: unknown): Promise<MoveResponse> {
    return new Promise((resolve) => {
      emit('makeMove', { gameId, move }, (res: MoveResponse) => {
        if (res.game) setGame(res.game)
        if (!res.success) alert(res.error)
        resolve(res)
      })
    })
  }

  function handleTicTacToeMove(move: string) {
    void handleMove(move)
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>
  if (!game) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Game not found</div>

  const myIndex = game.players.findIndex((p) => p.userId === user?._id)
  const minPlayers = game.gameType === 'wisecracker' ? 3 : 2
  const isWaitingForPlayer = game.players.length < minPlayers && game.gameType !== 'wisecracker'
  const isCompleted = game.status === 'completed'
  const isMyTurn = !isWaitingForPlayer && !isCompleted && game.currentTurnIndex === myIndex
  const currentPlayer = game.players[game.currentTurnIndex]
  const resultText = game.result?.isDraw
    ? 'Draw'
    : game.result?.winnerName
      ? `${game.result.winnerName} won`
      : null

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">← Back</button>
        <div className="text-center">
          <h1 className="text-xl font-semibold">{getGameLabel(game.gameType)}</h1>
          <p className="text-sm text-gray-400">Code: {game.gameCode}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
          {game.gameType === 'wisecracker' ? game.status : isCompleted ? resultText : isWaitingForPlayer ? 'Waiting for player' : isMyTurn ? 'Your turn' : `${currentPlayer?.username}'s turn`}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          {isWaitingForPlayer && (
            <div className="mb-4 rounded-xl bg-gray-800 p-4 text-center text-gray-300">
              Share code <span className="font-mono text-white">{game.gameCode}</span> with another player to start.
            </div>
          )}
          {isCompleted && resultText && (
            <div className="mb-4 rounded-xl bg-gray-800 p-4 text-center text-green-300">
              Game over: {resultText}
            </div>
          )}
          {game.gameType === 'ticTacToe' && <TicTacToeBoard gameState={game.gameState} isMyTurn={isMyTurn} onMove={handleTicTacToeMove} />}
          {game.gameType === 'wisecracker' && <WisecrackerBoard game={game} user={user} onMove={handleMove} />}
        </div>
        <aside className="w-64">
          <div className="space-y-2 mb-4">
            <h3 className="font-semibold mb-2">Players</h3>
            {game.players.map((p, i) => (
              <PlayerCard key={p.userId} player={p} isCurrentTurn={!isCompleted && i === game.currentTurnIndex} />
            ))}
          </div>
          <MoveHistory moves={game.moveHistory} />
        </aside>
      </div>
    </div>
  )
}
