import { describe, expect, it } from 'vitest'

import { hasCycle, validateFlow } from '../validation'
import type { AutomationFlow, FlowEdge, FlowNode } from '../../shared/types'
import { DEFAULT_AUTOMATION_MODE } from '../../shared/constants'

const createTriggerNode = (id = 'trigger-1'): FlowNode => ({
  id,
  type: 'trigger',
  position: { x: 100, y: 100 },
  data: {
    label: 'state trigger',
    platform: 'state',
    config: { entity_id: 'light.kitchen', to: 'on' },
    hasWarning: false,
  },
})

const createActionNode = (
  id = 'action-1',
  message = 'hello',
): FlowNode => ({
  id,
  type: 'action',
  position: { x: 300, y: 100 },
  data: {
    label: 'call notify.mobile_app',
    action: 'call-service',
    config: {
      service: 'notify.mobile_app',
      data: { message },
    },
    hasWarning: false,
  },
})

const createEdge = (
  source: string,
  target: string,
  id = `${source}-${target}`,
): FlowEdge => ({
  id,
  source,
  target,
  type: 'execution',
})

const createFlow = (
  overrides: Partial<AutomationFlow> = {},
): AutomationFlow => ({
  id: null,
  alias: 'Kitchen automation',
  description: '',
  mode: DEFAULT_AUTOMATION_MODE,
  nodes: [createTriggerNode(), createActionNode()],
  edges: [createEdge('trigger-1', 'action-1')],
  lastSavedAt: null,
  ...overrides,
})

describe('hasCycle', () => {
  it('returns false for an empty graph', () => {
    expect(hasCycle([], [])).toBe(false)
  })

  it('returns true for a cycle', () => {
    const nodes = [createTriggerNode('node-1'), createActionNode('node-2')]
    const edges = [
      createEdge('node-1', 'node-2', 'edge-1'),
      createEdge('node-2', 'node-1', 'edge-2'),
    ]

    expect(hasCycle(nodes, edges)).toBe(true)
  })
})

describe('validateFlow', () => {
  it('returns expected errors for an empty flow', () => {
    const result = validateFlow(
      createFlow({
        alias: '',
        nodes: [],
        edges: [],
      }),
    )
    const codes = result.errors.map((error) => error.code)

    expect(result.valid).toBe(false)
    expect(codes).toEqual(
      expect.arrayContaining(['MISSING_ALIAS', 'NO_TRIGGER', 'NO_ACTION']),
    )
  })

  it('returns NO_TRIGGER when there is no trigger node', () => {
    const result = validateFlow(
      createFlow({
        nodes: [createActionNode()],
        edges: [],
      }),
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toContain('NO_TRIGGER')
  })

  it('returns NO_ACTION when there is no action node', () => {
    const result = validateFlow(
      createFlow({
        nodes: [createTriggerNode()],
        edges: [],
      }),
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toContain('NO_ACTION')
  })

  it('returns CYCLE_DETECTED when the graph has a cycle', () => {
    const result = validateFlow(
      createFlow({
        nodes: [createTriggerNode('node-1'), createActionNode('node-2')],
        edges: [createEdge('node-1', 'node-2'), createEdge('node-2', 'node-1')],
      }),
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toContain('CYCLE_DETECTED')
  })

  it('returns valid for a trigger to action flow', () => {
    const result = validateFlow(createFlow())

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns SIZE_LIMIT when serialized flow exceeds max size', () => {
    const result = validateFlow(
      createFlow({
        nodes: [createTriggerNode(), createActionNode('action-1', 'x'.repeat(2048))],
      }),
      256,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toContain('SIZE_LIMIT')
  })
})
