import { Handle, Position } from '@xyflow/react'

import type { TriggerNodeData } from '../../shared/types'
import { BaseNodeCard } from './BaseNodeCard'

export interface TriggerNodeProps {
  id: string
  data: TriggerNodeData
  selected: boolean
}

export function TriggerNode({ id, data, selected }: TriggerNodeProps) {
  return (
    <BaseNodeCard
      nodeType="trigger"
      label={data.label}
      selected={selected}
      hasWarning={data.hasWarning}
      warningMessage={data.warningMessage}
    >
      <Handle
        id={`${id}-source`}
        type="source"
        position={Position.Right}
        aria-label="Trigger output handle"
      />
    </BaseNodeCard>
  )
}
