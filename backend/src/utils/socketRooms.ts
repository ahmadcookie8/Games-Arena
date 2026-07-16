export function userRoom(userId: string): string {
  return `user:${userId}`
}

export function gameUserRoom(gameId: string, userId: string): string {
  return `game:${gameId}:user:${userId}`
}
