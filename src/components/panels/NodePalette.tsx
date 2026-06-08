import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'

import type { FlowNode } from '../../shared/types'

type PaletteNodeType = NonNullable<FlowNode['type']>

export interface NodePaletteProps {
  onAddNode: (
    type: PaletteNodeType,
    position?: { x: number; y: number }
  ) => void
}

interface PaletteItem {
  type: PaletteNodeType
  title: string
  description: string
  shortcutHint: string
}

const items: PaletteItem[] = [
  {
    type: 'trigger',
    title: 'Trigger',
    description: 'Starts the automation when an event occurs.',
    shortcutHint: 'Enter or Space + arrows + Enter',
  },
  {
    type: 'condition',
    title: 'Condition',
    description: 'Checks logic before actions run.',
    shortcutHint: 'Enter or Space + arrows + Enter',
  },
  {
    type: 'action',
    title: 'Action',
    description: 'Executes the final operation.',
    shortcutHint: 'Enter or Space + arrows + Enter',
  },
]

const KEYBOARD_DROP_CENTER = {
  x: 320,
  y: 200,
}

const KEYBOARD_MOVE_STEP = 40

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const suppressedClickTypeRef = useRef<PaletteNodeType | null>(null)
  const [keyboardDrag, setKeyboardDrag] = useState<{
    type: PaletteNodeType
    xOffset: number
    yOffset: number
  } | null>(null)
  const [keyboardStatus, setKeyboardStatus] = useState('')

  const suppressNextClick = (type: PaletteNodeType) => {
    suppressedClickTypeRef.current = type
    window.setTimeout(() => {
      if (suppressedClickTypeRef.current === type) {
        suppressedClickTypeRef.current = null
      }
    }, 0)
  }

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    type: PaletteNodeType
  ) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.setData('text/plain', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDropByKeyboard = (type: PaletteNodeType) => {
    const position = keyboardDrag
      ? {
          x: KEYBOARD_DROP_CENTER.x + keyboardDrag.xOffset,
          y: KEYBOARD_DROP_CENTER.y + keyboardDrag.yOffset,
        }
      : KEYBOARD_DROP_CENTER

    onAddNode(type, position)
    setKeyboardDrag(null)
    setKeyboardStatus(`Dropped ${type} node on the canvas.`)
  }

  const handleKeyboardInteraction = (
    event: KeyboardEvent<HTMLButtonElement>,
    item: PaletteItem
  ) => {
    if (
      event.key === ' ' ||
      event.key === 'Spacebar' ||
      event.key === 'Space'
    ) {
      event.preventDefault()
      suppressNextClick(item.type)
      setKeyboardDrag({ type: item.type, xOffset: 0, yOffset: 0 })
      setKeyboardStatus(
        `Picked up ${item.title} node. Use arrow keys to position and Enter to drop.`
      )
      return
    }

    if (!keyboardDrag || keyboardDrag.type !== item.type) {
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      suppressNextClick(item.type)
      handleDropByKeyboard(item.type)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setKeyboardDrag(null)
      setKeyboardStatus(`Canceled keyboard drag for ${item.title} node.`)
      return
    }

    const nextOffset = {
      xOffset: keyboardDrag.xOffset,
      yOffset: keyboardDrag.yOffset,
    }

    switch (event.key) {
      case 'ArrowUp':
        nextOffset.yOffset -= KEYBOARD_MOVE_STEP
        break
      case 'ArrowDown':
        nextOffset.yOffset += KEYBOARD_MOVE_STEP
        break
      case 'ArrowLeft':
        nextOffset.xOffset -= KEYBOARD_MOVE_STEP
        break
      case 'ArrowRight':
        nextOffset.xOffset += KEYBOARD_MOVE_STEP
        break
      default:
        return
    }

    event.preventDefault()
    setKeyboardDrag({
      type: item.type,
      ...nextOffset,
    })
    setKeyboardStatus(
      `${item.title} node position offset ${nextOffset.xOffset}, ${nextOffset.yOffset}.`
    )
  }

  return (
    <section aria-label="Node palette">
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Node Palette</h2>
      <p style={{ marginTop: 0, marginBottom: 12 }}>
        Drag nodes to the canvas. Keyboard: Enter adds at center, Space picks
        up, arrows move, and Enter drops.
      </p>
      <p
        aria-live="polite"
        style={{ marginTop: 0, marginBottom: 12, color: '#334155' }}
      >
        {keyboardStatus}
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: 10,
        }}
      >
        {items.map((item) => (
          <li key={item.type}>
            <button
              type="button"
              role="button"
              draggable
              onDragStart={(event) => handleDragStart(event, item.type)}
              onClick={() => {
                if (suppressedClickTypeRef.current === item.type) {
                  suppressedClickTypeRef.current = null
                  return
                }

                onAddNode(item.type)
              }}
              onKeyDown={(event) => handleKeyboardInteraction(event, item)}
              aria-pressed={keyboardDrag?.type === item.type}
              aria-label={`Add ${item.title} node`}
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                padding: 12,
                textAlign: 'left',
                background: '#fff',
                cursor: keyboardDrag?.type === item.type ? 'grabbing' : 'grab',
              }}
            >
              <strong>{item.title}</strong>
              <p style={{ margin: '6px 0 0' }}>{item.description}</p>
              <small style={{ color: '#475569' }}>
                Keyboard shortcut: <kbd>{item.shortcutHint}</kbd>
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
