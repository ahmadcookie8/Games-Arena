import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Modal from './Modal'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open settings</button>
      <a href="#outside">Outside link</a>
      <Modal
        isOpen={open}
        title="Run settings"
        primaryAction={{ label: 'Save settings', onClick: () => setOpen(false) }}
        secondaryAction={{ label: 'Cancel', onClick: () => setOpen(false) }}
        onClose={() => setOpen(false)}
      >
        Choose the rules for this run.
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('traps focus, dismisses with Escape, and restores trigger focus', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const trigger = screen.getByRole('button', { name: 'Open settings' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Run settings' })
    expect(dialog).toHaveAccessibleDescription('Choose the rules for this run.')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    for (let index = 0; index < 5; index += 1) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }

    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
