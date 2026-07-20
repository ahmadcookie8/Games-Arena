import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import './player-avatar.css'

export type PlayerAvatarSize = 'sm' | 'md' | 'lg'
export type PlayerAvatarStatus = 'online' | 'offline' | 'turn'

export interface PlayerAvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: string
  size?: PlayerAvatarSize
  accent?: string
  status?: PlayerAvatarStatus
  ariaLabel?: string
}

export function getPlayerInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized) return '?'

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
  }

  return normalized.slice(0, 2).toUpperCase()
}

export default function PlayerAvatar({
  name,
  size = 'md',
  accent,
  status,
  ariaLabel,
  className,
  style,
  ...props
}: PlayerAvatarProps) {
  const avatarStyle = {
    ...style,
    ...(accent ? { '--player-avatar-accent': accent } : {}),
  } as CSSProperties

  return (
    <span
      className={cn('player-avatar', `player-avatar--${size}`, className)}
      style={avatarStyle}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...props}
    >
      <span className="player-avatar__initials">{getPlayerInitials(name)}</span>
      {status && <span className={`player-avatar__status player-avatar__status--${status}`} />}
    </span>
  )
}
