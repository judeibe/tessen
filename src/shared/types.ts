import type {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  XYPosition,
} from '@xyflow/react'

export type AutomationMode = 'single' | 'restart' | 'queued' | 'parallel'
export type FlowNodeType = 'trigger' | 'condition' | 'action'

interface BaseNodeData extends Record<string, unknown> {
  label: string
  hasWarning: boolean
  warningMessage?: string
}

export interface TriggerNodeData extends BaseNodeData {
  platform: string
  config: Record<string, unknown>
}

export interface ConditionNodeData extends BaseNodeData {
  condition: string
  config: Record<string, unknown>
}

export interface ActionNodeData extends BaseNodeData {
  action: string
  config: Record<string, unknown>
}

export type FlowNodeData = TriggerNodeData | ConditionNodeData | ActionNodeData

export type FlowNode = Node<FlowNodeData, FlowNodeType>

export type FlowEdge = Edge<Record<string, unknown>, 'execution'> & {
  source: string
  target: string
  type: 'execution'
}

export interface AutomationFlow {
  id: string | null
  alias: string
  description?: string
  mode: AutomationMode
  nodes: FlowNode[]
  edges: FlowEdge[]
  lastSavedAt: string | null
  _unknownProps?: Record<string, unknown>
}

export interface HAEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  friendlyName: string
  domain: string
  isMissing?: boolean
}

export interface HAServiceField {
  name?: string
  description?: string
  required?: boolean
  selector?: Record<string, unknown>
  default?: unknown
}

export interface HAService {
  domain: string
  service: string
  name?: string
  description?: string
  fields: Record<string, HAServiceField>
}

export interface HAAutomationYAML {
  id?: string
  alias: string
  description?: string
  mode?: AutomationMode
  triggers: Record<string, unknown>[]
  conditions?: Record<string, unknown>[]
  actions: Record<string, unknown>[]
  [key: string]: unknown
}

export interface AutomationSummary {
  id: string
  alias: string
  state: 'on' | 'off' | 'unavailable'
}

export type ValidationErrorCode =
  | 'NO_TRIGGER'
  | 'NO_ACTION'
  | 'MISSING_ALIAS'
  | 'CYCLE_DETECTED'
  | 'SIZE_LIMIT'

export interface ValidationError {
  code: ValidationErrorCode
  message: string
  nodeId?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface FlowStore {
  flow: AutomationFlow | null
  selectedNodeId: string | null
  isDirty: boolean
  saveError: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  setFlow: (flow: AutomationFlow) => void
  addNode: (type: FlowNodeType, position: XYPosition) => void
  removeNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void
  addEdge: (edge: Omit<FlowEdge, 'id'>) => void
  removeEdge: (edgeId: string) => void
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  selectNode: (nodeId: string | null) => void
  setAlias: (alias: string) => void
  setDescription: (description: string) => void
  markSaved: (savedAt: string, savedId?: string) => void
  setSaveError: (error: string | null) => void
  undo: () => void
  redo: () => void
}
