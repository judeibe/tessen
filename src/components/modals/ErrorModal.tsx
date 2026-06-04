import { useEffect, useId, useRef } from 'react'

export interface ErrorModalProps {
  isOpen: boolean
  title: string
  message: string
  onRetry?: () => void
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
  width: 'min(460px, calc(100vw - 32px))',
  backgroundColor: '#fff',
  borderRadius: 10,
  padding: 20,
  boxShadow: '0 20px 35px rgba(15, 23, 42, 0.25)',
} as const

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled'))
}

export function ErrorModal({
  isOpen,
  title,
  message,
  onRetry,
  onClose,
}: ErrorModalProps) {
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
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        <p>{message}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
