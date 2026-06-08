import type { EdgeTypes, NodeTypes } from '@xyflow/react'
import { memo } from 'react'

import { ExecutionEdge } from '../components/canvas/edge-types/ExecutionEdge'
import { ActionNode } from '../components/nodes/ActionNode'
import { ConditionNode } from '../components/nodes/ConditionNode'
import { TriggerNode } from '../components/nodes/TriggerNode'

const MemoizedTriggerNode = memo(TriggerNode)
const MemoizedConditionNode = memo(ConditionNode)
const MemoizedActionNode = memo(ActionNode)

export const nodeTypes = {
  trigger: MemoizedTriggerNode,
  condition: MemoizedConditionNode,
  action: MemoizedActionNode,
} as unknown as NodeTypes

export const edgeTypes = {
  execution: ExecutionEdge,
} as unknown as EdgeTypes
