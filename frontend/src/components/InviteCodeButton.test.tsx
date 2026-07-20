import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InviteCodeButton from './InviteCodeButton'

describe('InviteCodeButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('copies an active invite code and announces success', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    render(<InviteCodeButton gameCode="ABC23456" />)

    await user.click(screen.getByRole('button', { name: /copy invite code abc23456/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ABC23456'))
    expect(screen.getByRole('status')).toHaveTextContent('Invite code copied')
  })

  it('reports clipboard failures with the originating control', async () => {
    const user = userEvent.setup()
    const onCopyError = vi.fn()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('blocked'))
    render(<InviteCodeButton gameCode="ABC23456" onCopyError={onCopyError} />)

    const button = screen.getByRole('button', { name: /copy invite code abc23456/i })
    await user.click(button)

    await waitFor(() => expect(onCopyError).toHaveBeenCalledWith(expect.stringContaining('could not be copied'), button))
    expect(onCopyError).toHaveBeenCalledWith(expect.stringContaining('ABC23456'), button)
  })

  it('renders completed game codes without an invite action', () => {
    render(<InviteCodeButton gameCode="ABC23456" copyable={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('ABC23456')).toBeInTheDocument()
  })
})
