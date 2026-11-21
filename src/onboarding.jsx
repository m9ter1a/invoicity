import React, { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Moon, Sun } from 'lucide-react'
import { Mark } from './chat-controls'

export function ThemeSwitch({ theme, onChange }) {
  const dark = theme === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  return <button className="iconBtn themeSwitch" title={label} aria-label={label}
    onClick={() => onChange(dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
}

export function Onboarding({ onStart }) {
  return <main className="tour" aria-label="Welcome tour">
    <section className="tourContent">
      <div className="tourMark"><Mark /></div>
      <h1>Welcome to Invoicity</h1>
      <p>Your first private AI invoice assistant</p>
      <button className="welcomeStart" onClick={onStart}>Get started <ArrowRight size={20} aria-hidden="true" /></button>
    </section>
  </main>
}

const steps = [
  ['.newCard', 'Create a spreadsheet', 'Start a blank workbook here. You can open it now or continue the tour.'],
  ['.importCard', 'Import a file', 'Bring an existing Excel, OpenDocument or CSV file into this workspace.'],
  ['.search', 'Find a document', 'Search your saved documents by name. You can also press ⌘K.'],
  ['.documentFilters', 'Keep track of important files', 'Bookmark a document, then choose Bookmarked to find it here.'],
]
export function WorkspaceTour({ onFinish }) {
  const [step, setStep] = useState(0), [position, setPosition] = useState(null)
  const tip = useRef(null)
  const [selector, title, description] = steps[step]
  useLayoutEffect(() => {
    const target = document.querySelector(selector)
    const control = target.matches('button') ? target : target.querySelector('input, button')
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    control?.setAttribute('aria-describedby', 'tour-description')
    function measure() {
      const r = target.getBoundingClientRect()
      const w = Math.min(330, window.innerWidth - 24), h = tip.current.offsetHeight
      const below = r.bottom + 13
      const top = below + h <= window.innerHeight - 12 ? below : Math.max(12, r.top - 13 - h)
      setPosition({ x: r.x, y: r.y, width: r.width, height: r.height, top,
        left: Math.min(window.innerWidth - w - 12, Math.max(12, r.x)), w })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    observer.observe(tip.current)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const escape = e => { if (e.key === 'Escape') onFinish() }
    window.addEventListener('keydown', escape)
    return () => {
      observer.disconnect()
      control?.removeAttribute('aria-describedby')
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('keydown', escape)
    }
  }, [step])
  return <>
    {position && <div className="tourSpot" aria-hidden="true" style={{ left:position.x-4, top:position.y-4, width:position.width+8, height:position.height+8 }} />}
    <aside className="tourTip" ref={tip} aria-label="Workspace tour" style={position ? {top:position.top,left:position.left,width:position.w} : {visibility:'hidden'}}>
      <div className="tipTop"><small>Workspace tour · {step + 1} of {steps.length}</small><button onClick={onFinish}>Skip tour</button></div>
      <h2>{title}</h2><p id="tour-description">{description}</p>
      <div className="tipActions">{step > 0 && <button onClick={() => setStep(step - 1)}><ArrowLeft size={14}/> Back</button>}
        <button className="tourPrimary" autoFocus onClick={() => step + 1 === steps.length ? onFinish() : setStep(step + 1)}>
          {step + 1 === steps.length ? 'Finish tour' : 'Next'} <ArrowRight size={14}/>
        </button>
      </div>
    </aside>
  </>
}
