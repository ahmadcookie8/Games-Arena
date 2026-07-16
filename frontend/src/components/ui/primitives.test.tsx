import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '.'

describe('form and action primitives', () => {
  it.each([
    ['primary', 'ui-action-primary'],
    ['secondary', 'bg-surface'],
    ['ghost', 'bg-transparent'],
    ['success', 'ui-action-success'],
    ['danger', 'ui-action-danger'],
  ] as const)('renders the %s button treatment', (variant, expectedClass) => {
    render(<Button variant={variant}>{variant} action</Button>)
    expect(screen.getByRole('button', { name: `${variant} action` })).toHaveClass(expectedClass)
  })

  it('associates visible labels, hints, and errors with a field', () => {
    render(
      <Field
        id="player-name"
        label="Player name"
        hint="Shown to everyone in the room."
        error="Choose at least three characters."
        required
      >
        <Input name="playerName" required />
      </Field>,
    )

    const input = screen.getByRole('textbox', { name: /player name/i })
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Choose at least three characters. Shown to everyone in the room.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least three characters.')
  })

  it('locks a pending action and exposes its busy state', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button loading loadingText="Creating room" onClick={onClick}>
        Create room
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Creating room' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveClass('ui-action-primary')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('keyboard interaction primitives', () => {
  it('supports Arrow, Home, and End navigation across tabs', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="lobby">
        <TabsList aria-label="Arena view">
          <TabsTrigger value="lobby">Lobby</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>
        <TabsContent value="lobby">Lobby panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
        <TabsContent value="stats">Stats panel</TabsContent>
      </Tabs>,
    )

    const lobby = screen.getByRole('tab', { name: 'Lobby' })
    const history = screen.getByRole('tab', { name: 'History' })
    const stats = screen.getByRole('tab', { name: 'Stats' })

    lobby.focus()
    await user.keyboard('{ArrowRight}')
    expect(history).toHaveFocus()
    expect(history).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(stats).toHaveFocus()
    expect(stats).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(lobby).toHaveFocus()
    expect(lobby).toHaveAttribute('aria-selected', 'true')
  })

  it('dismisses a dropdown with Escape and restores trigger focus', async () => {
    const user = userEvent.setup()

    function ExampleMenu() {
      const [open, setOpen] = useState(false)
      return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Game options</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Copy code</DropdownMenuItem>
            <DropdownMenuItem tone="danger">Close game</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    render(<ExampleMenu />)
    const trigger = screen.getByRole('button', { name: 'Game options' })
    await user.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Copy code' })).toBeVisible()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem', { name: 'Copy code' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('exposes segmented choices as a radio group with roving keyboard focus', async () => {
    const user = userEvent.setup()

    function ExampleSegments() {
      const [value, setValue] = useState('multiplayer')
      return (
        <SegmentedControl
          ariaLabel="Game mode"
          value={value}
          onValueChange={setValue}
          items={[
            { value: 'multiplayer', label: 'Multiplayer' },
            { value: 'solo', label: 'Single player' },
            { value: 'practice', label: 'Practice' },
          ]}
        />
      )
    }

    render(<ExampleSegments />)
    const multiplayer = screen.getByRole('radio', { name: 'Multiplayer' })
    const solo = screen.getByRole('radio', { name: 'Single player' })
    const practice = screen.getByRole('radio', { name: 'Practice' })

    multiplayer.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(solo).toHaveFocus())
    expect(solo).toBeChecked()

    await user.keyboard('{End}')
    await waitFor(() => expect(practice).toHaveFocus())
    expect(practice).toBeChecked()

    await user.keyboard('{Home}')
    await waitFor(() => expect(multiplayer).toHaveFocus())
    expect(multiplayer).toBeChecked()
  })
})
