import type {
  AutomationFlow,
  FlowEdge,
  FlowNode,
  ValidationError,
  ValidationResult,
} from '../shared/types'

const DEFAULT_MAX_YAML_SIZE_BYTES = 2 * 1024 * 1024

type NodeColor = 'white' | 'gray' | 'black'

export function hasCycle(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  const adjacency = new Map<string, string[]>()
  const color = new Map<string, NodeColor>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    color.set(node.id, 'white')
  }

  for (const edge of edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target)
    }
  }

  const visit = (nodeId: string): boolean => {
    color.set(nodeId, 'gray')

    for (const neighborId of adjacency.get(nodeId) ?? []) {
      const neighborColor = color.get(neighborId)

      if (neighborColor === 'gray') {
        return true
      }

      if (neighborColor === 'white' && visit(neighborId)) {
        return true
      }
    }

    color.set(nodeId, 'black')
    return false
  }

  for (const node of nodes) {
    if (color.get(node.id) === 'white' && visit(node.id)) {
      return true
    }
  }

  return false
}

function getSerializedSizeBytes(flow: AutomationFlow): number {
  const serialized = JSON.stringify({
    alias: flow.alias,
    description: flow.description,
    mode: flow.mode,
    trigger: flow.nodes
      .filter((node) => node.type === 'trigger')
      .map((node) => node.data),
    condition: flow.nodes
      .filter((node) => node.type === 'condition')
      .map((node) => node.data),
    action: flow.nodes
      .filter((node) => node.type === 'action')
      .map((node) => node.data),
    edges: flow.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    })),
    _unknownProps: flow._unknownProps,
  })

  return new TextEncoder().encode(serialized).length
}

export function validateFlow(
  flow: AutomationFlow,
  maxYamlSizeBytes = DEFAULT_MAX_YAML_SIZE_BYTES,
): ValidationResult {
  const errors: ValidationError[] = []

  const hasTriggerNode = flow.nodes.some((node) => node.type === 'trigger')
  const hasActionNode = flow.nodes.some((node) => node.type === 'action')

  if (!flow.alias.trim()) {
    errors.push({
      code: 'MISSING_ALIAS',
      message: 'Automation alias is required before saving.',
    })
  }

  if (!hasTriggerNode) {
    errors.push({
      code: 'NO_TRIGGER',
      message: 'At least one trigger node is required.',
    })
  }

  if (!hasActionNode) {
    errors.push({
      code: 'NO_ACTION',
      message: 'At least one action node is required.',
    })
  }

  if (hasCycle(flow.nodes, flow.edges)) {
    errors.push({
      code: 'CYCLE_DETECTED',
      message: 'Flow contains a cycle. Home Assistant automations must be acyclic.',
    })
  }

  const flowSize = getSerializedSizeBytes(flow)
  if (flowSize > maxYamlSizeBytes) {
    errors.push({
      code: 'SIZE_LIMIT',
      message: `Serialized automation is ${flowSize} bytes, exceeding ${maxYamlSizeBytes} bytes.`,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
