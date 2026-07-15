import { Wisecracker, WisecrackerState } from './Wisecracker'

const players = [
  { userId: 'user1', username: 'Host' },
  { userId: 'user2', username: 'Second' },
  { userId: 'user3', username: 'Third' },
]

function stateWithPlayers(): WisecrackerState {
  let state = Wisecracker.createInitialState('user1')
  state = Wisecracker.addPlayer(state, 'user2')
  state = Wisecracker.addPlayer(state, 'user3')
  return state
}

describe('Wisecracker', () => {
  it('requires at least three players to start', () => {
    const state = Wisecracker.createInitialState('user1')

    expect(() => Wisecracker.applyAction(state, { type: 'startMatch', maxScore: 3 }, 'user1', players.slice(0, 1))).toThrow('at least 3 players')
  })

  it('counts prompt blanks and moves to answering', () => {
    const state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 3 }, 'user1', players)
    const chooser = state.chooserUserId!
    const next = Wisecracker.applyAction(state, { type: 'setPrompt', prompt: 'A _ needs _.' }, chooser, players)

    expect(next.phase).toBe('answering')
    expect(next.answerSlots).toBe(2)
  })

  it('lets the chooser refresh the generated prompt during prompt phase', () => {
    const state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 3 }, 'user1', players)
    const next = Wisecracker.applyAction(state, { type: 'refreshPrompt' }, state.chooserUserId!, players)

    expect(next.phase).toBe('prompt')
    expect(next.prompt).toBeTruthy()
    expect(next.answerSlots).toBe(0)
  })

  it('blocks non-choosers and locked prompts from refreshing', () => {
    let state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 3 }, 'user1', players)
    const nonChooser = state.activePlayerIds.find((id) => id !== state.chooserUserId)!

    expect(() => Wisecracker.applyAction(state, { type: 'refreshPrompt' }, nonChooser, players)).toThrow('Only the chooser')

    state = Wisecracker.applyAction(state, { type: 'setPrompt', prompt: 'A _.' }, state.chooserUserId!, players)
    expect(() => Wisecracker.applyAction(state, { type: 'refreshPrompt' }, state.chooserUserId!, players)).toThrow('refresh the prompt')
  })

  it('moves to reveal after every typer submits', () => {
    let state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 3 }, 'user1', players)
    state = Wisecracker.applyAction(state, { type: 'setPrompt', prompt: 'A _.' }, state.chooserUserId!, players)
    const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)

    state = Wisecracker.applyAction(state, { type: 'submitAnswers', answers: ['first'] }, typers[0], players)
    expect(state.phase).toBe('answering')
    state = Wisecracker.applyAction(state, { type: 'submitAnswers', answers: ['second'] }, typers[1], players)

    expect(state.phase).toBe('revealing')
    expect(state.answerOrder).toHaveLength(2)
  })

  it('adds mid-round joins as waiting players until the next round', () => {
    let state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 3 }, 'user1', players)
    state = Wisecracker.addPlayer(state, 'user4')

    expect(state.activePlayerIds).not.toContain('user4')
    expect(state.waitingPlayerIds).toContain('user4')
  })

  it('recovers persisted states whose empty collections were omitted', () => {
    let state = Wisecracker.applyAction(stateWithPlayers(), { type: 'startMatch', maxScore: 1 }, 'user1', players)
    state = Wisecracker.applyAction(state, { type: 'setPrompt', prompt: 'A _.' }, state.chooserUserId!, players)
    delete (state as Partial<WisecrackerState>).submittedAnswers
    delete (state as Partial<WisecrackerState>).answerOrder
    delete (state as Partial<WisecrackerState>).waitingPlayerIds

    const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)
    state = Wisecracker.applyAction(state, { type: 'submitAnswers', answers: ['first'] }, typers[0], players)
    state = Wisecracker.applyAction(state, { type: 'submitAnswers', answers: ['second'] }, typers[1], players)
    state = Wisecracker.applyAction(state, { type: 'revealNextAnswer' }, state.chooserUserId!, players)
    state = Wisecracker.applyAction(state, { type: 'revealNextAnswer' }, state.chooserUserId!, players)
    state = Wisecracker.applyAction(state, { type: 'selectRoundWinner', userId: typers[0] }, state.chooserUserId!, players)

    expect(state.phase).toBe('completed')
    state = Wisecracker.applyAction(state, { type: 'returnToLobby' }, 'user1', players)
    expect(state.phase).toBe('lobby')
    expect(state.submittedAnswers).toEqual({})
    expect(state.answerOrder).toEqual([])
    expect(state.waitingPlayerIds).toEqual([])
  })
})
