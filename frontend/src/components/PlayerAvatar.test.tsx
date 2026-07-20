import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PlayerAvatar, { getPlayerInitials } from './PlayerAvatar'

describe('PlayerAvatar', () => {
  it('derives stable one and two-part initials', () => {
    expect(getPlayerInitials('Taylor')).toBe('TA')
    expect(getPlayerInitials('Taylor Example')).toBe('TE')
    expect(getPlayerInitials('')).toBe('?')
  })

  it('is decorative beside a visible player name by default', () => {
    const { container } = render(<PlayerAvatar name="Taylor Example" status="online" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('TE')).toBeInTheDocument()
  })

  it('can expose an explicit accessible label', () => {
    render(<PlayerAvatar name="Taylor Example" ariaLabel="Taylor Example, online" status="online" />)
    expect(screen.getByLabelText('Taylor Example, online')).toBeInTheDocument()
  })
})
