import { useEffect, useId, useRef } from 'react'

import type { AutomationSummary } from '../../shared/types'

export interface ImportAutomationModalProps {
  isOpen: boolean
  automations: AutomationSummary[]
  isLoading: boolean
  loadError: string | null
  onSelect: (automationId: string) => void
  onClose: () => void
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
} as const

const dialogStyle = {
  width: 'min(640px, calc(100vw - 32px))',
  maxHeight: 'min(85vh, 720px)',
  backgroundColor: '#fff',
  borderRadius: 10,
  padding: 20,
  boxShadow: '0 20px 35px rgba(15, 23, 42, 0.25)',
  display: 'grid',
  gap: 12,
} as const

const listStyle = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  overflowY: 'auto',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  maxHeight: 'min(52vh, 420px)',
} as const

const itemButtonStyle = {
  width: '100%',
  border: 'none',
  borderBottom: '1px solid #e2e8f0',
  background: '#fff',
  padding: '12px 14px',
  textAlign: 'left',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
} as const

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled'))
}

function getStateBadgeColors(state: AutomationSummary['state']): {
  background: string
  color: string
} {
  if (state === 'on') {
    return { background: '#dcfce7', color: '#166534' }
  }

  if (state === 'off') {
    return { background: '#fee2e2', color: '#991b1b' }
  }

  return { background: '#e2e8f0', color: '#334155' }
}

export function ImportAutomationModal({
  isOpen,
  automations,
  isLoading,
  loadError,
  onSelect,
  onClose,
}: ImportAutomationModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !dialogRef.current) {
      return
    }

    const focusableElements = getFocusableElements(dialogRef.current)
    const firstFocusable = focusableElements[0] ?? dialogRef.current
    firstFocusable.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(dialogRef.current)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
        return
      }

      if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div style={overlayStyle}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dialogStyle}
        tabIndex={-1}
      >
        <h2 id={titleId} style={{ margin: 0 }}>
          Import automation from Home Assistant
        </h2>

        {isLoading ? (
          <p aria-live="polite" style={{ margin: 0 }}>
            <span aria-hidden="true">⏳ </span>
            Loading automations...
          </p>
        ) : null}

        {loadError ? (
          <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && automations.length === 0 ? (
          <p style={{ margin: 0 }}>No automations were found.</p>
        ) : null}

        {automations.length > 0 ? (
          <ul style={listStyle} aria-label="Home Assistant automations">
            {automations.map((automation, index) => {
              const badgeColors = getStateBadgeColors(automation.state)
              return (
                <li key={automation.id}>
                  <button
                    type="button"
                    style={{
                      ...itemButtonStyle,
                      borderBottom:
                        index === automations.length - 1
                          ? 'none'
                          : itemButtonStyle.borderBottom,
                    }}
                    onClick={() => onSelect(automation.id)}
                    disabled={isLoading}
                    aria-label={`Import ${automation.alias}`}
                  >
                    <span style={{ fontWeight: 600 }}>{automation.alias}</span>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        backgroundColor: badgeColors.background,
                        color: badgeColors.color,
                      }}
                    >
                      {automation.state}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div
          style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}
        >
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
