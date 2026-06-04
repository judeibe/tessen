import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeMouseHandler,
} from '@xyflow/react'
import { useCallback, useState, type DragEvent } from 'react'

import { edgeTypes, nodeTypes } from '../../flows/node-types'
import { useFlowStore } from '../../flows/store'
import { hasCycle } from '../../flows/validation'
import type { FlowNodeType } from '../../shared/types'
import '@xyflow/react/dist/style.css'

const allowedNodeTypes: FlowNodeType[] = ['trigger', 'condition', 'action']

function isFlowNodeType(value: string): value is FlowNodeType {
  return allowedNodeTypes.includes(value as FlowNodeType)
}

function AutomationCanvasFlow() {
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const addNode = useFlowStore((state) => state.addNode)
  const addEdge = useFlowStore((state) => state.addEdge)
  const onNodesChange = useFlowStore((state) => state.onNodesChange)
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange)
  const selectNode = useFlowStore((state) => state.selectNode)

  const [cycleWarning, setCycleWarning] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }

      const pendingEdge = {
        id: '__pending__',
        source: connection.source,
        target: connection.target,
        type: 'execution' as const,
      }

      if (hasCycle(nodes, [...edges, pendingEdge])) {
        setCycleWarning('Connection rejected: this link would create a cycle.')
        return
      }

      setCycleWarning(null)
      addEdge({
        source: connection.source,
        target: connection.target,
        type: 'execution',
      })
    },
    [addEdge, edges, nodes],
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const droppedType =
        event.dataTransfer.getData('application/reactflow') ||
        event.dataTransfer.getData('text/plain')

      if (!isFlowNodeType(droppedType)) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      addNode(droppedType, position)
      setCycleWarning(null)
    },
    [addNode, screenToFlowPosition],
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {cycleWarning ? (
        <p
          role="alert"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 5,
            margin: 0,
            padding: '8px 10px',
            borderRadius: 6,
            background: '#fee2e2',
            color: '#991b1b',
          }}
        >
          {cycleWarning}
        </p>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={handleConnect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        aria-label="Automation builder flow canvas"
        onlyRenderVisibleElements
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

export function AutomationCanvas() {
  return (
    <ReactFlowProvider>
      <AutomationCanvasFlow />
    </ReactFlowProvider>
  )
}
