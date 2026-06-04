import { Handle, Position } from '@xyflow/react'

import type { ConditionNodeData } from '../../shared/types'
import { BaseNodeCard } from './BaseNodeCard'

export interface ConditionNodeProps {
  id: string
  data: ConditionNodeData
  selected: boolean
}

export function ConditionNode({ id, data, selected }: ConditionNodeProps) {
  return (
    <BaseNodeCard
      nodeType="condition"
      label={data.label}
      selected={selected}
      hasWarning={data.hasWarning}
      warningMessage={data.warningMessage}
    >
      <Handle
        id={`${id}-target`}
        type="target"
        position={Position.Left}
        aria-label="Condition input handle"
      />
      <Handle
        id={`${id}-source`}
        type="source"
        position={Position.Right}
        aria-label="Condition output handle"
      />
    </BaseNodeCard>
  )
}
