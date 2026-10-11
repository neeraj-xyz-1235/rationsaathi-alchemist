import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'

const pageInfo = {
  check: {
    title: 'Check entitlement',
    subtitle:
      'Enter household details to organise an entitlement comparison.',
    icon: ClipboardList,
  },
  tracker: {
    title: 'Monthly tracker',
    subtitle:
      'Review monthly notes and delivery records in one place.',
    icon: CalendarDays,
  },
  report: {
    title: 'Ration reports',
    subtitle:
      'Search your entries and review a clear summary.',
    icon: FileText,
  },
  complaints: {
    title: 'Complaints & help',
    subtitle:
      'Keep a private draft of an issue or question you want to raise.',
    icon: MessageSquare,
  },
  shops: {
    title: 'Nearby ration shops',
    subtitle:
      'Save shop details you already know. Live location and listings are not connected.',
    icon: MapPin,
  },
  help: {
    title: 'Help centre',
    subtitle:
      'Practical guidance for using your RationSaathi workspace.',
    icon: HelpCircle,
  },
}

const seed = [
  {
    id: 1,
    item: 'Rice',
    qty: '8',
    date: '2026-09-03',
    note: 'Receipt #101',
  },
  {
    id: 2,
    item: 'Wheat',
    qty: '10',
    date: '2026-09-05',
    note: 'Manual record',
  },
  {
    id: 3,
    item: 'Rice',
    qty: '6',
    date: '2026-09-20',
    note: 'Receipt #145',
  },
]

export default function WorkspacePage({ type }) {
  const info = pageInfo[type] || pageInfo.help
  const Icon = info.icon

  const [records, setRecords] = useState(seed)

  const [form, setForm] = useState({
    item: 'Rice',
    qty: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  })

  const [members, setMembers] = useState('4')
  const [householdType, setHouseholdType] =
    useState('Priority household')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)

  const [complaint, setComplaint] = useState({
    topic: 'Ration quantity query',
    details: '',
  })

  const [shop, setShop] = useState({
    name: '',
    area: '',
    phone: '',
  })

  const [shops, setShops] = useState([])

  const filtered = useMemo(
    () =>
      records.filter((record) =>
        `${record.item} ${record.date} ${record.note}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [records, search],
  )

  const total = records.reduce(
    (sum, record) => sum + (Number(record.qty) || 0),
    0,
  )

  function addRecord(event) {
    event.preventDefault()

    if (!form.qty || Number(form.qty) <= 0) return

    setRecords((current) => [
      {
        ...form,
        id: Date.now(),
        qty: String(Number(form.qty)),
      },
      ...current,
    ])

    setForm((current) => ({
      ...current,
      qty: '',
      note: '',
    }))

    setSaved(true)
  }

  function saveLocal(event) {
    event.preventDefault()
    setSaved(true)
  }

  function submitComplaint(event) {
    event.preventDefault()
    setSaved(true)
  }

  function addShop(event) {
    event.preventDefault()

    if (!shop.name.trim()) return

    setShops((current) => [
      ...current,
      { ...shop, id: Date.now() },
    ])

    setShop({
      name: '',
      area: '',
      phone: '',
    })

    setSaved(true)
  }

  return (
    <main className="workspace-page">
      <div className="workspace-breadcrumb">
        <Link to="/dashboard">
          <ArrowLeft size={15} />
          Back to dashboard
        </Link>
        <span>/</span>
        <span>{info.title}</span>
      </div>

      <div className="workspace-page-heading">
        <span className="workspace-page-icon">
          <Icon size={24} />
        </span>

        <div>
          <p className="section-eyebrow">
            RATIONSAATHI WORKSPACE
          </p>
          <h1>{info.title}</h1>
          <p>{info.subtitle}</p>
        </div>
      </div>

      {saved && (
        <div className="workspace-success" role="status">
          <CheckCircle2 size={18} />
          <span>
            Updated in this page preview. This demo does not save
            to the server yet.
          </span>
          <button
            type="button"
            onClick={() => setSaved(false)}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {type === 'check' && (
        <div className="workspace-columns">
          <form
            className="workspace-panel workspace-form"
            onSubmit={saveLocal}
          >
            <h2>Household details</h2>

            <p className="workspace-muted">
              Use the details on your own ration card. Do not enter
              Aadhaar or bank details here.
            </p>

            <label>
              Household category
              <select
                value={householdType}
                onChange={(event) =>
                  setHouseholdType(event.target.value)
                }
              >
                <option>Priority household</option>
                <option>
                  Antyodaya Anna Yojana (AAY)
                </option>
                <option>Other / not sure</option>
              </select>
            </label>

            <label>
              Number of household members
              <input
                type="number"
                min="1"
                max="30"
                value={members}
                onChange={(event) =>
                  setMembers(event.target.value)
                }
                required
              />
            </label>

            <label>
              Expected rice (kg / month)
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Enter from your applicable rules"
              />
            </label>

            <label>
              Expected wheat (kg / month)
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Enter from your applicable rules"
              />
            </label>

            <label>
              Notes (optional)
              <textarea
                rows="3"
                placeholder="Add a reminder for yourself"
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
            >
              Save household draft
              <ArrowRight size={16} />
            </button>
          </form>

          <aside className="workspace-panel workspace-side-note">
            <ShieldCheck size={23} />
            <h3>Before you compare</h3>

            <ul>
              <li>
                Entitlements depend on applicable rules and card
                category.
              </li>
              <li>
                Keep dates and quantities from receipts where
                possible.
              </li>
              <li>
                A mismatch is a prompt to verify details, not
                proof of wrongdoing.
              </li>
            </ul>

            <div className="workspace-mini-stat">
              <Users size={18} />
              <span>
                <small>Household members</small>
                <strong>{members || '—'}</strong>
              </span>
            </div>

            <div className="workspace-mini-stat">
              <ClipboardList size={18} />
              <span>
                <small>Selected category</small>
                <strong>{householdType}</strong>
              </span>
            </div>
          </aside>
        </div>
      )}

      {type === 'tracker' && (
        <>
          <div className="workspace-summary-cards">
            <article>
              <span>Records in this preview</span>
              <strong>{records.length}</strong>
            </article>
            <article>
              <span>Total quantity recorded</span>
              <strong>{total} kg</strong>
            </article>
            <article>
              <span>Selected month</span>
              <strong>September 2026</strong>
            </article>
          </div>

          <div className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Record a ration delivery</h2>
                <p>
                  Add a note or receipt reference to the local
                  preview list.
                </p>
              </div>
              <Upload size={20} />
            </div>

            <form
              className="record-entry-form"
              onSubmit={addRecord}
            >
              <label>
                Item
                <select
                  value={form.item}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      item: event.target.value,
                    }))
                  }
                >
                  <option>Rice</option>
                  <option>Wheat</option>
                  <option>Sugar</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Quantity (kg)
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.qty}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      qty: event.target.value,
                    }))
                  }
                  required
                  placeholder="e.g. 5"
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Receipt / note
                <input
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Receipt number or note"
                />
              </label>

              <button
                className="button button-primary"
                type="submit"
              >
                <Plus size={16} />
                Add record
              </button>
            </form>

            <div className="workspace-panel-head list-head">
              <div>
                <h2>Monthly records</h2>
                <p>
                  Demo entries remain in this page session only.
                </p>
              </div>

              <label className="workspace-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Filter records"
                />
              </label>
            </div>

            <RecordList
              records={filtered}
              onDelete={(id) =>
                setRecords((current) =>
                  current.filter((record) => record.id !== id),
                )
              }
            />
          </div>
        </>
      )}

      {type === 'report' && (
        <>
          <div className="workspace-summary-cards">
            <article>
              <span>Recorded entries</span>
              <strong>{records.length}</strong>
            </article>

            <article>
              <span>Total quantity</span>
              <strong>{total} kg</strong>
            </article>

            <article>
              <span>Difference</span>
              <strong>—</strong>
              <small>Needs verified entitlement inputs</small>
            </article>
          </div>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Record report</h2>
                <p>Filter the example entries below.</p>
              </div>

              <label className="workspace-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search item, date, receipt"
                />
              </label>
            </div>

            <RecordList
              records={filtered}
              onDelete={(id) =>
                setRecords((current) =>
                  current.filter((record) => record.id !== id),
                )
              }
            />

            <p className="workspace-muted report-disclaimer">
              These totals are calculated from the page's demo
              entries only; they are not a verified government
              entitlement calculation.
            </p>

            <Link
              to="/tracker"
              className="button button-primary"
            >
              Manage records
              <ArrowRight size={16} />
            </Link>
          </section>
        </>
      )}

      {type === 'complaints' && (
        <div className="workspace-columns">
          <form
            className="workspace-panel workspace-form"
            onSubmit={submitComplaint}
          >
            <h2>Prepare a query or complaint draft</h2>

            <p className="workspace-muted">
              This form does not submit to an authority. Copy the
              details into the official channel you choose.
            </p>

            <label>
              Topic
              <select
                value={complaint.topic}
                onChange={(event) =>
                  setComplaint((current) => ({
                    ...current,
                    topic: event.target.value,
                  }))
                }
              >
                <option>Ration quantity query</option>
                <option>Shop opening hours</option>
                <option>Receipt or record correction</option>
                <option>Other question</option>
              </select>
            </label>

            <label>
              Details
              <textarea
                rows="7"
                value={complaint.details}
                onChange={(event) =>
                  setComplaint((current) => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                required
                placeholder="Describe the date, item, quantity, and what you want clarified. Avoid sharing sensitive IDs."
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
            >
              <CheckCircle2 size={16} />
              Save draft
            </button>
          </form>

          <aside className="workspace-panel workspace-side-note">
            <MessageSquare size={23} />
            <h3>Useful information to keep</h3>

            <ul>
              <li>Date and approximate time of the visit.</li>
              <li>Item and quantity shown on the receipt.</li>
              <li>Receipt reference, if available.</li>
              <li>
                A clear description of the question you want
                answered.
              </li>
            </ul>

            <p className="workspace-muted">
              For urgent or official issues, use the relevant
              government grievance channel.
            </p>
          </aside>
        </div>
      )}

      {type === 'shops' && (
        <div className="workspace-columns">
          <form
            className="workspace-panel workspace-form"
            onSubmit={addShop}
          >
            <h2>Add a shop you know</h2>

            <p className="workspace-muted">
              No live location or official shop directory is
              connected in this prototype.
            </p>

            <label>
              Shop name
              <input
                value={shop.name}
                onChange={(event) =>
                  setShop((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                placeholder="Name shown on the signboard"
              />
            </label>

            <label>
              Area / address
              <input
                value={shop.area}
                onChange={(event) =>
                  setShop((current) => ({
                    ...current,
                    area: event.target.value,
                  }))
                }
                placeholder="Locality or landmark"
              />
            </label>

            <label>
              Phone (optional)
              <input
                value={shop.phone}
                onChange={(event) =>
                  setShop((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Public shop contact"
              />
            </label>

            <button
              type="submit"
              className="button button-primary"
            >
              <Plus size={16} />
              Add to this preview
            </button>
          </form>

          <section className="workspace-panel">
            <h2>Saved shop notes</h2>

            {shops.length === 0 ? (
              <div className="workspace-empty">
                <ShoppingBag size={28} />
                <strong>No shop notes yet</strong>
                <p>
                  Add a shop using the form. Entries are kept only
                  while this page remains open.
                </p>
              </div>
            ) : (
              shops.map((savedShop) => (
                <article
                  className="saved-shop"
                  key={savedShop.id}
                >
                  <MapPin size={18} />

                  <div>
                    <strong>{savedShop.name}</strong>
                    <span>
                      {savedShop.area || 'No area added'}
                      {savedShop.phone
                        ? ` · ${savedShop.phone}`
                        : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShops((current) =>
                        current.filter(
                          (item) => item.id !== savedShop.id,
                        ),
                      )
                    }
                    aria-label={`Remove ${savedShop.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {type === 'help' && (
        <div className="help-guide-grid">
          <article className="workspace-panel">
            <ClipboardList size={23} />
            <h2>Check entitlement</h2>
            <p>
              Start with your household category and the
              applicable rules. Enter expected amounts only when
              you have a reliable source.
            </p>
            <Link to="/check">
              Open entitlement check <ArrowRight size={15} />
            </Link>
          </article>

          <article className="workspace-panel">
            <CalendarDays size={23} />
            <h2>Track deliveries</h2>
            <p>
              Record item, quantity, date, and a receipt
              reference. Keep original documents somewhere safe.
            </p>
            <Link to="/tracker">
              Open monthly tracker <ArrowRight size={15} />
            </Link>
          </article>

          <article className="workspace-panel">
            <FileText size={23} />
            <h2>Read reports carefully</h2>
            <p>
              A numerical difference may have many explanations.
              Verify records and applicable rules before drawing
              conclusions.
            </p>
            <Link to="/report">
              Open reports <ArrowRight size={15} />
            </Link>
          </article>

          <article className="workspace-panel">
            <ShieldCheck size={23} />
            <h2>Protect your privacy</h2>
            <p>
              Avoid entering Aadhaar, bank account, passwords, or
              other highly sensitive information into notes.
            </p>
            <Link to="/privacy">
              Read privacy information <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      )}
    </main>
  )
}

function RecordList({ records, onDelete }) {
  if (!records.length) {
    return (
      <div className="workspace-empty">
        <Search size={25} />
        <strong>No matching records</strong>
        <p>Try another search term or add a new record.</p>
      </div>
    )
  }

  return (
    <div className="workspace-record-list">
      {records.map((record) => (
        <article
          className="workspace-record-row"
          key={record.id}
        >
          <span
            className={`workspace-record-icon ${
              record.item.toLowerCase() === 'rice'
                ? 'rice'
                : 'wheat'
            }`}
          >
            {record.item[0]}
          </span>

          <div className="workspace-record-main">
            <strong>
              {record.item} · {record.qty} kg
            </strong>
            <span>
              {record.date} · {record.note || 'No receipt note'}
            </span>
          </div>

          <span className="workspace-record-status">
            <CheckCircle2 size={14} />
            Listed
          </span>

          <button
            type="button"
            onClick={() => onDelete(record.id)}
            aria-label={`Remove ${record.item} record`}
          >
            <Trash2 size={16} />
          </button>
        </article>
      ))}
    </div>
  )
}