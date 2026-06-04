import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { XYPosition } from '@xyflow/react'
import { create } from 'zustand'
import { temporal, type ZundoOptions } from 'zundo'

import { DEFAULT_AUTOMATION_MODE } from '../shared/constants'
import type {
  ActionNodeData,
  AutomationFlow,
  ConditionNodeData,
  FlowEdge,
  FlowNode,
  FlowNodeData,
  FlowNodeType,
  FlowStore,
  TriggerNodeData,
} from '../shared/types'

const HISTORY_THROTTLE_MS = 200

type FlowHistoryState = Pick<FlowStore, 'nodes' | 'edges'>

const createNodeId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const createEdgeId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function throttle<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number,
): (...args: TArgs) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let queuedArgs: TArgs | null = null

  return (...args: TArgs) => {
    queuedArgs = args

    if (timeout) {
      return
    }

    timeout = setTimeout(() => {
      timeout = null

      if (queuedArgs) {
        callback(...queuedArgs)
        queuedArgs = null
      }
    }, waitMs)
  }
}

function createDefaultFlow(
  nodes: FlowNode[] = [],
  edges: FlowEdge[] = [],
): AutomationFlow {
  return {
    id: null,
    alias: '',
    description: '',
    mode: DEFAULT_AUTOMATION_MODE,
    nodes,
    edges,
    lastSavedAt: null,
    _unknownProps: {},
  }
}

function ensureFlow(
  flow: AutomationFlow | null,
  nodes: FlowNode[],
  edges: FlowEdge[],
): AutomationFlow {
  if (!flow) {
    return createDefaultFlow(nodes, edges)
  }

  return {
    ...flow,
    nodes,
    edges,
  }
}

function createNodeData(type: FlowNodeType): FlowNodeData {
  if (type === 'trigger') {
    const data: TriggerNodeData = {
      label: 'state trigger',
      platform: 'state',
      config: {},
      hasWarning: false,
    }

    return data
  }

  if (type === 'condition') {
    const data: ConditionNodeData = {
      label: 'state condition',
      condition: 'state',
      config: {},
      hasWarning: false,
    }

    return data
  }

  const data: ActionNodeData = {
    label: 'call-service action',
    action: 'call-service',
    config: {},
    hasWarning: false,
  }

  return data
}

const throttledHistoryHandleSet: NonNullable<
  ZundoOptions<FlowStore, FlowHistoryState>['handleSet']
> = (handleSet) => throttle(handleSet, HISTORY_THROTTLE_MS)

export const useFlowStore = create<FlowStore>()(
  temporal(
    (set, get) => ({
      flow: null,
      selectedNodeId: null,
      isDirty: false,
      saveError: null,
      nodes: [],
      edges: [],
      setFlow: (flow) =>
        set({
          flow,
          nodes: flow.nodes,
          edges: flow.edges,
          selectedNodeId: null,
          isDirty: false,
          saveError: null,
        }),
      addNode: (type, position: XYPosition) =>
        set((state) => {
          const nextNode: FlowNode = {
            id: createNodeId(),
            type,
            position,
            data: createNodeData(type),
          }
          const nodes = [...state.nodes, nextNode]
          const edges = state.edges

          return {
            nodes,
            edges,
            flow: ensureFlow(state.flow, nodes, edges),
            isDirty: true,
          }
        }),
      removeNode: (nodeId) =>
        set((state) => {
          const nodes = state.nodes.filter((node) => node.id !== nodeId)
          const edges = state.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          )

          return {
            nodes,
            edges,
            flow: ensureFlow(state.flow, nodes, edges),
            isDirty: true,
            selectedNodeId:
              state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          }
        }),
      updateNodeData: (nodeId, data) =>
        set((state) => {
          const nodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...data,
                  } as FlowNodeData,
                }
              : node,
          )

          return {
            nodes,
            flow: ensureFlow(state.flow, nodes, state.edges),
            isDirty: true,
          }
        }),
      addEdge: (edge) =>
        set((state) => {
          const nextEdge: FlowEdge = {
            ...edge,
            id: createEdgeId(),
            type: 'execution',
          }
          const edges = [...state.edges, nextEdge]

          return {
            edges,
            flow: ensureFlow(state.flow, state.nodes, edges),
            isDirty: true,
          }
        }),
      removeEdge: (edgeId) =>
        set((state) => {
          const edges = state.edges.filter((edge) => edge.id !== edgeId)

          return {
            edges,
            flow: ensureFlow(state.flow, state.nodes, edges),
            isDirty: true,
          }
        }),
      onNodesChange: (changes) =>
        set((state) => {
          const nodes = applyNodeChanges(changes, state.nodes)

          return {
            nodes,
            flow: ensureFlow(state.flow, nodes, state.edges),
            isDirty: true,
          }
        }),
      onEdgesChange: (changes) =>
        set((state) => {
          const edges = applyEdgeChanges(changes, state.edges)

          return {
            edges,
            flow: ensureFlow(state.flow, state.nodes, edges),
            isDirty: true,
          }
        }),
      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
      setAlias: (alias) =>
        set((state) => ({
          flow: {
            ...(state.flow ?? createDefaultFlow(state.nodes, state.edges)),
            alias,
          },
          isDirty: true,
        })),
      setDescription: (description) =>
        set((state) => ({
          flow: {
            ...(state.flow ?? createDefaultFlow(state.nodes, state.edges)),
            description,
          },
          isDirty: true,
        })),
      markSaved: (savedAt, savedId) =>
        set((state) => {
          if (!state.flow) {
            return {
              isDirty: false,
              saveError: null,
            }
          }

          const normalizedSavedId =
            typeof savedId === 'string' && savedId.trim().length > 0
              ? savedId
              : state.flow.id

          return {
            flow: {
              ...state.flow,
              id: normalizedSavedId,
              lastSavedAt: savedAt,
            },
            isDirty: false,
            saveError: null,
          }
        }),
      setSaveError: (error) => set({ saveError: error }),
      undo: () => {
        useFlowStore.temporal.getState().undo()
        const { flow, nodes, edges } = get()

        if (!flow) {
          return
        }

        set({
          flow: {
            ...flow,
            nodes,
            edges,
          },
          isDirty: true,
        })
      },
      redo: () => {
        useFlowStore.temporal.getState().redo()
        const { flow, nodes, edges } = get()

        if (!flow) {
          return
        }

        set({
          flow: {
            ...flow,
            nodes,
            edges,
          },
          isDirty: true,
        })
      },
    }),
    {
      handleSet: throttledHistoryHandleSet,
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      equality: (past, current) =>
        past.nodes === current.nodes && past.edges === current.edges,
    },
  ),
)
