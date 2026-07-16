# Games Arena deterministic game engine

This package is the single Snake and Maze Chase simulation used by both the
browser and backend replay verifier. It intentionally has no runtime
dependencies and exposes matching CommonJS and ESM entry points.

## Replay format

```ts
interface ReplayV1 {
  version: 1
  tickCount: number
  inputs: Array<{
    tick: number
    direction: 'up' | 'down' | 'left' | 'right'
  }>
}
```

Inputs are accepted direction changes, ordered by a unique zero-based active
simulation tick. Paused time and Maze Chase life-reset countdowns do not
advance `tickCount`. The server supplies the 64-hex seed and derives the final
state, score, and completion; none of those values belong in the replay body.

Limits are exported as `MAX_REPLAY_TICKS` and `MAX_REPLAY_INPUTS`. Replays with
ticks after the first canonical game-over state are rejected.
