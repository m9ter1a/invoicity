import React, { useEffect, useRef, useState } from 'react'
import smile from './smile.svg'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export function Mark() {
  return <span className="mark" aria-hidden="true"><img src={smile} alt="" draggable="false" /></span>
}

const minWidth = 250
export function useChatWidth() {
  const maximum = () => Math.min(760, window.innerWidth - 380)
  const [maxWidth, setMaxWidth] = useState(maximum)
  const [preferred, setPreferred] = useState(() =>
    Number(localStorage.getItem('chat-width')) || clamp(window.innerWidth * .26, 285, 390))
  useEffect(() => {
    const resize = () => setMaxWidth(maximum())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const width = clamp(preferred, minWidth, maxWidth)
  const start = useRef(null)
  const change = (n, persist) => {
    const next = clamp(Math.round(n), minWidth, maxWidth)
    setPreferred(next)
    if (persist) localStorage.setItem('chat-width', String(next))
  }
  const divider = (
    <div className="chatDivider" role="separator" tabIndex={0}
      aria-label="Resize chat" aria-orientation="vertical" aria-controls="invoicity-chat"
      aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={Math.round(width)}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, width }
      }}
      onPointerMove={(e) => {
        if (start.current) change(start.current.width + start.current.x - e.clientX, false)
      }}
      onPointerUp={(e) => {
        if (start.current) change(start.current.width + start.current.x - e.clientX, true)
        start.current = null
      }}
      onLostPointerCapture={() => { start.current = null }}
      onKeyDown={(e) => {
        const sizes = { ArrowLeft: width + 24, ArrowRight: width - 24, Home: minWidth, End: maxWidth }
        if (Object.hasOwn(sizes, e.key)) {
          e.preventDefault()
          change(sizes[e.key], true)
        }
      }}
    />
  )
  return { width, divider }
}

function savedPosition() {
  try {
    const p = JSON.parse(localStorage.getItem('chat-launcher'))
    if (p && [p.x, p.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return p
  } catch {}
  return { x: 1, y: 1 }
}

export function ChatLauncher({ onOpen }) {
  const [pos, setPos] = useState(savedPosition)
  const track = useRef(null), drag = useRef(null), moved = useRef(false)
  function update(p, persist) {
    setPos(p)
    if (persist) localStorage.setItem('chat-launcher', JSON.stringify(p))
  }
  function position(e, persist) {
    const start = drag.current
    if (!start) return
    const dx = e.clientX - start.x, dy = e.clientY - start.y
    if (Math.hypot(dx, dy) > 4) moved.current = true
    if (!moved.current) return
    const area = track.current, button = e.currentTarget
    update({
      x: clamp(start.pos.x + dx / Math.max(1, area.clientWidth - button.offsetWidth), 0, 1),
      y: clamp(start.pos.y + dy / Math.max(1, area.clientHeight - button.offsetHeight), 0, 1),
    }, persist)
  }
  return (
    <div className="launcherTrack" ref={track}>
      <button autoFocus type="button" className="chatLauncher" aria-label="Open Invoicity chat"
        title="Open Invoicity chat · Drag to move"
        style={{ left: pos.x * 100 + '%', top: pos.y * 100 + '%',
          transform: 'translate(' + (-100 * pos.x) + '%, ' + (-100 * pos.y) + '%)' }}
        onPointerDown={e => {
          if (e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, pos }
          moved.current = false
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => position(e, false)}
        onPointerUp={e => { position(e, true); drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
        onClick={e => { if (!moved.current || e.detail === 0) onOpen() }}
        onKeyDown={e => {
          const step = .05
          const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0],
            ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
          if (delta) {
            e.preventDefault()
            update({ x: clamp(pos.x + delta[0], 0, 1), y: clamp(pos.y + delta[1], 0, 1) }, true)
          }
        }}
      ><Mark /></button>
    </div>
  )
}
