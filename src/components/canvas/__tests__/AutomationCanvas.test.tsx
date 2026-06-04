import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AutomationFlow, FlowEdge, FlowNode } from '../../../shared/types'
import { useFlowStore } from '../../../flows/store'
import { AutomationCanvas } from '../AutomationCanvas'

vi.mock('@xyflow/react', async () => {
  const actual =
    await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')

  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
    ReactFlow: ({
      children,
      onConnect,
      ariaLabel,
      onlyRenderVisibleElements,
    }: {
      children?: ReactNode
      onConnect?: (connection: {
        source?: string | null
        target?: string | null
      }) => void
      ariaLabel?: string
      onlyRenderVisibleElements?: boolean
    }) => (
      <div
        data-testid="react-flow"
        aria-label={ariaLabel}
        data-only-render-visible-elements={String(onlyRenderVisibleElements)}
      >
        <button
          type="button"
          onClick={() =>
            onConnect?.({ source: 'trigger-1', target: 'action-1' })
          }
        >
          Connect nodes
        </button>
        {children}
      </div>
    ),
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    useReactFlow: () => ({
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
  }
})

const nodes: FlowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      label: 'state trigger',
      platform: 'state',
      config: {},
      hasWarning: false,
    },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 280, y: 100 },
    data: {
      label: 'call-service action',
      action: 'call-service',
      config: {},
      hasWarning: false,
    },
  },
]

const edges: FlowEdge[] = [
  {
    id: 'action-to-trigger',
    source: 'action-1',
    target: 'trigger-1',
    type: 'execution',
  },
]

const flow: AutomationFlow = {
  id: null,
  alias: 'Cycle test',
  mode: 'single',
  nodes,
  edges,
  lastSavedAt: null,
}

describe('AutomationCanvas', () => {
  beforeEach(() => {
    useFlowStore.setState({
      flow,
      selectedNodeId: null,
      isDirty: false,
      saveError: null,
      nodes,
      edges,
    })
  })

  it('shows a warning when a connection would create a cycle', async () => {
    const user = userEvent.setup()

    render(<AutomationCanvas />)

    await user.click(screen.getByRole('button', { name: 'Connect nodes' }))

    expect(
      screen.getByText('Connection rejected: this link would create a cycle.')
    ).toBeInTheDocument()
  })

  it('enables visible-element-only rendering on ReactFlow', () => {
    render(<AutomationCanvas />)

    expect(screen.getByTestId('react-flow')).toHaveAttribute(
      'data-only-render-visible-elements',
      'true'
    )
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<AutomationCanvas />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
