import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_AUTOMATION_MODE } from '../../src/shared/constants'
import { flowToYaml, yamlToFlow } from '../../src/flows/serialization'
import { useFlowStore } from '../../src/flows/store'
import type { AutomationFlow, FlowEdge, FlowNode, HAAutomationYAML } from '../../src/shared/types'

const triggerNode: FlowNode = {
  id: 'trigger-1',
  type: 'trigger',
  position: { x: 100, y: 200 },
  data: {
    label: 'state trigger',
    platform: 'state',
    config: { entity_id: 'binary_sensor.front_door', to: 'on' },
    hasWarning: false,
  },
}

const conditionNode: FlowNode = {
  id: 'condition-1',
  type: 'condition',
  position: { x: 320, y: 200 },
  data: {
    label: 'state condition',
    condition: 'state',
    config: { entity_id: 'person.jude', state: 'home' },
    hasWarning: false,
  },
}

const actionNode: FlowNode = {
  id: 'action-1',
  type: 'action',
  position: { x: 540, y: 200 },
  data: {
    label: 'call notify.mobile_app',
    action: 'call-service',
    config: {
      service: 'notify.mobile_app',
      data: { message: 'Front door opened while you are home.' },
    },
    hasWarning: false,
  },
}

const edges: FlowEdge[] = [
  { id: 'edge-1', source: triggerNode.id, target: conditionNode.id, type: 'execution' },
  { id: 'edge-2', source: conditionNode.id, target: actionNode.id, type: 'execution' },
]

function resetFlowStore(): void {
  useFlowStore.setState({
    flow: null,
    selectedNodeId: null,
    isDirty: false,
    saveError: null,
    nodes: [],
    edges: [],
  })
}

describe('flow composition integration', () => {
  afterEach(() => {
    resetFlowStore()
  })

  it('serializes trigger -> condition -> action graph into expected HA config shape', () => {
    const flow: AutomationFlow = {
      id: null,
      alias: 'Front door welcome',
      description: 'Notify when front door opens while at home',
      mode: DEFAULT_AUTOMATION_MODE,
      nodes: [triggerNode, conditionNode, actionNode],
      edges,
      lastSavedAt: null,
    }

    const yaml = flowToYaml(flow)

    expect(yaml).toEqual({
      alias: 'Front door welcome',
      description: 'Notify when front door opens while at home',
      mode: 'single',
      trigger: [
        {
          platform: 'state',
          entity_id: 'binary_sensor.front_door',
          to: 'on',
        },
      ],
      condition: [
        {
          condition: 'state',
          entity_id: 'person.jude',
          state: 'home',
        },
      ],
      action: [
        {
          service: 'notify.mobile_app',
          data: { message: 'Front door opened while you are home.' },
        },
      ],
    })
  })

  it('preserves imported id when editing and serializing back to yaml', () => {
    const importedYaml: HAAutomationYAML = {
      id: 'automation.existing_automation',
      alias: 'Edit me',
      mode: 'single',
      trigger: [{ platform: 'state', entity_id: 'binary_sensor.front_door', to: 'on' }],
      action: [{ service: 'light.turn_on', target: { entity_id: 'light.porch' } }],
    }

    const importedFlow = yamlToFlow(
      importedYaml,
      new Set(['binary_sensor.front_door', 'light.porch', 'notify.mobile_app']),
    )

    useFlowStore.getState().setFlow(importedFlow)
    const initialActionNodeIds = new Set(
      useFlowStore
        .getState()
        .nodes.filter((node) => node.type === 'action')
        .map((node) => node.id),
    )

    useFlowStore.getState().addNode('action', { x: 780, y: 200 })

    const stateAfterAddNode = useFlowStore.getState()
    const newActionNode = stateAfterAddNode.nodes.find(
      (node) => node.type === 'action' && !initialActionNodeIds.has(node.id),
    )
    const originalActionNode = stateAfterAddNode.nodes.find(
      (node) => node.type === 'action' && initialActionNodeIds.has(node.id),
    )

    expect(newActionNode).toBeDefined()
    expect(originalActionNode).toBeDefined()

    useFlowStore.getState().updateNodeData(newActionNode!.id, {
      label: 'call notify.mobile_app',
      config: {
        service: 'notify.mobile_app',
        data: { message: 'Edited automation action' },
      },
    })

    useFlowStore.getState().addEdge({
      source: originalActionNode!.id,
      target: newActionNode!.id,
      type: 'execution',
    })

    const updatedFlow = useFlowStore.getState().flow
    expect(updatedFlow?.id).toBe('automation.existing_automation')

    const serialized = flowToYaml(updatedFlow as AutomationFlow)

    expect(serialized.id).toBe('automation.existing_automation')
    expect(serialized.action).toContainEqual({
      service: 'light.turn_on',
      target: { entity_id: 'light.porch' },
    })
    expect(serialized.action).toContainEqual({
      service: 'notify.mobile_app',
      data: { message: 'Edited automation action' },
    })
    expect(serialized.action).toHaveLength(2)
  })
})
