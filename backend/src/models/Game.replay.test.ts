import mongoose from 'mongoose'
import { Game } from './Game'

function replayGame(replay: unknown) {
  const userId = new mongoose.Types.ObjectId()
  return new Game({
    gameType: 'snake',
    gameCode: 'ABCDEFGH',
    players: [{ userId, username: 'alice', index: 0 }],
    currentTurn: userId,
    gameState: {},
    metadata: { mode: 'singlePlayer', ratedGame: false, boardSize: 'small', wallLooping: false },
    replay,
  })
}

describe('Game replay descriptor', () => {
  it('accepts a complete versioned cryptographic seed', () => {
    expect(replayGame({ version: 1, seed: 'a'.repeat(64) }).validateSync()).toBeUndefined()
  })

  it('rejects missing, malformed, or unsupported replay descriptors', () => {
    expect(replayGame({ version: 1 }).validateSync()?.errors['replay.seed']).toBeDefined()
    expect(replayGame({ version: 1, seed: 'short' }).validateSync()?.errors['replay.seed']).toBeDefined()
    expect(replayGame({ version: 2, seed: 'a'.repeat(64) }).validateSync()?.errors['replay.version']).toBeDefined()
  })

  it('does not materialize an empty replay descriptor for legacy games', () => {
    expect(replayGame(undefined).toObject().replay).toBeUndefined()
  })
})

describe('Game coordinated rematch link', () => {
  it('enforces at most one rematch for documents that define rematchOf', () => {
    const rematchIndex = Game.schema.indexes().find(([fields]) => fields.rematchOf === 1)

    expect(rematchIndex).toEqual([
      { rematchOf: 1 },
      {
        unique: true,
        partialFilterExpression: { rematchOf: { $type: 'objectId' } },
        background: true,
      },
    ])
  })
})
