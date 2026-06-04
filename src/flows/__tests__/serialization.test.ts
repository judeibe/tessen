import { describe, expect, it } from 'vitest'

import { DEFAULT_AUTOMATION_MODE } from '../../shared/constants'
import type {
  AutomationFlow,
  FlowEdge,
  FlowNode,
  HAAutomationYAML,
} from '../../shared/types'
import { flowToYaml, SerializationError, yamlToFlow } from '../serialization'

const createTriggerNode = (id: string, entityId: string): FlowNode => ({
  id,
  type: 'trigger',
  position: { x: 100, y: 100 },
  data: {
    label: 'state trigger',
    platform: 'state',
    config: { entity_id: entityId, to: 'on' },
    hasWarning: false,
  },
})

const createConditionNode = (id: string): FlowNode => ({
  id,
  type: 'condition',
  position: { x: 220, y: 100 },
  data: {
    label: 'state condition',
    condition: 'state',
    config: { entity_id: 'binary_sensor.home', state: 'on' },
    hasWarning: false,
  },
})

const createActionNode = (id: string, service: string): FlowNode => ({
  id,
  type: 'action',
  position: { x: 360, y: 100 },
  data: {
    label: `call ${service}`,
    action: 'call-service',
    config: { service, data: { message: 'hello' } },
    hasWarning: false,
  },
})

const createEdge = (source: string, target: string, id: string): FlowEdge => ({
  id,
  source,
  target,
  type: 'execution',
})

const createFlow = (
  overrides: Partial<AutomationFlow> = {}
): AutomationFlow => ({
  id: null,
  alias: 'Kitchen automation',
  description: '',
  mode: DEFAULT_AUTOMATION_MODE,
  nodes: [createTriggerNode('trigger-1', 'light.kitchen')],
  edges: [],
  lastSavedAt: null,
  ...overrides,
})

describe('flowToYaml', () => {
  it('serializes a valid trigger-condition-action flow', () => {
    const trigger = createTriggerNode('trigger-1', 'light.kitchen')
    const condition = createConditionNode('condition-1')
    const action = createActionNode('action-1', 'notify.mobile_app')

    const yaml = flowToYaml(
      createFlow({
        alias: 'Evening lights',
        description: 'Runs every evening',
        mode: 'queued',
        nodes: [trigger, condition, action],
        edges: [
          createEdge(trigger.id, condition.id, 'e-1'),
          createEdge(condition.id, action.id, 'e-2'),
        ],
      })
    )

    expect(yaml).toEqual({
      alias: 'Evening lights',
      description: 'Runs every evening',
      mode: 'queued',
      trigger: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
      condition: [
        { condition: 'state', entity_id: 'binary_sensor.home', state: 'on' },
      ],
      action: [{ service: 'notify.mobile_app', data: { message: 'hello' } }],
    })
  })

  describe('yamlToFlow', () => {
    it('maps valid HA YAML into trigger-condition-action flow nodes and edges', () => {
      const yaml: HAAutomationYAML = {
        id: 'automation-evening',
        alias: 'Evening automation',
        description: 'Imported from Home Assistant',
        mode: 'queued',
        trigger: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
        condition: [{ condition: 'time', after: '18:00:00' }],
        action: [
          { service: 'light.turn_on', target: { entity_id: 'light.kitchen' } },
        ],
      }

      const flow = yamlToFlow(yaml, new Set(['light.kitchen']))

      expect(flow.id).toBe('automation-evening')
      expect(flow.alias).toBe('Evening automation')
      expect(flow.description).toBe('Imported from Home Assistant')
      expect(flow.mode).toBe('queued')
      expect(flow.nodes.map((node) => node.type)).toEqual([
        'trigger',
        'condition',
        'action',
      ])
      expect(
        flow.edges.map((edge) => `${edge.source}->${edge.target}`)
      ).toEqual(['trigger-1->condition-1', 'condition-1->action-1'])

      expect(flow.nodes[0].data).toMatchObject({
        label: 'state trigger',
        platform: 'state',
        hasWarning: false,
      })
      expect(flow.nodes[1].data).toMatchObject({
        label: 'time condition',
        condition: 'time',
        hasWarning: false,
      })
      expect(flow.nodes[2].data).toMatchObject({
        label: 'call light.turn_on',
        action: 'call-service',
        hasWarning: false,
      })
    })

    it('creates edges for multiple triggers targeting the first condition', () => {
      const yaml: HAAutomationYAML = {
        alias: 'Multi trigger',
        trigger: [
          { platform: 'state', entity_id: 'binary_sensor.door', to: 'on' },
          { platform: 'time', at: '08:00:00' },
        ],
        condition: [
          { condition: 'state', entity_id: 'input_boolean.away', state: 'off' },
        ],
        action: [{ service: 'notify.notify', data: { message: 'Hello' } }],
      }

      const flow = yamlToFlow(
        yaml,
        new Set(['binary_sensor.door', 'input_boolean.away'])
      )

      expect(flow.nodes.filter((node) => node.type === 'trigger')).toHaveLength(
        2
      )
      expect(
        flow.edges.map((edge) => `${edge.source}->${edge.target}`)
      ).toEqual([
        'trigger-1->condition-1',
        'trigger-2->condition-1',
        'condition-1->action-1',
      ])
    })

    it('flags nodes with missing entity_id values as warnings', () => {
      const yaml: HAAutomationYAML = {
        alias: 'Missing entity automation',
        trigger: [{ platform: 'state', entity_id: 'light.unknown', to: 'on' }],
        action: [{ service: 'light.turn_on', entity_id: 'light.unknown' }],
      }

      const flow = yamlToFlow(yaml, new Set(['light.kitchen']))
      const warningNodes = flow.nodes.filter((node) => node.data.hasWarning)

      expect(warningNodes).toHaveLength(2)
      expect(warningNodes[0].data.warningMessage).toBe(
        "Entity 'light.unknown' was not found in Home Assistant."
      )
      expect(warningNodes[1].data.warningMessage).toBe(
        "Entity 'light.unknown' was not found in Home Assistant."
      )
    })

    it('preserves unknown fields for round-trip serialization', () => {
      const yaml: HAAutomationYAML = {
        id: 'automation-roundtrip',
        alias: 'Round trip',
        mode: 'single',
        trigger: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
        action: [{ service: 'light.turn_on' }],
        trace: { stored_traces: 15 },
        variables: { room: 'kitchen' },
      }

      const flow = yamlToFlow(yaml, new Set(['light.kitchen']))
      const roundTrippedYaml = flowToYaml(flow)

      expect(flow._unknownProps).toEqual({
        trace: { stored_traces: 15 },
        variables: { room: 'kitchen' },
      })
      expect(roundTrippedYaml.trace).toEqual({ stored_traces: 15 })
      expect(roundTrippedYaml.variables).toEqual({ room: 'kitchen' })
    })

    it('handles empty condition array without creating condition nodes', () => {
      const yaml: HAAutomationYAML = {
        alias: 'No condition',
        trigger: [{ platform: 'state', entity_id: 'sensor.motion', to: 'on' }],
        condition: [],
        action: [{ service: 'light.turn_on' }, { service: 'notify.notify' }],
      }

      const flow = yamlToFlow(yaml, new Set(['sensor.motion']))

      expect(
        flow.nodes.filter((node) => node.type === 'condition')
      ).toHaveLength(0)
      expect(
        flow.edges.map((edge) => `${edge.source}->${edge.target}`)
      ).toEqual(['trigger-1->action-1', 'action-1->action-2'])
      expect(flow.mode).toBe(DEFAULT_AUTOMATION_MODE)
    })
  })

  it('omits condition when serializing trigger-to-action flow', () => {
    const trigger = createTriggerNode('trigger-1', 'light.kitchen')
    const action = createActionNode('action-1', 'light.turn_on')

    const yaml = flowToYaml(
      createFlow({
        nodes: [trigger, action],
        edges: [createEdge(trigger.id, action.id, 'e-1')],
      })
    )

    expect(yaml.trigger).toEqual([
      { platform: 'state', entity_id: 'light.kitchen', to: 'on' },
    ])
    expect(yaml.action).toEqual([
      { service: 'light.turn_on', data: { message: 'hello' } },
    ])
    expect(yaml.condition).toBeUndefined()
  })

  it('orders trigger and action arrays using topological ordering', () => {
    const triggerB = createTriggerNode('trigger-b', 'sensor.b')
    const triggerA = createTriggerNode('trigger-a', 'sensor.a')
    const actionA = createActionNode('action-a', 'notify.notify')
    const actionB = createActionNode('action-b', 'light.turn_on')

    const yaml = flowToYaml(
      createFlow({
        nodes: [triggerB, actionB, triggerA, actionA],
        edges: [
          createEdge(triggerB.id, actionA.id, 'e-1'),
          createEdge(triggerA.id, actionA.id, 'e-2'),
          createEdge(actionA.id, actionB.id, 'e-3'),
        ],
      })
    )

    expect(yaml.trigger).toEqual([
      { platform: 'state', entity_id: 'sensor.b', to: 'on' },
      { platform: 'state', entity_id: 'sensor.a', to: 'on' },
    ])
    expect(yaml.action).toEqual([
      { service: 'notify.notify', data: { message: 'hello' } },
      { service: 'light.turn_on', data: { message: 'hello' } },
    ])
  })

  it('preserves the flow mode field in YAML', () => {
    const trigger = createTriggerNode('trigger-1', 'switch.kitchen')
    const action = createActionNode('action-1', 'switch.turn_on')

    const yaml = flowToYaml(
      createFlow({
        mode: 'parallel',
        nodes: [trigger, action],
        edges: [createEdge(trigger.id, action.id, 'e-1')],
      })
    )

    expect(yaml.mode).toBe('parallel')
  })

  it('passes through _unknownProps without overriding known fields', () => {
    const trigger = createTriggerNode('trigger-1', 'light.kitchen')
    const action = createActionNode('action-1', 'light.turn_on')

    const yaml = flowToYaml(
      createFlow({
        alias: 'Known alias',
        nodes: [trigger, action],
        edges: [createEdge(trigger.id, action.id, 'e-1')],
        _unknownProps: {
          trace: { stored_traces: 10 },
          variables: { room: 'kitchen' },
          alias: 'Should not replace alias',
        },
      })
    )

    expect(yaml.alias).toBe('Known alias')
    expect(yaml.trace).toEqual({ stored_traces: 10 })
    expect(yaml.variables).toEqual({ room: 'kitchen' })
  })

  it('throws SerializationError for unserializable node config', () => {
    const trigger = createTriggerNode('trigger-1', 'light.kitchen')
    const action = createActionNode('action-1', 'light.turn_on')
    const invalidAction: FlowNode = {
      ...action,
      data: {
        ...action.data,
        config: 'invalid-config' as unknown as Record<string, unknown>,
      },
    }

    expect(() =>
      flowToYaml(
        createFlow({
          nodes: [trigger, invalidAction],
          edges: [createEdge(trigger.id, invalidAction.id, 'e-1')],
        })
      )
    ).toThrow(SerializationError)
  })
})
