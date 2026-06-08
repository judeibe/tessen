import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import type {
  HAEntity,
  HAService,
  TriggerNodeData,
} from '../../../shared/types'
import { NodeConfigPanel } from '../NodeConfigPanel'

const entities: HAEntity[] = [
  {
    entity_id: 'light.kitchen',
    state: 'off',
    attributes: {},
    friendlyName: 'Kitchen Light',
    domain: 'light',
  },
]

const services: HAService[] = [
  {
    domain: 'light',
    service: 'turn_on',
    fields: {},
  },
]

const triggerNodeData: TriggerNodeData = {
  label: 'Kitchen trigger',
  platform: 'state',
  config: {
    entity_id: 'light.kitchen',
  },
  hasWarning: false,
}

describe('NodeConfigPanel', () => {
  it('calls onChange when editing fields', async () => {
    const onChange = vi.fn()

    render(
      <NodeConfigPanel
        nodeId="trigger-1"
        nodeType="trigger"
        nodeData={triggerNodeData}
        entities={entities}
        services={services}
        onChange={onChange}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const labelInput = screen.getByRole('textbox', { name: 'Label' })
    fireEvent.change(labelInput, { target: { value: 'Updated trigger' } })

    expect(onChange).toHaveBeenCalledWith('trigger-1', {
      label: 'Updated trigger',
    })
  })

  it('calls onDelete and onClose actions', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onClose = vi.fn()

    render(
      <NodeConfigPanel
        nodeId="trigger-1"
        nodeType="trigger"
        nodeData={triggerNodeData}
        entities={entities}
        services={services}
        onChange={vi.fn()}
        onDelete={onDelete}
        onClose={onClose}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Close node configuration panel' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete node trigger-1' })
    )

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('trigger-1')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <NodeConfigPanel
        nodeId="trigger-1"
        nodeType="trigger"
        nodeData={triggerNodeData}
        entities={entities}
        services={services}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
