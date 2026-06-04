import { useMemo, useState } from 'react'

import { ACTION_TYPES, CONDITION_TYPES, TRIGGER_PLATFORMS } from '../../shared/constants'
import type {
  ActionNodeData,
  ConditionNodeData,
  FlowNode,
  HAEntity,
  HAService,
  TriggerNodeData,
} from '../../shared/types'

type NodeConfigData = TriggerNodeData | ConditionNodeData | ActionNodeData

type PartialNodeConfigData = Partial<NodeConfigData>

const entityConfigKey = 'entity_id'

export interface NodeConfigPanelProps {
  nodeId: string
  nodeType: FlowNode['type']
  nodeData: NodeConfigData
  entities: HAEntity[]
  services: HAService[]
  onChange: (nodeId: string, data: PartialNodeConfigData) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

function isNumberSelector(field: HAService['fields'][string]): boolean {
  return Boolean(field.selector && typeof field.selector === 'object' && 'number' in field.selector)
}

export function NodeConfigPanel({
  nodeId,
  nodeType,
  nodeData,
  entities,
  services,
  onChange,
  onDelete,
  onClose,
}: NodeConfigPanelProps) {
  const config = nodeData.config
  const entityListId = `node-entities-${nodeId}`
  const triggerData = nodeType === 'trigger' ? (nodeData as TriggerNodeData) : null
  const conditionData = nodeType === 'condition' ? (nodeData as ConditionNodeData) : null
  const actionData = nodeType === 'action' ? (nodeData as ActionNodeData) : null

  const updateConfig = (nextConfig: Record<string, unknown>) => {
    onChange(nodeId, { config: nextConfig })
  }

  const updateConfigField = (field: string, value: unknown) => {
    const nextConfig = { ...config }
    if (value === '' || value === undefined || value === null) {
      delete nextConfig[field]
    } else {
      nextConfig[field] = value
    }
    updateConfig(nextConfig)
  }

  const selectedServiceKey =
    nodeType === 'action' && typeof config.service === 'string' ? config.service : ''
  const selectedService =
    nodeType === 'action'
      ? services.find((service) => `${service.domain}.${service.service}` === selectedServiceKey)
      : undefined

  const knownConfigKeys = useMemo(() => {
    const keys = new Set<string>()
    if (nodeType === 'trigger' || nodeType === 'condition') {
      keys.add(entityConfigKey)
    }

    if (nodeType === 'action') {
      keys.add('service')
      if (selectedService) {
        for (const fieldName of Object.keys(selectedService.fields)) {
          keys.add(fieldName)
        }
      }
    }

    return keys
  }, [nodeType, selectedService])

  const unknownConfigObject = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config).filter(([key]) => !knownConfigKeys.has(key)),
      ),
    [config, knownConfigKeys],
  )

  const [unknownJsonError, setUnknownJsonError] = useState<string | null>(null)

  const unknownConfigExists = Object.keys(unknownConfigObject).length > 0

  const handleUnknownJsonChange = (value: string) => {
    if (!value.trim()) {
      setUnknownJsonError(null)
      const knownEntries = Object.fromEntries(
        Object.entries(config).filter(([key]) => knownConfigKeys.has(key)),
      )
      updateConfig(knownEntries)
      return
    }

    try {
      const parsed = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setUnknownJsonError('Unknown fields JSON must be an object.')
        return
      }

      const knownEntries = Object.fromEntries(
        Object.entries(config).filter(([key]) => knownConfigKeys.has(key)),
      )
      updateConfig({
        ...knownEntries,
        ...(parsed as Record<string, unknown>),
      })
      setUnknownJsonError(null)
    } catch {
      setUnknownJsonError('Unknown fields JSON is invalid.')
    }
  }

  return (
    <section aria-label={`Configure ${nodeType ?? 'node'} ${nodeId}`}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Node Configuration</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node configuration panel"
        >
          Close
        </button>
      </div>

      <p style={{ marginTop: 0, color: '#475569' }}>
        Node ID: <code>{nodeId}</code>
      </p>

      <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
        Label
        <input
          type="text"
          value={nodeData.label}
          onChange={(event) => onChange(nodeId, { label: event.target.value })}
        />
      </label>

      {triggerData ? (
        <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
          Trigger Platform
          <select
            value={triggerData.platform}
            onChange={(event) => onChange(nodeId, { platform: event.target.value })}
          >
            {TRIGGER_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {conditionData ? (
        <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
          Condition Type
          <select
            value={conditionData.condition}
            onChange={(event) => onChange(nodeId, { condition: event.target.value })}
          >
            {CONDITION_TYPES.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {actionData ? (
        <>
          <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
            Action Type
            <select
              value={actionData.action}
              onChange={(event) => onChange(nodeId, { action: event.target.value })}
            >
              {ACTION_TYPES.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionType}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
            Service
            <select
              value={selectedServiceKey}
              onChange={(event) => updateConfigField('service', event.target.value)}
            >
              <option value="">Select a service</option>
              {services.map((service) => {
                const key = `${service.domain}.${service.service}`
                return (
                  <option key={key} value={key}>
                    {key}
                  </option>
                )
              })}
            </select>
          </label>

          {selectedService ? (
            <fieldset style={{ marginBottom: 10 }}>
              <legend>Service Fields</legend>
              {Object.entries(selectedService.fields).map(([fieldName, field]) => {
                const numberField = isNumberSelector(field)
                const value = config[fieldName]

                return (
                  <label
                    key={fieldName}
                    style={{ display: 'grid', gap: 4, marginBottom: 8 }}
                  >
                    {field.name ?? fieldName}
                    <input
                      type={numberField ? 'number' : 'text'}
                      value={
                        typeof value === 'number' || typeof value === 'string'
                          ? String(value)
                          : ''
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value
                        if (numberField) {
                          updateConfigField(
                            fieldName,
                            nextValue === '' ? undefined : Number(nextValue),
                          )
                          return
                        }
                        updateConfigField(fieldName, nextValue)
                      }}
                      placeholder={field.description}
                    />
                  </label>
                )
              })}
            </fieldset>
          ) : null}
        </>
      ) : null}

      {nodeType === 'trigger' || nodeType === 'condition' ? (
        <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
          Entity ID
          <input
            type="text"
            list={entityListId}
            value={typeof config[entityConfigKey] === 'string' ? config[entityConfigKey] : ''}
            onChange={(event) => updateConfigField(entityConfigKey, event.target.value)}
            placeholder="Search entities"
          />
          <datalist id={entityListId}>
            {entities.map((entity) => (
              <option key={entity.entity_id} value={entity.entity_id}>
                {entity.friendlyName}
              </option>
            ))}
          </datalist>
        </label>
      ) : null}

      {unknownConfigExists || nodeType === 'action' ? (
        <div style={{ marginBottom: 12 }}>
          <p role="alert" style={{ marginTop: 0 }}>
            Unknown fields are shown as JSON and preserved on save.
          </p>
          <label style={{ display: 'grid', gap: 4 }}>
            Unknown Configuration JSON
            <textarea
              key={`${nodeId}-${JSON.stringify(unknownConfigObject)}`}
              rows={8}
              defaultValue={JSON.stringify(unknownConfigObject, null, 2)}
              onBlur={(event) => handleUnknownJsonChange(event.target.value)}
              aria-invalid={unknownJsonError ? 'true' : 'false'}
            />
          </label>
          {unknownJsonError ? (
            <p role="alert" style={{ marginBottom: 0, color: '#b91c1c' }}>
              {unknownJsonError}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onDelete(nodeId)}
        aria-label={`Delete node ${nodeId}`}
      >
        Delete Node
      </button>
    </section>
  )
}
