import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { NodePalette } from '../NodePalette'

describe('NodePalette', () => {
  it('adds a node when a palette button is clicked', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()

    render(<NodePalette onAddNode={onAddNode} />)

    await user.click(screen.getByRole('button', { name: 'Add Trigger node' }))

    expect(onAddNode).toHaveBeenCalledWith('trigger')
  })

  it('supports keyboard drag simulation with space, arrows, and enter', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()

    render(<NodePalette onAddNode={onAddNode} />)

    const triggerButton = screen.getByRole('button', { name: 'Add Trigger node' })
    triggerButton.focus()

    await user.keyboard('{Space}')
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}')

    expect(onAddNode).toHaveBeenCalledWith('trigger', { x: 360, y: 240 })
    expect(
      screen.getByText('Dropped trigger node on the canvas.'),
    ).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const onAddNode = vi.fn()
    const { container } = render(<NodePalette onAddNode={onAddNode} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
