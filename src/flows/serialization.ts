import type {
  ActionNodeData,
  AutomationFlow,
  AutomationMode,
  ConditionNodeData,
  FlowEdge,
  FlowNode,
  HAAutomationYAML,
  TriggerNodeData,
} from '../shared/types'
import { DEFAULT_AUTOMATION_MODE } from '../shared/constants'

const KNOWN_AUTOMATION_KEYS = new Set([
  'id',
  'alias',
  'description',
  'mode',
  'trigger',
  'condition',
  'action',
])

const NODE_START_X = 120
const NODE_START_Y = 100
const NODE_VERTICAL_GAP = 140
const NODE_COLUMN_GAP = 280

export class SerializationError extends Error {
  nodeId?: string
  field?: string

  constructor(
    message: string,
    options?: {
      nodeId?: string
      field?: string
      cause?: unknown
    },
  ) {
    super(message, options)
    this.name = 'SerializationError'
    this.nodeId = options?.nodeId
    this.field = options?.field
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(
  value: unknown,
  nodeId: string,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new SerializationError('Node config is not serializable.', {
      nodeId,
      field,
    })
  }

  return value
}

function buildTopologicalOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeById = new Map<string, FlowNode>()
  const nodeIndex = new Map<string, number>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const [index, node] of nodes.entries()) {
    if (nodeById.has(node.id)) {
      throw new SerializationError(`Duplicate node id '${node.id}' found.`)
    }

    nodeById.set(node.id, node)
    nodeIndex.set(node.id, index)
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      throw new SerializationError(
        `Edge '${edge.id}' references a missing source or target node.`,
        {
          field: 'edges',
        },
      )
    }

    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue = nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)

  const sortedIds: string[] = []

  while (queue.length > 0) {
    queue.sort((left, right) => {
      const leftIndex = nodeIndex.get(left) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = nodeIndex.get(right) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })

    const nodeId = queue.shift()

    if (!nodeId) {
      break
    }

    sortedIds.push(nodeId)

    for (const neighborId of adjacency.get(nodeId) ?? []) {
      const nextInDegree = (inDegree.get(neighborId) ?? 0) - 1
      inDegree.set(neighborId, nextInDegree)

      if (nextInDegree === 0) {
        queue.push(neighborId)
      }
    }
  }

  if (sortedIds.length !== nodes.length) {
    throw new SerializationError(
      'Flow graph is cyclic and cannot be serialized to YAML order.',
      {
        field: 'edges',
      },
    )
  }

  return sortedIds.map((nodeId) => {
    const node = nodeById.get(nodeId)
    if (!node) {
      throw new SerializationError(`Node '${nodeId}' is missing from flow.`)
    }
    return node
  })
}

function isAutomationMode(value: unknown): value is AutomationMode {
  return (
    value === 'single' ||
    value === 'restart' ||
    value === 'queued' ||
    value === 'parallel'
  )
}

function deriveWarningMessage(
  config: Record<string, unknown>,
  knownEntityIds: Set<string>,
): string | undefined {
  const entityId = config.entity_id
  if (typeof entityId !== 'string') {
    return undefined
  }

  if (knownEntityIds.has(entityId)) {
    return undefined
  }

  return `Entity '${entityId}' was not found in Home Assistant.`
}

function deriveActionType(config: Record<string, unknown>): string {
  const actionValue = config.action
  if (typeof actionValue === 'string' && actionValue.trim().length > 0) {
    return actionValue
  }

  for (const key of Object.keys(config)) {
    if (key !== 'service') {
      return key
    }
  }

  return 'action'
}

function createTriggerNode(
  triggerConfig: Record<string, unknown>,
  index: number,
  knownEntityIds: Set<string>,
): FlowNode {
  const platform =
    typeof triggerConfig.platform === 'string' && triggerConfig.platform.trim().length > 0
      ? triggerConfig.platform
      : 'trigger'

  const config = Object.fromEntries(
    Object.entries(triggerConfig).filter(([key]) => key !== 'platform'),
  )
  const warningMessage = deriveWarningMessage(config, knownEntityIds)

  const data: TriggerNodeData = {
    label: `${platform} trigger`,
    platform,
    config,
    hasWarning: Boolean(warningMessage),
    warningMessage,
  }

  return {
    id: `trigger-${index + 1}`,
    type: 'trigger',
    position: {
      x: NODE_START_X,
      y: NODE_START_Y + index * NODE_VERTICAL_GAP,
    },
    data,
  }
}

function createConditionNode(
  conditionConfig: Record<string, unknown>,
  index: number,
  knownEntityIds: Set<string>,
): FlowNode {
  const condition =
    typeof conditionConfig.condition === 'string' &&
    conditionConfig.condition.trim().length > 0
      ? conditionConfig.condition
      : 'condition'

  const config = Object.fromEntries(
    Object.entries(conditionConfig).filter(([key]) => key !== 'condition'),
  )
  const warningMessage = deriveWarningMessage(config, knownEntityIds)

  const data: ConditionNodeData = {
    label: `${condition} condition`,
    condition,
    config,
    hasWarning: Boolean(warningMessage),
    warningMessage,
  }

  return {
    id: `condition-${index + 1}`,
    type: 'condition',
    position: {
      x: NODE_START_X + NODE_COLUMN_GAP,
      y: NODE_START_Y + index * NODE_VERTICAL_GAP,
    },
    data,
  }
}

function createActionNode(
  actionConfig: Record<string, unknown>,
  index: number,
  knownEntityIds: Set<string>,
): FlowNode {
  const service = actionConfig.service
  const actionType =
    typeof service === 'string' && service.trim().length > 0
      ? 'call-service'
      : deriveActionType(actionConfig)

  const warningMessage = deriveWarningMessage(actionConfig, knownEntityIds)

  const data: ActionNodeData = {
    label:
      typeof service === 'string' && service.trim().length > 0
        ? `call ${service}`
        : `${actionType} action`,
    action: actionType,
    config: { ...actionConfig },
    hasWarning: Boolean(warningMessage),
    warningMessage,
  }

  return {
    id: `action-${index + 1}`,
    type: 'action',
    position: {
      x: NODE_START_X + NODE_COLUMN_GAP * 2,
      y: NODE_START_Y + index * NODE_VERTICAL_GAP,
    },
    data,
  }
}

function createEdge(source: string, target: string, index: number): FlowEdge {
  return {
    id: `edge-${index + 1}`,
    source,
    target,
    type: 'execution',
  }
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord)
}

function extractUnknownProps(yaml: HAAutomationYAML): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(yaml).filter(([key]) => !KNOWN_AUTOMATION_KEYS.has(key)),
  )
}

export function yamlToFlow(
  yaml: HAAutomationYAML,
  knownEntityIds: Set<string>,
): AutomationFlow {
  const triggerNodes = toRecordArray(yaml.trigger).map((triggerConfig, index) =>
    createTriggerNode(triggerConfig, index, knownEntityIds),
  )
  const conditionNodes = toRecordArray(yaml.condition).map((conditionConfig, index) =>
    createConditionNode(conditionConfig, index, knownEntityIds),
  )
  const actionNodes = toRecordArray(yaml.action).map((actionConfig, index) =>
    createActionNode(actionConfig, index, knownEntityIds),
  )

  const nodes = [...triggerNodes, ...conditionNodes, ...actionNodes]
  const edges: FlowEdge[] = []
  let edgeIndex = 0

  const firstCondition = conditionNodes[0]
  const firstAction = actionNodes[0]
  const triggerTarget = firstCondition?.id ?? firstAction?.id

  if (triggerTarget) {
    for (const triggerNode of triggerNodes) {
      edges.push(createEdge(triggerNode.id, triggerTarget, edgeIndex))
      edgeIndex += 1
    }
  }

  for (let index = 0; index < conditionNodes.length - 1; index += 1) {
    edges.push(createEdge(conditionNodes[index].id, conditionNodes[index + 1].id, edgeIndex))
    edgeIndex += 1
  }

  if (conditionNodes.length > 0 && firstAction) {
    edges.push(
      createEdge(conditionNodes[conditionNodes.length - 1].id, firstAction.id, edgeIndex),
    )
    edgeIndex += 1
  }

  for (let index = 0; index < actionNodes.length - 1; index += 1) {
    edges.push(createEdge(actionNodes[index].id, actionNodes[index + 1].id, edgeIndex))
    edgeIndex += 1
  }

  return {
    id: typeof yaml.id === 'string' ? yaml.id : null,
    alias: typeof yaml.alias === 'string' ? yaml.alias : '',
    description: typeof yaml.description === 'string' ? yaml.description : '',
    mode: isAutomationMode(yaml.mode) ? yaml.mode : DEFAULT_AUTOMATION_MODE,
    nodes,
    edges,
    lastSavedAt: null,
    _unknownProps: extractUnknownProps(yaml),
  }
}

function serializeTriggerNode(node: FlowNode): Record<string, unknown> {
  const data = node.data as TriggerNodeData
  const config = requireRecord(data.config, node.id, 'config')
  return {
    platform: data.platform,
    ...config,
  }
}

function serializeConditionNode(node: FlowNode): Record<string, unknown> {
  const data = node.data as ConditionNodeData
  const config = requireRecord(data.config, node.id, 'config')
  return {
    condition: data.condition,
    ...config,
  }
}

function serializeActionNode(node: FlowNode): Record<string, unknown> {
  const data = node.data as ActionNodeData
  const config = requireRecord(data.config, node.id, 'config')
  const serializedAction: Record<string, unknown> = { ...config }

  if (
    !('service' in serializedAction) &&
    !('action' in serializedAction) &&
    data.action !== 'call-service'
  ) {
    serializedAction.action = data.action
  }

  return serializedAction
}

function normalizeUnknownProps(
  unknownProps: AutomationFlow['_unknownProps'],
): Record<string, unknown> {
  if (!unknownProps) {
    return {}
  }

  if (!isRecord(unknownProps)) {
    throw new SerializationError('Unknown automation properties must be an object.', {
      field: '_unknownProps',
    })
  }

  return Object.fromEntries(
    Object.entries(unknownProps).filter(([key]) => !KNOWN_AUTOMATION_KEYS.has(key)),
  )
}

export function flowToYaml(flow: AutomationFlow): HAAutomationYAML {
  const orderedNodes = buildTopologicalOrder(flow.nodes, flow.edges)

  const trigger = orderedNodes
    .filter((node) => node.type === 'trigger')
    .map(serializeTriggerNode)
  const condition = orderedNodes
    .filter((node) => node.type === 'condition')
    .map(serializeConditionNode)
  const action = orderedNodes
    .filter((node) => node.type === 'action')
    .map(serializeActionNode)

  const yaml: HAAutomationYAML = {
    ...normalizeUnknownProps(flow._unknownProps),
    alias: flow.alias,
    mode: flow.mode,
    trigger,
    action,
  }

  if (flow.id) {
    yaml.id = flow.id
  }

  if (flow.description?.trim()) {
    yaml.description = flow.description
  }

  if (condition.length > 0) {
    yaml.condition = condition
  }

  return yaml
}
