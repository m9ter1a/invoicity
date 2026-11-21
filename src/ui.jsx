import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Layers3,
  PanelsTopLeft,
  Star,
  Cpu,
  LockKeyhole,
  ChevronRight,
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
  HardDrive,
  FileText,
  ChevronDown,
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
  blank: 'Таблица',
  invoice: 'Инвойс',
  register: 'Реестр',
  import: 'Импорт',
}
const prettyTime = (value) =>
  new Intl.DateTimeFormat('ru-RU', {
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
    <dialog ref={ref} onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <IconButton title="Закрыть" onClick={onClose}>
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
    [view, setView] = useState('all'),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState(''),
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
  const records = items.filter(
    (i) =>
      (view === 'all' || i.star) &&
      i.name.toLowerCase().includes(query.toLowerCase()),
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
          <aside className="rail">
            <div className="traffic" />
            <div className="brand">
              <Mark />
              invoicity
            </div>
            <div className="navlabel">Библиотека</div>
            <nav>
              {[
                ['all', PanelsTopLeft, 'Все таблицы'],
                ['stars', Star, 'Избранное'],
              ].map(([key, I, title]) => (
                <button
                  key={key}
                  className={view === key ? 'selected' : ''}
                  onClick={() => {
                    setView(key)
                    setQuery('')
                  }}
                >
                  <I size={17} />
                  {title}
                  <small>
                    {key === 'all'
                      ? items.length
                      : items.filter((i) => i.star).length}
                  </small>
                </button>
              ))}
            </nav>
            <div className="railBottom">
              <button className="modelLink" onClick={() => setModal('model')}>
                <Cpu size={17} />
                Локальная модель
                <ChevronRight size={14} />
              </button>
              <div className="device">
                <span className="deviceIcon">
                  <HardDrive size={16} />
                </span>
                <div>
                  Этот Mac<small>Локальное хранилище</small>
                </div>
              </div>
            </div>
          </aside>
          <main className="home">
            <div className="topline">
              <span>
                <Layers3 size={15} /> Рабочая область <ChevronRight size={13} />{' '}
                <b>{view === 'all' ? 'Обзор' : 'Избранное'}</b>
              </span>
              <span className="privacy">
                <i /> Локальный режим
              </span>
            </div>
            <div className="homeInner">
              <header className="homeTitle">
                <div>
                  <h1>{view === 'all' ? 'Рабочая область' : 'Избранное'}</h1>
                  <p>
                    {view === 'all'
                      ? 'Инвойсы и таблицы на этом устройстве.'
                      : 'Таблицы, которые вы отметили звездой.'}
                  </p>
                </div>
              </header>
              {view === 'all' && (
                <>
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
                        <strong>Новая таблица</strong>
                        <span>Начать с чистого листа</span>
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
                      <strong>Импорт файла</strong>
                      <span>XLSX, XLS, ODS, CSV и TSV</span>
                      <ArrowUpRight className="cardArrow" size={17} />
                    </button>
                  </div>
                  <div className="templates">
                    <span>Из шаблона</span>
                    <button onClick={() => open(() => api.create('invoice'))}>
                      <FileText />
                      Инвойс
                      <ArrowUpRight />
                    </button>
                    <button onClick={() => open(() => api.create('register'))}>
                      <Rows3 />
                      Реестр инвойсов
                      <ArrowUpRight />
                    </button>
                  </div>
                </>
              )}
              <section className="library">
                <div className="sectionHead">
                  <h2>
                    {view === 'all'
                      ? 'Недавние таблицы'
                      : 'Сохранённые таблицы'}{' '}
                    <small>{records.length}</small>
                  </h2>
                  <label className="search">
                    <Search size={15} />
                    <input
                      ref={search}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск таблиц"
                      aria-label="Поиск таблиц"
                    />
                    <kbd>⌘ K</kbd>
                  </label>
                </div>
                <div className="records">
                  <div className="listHead">
                    <span>Название</span>
                    <span>Тип</span>
                    <span>Изменено</span>
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
                            {i.demo && <small>Демонстрационная книга</small>}
                          </span>
                        </button>
                        <span>{types[i.kind]}</span>
                        <time>{prettyTime(i.updated)}</time>
                        <IconButton
                          title={
                            i.star ? 'Убрать из избранного' : 'В избранное'
                          }
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
                      {query
                        ? 'Совпадений нет.'
                        : view === 'stars'
                          ? 'Отметьте таблицу звездой, и она появится здесь.'
                          : 'Создайте таблицу или импортируйте файл.'}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      )}
      {modal === 'model' && (
        <Modal title="Локальная модель" onClose={() => setModal('')}>
          <div className="modelBox">
            <Cpu />
            <div>
              <b>NVIDIA Nemotron 3 Nano</b>
              <p>4B · Q4_K_M · 2,84 ГБ</p>
            </div>
          </div>
          <p>
            {model.installed
              ? 'Модель установлена на этом Mac и загружается в память при первом вопросе.'
              : 'Файлы модели отсутствуют. Установите полную сборку приложения.'}
          </p>
          <div className="localNote">
            <LockKeyhole size={16} />
            Таблицы, вложения и чат обрабатываются на устройстве.
          </div>
        </Modal>
      )}
      {error && (
        <div className="toast" role="status">
          {error}
          <IconButton title="Закрыть" onClick={() => setError('')}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </>
  )
}

const operationNames = {
  write: 'Записать значения',
  clear: 'Очистить',
  bold: 'Полужирный',
  italic: 'Курсив',
  merge: 'Объединить',
  unmerge: 'Разъединить',
  filter: 'Фильтр',
  sort: 'Сортировка',
  format: 'Числовой формат',
  fill: 'Заливка',
  align: 'Выравнивание',
  addSheet: 'Добавить лист',
  renameSheet: 'Переименовать лист',
  insertRows: 'Вставить строки',
  deleteRows: 'Удалить строки',
  insertColumns: 'Вставить столбцы',
  deleteColumns: 'Удалить столбцы',
  columnWidth: 'Ширина столбца',
  rowHeight: 'Высота строки',
  freezeRows: 'Закрепить строки',
  freezeColumns: 'Закрепить столбцы',
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
    [saving, setSaving] = useState('Сохранено'),
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
      if (live.current && saveChain.current === job) setSaving('Сохранено')
    } catch (e) {
      if (live.current) setSaving('Ошибка сохранения')
      throw e
    }
  }
  function dirty() {
    if (!live.current) return
    setSaving('Сохранение…')
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
    const n = value.trim() || 'Без названия'
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
              ? 'Предлагаю изменения в таблице.'
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
          'Таблица изменилась после запроса. Попросите ассистента обновить предложение.',
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
        <IconButton title="К таблицам" disabled={busy} onClick={home}>
          <ArrowLeft size={18} />
        </IconButton>
        <span className="fileIcon mini">
          <FileSpreadsheet size={15} />
        </span>
        <input
          aria-label="Название таблицы"
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
          Проверить
        </button>
        <button
          disabled={!ready}
          className="barAction"
          onClick={() => setModal('export')}
        >
          <Download size={15} />
          Экспорт
        </button>
        <IconButton
          title={chatOpen ? 'Скрыть ассистента' : 'Открыть ассистента'}
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
              Не удалось открыть редактор. {failed}
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
                <b>Ассистент</b>
                <small>Nemotron 3 Nano</small>
              </div>
              <span className="localDot" title="На устройстве" />
            </header>
            <div className="conversation" ref={body}>
              {!messages.length && (
                <div className="hello">
                  <span className="agentGlyph">
                    <Layers3 size={27} />
                  </span>
                  <h2>
                    Чем помочь
                    <br />с таблицей?
                  </h2>
                  <p>Задайте вопрос о данных или поручите изменить ячейки.</p>
                  {['Проверь этот инвойс', 'Объясни расчёт итоговой суммы'].map(
                    (p) => (
                      <button disabled={!ready} key={p} onClick={() => ask(p)}>
                        <CornerDownRight size={14} />
                        {p}
                      </button>
                    ),
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <div className={'msg ' + m.role} key={i}>
                  <small>{m.role === 'user' ? 'Вы' : 'Nemotron'}</small>
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
                              a.index != null ? '№ ' + a.index : '',
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
                          Применить изменения
                        </button>
                      ) : (
                        <span>
                          <Check size={13} />
                          Применено
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="thinking">
                  <LoaderCircle size={14} />
                  Модель обрабатывает запрос…
                </div>
              )}
            </div>
            <div className="composeArea">
              {files.map((f, i) => (
                <div className="attachment" key={i}>
                  <Paperclip size={13} />
                  {f.name}
                  {f.partial ? ' (фрагмент)' : ''}
                  <IconButton
                    title="Убрать вложение"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
              <div className="composer">
                <textarea
                  aria-label="Сообщение ассистенту"
                  placeholder="Спросите о таблице…"
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
                    title="Прикрепить документ"
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
                    aria-label="Отправить"
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
                Обработка на этом Mac
              </small>
            </div>
          </aside>
        )}
      </div>
      {modal === 'export' && (
        <Modal title="Экспорт таблицы" onClose={() => setModal('')}>
          <label className="field">
            Формат файла
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
              ? 'Значения активного листа.'
              : ['docx', 'pdf'].includes(format)
                ? 'Все листы с рассчитанными значениями.'
                : 'Все листы книги с формулами.'}
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
                  notify('Файл сохранён.')
                }
              } catch (e) {
                notify(e)
              }
            }}
          >
            <ArrowDownToLine size={16} />
            Сохранить файл
          </button>
        </Modal>
      )}
      {modal === 'audit' && audit && (
        <Modal title="Проверка инвойса" onClose={() => setModal('')}>
          <div className="auditResult">
            <ShieldCheck />
            <b>
              {audit.issues.length
                ? 'Замечаний: ' + audit.issues.length
                : audit.tested
                  ? 'В проверенных полях расхождений нет'
                  : 'Типовые поля инвойса не найдены'}
            </b>
          </div>
          <p>
            Проверены формулы и распознанные поля. Количество проверок по
            строкам и реквизитам — {audit.tested}.
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
