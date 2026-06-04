import { useMemo } from 'react'

export interface AutomationHeaderProps {
  alias: string
  description?: string
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: string | null
  saveError: string | null
  onAliasChange: (alias: string) => void
  onDescriptionChange: (description: string) => void
  onSave: () => void
  onImport: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

function formatRelativeSavedAt(lastSavedAt: string): string {
  const date = new Date(lastSavedAt)
  if (Number.isNaN(date.getTime())) {
    return 'Last saved time unavailable'
  }

  const elapsedMs = Date.now() - date.getTime()
  const elapsedMinutes = Math.round(elapsedMs / (1000 * 60))
  const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  })

  if (Math.abs(elapsedMinutes) < 1) {
    return 'Saved just now'
  }

  if (Math.abs(elapsedMinutes) < 60) {
    return `Saved ${relativeFormatter.format(-elapsedMinutes, 'minute')}`
  }

  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (Math.abs(elapsedHours) < 24) {
    return `Saved ${relativeFormatter.format(-elapsedHours, 'hour')}`
  }

  const elapsedDays = Math.round(elapsedHours / 24)
  if (Math.abs(elapsedDays) < 30) {
    return `Saved ${relativeFormatter.format(-elapsedDays, 'day')}`
  }

  return `Saved on ${date.toLocaleString()}`
}

export function AutomationHeader({
  alias,
  description,
  isDirty,
  isSaving,
  lastSavedAt,
  saveError,
  onAliasChange,
  onDescriptionChange,
  onSave,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: AutomationHeaderProps) {
  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) {
      return 'Not saved yet'
    }

    return formatRelativeSavedAt(lastSavedAt)
  }, [lastSavedAt])

  return (
    <section aria-label="Automation header">
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Automation Alias
          <input
            type="text"
            value={alias}
            onChange={(event) => onAliasChange(event.target.value)}
            placeholder="Enter automation name"
            aria-label="Automation alias"
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Description
          <textarea
            rows={2}
            value={description ?? ''}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Optional description"
            aria-label="Automation description"
          />
        </label>
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onImport}
          aria-label="Import automation from Home Assistant"
        >
          Import from HA
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          aria-label="Save automation"
        >
          {isSaving ? (
            <>
              <span aria-hidden="true">⏳ </span>
              Saving...
            </>
          ) : (
            'Save'
          )}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last change"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo last change"
        >
          Redo
        </button>
      </div>

      {saveError ? (
        <p role="alert" style={{ marginBottom: 6, color: '#b91c1c' }}>
          {saveError}
        </p>
      ) : null}

      <p style={{ marginBottom: 0 }}>
        <strong>Status:</strong>{' '}
        <time dateTime={lastSavedAt ?? undefined}>{lastSavedLabel}</time>
      </p>
    </section>
  )
}
