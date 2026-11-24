import { Dictation } from './dictation'
import { ActionButton } from './action-button'
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Bookmark,
  Trash2,
  Database,
  MousePointer2,
  Plus,
  Upload,
  Search,
  FileSpreadsheet,
  Table2,
  Rows3,
  ArrowLeft,
  Download,
  Check,
  Paperclip,
  ArrowUp,
  Square,
  X,
  FileText,
  LoaderCircle,
  ArrowDownToLine,
  Grid2X2,
} from 'lucide-react'
import { Mark, ChatLauncher, useChatWidth } from './chat-controls'
import { Onboarding, ThemeSwitch, WorkspaceTour } from './onboarding'
import { mountGrid, context, applyPlan } from './grid'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './style.css'
const api = window.localDesk
const types = {
  blank: 'Spreadsheet',
  invoice: 'Invoice',
  register: 'Register',
  import: 'Imported',
}
const prettyTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
const cleanError = (e) =>
  String(e?.message || e).replace(
    /^Error invoking remote method '[^']+': Error: /,
    '',
  )
const icons = {
  blank: Grid2X2,
  invoice: FileText,
  register: Rows3,
  import: FileSpreadsheet,
}
function IconButton({ title, children, ...props }) {
  return (
    <button
      type="button"
      className="iconBtn"
      title={title}
      aria-label={title}
      {...props}
    >
      {children}
    </button>
  )
}
function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    d.showModal()
    d.querySelector('.confirmActions button')?.focus({ preventScroll: true })
    return () => d.close()
  }, [])
  return (
    <dialog aria-label={title} ref={ref} onCancel={e => { e.preventDefault(); onClose() }}>
      <header>
        <h2>{title}</h2>
        <IconButton title="Close" onClick={onClose}>
          <X />
        </IconButton>
      </header>
      {children}
    </dialog>
  )
}
function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('appearance') === 'dark' ? 'dark' : 'light')
  const [tour, setTour] = useState(() => location.hash === '#welcome' || !localStorage.getItem('welcome-complete') ? 'welcome' : '')
  useLayoutEffect(() => {
    if (location.hash === '#welcome') {
      localStorage.removeItem('welcome-complete')
      window.history.replaceState(null, '', location.href.split('#')[0])
    }
  }, [])
  const leaveWelcome = next => {
    localStorage.setItem('welcome-complete', '1')
    setTour(next)
  }
  const finishTour = () => leaveWelcome('')
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('appearance', theme)
    api.setAppearance(theme).catch(notify)
  }, [theme])
  const [items, setItems] = useState([]),
    [book, setBook] = useState(null),
    [deleting, setDeleting] = useState(null),
    [query, setQuery] = useState(''),
    [bookmarked, setBookmarked] = useState(false),
    [model, setModel] = useState({}),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false)
  const flush = useRef(async () => true),
    search = useRef(null),
    timer = useRef(null)
  const notify = (e) => {
    setError(cleanError(e))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setError(''), 8000)
  }
  const refresh = async () => setItems(await api.list())
  useEffect(() => {
    refresh().catch(notify)
    api.modelStatus().then(setModel).catch(notify)
    api.onFlush(async () => {
      try {
        await flush.current()
        await api.flushDone(true)
      } catch (e) {
        notify(e)
        await api.flushDone(false)
      }
    })
  }, [])
  useEffect(() => {
    const listener = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !book) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [book])
  async function open(load) {
    if (loading) return
    setLoading(true)
    try {
      const b = await load()
      if (b) {
        setBook(b)
        if (tour) finishTour()
      }
    } catch (e) {
      notify(e)
    } finally {
      setLoading(false)
    }
  }
  async function home() {
    try {
      await flush.current()
      await refresh()
      setBook(null)
    } catch (e) {
      notify(e)
    }
  }
  const searchTerm = query.trim().toLocaleLowerCase('en-US')
  const records = items.filter((item) =>
    (!bookmarked || item.star) && item.name.toLocaleLowerCase('en-US').includes(searchTerm),
  )
  return (
    <>
      {tour === 'welcome' ? (
        <Onboarding onStart={() => leaveWelcome('guide')} />
      ) : book ? (
        <Editor
          key={book.id}
          theme={theme}
          onTheme={setTheme}
          initial={book}
          home={home}
          flush={flush}
          notify={notify}
          model={model}
        />
      ) : (
        <div className="workspace">
          <main className="home">
            <div className="topline">
              <div className="brand">
                <Mark />
                invoicity
              </div>
              <div className="workspaceTools">
                <ThemeSwitch theme={theme} onChange={setTheme} />
              </div>
            </div>
            <div className="homeInner">
              <header className="homeTitle">
                <h1>Workspace</h1>
              </header>
              <div className="launch">
                <button
                  disabled={loading}
                  className="newCard"
                  onClick={() => open(() => api.create())}
                >
                  <Plus size={35} strokeWidth={1.5} aria-hidden="true" />
                  <strong>New spreadsheet</strong>
                </button>
                <button
                  disabled={loading}
                  className="importCard"
                  onClick={() => open(() => api.importFile())}
                >
                  <Upload size={27} strokeWidth={1.5} aria-hidden="true" />
                  <strong>Import a file</strong>
                </button>
              </div>
              <section className="library">
                <div className="sectionHead">
                  <h2>
                    Documents <small aria-live="polite">{records.length}</small>
                  </h2>
                  <label className="search">
                    <Search size={15} />
                    <input
                      ref={search}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      type="search"
                      placeholder="Search documents by name"
                      aria-label="Search documents by name"
                    />
                    <kbd>{api.platform === 'darwin' ? '⌘ K' : 'Ctrl K'}</kbd>
                  </label>
                </div>
                <div className="documentFilters" role="group" aria-label="Filter documents">
                  <button aria-pressed={!bookmarked} onClick={() => setBookmarked(false)}>All</button>
                  <button aria-pressed={bookmarked} onClick={() => setBookmarked(true)}>
                    <Bookmark size={15} aria-hidden="true" /> Bookmarked
                  </button>
                </div>
                <div className="records">
                  <div className="listHead">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Last modified</span>
                    <span /><span />
                  </div>
                  {records.map((i) => {
                    const I = icons[i.kind] || Table2
                    return (
                      <div className="record" key={i.id}>
                        <button
                          className="recordOpen"
                          onClick={() => open(() => api.read(i.id))}
                        >
                          <span className="fileIcon">
                            <I size={19} />
                          </span>
                          <span>
                            {i.name}
                            {i.demo && <small>Sample workbook</small>}
                          </span>
                        </button>
                        <span>{types[i.kind]}</span>
                        <time>{prettyTime(i.updated)}</time>
                        <IconButton
                          aria-pressed={Boolean(i.star)}
                          title={i.star ? 'Remove bookmark' : 'Bookmark document'}
                          onClick={async () => {
                            try {
                              const star = await api.toggleStar(i.id)
                              setItems(items => items.map(item => item.id === i.id ? { ...item, star } : item))
                            } catch (e) {
                              notify(e)
                            }
                          }}
                        >
                          <Bookmark
                            size={18}
                            fill={i.star ? 'currentColor' : 'none'}
                          />
                        </IconButton>
                        <IconButton title={'Delete ' + i.name} onClick={() => setDeleting(i)}><Trash2 size={16} /></IconButton>
                      </div>
                    )
                  })}
                  {!records.length && (
                    <div className="empty">
                      {searchTerm
                        ? 'No matching documents.'
                        : bookmarked ? 'No bookmarked documents yet.' : 'Create a spreadsheet or import a file to get started.'}
                      {searchTerm && (
                        <button
                          onClick={() => {
                            setQuery('')
                            search.current?.focus()
                          }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      )}
      {tour === 'guide' && !book && <WorkspaceTour onFinish={finishTour} />}
      {deleting && <Modal title="Delete spreadsheet?" onClose={() => { if (!loading) setDeleting(null) }}>
        <p>Move <strong>{deleting.name}</strong> and its chat history to the {api.platform === 'win32' ? 'Recycle Bin' : 'Trash'}?</p>
        <div className="dialogActions confirmActions">
          <ActionButton autoFocus disabled={loading} onClick={() => setDeleting(null)}>Cancel</ActionButton>
          <ActionButton primary disabled={loading} onClick={async () => {
            setLoading(true)
            try { await api.trashBook(deleting.id); setDeleting(null); await refresh() }
            catch (e) { notify(e) } finally { setLoading(false) }
          }}>Move to {api.platform === 'win32' ? 'Recycle Bin' : 'Trash'}</ActionButton>
        </div>
      </Modal>}
      {error && (
        <div className="toast" role="status">
          {error}
          <IconButton title="Close" onClick={() => setError('')}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </>
  )
}

const operationNames = {
  write: 'Write values',
  clear: 'Clear cells',
  bold: 'Bold',
  italic: 'Italic',
  merge: 'Merge cells',
  unmerge: 'Unmerge cells',
  filter: 'Filter',
  sort: 'Sort',
  format: 'Number format',
  fill: 'Fill color',
  smiley: 'Paint smiley',
  pixelArt: 'Paint cells',
  paintIcon: 'Paint picture',
  align: 'Alignment',
  addSheet: 'Add sheet',
  renameSheet: 'Rename sheet',
  insertRows: 'Insert rows',
  deleteRows: 'Delete rows',
  insertColumns: 'Insert columns',
  deleteColumns: 'Delete columns',
  columnWidth: 'Column width',
  rowHeight: 'Row height',
  freezeRows: 'Freeze rows',
  freezeColumns: 'Freeze columns',
}
function AgentCursor() {
  return <span className="agentCursor" aria-hidden="true"><MousePointer2 size={22} fill="#fafafa" stroke="#151515" /></span>
}

function Editor({ initial, home, flush, notify, model, theme, onTheme }) {
  const record = useRef(initial),
    grid = useRef(null),
    host = useRef(null),
    timer = useRef(),
    live = useRef(true),
    activeRequest = useRef(null),
    saveChain = useRef(Promise.resolve()),
    body = useRef(null)
  const [name, setName] = useState(initial.name),
    [messages, setMessages] = useState(initial.messages || []),
    [text, setText] = useState(''),
    [dictationState, setDictationState] = useState('idle'),
    [files, setFiles] = useState([]),
    [draggingFile, setDraggingFile] = useState(false),
    [readingFile, setReadingFile] = useState(false),
    [busy, setBusy] = useState(false),
    [chatOpen, setChatOpen] = useState(true),
    [modal, setModal] = useState(''),
    [format, setFormat] = useState('xlsx'),
    [activity, setActivity] = useState(null),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState('')
  const lastTurn = messages.at(-1)
  const failedTurn = lastTurn?.role === 'assistant' && (lastTurn.state === 'failed' ||
    ['Unsupported assistant action.', 'Request stopped.'].includes(lastTurn.text))
  const retryIndex = lastTurn?.role === 'user' ? messages.length - 1 : failedTurn ? messages.length - 2 : -1
  const retryUser = retryIndex >= 0 && messages[retryIndex]?.role === 'user' ? messages[retryIndex] : null
  const dictating = dictationState === 'recording'
  const { width, divider } = useChatWidth()
  const messageInput = useRef(null)
  useEffect(() => {
    if (!activity || !grid.current) return
    const book = grid.current.book
    const sheet = book.getActiveSheet()
    const range = activity.range && (!activity.sheet || activity.sheet === sheet.getSheetName())
      ? sheet.getRange(activity.range) : book.getActiveRange()
    if (activity.done && activity.range && range && (!activity.sheet || activity.sheet === sheet.getSheetName())) {
      const row = range.getRow(), column = range.getColumn()
      const views = sheet.getVisibleRangesOfAllViewports()
      if (views && ![...views.values()].some(r => row >= r.startRow && row <= r.endRow && column >= r.startColumn && column <= r.endColumn))
        sheet.scrollToCell(row, column)
    }
    const cursor = range?.attachPopup({
      componentKey: AgentCursor, direction: 'bottom-left', constrainToCanvas: true, offset: [3, 0],
    })
    const expiry = activity.done ? setTimeout(() => setActivity(null), 950) : null
    return () => { clearTimeout(expiry); cursor?.dispose() }
  }, [activity])
  const setHistory = (msgs) => {
    record.current.messages = msgs
    setMessages(msgs)
    dirty()
  }
  async function save(finish = false) {
    if (!grid.current) return
    clearTimeout(timer.current)
    if (finish) await grid.current.finish()
    const snap = grid.current.snapshot()
    snap.name = record.current.name
    const data = { ...record.current, snapshot: snap }
    const job = saveChain.current.catch(() => {}).then(() => api.save(data))
    saveChain.current = job
    await job
  }
  function dirty() {
    if (!live.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save().catch(notify), 450)
  }
  useLayoutEffect(() => {
    live.current = true
    try {
      grid.current = mountGrid(host.current, initial.snapshot, dirty, theme === 'dark')
      setReady(true)
    } catch (e) {
      setFailed(cleanError(e))
    }
    flush.current = () => save(true)
    return () => {
      live.current = false
      clearTimeout(timer.current)
      flush.current = async () => true
      grid.current?.dispose()
      grid.current = null
    }
  }, [])
  useLayoutEffect(() => { grid.current?.setDark(theme === 'dark') }, [theme])
  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
  }, [messages, busy])
  function rename(value) {
    const n = value.trim() || 'Untitled spreadsheet'
    setName(n)
    record.current.name = n
    grid.current?.book.setName(n)
    dirty()
  }
  async function addAttachments(dropped) {
    if (busy || readingFile || dictating || files.length >= 2) return
    setReadingFile(true)
    try {
      const slots = 2 - files.length
      for (const source of dropped ? dropped.slice(0, slots) : [null]) {
        const item = source ? await api.attachDroppedFile(source) : await api.attachment()
        if (item && live.current) {
          setFiles(previous => [...previous, item].slice(0, 2))
          messageInput.current?.focus({preventScroll: true})
        }
      }
    } catch (error) { notify(error) }
    finally { if (live.current) setReadingFile(false) }
  }
  async function ask(prompt = text, retry = false) {
    if (activeRequest.current || busy || readingFile || dictating || !ready || !prompt.trim()) return
    setBusy(true)
    const request = {id: crypto.randomUUID(), stopped: false}
    activeRequest.current = request
    const old = retry ? record.current.messages.slice(0, retryIndex) : record.current.messages
    const user = retry ? retryUser : {
      role: 'user',
      text: prompt.trim(),
      files: files.map((x) => x.name),
      sources: files,
    }
    setHistory([...old, user])
    setText('')
    setFiles([])
    try {
      await grid.current.finish()
      if (request.stopped) throw Error('Request stopped.')
      const base = JSON.stringify(grid.current.snapshot().sheets)
      setActivity({})
      const reply = await api.chat({
        id: request.id,
        question: user.text,
        view: host.current.getBoundingClientRect().toJSON(),
        context: context(grid.current, old),
        attachments: user.sources || [],
        history: old,
      })
      if (!live.current) return
      if (request.stopped) throw Error('Request stopped.')
      if (reply.calculation) {
        const value = await grid.current.calculate(reply.calculation)
        reply.message = reply.calculation.formula + ' = ' + value.toLocaleString('en-US', {maximumSignificantDigits:15})
      }
      if (reply.actions.length) {
        await grid.current.finish()
        if (!live.current) return
        if (request.stopped) throw Error('Request stopped.')
        if (JSON.stringify(grid.current.snapshot().sheets) !== base)
          throw Error('The sheet changed during this request. Send the request again to use the current data.')
        applyPlan(grid.current, reply.actions)
        const [write] = reply.actions
        const formula = write.op === 'write' && write.values?.length === 1 && write.values[0]?.length === 1 && write.values[0][0]
        if (reply.actions.length === 1 && typeof formula === 'string' && formula.startsWith('=')) {
          await grid.current.finish()
          const sheet = write.sheet ? grid.current.book.getSheetByName(write.sheet) : grid.current.book.getActiveSheet()
          const value = sheet.getRange(write.range).getCellData()?.v
          reply.message = write.range + ' contains ' + formula + (value == null ? '.' : ' → ' + value.toLocaleString('en-US') + '.')
        }
        if (JSON.stringify(grid.current.snapshot().sheets) === base) {
          reply.actions = []
          reply.message = 'The proposed edit would leave the sheet unchanged.'
        }
        const destination = reply.actions.findLast(a => a.range)
        setActivity(destination ? { range: destination.range, sheet: destination.sheet, done: true } : null)
      } else setActivity(null)
      setHistory([...old, user, {
        role: 'assistant',
        text: reply.message,
        actions: reply.actions,
        state: reply.actions.length ? 'applied' : undefined,
      }])
      await save().catch(notify)
    } catch (e) {
      if (live.current) {
        setActivity(null)
        setHistory([...old, user, { role: 'assistant', state: 'failed', text: request.stopped ? 'Request stopped.' : cleanError(e) }])
        setText(user.text)
        setFiles(user.sources || [])
      }
    } finally {
      activeRequest.current = null
      if (live.current) setBusy(false)
    }
  }
  // Submit from the render containing the final transcript, current edits and attachments.
  useEffect(() => {
    if (dictationState !== 'submit') return
    setDictationState('idle')
    if (chatOpen && model.installed) ask()
  }, [dictationState])
  async function updateContext(mode) {
    if (busy) return
    setBusy(true)
    const previous = record.current.messages
    try {
      const next = mode === 'clear' ? [] : [{role: 'summary', text: await api.compact(previous)}]
      if (!live.current) return
      record.current.messages = next
      try { await save(true) }
      catch (e) { record.current.messages = previous; dirty(); throw e }
      setMessages(next)
      if (mode === 'clear') { setText(''); setFiles([]) }
      setModal('')
    } catch (e) { notify(e) }
    finally { if (live.current) setBusy(false) }
  }
  return (
    <div className="studio">
      <div className="editorTop">
        {api.platform === 'darwin' && <span className="editorTraffic" />}
        <IconButton title="Back to documents" disabled={busy} onClick={home}>
          <ArrowLeft size={18} />
        </IconButton>
        <span className="fileIcon mini">
          <FileSpreadsheet size={15} />
        </span>
        <input
          aria-label="Document name"
          className="titleInput"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => rename(name)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
          }}
        />
        <div className="spacer" />
        <ThemeSwitch theme={theme} onChange={onTheme} />
        <button
          disabled={!ready}
          className="barAction"
          onClick={() => setModal('export')}
        >
          <Download size={15} />
          Export
        </button>
      </div>
      <div className="studioBody">
        <div className="gridWrap">
          <div ref={host} className="gridHost" />
          {(busy || activity) && <div className="agentGlow" aria-hidden="true" />}
          {!chatOpen && <ChatLauncher onOpen={() => {
            setChatOpen(true)
            requestAnimationFrame(() => messageInput.current?.focus())
          }} />}
          {failed && (
            <div className="gridError" role="alert">
              Could not open the editor. {failed}
            </div>
          )}
        </div>
        {chatOpen && (
          <aside className="copilot" id="invoicity-chat" aria-label="Invoicity chat" style={{ width }}
            onDragOver={event => {
              if (!event.dataTransfer.types.includes('Files')) return
              event.preventDefault()
              const canDrop = !busy && !readingFile && !dictating && files.length < 2
              event.dataTransfer.dropEffect = canDrop ? 'copy' : 'none'
              setDraggingFile(canDrop)
            }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDraggingFile(false)
            }}
            onDrop={event => {
              if (!event.dataTransfer.types.includes('Files')) return
              event.preventDefault()
              setDraggingFile(false)
              addAttachments(Array.from(event.dataTransfer.files))
            }}>
            {divider}
            <header>
              <h2>Invoicity Agent</h2>
              <IconButton title="Close chat" onClick={() => setChatOpen(false)}><X size={20} /></IconButton>
            </header>
            <div className="conversation" ref={body}>
              {!messages.length && (
                <div className="hello">
                  <h3>What would you like to work <span className="greetingEnd">on? =)</span></h3>
                  <div className="suggestions">
                    {['Review this invoice', 'Explain the total'].map((p) => (
                      <button disabled={!ready || dictating || !model.installed} key={p} onClick={() => ask(p)}>
                        {p}<ArrowUp size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div className={'msg ' + m.role} key={i}>
                  <small>{m.role === 'user' ? 'You' : m.role === 'summary' ? 'Context summary' : 'Invoicity'}</small>
                  {m.text && !m.base && m.state !== 'pending' && <p>{m.text}</p>}
                  {m.files?.length > 0 && (
                    <span className="attachedNames">{m.files.join(', ')}</span>
                  )}
                  {m.actions?.length > 0 && (
                    <details className="actionDetails">
                      <summary>
                        {m.state === 'applied' && <Check size={14} aria-hidden="true" />}
                        {m.state === 'applied' ? 'Applied' : 'Not applied'} · {m.actions.length} {m.actions.length === 1 ? 'change' : 'changes'}
                      </summary>
                      {m.actions.map((a, j) => (
                        <div key={j}>
                          <b>{operationNames[a.op] || a.op}</b>
                          <code>
                            {[
                              a.sheet,
                              a.range,
                              a.name,
                              a.index != null ? 'No. ' + a.index : '',
                              a.count,
                              a.value,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </code>
                          {a.values && <pre>{JSON.stringify(a.values)}</pre>}
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              ))}
              {!busy && retryUser && !text && !files.length && (
                <div className="interruptedRequest">
                  {!failedTurn && <span>The last request was interrupted.</span>}
                  <ActionButton disabled={!ready || readingFile || dictating}
                    onClick={() => ask(retryUser.text, true)}>Retry request</ActionButton>
                </div>
              )}
              {busy && (
                <div className="thinking">
                  <LoaderCircle size={14} />
                  Working on your request…
                </div>
              )}
            </div>
            <div className="composeArea" data-file-over={draggingFile || undefined}>
              {files.map((f, i) => (
                <div className="attachment" key={i}>
                  <FileText size={16} aria-hidden="true" />
                  {f.name}
                  {f.partial ? ' (excerpt)' : ''}
                  <IconButton
                    title="Remove attachment"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
              <div className="composer">
                <textarea
                  ref={messageInput}
                  aria-label="Message Invoicity"
                  placeholder="Message Invoicity…"
                  maxLength={2500}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => e.stopPropagation()}
                  onCut={(e) => e.stopPropagation()}
                  onCopy={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault()
                      ask()
                    }
                  }}
                />
                <div>
                  <IconButton
                    title="Attach document"
                    disabled={busy || readingFile || dictating || files.length >= 2}
                    onClick={() => addAttachments()}
                  >
                    <Paperclip size={17} />
                  </IconButton>
                  <IconButton title="Chat context" disabled={busy || readingFile || dictating} onClick={() => setModal('context')}>
                    <Database size={17} />
                  </IconButton>
                  <Dictation disabled={busy || readingFile} atLimit={text.length >= 2500} onState={setDictationState} notify={notify}
                    focus={() => messageInput.current?.focus()}
                    append={words => setText(previous =>
                      (previous + (previous && !/\s$/.test(previous) ? ' ' : '') + words).slice(0, 2500))} />
                  {busy && activeRequest.current ? (
                    <button className="send" aria-label="Stop request" title="Stop request"
                      onClick={() => {
                        const request = activeRequest.current
                        if (!request) return
                        request.stopped = true
                        api.cancelChat(request.id).catch(notify)
                      }}>
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : <button
                    className="send"
                    aria-label="Send"
                    disabled={
                      busy || readingFile || dictating || !text.trim() || !ready || !model.installed
                    }
                    onClick={() => ask()}
                  >
                    <ArrowUp size={16} />
                  </button>}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
      {modal === 'context' && <Modal title="Chat context" onClose={() => setModal('')}>
        <p>{messages.length ? 'This workbook has its own conversation memory.' : 'This conversation is empty.'}</p>
        <div className="dialogActions memoryOptions">
          <ActionButton disabled={!messages.length} onClick={() => setModal('compress')}>Compress context</ActionButton>
          <ActionButton disabled={!messages.length} onClick={() => setModal('clear')}>Clear context</ActionButton>
        </div>
      </Modal>}
      {['compress', 'clear'].includes(modal) && <Modal title={modal === 'clear' ? 'Clear this chat?' : 'Compress this chat?'}
        onClose={() => { if (!busy) setModal('') }}>
        <p>{modal === 'clear' ? 'Erase the messages, remembered attachments and summary for this workbook. Your spreadsheet edits stay in place.'
          : 'Nemotron will replace this conversation with a local summary of its important facts and decisions. The full transcript will be removed.'}</p>
        <div className="dialogActions confirmActions">
          <ActionButton autoFocus disabled={busy} onClick={() => setModal('')}>Cancel</ActionButton>
          <ActionButton primary disabled={busy} onClick={() => updateContext(modal)}>{busy ? 'Working…' : modal === 'clear' ? 'Clear chat' : 'Compress chat'}</ActionButton>
        </div>
      </Modal>}
      {modal === 'export' && (
        <Modal title="Export workbook" onClose={() => setModal('')}>
          <label className="field">
            File format
            <select aria-describedby="export-hint" value={format} onChange={(e) => setFormat(e.target.value)}>
              {[
                ['xlsx', 'Excel (.xlsx)'],
                ['xls', 'Excel 97–2003 (.xls)'],
                ['ods', 'OpenDocument (.ods)'],
                ['csv', 'CSV (.csv)'],
                ['tsv', 'TSV (.tsv)'],
                ['docx', 'Word (.docx)'],
                ['pdf', 'PDF (.pdf)'],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="exportHint" id="export-hint">
            {['csv', 'tsv'].includes(format)
              ? 'Values from the active sheet.'
              : ['docx', 'pdf'].includes(format)
                ? 'All sheets with calculated values.'
                : 'All sheets, including formulas.'}
          </p>
          <div className="dialogActions singleAction">
            <ActionButton
              primary
              onClick={async () => {
                try {
                  await grid.current.finish()
                  if (
                    await api.exportFile(
                      grid.current.snapshot(),
                      format,
                      grid.current.book.getActiveSheet().getSheetId(),
                    )
                  ) {
                    setModal('')
                    notify('File saved.')
                  }
                } catch (e) {
                  notify(e)
                }
              }}
            >
              <ArrowDownToLine size={16} />
              Save file
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
createRoot(document.getElementById('root')).render(<App />)
