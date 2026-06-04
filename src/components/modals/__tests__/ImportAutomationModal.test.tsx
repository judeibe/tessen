import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { ImportAutomationModal } from '../ImportAutomationModal'

describe('ImportAutomationModal', () => {
  it('calls onSelect when choosing an automation', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <ImportAutomationModal
        isOpen
        automations={[
          {
            id: 'automation.morning_routine',
            alias: 'Morning routine',
            state: 'on',
          },
        ]}
        isLoading={false}
        loadError={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Import Morning routine' }))

    expect(onSelect).toHaveBeenCalledWith('automation.morning_routine')
  })

  it('closes on escape', () => {
    const onClose = vi.fn()

    render(
      <ImportAutomationModal
        isOpen
        automations={[]}
        isLoading={false}
        loadError={null}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <ImportAutomationModal
        isOpen
        automations={[]}
        isLoading={false}
        loadError={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
