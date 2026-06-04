import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'

import { AutomationCanvas } from './components/canvas/AutomationCanvas'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorModal } from './components/modals/ErrorModal'
import { ImportAutomationModal } from './components/modals/ImportAutomationModal'
import { AutomationHeader } from './components/panels/AutomationHeader'
import { NodeConfigPanel } from './components/panels/NodeConfigPanel'
import { NodePalette } from './components/panels/NodePalette'
import { flowToYaml, yamlToFlow } from './flows/serialization'
import { useFlowStore } from './flows/store'
import { validateFlow } from './flows/validation'
import {
  getAutomationConfig,
  listAutomations,
  saveAutomation,
  validateAutomationConfig,
} from './ha/automations'
import { connectToHA, type HASaveError } from './ha/client'
import { getAllEntities, subscribeToEntities } from './ha/entities'
import { getAllServices } from './ha/services'
import { DEFAULT_AUTOMATION_MODE } from './shared/constants'
import type { AutomationFlow, AutomationSummary } from './shared/types'
import './App.css'

const DEFAULT_NODE_POSITION = { x: 320, y: 200 }
const HA_URL = (import.meta.env.VITE_HA_URL as string | undefined)?.trim() ?? ''
const HA_TOKEN = (import.meta.env.VITE_HA_TOKEN as string | undefined)?.trim() ?? ''

function createEmptyFlow(): AutomationFlow {
  return {
    id: null,
    alias: '',
    description: '',
    mode: DEFAULT_AUTOMATION_MODE,
    nodes: [],
    edges: [],
    lastSavedAt: null,
    _unknownProps: {},
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'haMessage' in error &&
    typeof (error as HASaveError).haMessage === 'string'
  ) {
    return (error as HASaveError).haMessage ?? fallback
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function App() {
  const flow = useFlowStore((state) => state.flow)
  const nodes = useFlowStore((state) => state.nodes)
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId)
  const isDirty = useFlowStore((state) => state.isDirty)
  const saveError = useFlowStore((state) => state.saveError)
  const setFlow = useFlowStore((state) => state.setFlow)
  const addNode = useFlowStore((state) => state.addNode)
  const removeNode = useFlowStore((state) => state.removeNode)
  const updateNodeData = useFlowStore((state) => state.updateNodeData)
  const selectNode = useFlowStore((state) => state.selectNode)
  const setAlias = useFlowStore((state) => state.setAlias)
  const setDescription = useFlowStore((state) => state.setDescription)
  const markSaved = useFlowStore((state) => state.markSaved)
  const setSaveError = useFlowStore((state) => state.setSaveError)
  const undo = useFlowStore((state) => state.undo)
  const redo = useFlowStore((state) => state.redo)

  const canUndo = useStore(
    useFlowStore.temporal,
    (state) => state.pastStates.length > 0,
  )
  const canRedo = useStore(
    useFlowStore.temporal,
    (state) => state.futureStates.length > 0,
  )

  const [isSaving, setIsSaving] = useState(false)
  const [entities, setEntities] = useState<
    import('./shared/types').HAEntity[]
  >([])
  const [services, setServices] = useState<
    import('./shared/types').HAService[]
  >([])
  const [automations, setAutomations] = useState<AutomationSummary[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImportLoading, setIsImportLoading] = useState(false)
  const [importLoadError, setImportLoadError] = useState<string | null>(null)
  const [connection, setConnection] = useState<
    import('home-assistant-js-websocket').Connection | null
  >(null)
  const [errorModalState, setErrorModalState] = useState<{
    isOpen: boolean
    title: string
    message: string
    retryable: boolean
  }>({
    isOpen: false,
    title: '',
    message: '',
    retryable: false,
  })

  const initializeHA = useCallback(async () => {
    if (!HA_URL || !HA_TOKEN) {
      const missingEnvError =
        'Missing Home Assistant configuration. Set VITE_HA_URL and VITE_HA_TOKEN.'
      setSaveError(missingEnvError)
      setErrorModalState({
        isOpen: true,
        title: 'Home Assistant configuration missing',
        message: missingEnvError,
        retryable: false,
      })
      return
    }

    try {
      const nextConnection = await connectToHA(HA_URL, HA_TOKEN)
      setConnection(nextConnection)

      const [nextEntities, nextServices] = await Promise.all([
        getAllEntities(nextConnection),
        getAllServices(nextConnection),
      ])

      setEntities(nextEntities)
      setServices(nextServices)
      setSaveError(null)
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Failed to connect to Home Assistant and load metadata.',
      )
      setSaveError(message)
      setErrorModalState({
        isOpen: true,
        title: 'Unable to connect to Home Assistant',
        message,
        retryable: true,
      })
    }
  }, [setSaveError])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void initializeHA()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [initializeHA])

  useEffect(() => {
    if (!connection) {
      return
    }

    const unsubscribe = subscribeToEntities(connection, (entityMap) => {
      setEntities(Object.values(entityMap))
    })

    return () => {
      unsubscribe()
    }
  }, [connection])

  useEffect(() => {
    if (flow) {
      return
    }

    setFlow(createEmptyFlow())
  }, [flow, setFlow])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }
    return nodes.find((node) => node.id === selectedNodeId) ?? null
  }, [nodes, selectedNodeId])
  const knownEntityIds = useMemo(
    () => new Set(entities.map((entity) => entity.entity_id)),
    [entities],
  )

  const handleAddNode = useCallback(
    (type: 'trigger' | 'condition' | 'action', position?: { x: number; y: number }) => {
      addNode(type, position ?? DEFAULT_NODE_POSITION)
    },
    [addNode],
  )

  const handleSave = useCallback(async () => {
    if (!flow) {
      setSaveError('There is no automation flow to save.')
      return
    }

    if (!connection) {
      const message = 'Home Assistant is not connected. Retry after reconnecting.'
      setSaveError(message)
      setErrorModalState({
        isOpen: true,
        title: 'Cannot save automation',
        message,
        retryable: true,
      })
      return
    }

    const validationResult = validateFlow(flow)
    if (!validationResult.valid) {
      setSaveError(validationResult.errors.map((error) => error.message).join(' '))
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const yaml = flowToYaml(flow)

      const configValidation = await validateAutomationConfig(connection, {
        trigger: yaml.trigger,
        condition: yaml.condition,
        action: yaml.action,
      })

      const invalidSection = Object.entries(configValidation).find(
        ([, result]) => !result.valid,
      )

      if (invalidSection) {
        const [sectionName, sectionResult] = invalidSection
        const validationMessage =
          sectionResult.error ??
          `Home Assistant rejected the ${sectionName} section.`
        throw new Error(validationMessage)
      }

      const saveResult = await saveAutomation(HA_URL, HA_TOKEN, yaml, flow.id ?? undefined)
      markSaved(new Date().toISOString(), saveResult.id)
      setSaveError(null)
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save automation.')
      setSaveError(message)
      setErrorModalState({
        isOpen: true,
        title: 'Save failed',
        message,
        retryable: true,
      })
    } finally {
      setIsSaving(false)
    }
  }, [connection, flow, markSaved, setSaveError])

  const handleLoadAutomations = useCallback(async () => {
    setIsImportLoading(true)
    setImportLoadError(null)

    try {
      const automationList = await listAutomations(HA_URL, HA_TOKEN)
      setAutomations(automationList)
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load automations from Home Assistant.')
      setImportLoadError(message)
    } finally {
      setIsImportLoading(false)
    }
  }, [])

  const handleImportRequest = useCallback(() => {
    if (!HA_URL || !HA_TOKEN) {
      const message =
        'Missing Home Assistant configuration. Set VITE_HA_URL and VITE_HA_TOKEN.'
      setSaveError(message)
      setErrorModalState({
        isOpen: true,
        title: 'Home Assistant configuration missing',
        message,
        retryable: false,
      })
      return
    }

    setIsImportModalOpen(true)
    void handleLoadAutomations()
  }, [handleLoadAutomations, setSaveError])

  const handleImportSelection = useCallback(
    async (automationId: string) => {
      setIsImportLoading(true)

      try {
        const yaml = await getAutomationConfig(HA_URL, HA_TOKEN, automationId)
        const importedFlow = yamlToFlow(yaml, knownEntityIds)
        setFlow(importedFlow)
        setSaveError(null)
        setIsImportModalOpen(false)
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to import automation.')
        setSaveError(message)
        setIsImportModalOpen(false)
        setErrorModalState({
          isOpen: true,
          title: 'Import failed',
          message,
          retryable: false,
        })
      } finally {
        setIsImportLoading(false)
      }
    },
    [knownEntityIds, setFlow, setSaveError],
  )

  let statusAnnouncement: string | undefined
  if (isSaving) {
    statusAnnouncement = 'Saving automation to Home Assistant.'
  } else if (!saveError && flow?.lastSavedAt) {
    statusAnnouncement = `Automation saved at ${new Date(flow.lastSavedAt).toLocaleString()}.`
  } else if (!saveError) {
    statusAnnouncement = 'Automation has unsaved changes.'
  }

  return (
    <>
      <AppLayout
        header={
          <AutomationHeader
            alias={flow?.alias ?? ''}
            description={flow?.description}
            isDirty={isDirty}
            isSaving={isSaving}
            lastSavedAt={flow?.lastSavedAt ?? null}
            saveError={saveError}
            onAliasChange={setAlias}
            onDescriptionChange={setDescription}
            onSave={handleSave}
            onImport={handleImportRequest}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        }
        palette={<NodePalette onAddNode={handleAddNode} />}
        canvas={<AutomationCanvas />}
        configPanel={
          selectedNode ? (
            <NodeConfigPanel
              nodeId={selectedNode.id}
              nodeType={selectedNode.type}
              nodeData={selectedNode.data}
              entities={entities}
              services={services}
              onChange={updateNodeData}
              onDelete={(nodeId) => {
                removeNode(nodeId)
                selectNode(null)
              }}
              onClose={() => selectNode(null)}
            />
          ) : (
            <section aria-label="Node configuration panel">
              <h2 style={{ marginTop: 0 }}>Node Configuration</h2>
              <p>Select a node to configure it.</p>
            </section>
          )
        }
        statusAnnouncement={statusAnnouncement}
        errorAnnouncement={saveError ?? undefined}
      />

      <ErrorModal
        isOpen={errorModalState.isOpen}
        title={errorModalState.title}
        message={errorModalState.message}
        onRetry={
          errorModalState.retryable
            ? () => {
                void initializeHA()
              }
            : undefined
        }
        onClose={() =>
          setErrorModalState((currentState) => ({
            ...currentState,
            isOpen: false,
          }))
        }
      />

      <ImportAutomationModal
        isOpen={isImportModalOpen}
        automations={automations}
        isLoading={isImportLoading}
        loadError={importLoadError}
        onSelect={(automationId) => {
          void handleImportSelection(automationId)
        }}
        onClose={() => {
          setIsImportModalOpen(false)
          setImportLoadError(null)
        }}
      />
    </>
  )
}

export default App
