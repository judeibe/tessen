import { Handle, Position } from '@xyflow/react'

import type { ActionNodeData } from '../../shared/types'
import { BaseNodeCard } from './BaseNodeCard'

export interface ActionNodeProps {
  id: string
  data: ActionNodeData
  selected: boolean
}

export function ActionNode({ id, data, selected }: ActionNodeProps) {
  return (
    <BaseNodeCard
      nodeType="action"
      label={data.label}
      selected={selected}
      hasWarning={data.hasWarning}
      warningMessage={data.warningMessage}
    >
      <Handle
        id={`${id}-target`}
        type="target"
        position={Position.Left}
        aria-label="Action input handle"
      />
    </BaseNodeCard>
  )
}
