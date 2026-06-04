import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { ErrorModal } from '../ErrorModal'

describe('ErrorModal', () => {
  it('renders retry and close actions', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onClose = vi.fn()

    render(
      <ErrorModal
        isOpen
        title="Save failed"
        message="Could not save."
        onRetry={onRetry}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on escape', () => {
    const onClose = vi.fn()

    render(
      <ErrorModal
        isOpen
        title="Connection error"
        message="No connection."
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <ErrorModal
        isOpen
        title="Validation error"
        message="Invalid automation"
        onClose={vi.fn()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
