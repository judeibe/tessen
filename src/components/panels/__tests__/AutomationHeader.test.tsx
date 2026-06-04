import type { ComponentProps } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { AutomationHeader } from '../AutomationHeader'

function renderHeader(overrides: Partial<ComponentProps<typeof AutomationHeader>> = {}) {
  const props: ComponentProps<typeof AutomationHeader> = {
    alias: 'Morning routine',
    description: 'Starts every day',
    isDirty: true,
    isSaving: false,
    lastSavedAt: new Date().toISOString(),
    saveError: null,
    onAliasChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onSave: vi.fn(),
    onImport: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: true,
    ...overrides,
  }

  return {
    ...render(<AutomationHeader {...props} />),
    props,
  }
}

describe('AutomationHeader', () => {
  it('triggers action callbacks from header controls', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(
      screen.getByRole('button', { name: 'Import automation from Home Assistant' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save automation' }))
    await user.click(screen.getByRole('button', { name: 'Undo last change' }))
    await user.click(screen.getByRole('button', { name: 'Redo last change' }))

    expect(props.onImport).toHaveBeenCalledTimes(1)
    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    expect(props.onRedo).toHaveBeenCalledTimes(1)
  })

  it('disables save when there are no unsaved changes', () => {
    renderHeader({ isDirty: false })

    expect(screen.getByRole('button', { name: 'Save automation' })).toBeDisabled()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderHeader()

    expect(await axe(container)).toHaveNoViolations()
  })
})
