import React, { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Moon, Plus, Sun, Upload } from 'lucide-react'
import { Mark } from './chat-controls'

export function ThemeSwitch({ theme, onChange }) {
  const dark = theme === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  return <button className="iconBtn themeSwitch" title={label} aria-label={label}
    onClick={() => onChange(dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
}

export function Onboarding({ theme, onTheme, onFinish, onOpen, loading }) {
  const [step, setStep] = useState(0)
  const heading = useRef(null)
  useLayoutEffect(() => { heading.current?.focus() }, [step])
  const titles = ['Welcome to Invoicity.', 'Choose your appearance.', 'Open your first sheet.']
  const descriptions = [
    'Create invoices and work with your AI agent. Your files and conversations stay on this Mac.',
    'Choose how your workspace looks. You can switch themes at any time.',
    'Start with a blank spreadsheet or import a file. Invoicity Agent opens alongside it.',
  ]
  return <main className="tour" aria-label="Welcome tour">
    <header className="tourTop">
      <span className="tourProgress" aria-label={'Step ' + (step + 1) + ' of 3'}>
        {[0, 1, 2].map(i => <i key={i} className={i <= step ? 'filled' : ''} />)}
      </span>
      <button disabled={loading} onClick={onFinish} className="tourSkip">Skip tour</button>
    </header>
    <section className={'tourContent step' + step} key={step}>
      {step === 0 && <div className="tourMark"><Mark /></div>}
      <h1 tabIndex={-1} ref={heading}>{titles[step]}</h1>
      <p>{descriptions[step]}</p>
      {step === 1 && <div className="themeChoices" role="group" aria-label="Appearance">
        {['light', 'dark'].map(value => <button key={value} aria-pressed={theme === value}
          className={'themeChoice ' + value} onClick={() => onTheme(value)}>
          {value === 'light' ? <Sun /> : <Moon />}
          <span>{value === 'light' ? 'Light' : 'Dark'}</span>
          {theme === value && <Check size={16} />}
        </button>)}
      </div>}
      {step < 2 ? <button className="tourPrimary" onClick={() => setStep(step + 1)}>
        {step === 0 ? 'Get started' : 'Continue'} <ArrowRight size={17} />
      </button> : <div className="tourActions">
        <button className="tourPrimary" disabled={loading} onClick={() => onOpen('create')}><Plus size={18} /> New spreadsheet</button>
        <button className="tourSecondary" disabled={loading} onClick={() => onOpen('importFile')}><Upload size={17} /> Import a file</button>
      </div>}
    </section>
    <footer>{step > 0 && <button disabled={loading} onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>}</footer>
  </main>
}
