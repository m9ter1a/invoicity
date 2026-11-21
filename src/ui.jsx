import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Layers3,
  Star,
  LockKeyhole,
  Plus,
  ArrowUpRight,
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
  X,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  CornerDownRight,
  FileText,
  LoaderCircle,
  ArrowDownToLine,
  Grid2X2,
} from 'lucide-react'
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
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
function Paper() {
  return (
    <div className="paperScene" aria-hidden="true">
      <div className="graphLines" />
      <div className="paper back" />
      <div className="paper middle" />
      <div className="paper front">
        <div className="paperTop">
          <Mark />
          <span>INVOICE</span>
        </div>
        <div className="paperLead" />
        <div className="paperSmall" />
        <div className="paperGrid" />
        <div className="paperSum" />
      </div>
    </div>
  )
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
    return () => d.close()
  }, [])
  return (
    <dialog aria-label={title} ref={ref} onCancel={onClose}>
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
  const [items, setItems] = useState([]),
    [book, setBook] = useState(null),
    [query, setQuery] = useState(''),
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
      if (b) setBook(b)
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
    item.name.toLocaleLowerCase('en-US').includes(searchTerm),
  )
  return (
    <>
      {book ? (
        <Editor
          key={book.id}
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
              <span className="privacy">
                <LockKeyhole size={13} /> On this Mac
              </span>
            </div>
            <div className="homeInner">
              <header className="homeTitle">
                <h1>Workspace</h1>
              </header>
              <div className="launch">
                <button
                  disabled={loading}
                  className="newCard"
                  onClick={() => open(() => api.create('blank'))}
                >
                  <div className="newContent">
                    <span className="largeIcon">
                      <Plus />
                    </span>
                    <strong>New spreadsheet</strong>
                    <span>Start with a blank workbook</span>
                  </div>
                  <Paper />
                </button>
                <button
                  disabled={loading}
                  className="importCard"
                  onClick={() => open(() => api.importFile())}
                >
                  <span className="largeIcon">
                    <Upload />
                  </span>
                  <strong>Import a file</strong>
                  <span>Excel, OpenDocument, CSV or TSV</span>
                  <ArrowUpRight className="cardArrow" size={17} />
                </button>
              </div>
              <div className="templates">
                <span>Templates</span>
                <button onClick={() => open(() => api.create('invoice'))}>
                  <FileText />
                  Invoice
                  <ArrowUpRight />
                </button>
                <button onClick={() => open(() => api.create('register'))}>
                  <Rows3 />
                  Invoice register
                  <ArrowUpRight />
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
                    <kbd>⌘ K</kbd>
                  </label>
                </div>
                <div className="records">
                  <div className="listHead">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Last modified</span>
                    <span />
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
                          title={i.star ? 'Unstar document' : 'Star document'}
                          onClick={async () => {
                            try {
                              await api.toggleStar(i.id)
                              await refresh()
                            } catch (e) {
                              notify(e)
                            }
                          }}
                        >
                          <Star
                            size={15}
                            fill={i.star ? 'currentColor' : 'none'}
                          />
                        </IconButton>
                      </div>
                    )
                  })}
                  {!records.length && (
                    <div className="empty">
                      {searchTerm
                        ? 'No matching documents.'
                        : 'Create a spreadsheet or import a file to get started.'}
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
function Editor({ initial, home, flush, notify, model }) {
  const record = useRef(initial),
    grid = useRef(null),
    host = useRef(null),
    timer = useRef(),
    live = useRef(true),
    saveChain = useRef(Promise.resolve()),
    body = useRef(null)
  const [name, setName] = useState(initial.name),
    [messages, setMessages] = useState(initial.messages || []),
    [text, setText] = useState(''),
    [files, setFiles] = useState([]),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState('Saved'),
    [chatOpen, setChatOpen] = useState(true),
    [modal, setModal] = useState(''),
    [format, setFormat] = useState('xlsx'),
    [audit, setAudit] = useState(null),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState('')
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
    try {
      await job
      if (live.current && saveChain.current === job) setSaving('Saved')
    } catch (e) {
      if (live.current) setSaving('Could not save')
      throw e
    }
  }
  function dirty() {
    if (!live.current) return
    setSaving('Saving…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save().catch(notify), 450)
  }
  useLayoutEffect(() => {
    live.current = true
    try {
      grid.current = mountGrid(host.current, initial.snapshot, dirty)
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
  async function ask(prompt = text) {
    if (busy || !ready || !prompt.trim()) return
    setBusy(true)
    const old = record.current.messages
    const user = {
      role: 'user',
      text: prompt.trim(),
      files: files.map((x) => x.name),
    }
    setHistory([...old, user])
    setText('')
    setFiles([])
    try {
      await grid.current.finish()
      const base = JSON.stringify(grid.current.snapshot().sheets)
      const reply = await api.chat({
        question: user.text,
        context: context(grid.current),
        attachments: files,
        history: old,
      })
      if (live.current)
        setHistory([
          ...old,
          user,
          {
            role: 'assistant',
            text: reply.actions.length
              ? 'Review the proposed changes below.'
              : reply.message,
            actions: reply.actions,
            state: reply.actions.length ? 'pending' : undefined,
            base: reply.actions.length ? await fingerprint(base) : undefined,
          },
        ])
    } catch (e) {
      if (live.current) {
        setHistory([...old, user, { role: 'assistant', text: cleanError(e) }])
        setText(user.text)
        setFiles(files)
      }
    } finally {
      if (live.current) setBusy(false)
    }
  }
  async function apply(i) {
    try {
      const m = record.current.messages[i]
      await grid.current.finish()
      if (
        (await fingerprint(JSON.stringify(grid.current.snapshot().sheets))) !==
        m.base
      )
        throw Error(
          'The workbook has changed. Ask the assistant for an updated proposal.',
        )
      applyPlan(grid.current, m.actions)
      setHistory(
        record.current.messages.map((x, j) =>
          j === i ? { ...x, state: 'applied' } : x,
        ),
      )
      await save()
    } catch (e) {
      notify(e)
    }
  }
  async function checkBook() {
    try {
      await grid.current.finish()
      setAudit(await api.audit(grid.current.snapshot()))
      setModal('audit')
    } catch (e) {
      notify(e)
    }
  }
  return (
    <div className="studio">
      <div className="editorTop">
        <span className="editorTraffic" />
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
        <span className="saveBadge">
          <Check size={13} />
          {saving}
        </span>
        <div className="spacer" />
        <button disabled={!ready} className="barAction" onClick={checkBook}>
          <ShieldCheck size={16} />
          Check invoice
        </button>
        <button
          disabled={!ready}
          className="barAction"
          onClick={() => setModal('export')}
        >
          <Download size={15} />
          Export
        </button>
        <IconButton
          title={chatOpen ? 'Hide assistant' : 'Open assistant'}
          onClick={() => setChatOpen(!chatOpen)}
        >
          {chatOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </IconButton>
      </div>
      <div className="studioBody">
        <div className="gridWrap">
          <div ref={host} className="gridHost" />
          {failed && (
            <div className="gridError" role="alert">
              Could not open the editor. {failed}
            </div>
          )}
        </div>
        {chatOpen && (
          <aside className="copilot">
            <header>
              <span className="agentIcon">
                <Layers3 size={17} />
              </span>
              <div>
                <b>Assistant</b>
                <small>Nemotron 3 Nano</small>
              </div>
              <span className="localDot" title="On this device" />
            </header>
            <div className="conversation" ref={body}>
              {!messages.length && (
                <div className="hello">
                  <span className="agentGlyph">
                    <Layers3 size={27} />
                  </span>
                  <h2>
                    How can I help
                    <br />
                    with this sheet?
                  </h2>
                  <p>Ask about your data or request a change to the sheet.</p>
                  {['Review this invoice', 'Explain the total'].map((p) => (
                    <button disabled={!ready} key={p} onClick={() => ask(p)}>
                      <CornerDownRight size={14} />
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div className={'msg ' + m.role} key={i}>
                  <small>{m.role === 'user' ? 'You' : 'Nemotron'}</small>
                  <p>{m.text}</p>
                  {m.files?.length > 0 && (
                    <span className="attachedNames">{m.files.join(', ')}</span>
                  )}
                  {m.actions?.length > 0 && (
                    <div className="proposal">
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
                      {m.state === 'pending' ? (
                        <button disabled={busy} onClick={() => apply(i)}>
                          Apply changes
                        </button>
                      ) : (
                        <span>
                          <Check size={13} />
                          Applied
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="thinking">
                  <LoaderCircle size={14} />
                  Working on your request…
                </div>
              )}
            </div>
            <div className="composeArea">
              {files.map((f, i) => (
                <div className="attachment" key={i}>
                  <Paperclip size={13} />
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
                  aria-label="Message the assistant"
                  placeholder="Ask about this sheet…"
                  maxLength={2500}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
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
                    disabled={busy || files.length >= 2}
                    onClick={async () => {
                      try {
                        const f = await api.attachment()
                        if (f) setFiles((prev) => [...prev, f].slice(0, 2))
                      } catch (e) {
                        notify(e)
                      }
                    }}
                  >
                    <Paperclip size={17} />
                  </IconButton>
                  <button
                    className="send"
                    aria-label="Send"
                    disabled={
                      busy || !text.trim() || !ready || !model.installed
                    }
                    onClick={() => ask()}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
              <small>
                <LockKeyhole size={11} />
                Processed on this Mac
              </small>
            </div>
          </aside>
        )}
      </div>
      {modal === 'export' && (
        <Modal title="Export workbook" onClose={() => setModal('')}>
          <label className="field">
            File format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
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
          <p>
            {['csv', 'tsv'].includes(format)
              ? 'Values from the active sheet.'
              : ['docx', 'pdf'].includes(format)
                ? 'All sheets with calculated values.'
                : 'All sheets, including formulas.'}
          </p>
          <button
            className="primary"
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
          </button>
        </Modal>
      )}
      {modal === 'audit' && audit && (
        <Modal title="Invoice check" onClose={() => setModal('')}>
          <div className="auditResult">
            <ShieldCheck />
            <b>
              {audit.issues.length
                ? 'Issues found: ' + audit.issues.length
                : audit.tested
                  ? 'No discrepancies found'
                  : 'No invoice fields detected'}
            </b>
          </div>
          <p>
            Checked formulas and recognized invoice fields. Field and line
            checks completed: {audit.tested}.
          </p>
          {audit.issues.map((s, i) => (
            <p className="issue" key={i}>
              {s}
            </p>
          ))}
        </Modal>
      )}
    </div>
  )
}
async function fingerprint(s) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s),
  )
  return Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('')
}
createRoot(document.getElementById('root')).render(<App />)
