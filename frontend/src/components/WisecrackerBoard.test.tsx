import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Game, WisecrackerState } from '../types/game'
import type { User } from '../types/user'
import WisecrackerBoard from './WisecrackerBoard'

const user = { _id: 'host', username: 'Host' } as User

function makeGame(state: WisecrackerState, revision = 1): Game {
  return {
    _id: 'game-a',
    revision,
    gameType: 'wisecracker',
    status: 'active',
    gameCode: 'ABCDEFGH',
    players: [
      { userId: 'host', username: 'Host', index: 0, isConnected: true },
      { userId: 'writer-1', username: 'Writer 1', index: 1, isConnected: true },
      { userId: 'writer-2', username: 'Writer 2', index: 2, isConnected: true },
    ],
    currentTurnIndex: 0,
    gameState: state as unknown as Record<string, unknown>,
    moveHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMoveAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeState(overrides: Partial<WisecrackerState> = {}): WisecrackerState {
  return {
    phase: 'prompt',
    hostUserId: 'host',
    maxScore: 3,
    chooserUserId: 'host',
    chooserIndex: 0,
    activePlayerIds: ['host', 'writer-1', 'writer-2'],
    waitingPlayerIds: [],
    prompt: 'Starter _',
    answerSlots: 0,
    submissionStatus: {},
    revealedResponses: [],
    scores: { host: 0, 'writer-1': 0, 'writer-2': 0 },
    roundWinnerResponseId: null,
    matchWinnerUserId: null,
    ...overrides,
  }
}

describe('Wisecracker input reliability', () => {
  it('mounts only one mobile inspector and chat draft tree', async () => {
    const actor = userEvent.setup()
    render(
      <WisecrackerBoard
        game={makeGame(makeState({ phase: 'lobby' }))}
        user={user}
        onMove={vi.fn()}
        onSendChat={vi.fn().mockResolvedValue({ success: true })}
      />,
    )

    await actor.click(screen.getByRole('button', { name: 'Chat' }))
    expect(await screen.findAllByRole('textbox', { name: 'Message this lobby' })).toHaveLength(1)
  })

  it('keeps the host score target as a digit draft and submits the parsed integer', async () => {
    const actor = userEvent.setup()
    const state = makeState({ phase: 'lobby', maxScore: 3 })
    const game = makeGame(state)
    const onMove = vi.fn().mockResolvedValue({ success: true })
    const onSendChat = vi.fn()
    const view = render(<WisecrackerBoard game={game} user={user} onMove={onMove} onSendChat={onSendChat} />)
    const target = screen.getByRole('textbox', { name: 'Points to win' })

    expect(target).toHaveAttribute('inputmode', 'numeric')
    expect(target).toHaveAttribute('pattern', '[0-9]*')
    expect(target).toHaveAttribute('enterkeyhint', 'done')

    await actor.clear(target)
    expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled()
    await actor.type(target, '12')
    expect(target).toHaveValue('12')
    expect(target).toHaveFocus()

    view.rerender(
      <WisecrackerBoard
        game={{
          ...game,
          revision: 2,
          players: game.players.map((player) => player.userId === 'writer-1' ? { ...player, isConnected: false } : player),
        }}
        user={user}
        onMove={onMove}
        onSendChat={onSendChat}
      />,
    )
    expect(target).toHaveValue('12')
    expect(target).toHaveFocus()

    await actor.click(screen.getByRole('button', { name: 'Start match' }))
    expect(onMove).toHaveBeenCalledWith({ type: 'startMatch', maxScore: 12 })
  })

  it('enforces the server prompt and blank limits without resetting a draft on presence updates', async () => {
    const onMove = vi.fn().mockResolvedValue({ success: true })
    const onActionError = vi.fn()
    const game = makeGame(makeState())
    const view = render(<WisecrackerBoard game={game} user={user} onMove={onMove} onSendChat={vi.fn()} onActionError={onActionError} />)
    const prompt = screen.getByLabelText('Your prompt')

    expect(prompt).toHaveAttribute('maxlength', '240')
    await userEvent.clear(prompt)
    await userEvent.type(prompt, 'My ___________ prompt')

    view.rerender(<WisecrackerBoard
      game={{ ...game, revision: 2, players: game.players.map((player) => player.userId === 'writer-1' ? { ...player, isConnected: false } : player) }}
      user={user}
      onMove={onMove}
      onSendChat={vi.fn()}
      onActionError={onActionError}
    />)
    expect(prompt).toHaveValue('My ___________ prompt')

    await userEvent.clear(prompt)
    await userEvent.type(prompt, '_ _ _ _ _ _ _ _ _ _ _')
    expect(screen.getByRole('status')).toHaveTextContent('Use no more than 10 blanks.')
    expect(screen.getByRole('button', { name: 'Use prompt' })).toBeDisabled()
  })

  it('keeps an answer draft through an unrelated same-round update', async () => {
    const writer = { _id: 'writer-1', username: 'Writer 1' } as User
    const state = makeState({ phase: 'answering', answerSlots: 1, prompt: 'Say something funny' })
    const game = makeGame(state)
    const view = render(<WisecrackerBoard game={game} user={writer} onMove={vi.fn()} onSendChat={vi.fn()} />)
    const answer = screen.getByLabelText('Your answer 160 left')

    expect(answer).toHaveAttribute('maxlength', '160')
    await userEvent.type(answer, 'A draft that should stay')
    view.rerender(<WisecrackerBoard
      game={{ ...game, revision: 2, players: game.players.map((player) => player.userId === 'writer-2' ? { ...player, isConnected: false } : player) }}
      user={writer}
      onMove={vi.fn()}
      onSendChat={vi.fn()}
    />)
    expect(answer).toHaveValue('A draft that should stay')
  })

  it('enforces exact prompt and answer boundaries with remaining-character feedback', () => {
    const promptGame = makeGame(makeState())
    const promptView = render(
      <WisecrackerBoard game={promptGame} user={user} onMove={vi.fn()} onSendChat={vi.fn()} />,
    )
    const prompt = screen.getByLabelText('Your prompt')
    fireEvent.change(prompt, { target: { value: 'x'.repeat(240) } })
    expect(prompt).toHaveValue('x'.repeat(240))
    expect(screen.getByText(/0 characters remaining/)).toBeInTheDocument()

    promptView.unmount()
    const writer = { _id: 'writer-1', username: 'Writer 1' } as User
    render(
      <WisecrackerBoard
        game={makeGame(makeState({ phase: 'answering', answerSlots: 1, prompt: 'Answer _' }))}
        user={writer}
        onMove={vi.fn()}
        onSendChat={vi.fn()}
      />,
    )
    const answer = screen.getByLabelText('Your answer 160 left')
    fireEvent.change(answer, { target: { value: 'y'.repeat(160) } })
    expect(answer).toHaveValue('y'.repeat(160))
    expect(screen.getByLabelText('Your answer 0 left')).toBe(answer)
  })

  it('preserves a rejected answer, locks it after success, and clears it for a new round', async () => {
    const writer = { _id: 'writer-1', username: 'Writer 1' } as User
    const state = makeState({ phase: 'answering', answerSlots: 1, prompt: 'Answer _' })
    const game = makeGame(state)
    const onMove = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'The round changed. Try again.' })
      .mockResolvedValueOnce({ success: true })
    const onActionError = vi.fn()
    const view = render(
      <WisecrackerBoard game={game} user={writer} onMove={onMove} onSendChat={vi.fn()} onActionError={onActionError} />,
    )
    const answer = screen.getByLabelText('Your answer 160 left')
    await userEvent.type(answer, 'Keep this draft')
    await userEvent.click(screen.getByRole('button', { name: 'Lock in answers' }))

    await waitFor(() => expect(onActionError).toHaveBeenCalledWith('The round changed. Try again.', expect.any(HTMLElement)))
    expect(answer).toHaveValue('Keep this draft')
    await userEvent.click(screen.getByRole('button', { name: 'Lock in answers' }))
    expect(await screen.findByText('Answers locked in')).toBeInTheDocument()

    view.rerender(
      <WisecrackerBoard
        game={{
          ...makeGame(state, 2),
          moveHistory: [{
            moveNumber: 1,
            playerId: 'host',
            playerName: 'Host',
            move: 'started the next round',
            timestamp: '2026-01-01T00:01:00.000Z',
          }],
        }}
        user={writer}
        onMove={onMove}
        onSendChat={vi.fn()}
        onActionError={onActionError}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText('Your answer 160 left')).toHaveValue(''))
  })
})
