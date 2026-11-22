import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Mic, Square, LoaderCircle } from 'lucide-react'

const rate = 16000
function release(session) {
  session.stream?.getTracks().forEach(track => track.stop())
  session.node?.port.close()
  session.node?.disconnect()
  if (session.audio && session.audio.state !== 'closed') session.audio.close().catch(() => {})
}

export function Dictation({ disabled, atLimit, onState, append, notify, focus }) {
  const current = useRef(null)
  const orb = useRef(null)
  const [phase, setPhase] = useState('idle')
  function discard() {
    const session = current.current
    if (!session) return
    current.current = null
    release(session)
    if (session.pending) window.localDesk.cancelVoice(session.id).catch(() => {})
    onState('idle')
  }
  useLayoutEffect(() => discard, [])
  useEffect(() => {
    if (atLimit && current.current && !current.current.stopping) {
      stop(current.current)
      notify('The draft reached its 2,500-character limit.')
    }
  }, [atLimit])
  function fail(session, error) {
    if (current.current !== session) return
    discard()
    setPhase('idle')
    notify(error)
  }
  function flush(session) {
    if (session.voiced >= rate * 0.12) {
      const pcm = new Int16Array(session.length)
      let offset = 0
      for (const block of session.frames) {
        for (const value of block) pcm[offset++] = Math.round(Math.max(-1, Math.min(1, value)) * 32767)
      }
      session.pending++
      session.queue = session.queue.then(async () => {
        if (current.current !== session) return
        const text = await window.localDesk.transcribeVoice(session.id, pcm.buffer)
        if (current.current === session && text) {
          session.transcribed = true
          append(text)
        }
      }).catch(error => fail(session, error)).finally(() => { session.pending-- })
    }
    session.frames = []
    session.length = session.voiced = 0
  }
  async function stop(session, sendAfterSilence = false) {
    if (session.stopping) return
    session.stopping = true
    release(session)
    flush(session)
    setPhase('finishing')
    await session.queue
    if (current.current !== session) return
    if (session.node && !session.transcribed) notify('No speech detected. Check your microphone and try again.')
    current.current = null
    const send = sendAfterSilence && session.transcribed
    onState(send ? 'submit' : 'idle')
    setPhase('idle')
    if (!send) focus()
  }
  async function start() {
    if (disabled || atLimit || current.current) return
    const session = { id: crypto.randomUUID(), frames: [], length: 0, voiced: 0, quiet: 0,
      heardSpeech: false, pending: 0, queue: Promise.resolve(), stopping: false }
    current.current = session
    setPhase('starting')
    onState('recording')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
      if (current.current !== session || session.stopping) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      session.stream = stream
      const audio = session.audio = new AudioContext({ sampleRate: rate })
      await audio.audioWorklet.addModule('./voice-capture.js')
      if (current.current !== session || session.stopping) return
      const node = session.node = new AudioWorkletNode(audio, 'voice-capture', { channelCount: 1, channelCountMode: 'explicit' })
      const source = audio.createMediaStreamSource(stream)
      source.connect(node).connect(audio.destination) // Worklet output stays silent.
      stream.getAudioTracks()[0].onended = () => stop(session)
      node.onprocessorerror = () => fail(session, 'Audio capture stopped. Try dictating again.')
      node.port.onmessage = ({ data }) => {
        if (current.current !== session || session.stopping) return
        let energy = 0
        for (const sample of data) energy += sample * sample
        const level = Math.sqrt(energy / data.length)
        orb.current?.style.setProperty('--voice-scale', String(1 + Math.min(level * 6, 0.55)))
        session.frames.push(data)
        session.length += data.length
        if (level >= 0.006) {
          session.voiced += data.length
          if (session.voiced >= rate * 0.12) session.heardSpeech = true
          session.quiet = 0
        } else {
          session.quiet += data.length
          if (session.heardSpeech && session.quiet > rate * 2) {
            stop(session, true)
            return
          }
          // Keep a short lead-in so the next phrase retains its first consonant.
          if (!session.voiced && session.frames.length > 5) session.length -= session.frames.shift().length
        }
        if (session.length >= rate * 12 || (session.voiced && session.quiet >= rate * 0.8)) {
          flush(session)
          if (session.pending >= 4) {
            notify('Finishing the recorded phrases. You can resume dictation in a moment.')
            stop(session)
          }
        }
      }
      await audio.resume()
      if (current.current === session && !session.stopping) setPhase('listening')
    } catch (error) {
      const message = error.name === 'NotAllowedError' ? 'Allow microphone access in your system settings to dictate.'
        : error.name === 'NotFoundError' ? 'Connect a microphone and try again.'
        : 'Could not start the microphone. Check your audio input and try again.'
      if (!session.stopping) fail(session, message)
    }
  }
  const active = phase !== 'idle'
  const status = { starting: 'Opening microphone…', finishing: 'Transcribing…' }[phase]
  const label = active ? 'Stop dictation' : 'Dictate message'
  return <span className="voiceControl">
    {status && <span className="voiceStatus" role="status">{status}</span>}
    <button ref={orb} type="button" className="voiceButton" data-phase={phase}
      aria-label={label} title={label} aria-pressed={active} disabled={phase === 'finishing' || (!active && (disabled || atLimit))}
      onClick={() => active ? stop(current.current) : start()}>
      {phase === 'finishing' ? <LoaderCircle size={15} /> : active ? <Square fill="currentColor" size={11} /> : <Mic size={18} />}
    </button>
  </span>
}
