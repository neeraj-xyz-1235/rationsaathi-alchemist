import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import BrandMark from './BrandMark.jsx'

const links = [
  { label: 'Overview', to: '/dashboard', icon: Home },
  { label: 'Check entitlement', to: '/check', icon: ClipboardList },
  { label: 'Monthly tracker', to: '/tracker', icon: CalendarDays },
  { label: 'Ration reports', to: '/report', icon: FileText },
  { label: 'Complaints & help', to: '/complaints', icon: MessageSquare },
  { label: 'Nearby ration shops', to: '/shops', icon: ShoppingBag },
  { label: 'Help centre', to: '/help', icon: CircleHelp },
]

function Calendar({
  month,
  setMonth,
  selected,
  setSelected,
  eventDays,
}) {
  const first = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  )

  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()

  const offset = (first.getDay() + 6) % 7

  const dateKey = (day) =>
    `${month.getFullYear()}-${String(
      month.getMonth() + 1,
    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ]

  return (
    <div className="calendar-widget">
      <div className="calendar-widget-head">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() - 1,
                1,
              ),
            )
          }
        >
          <ChevronLeft size={17} />
        </button>

        <strong>
          {month.toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>

        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                1,
              ),
            )
          }
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(
          (day, index) => (
            <span key={`${day}${index}`}>{day}</span>
          ),
        )}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) =>
          day ? (
            <button
              type="button"
              key={index}
              className={[
                'calendar-day',
                selected === dateKey(day) ? 'selected' : '',
                eventDays.includes(dateKey(day))
                  ? 'has-event'
                  : '',
              ].join(' ')}
              onClick={() => setSelected(dateKey(day))}
            >
              {day}
              {eventDays.includes(dateKey(day)) && <i />}
            </button>
          ) : (
            <span key={index} />
          ),
        )}
      </div>

      <div className="calendar-selected">
        <CalendarDays size={15} />
        <span>
          <strong>{selected}</strong>
          <small>
            {eventDays.includes(selected)
              ? 'Example record date; verify against your own records.'
              : 'No example activity listed for this date.'}
          </small>
        </span>
      </div>
    </div>
  )
}

export default function AccountLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [popover, setPopover] = useState('')
  const [month, setMonth] = useState(new Date())
  const [selected, setSelected] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [loggingOut, setLoggingOut] = useState(false)

  const [notices, setNotices] = useState([
    {
      id: 1,
      title: 'Welcome to RationSaathi',
      text: 'Start by reviewing your household details.',
      read: false,
    },
    {
      id: 2,
      title: 'Keep receipt references',
      text: 'Dates and quantities help you verify your records.',
      read: false,
    },
    {
      id: 3,
      title: 'Check information carefully',
      text: 'An unexplained difference is not proof of misconduct.',
      read: true,
    },
  ])

  const name =
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    'Your account'

  const email = user?.email || ''
  const unread = notices.filter((notice) => !notice.read).length

  // Empty until the backend supplies real record dates.
  const eventDays = useMemo(() => [], [])

  useEffect(() => {
    setDrawer(false)
    setPopover('')
  }, [location.pathname])

  useEffect(() => {
    const onUnauthorized = (event) => {
      setPopover('')

      navigate(
        `/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`,
        {
          replace: true,
          state: {
            reason: 'session-expired',
            path: event.detail?.path,
          },
        },
      )
    }

    window.addEventListener(
      'rationsaathi:unauthorized',
      onUnauthorized,
    )

    return () => {
      window.removeEventListener(
        'rationsaathi:unauthorized',
        onUnauthorized,
      )
    }
  }, [navigate, location.pathname, location.search])

  async function doLogout() {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
      setLoggingOut(false)
    }
  }

  return (
    <div
      className={[
        'dashboard-shell',
        'account-shell',
        collapsed ? 'sidebar-collapsed' : '',
        drawer ? 'sidebar-mobile-open' : '',
      ].join(' ')}
    >
      {drawer && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}

      <aside className="dashboard-sidebar">
        <div className="sidebar-brand-row">
          <Link to="/" className="sidebar-brand">
            <BrandMark compact />

            <span className="sidebar-brand-text">
              <strong>RationSaathi</strong>
              <small>Entitlement companion</small>
            </span>
          </Link>

          <button
            className="sidebar-close-mobile"
            type="button"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-workspace">
          <div className="workspace-avatar">
            {String(name).slice(0, 1).toUpperCase()}
          </div>

          <div className="workspace-copy">
            <strong>{name}</strong>
            <span>Personal workspace</span>
          </div>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Account navigation"
        >
          <p className="sidebar-group-label">WORKSPACE</p>

          {links.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                end
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={() => setDrawer(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-card">
            <div className="help-card-icon">
              <ShieldCheck size={18} />
            </div>

            <strong>Private by design</strong>
            <p>
              Keep sensitive identity and banking details out of
              notes.
            </p>

            <Link
              to="/privacy"
              onClick={() => setDrawer(false)}
            >
              Privacy details <ChevronRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronLeft
              className={collapsed ? 'rotate-arrow' : ''}
              size={17}
            />
            <span>
              {collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'}
            </span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={15} />
              <strong>
                {links.find(
                  (item) => item.to === location.pathname,
                )?.label || 'Help centre'}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              aria-expanded={popover === 'notifications'}
              onClick={() =>
                setPopover((current) =>
                  current === 'notifications'
                    ? ''
                    : 'notifications',
                )
              }
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>

            {popover === 'notifications' && (
              <section className="notification-popover">
                <div className="popover-heading">
                  <div>
                    <strong>Notifications</strong>
                    <small>{unread} unread</small>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNotices((current) =>
                        current.map((notice) => ({
                          ...notice,
                          read: true,
                        })),
                      )
                    }
                  >
                    <CheckCheck size={15} />
                    Mark all read
                  </button>
                </div>

                {notices.map((notice) => (
                  <button
                    type="button"
                    key={notice.id}
                    className={`notification-item ${
                      notice.read ? 'read' : ''
                    }`}
                    onClick={() =>
                      setNotices((current) =>
                        current.map((item) =>
                          item.id === notice.id
                            ? { ...item, read: true }
                            : item,
                        ),
                      )
                    }
                  >
                    <span className="notification-dot">
                      {notice.read ? (
                        <Check size={13} />
                      ) : (
                        <Circle
                          size={9}
                          fill="currentColor"
                        />
                      )}
                    </span>

                    <span>
                      <strong>{notice.title}</strong>
                      <small>{notice.text}</small>
                    </span>
                  </button>
                ))}

                <p className="popover-footnote">
                  Local interface notices; server notifications
                  are not configured.
                </p>
              </section>
            )}

            <button
              type="button"
              className="topbar-icon-button"
              aria-label="Open calendar"
              aria-expanded={popover === 'calendar'}
              onClick={() =>
                setPopover((current) =>
                  current === 'calendar' ? '' : 'calendar',
                )
              }
            >
              <CalendarDays size={19} />
            </button>

            {popover === 'calendar' && (
              <section className="calendar-popover">
                <Calendar
                  month={month}
                  setMonth={setMonth}
                  selected={selected}
                  setSelected={setSelected}
                  eventDays={eventDays}
                />
              </section>
            )}

            <span className="topbar-separator" />

            <div className="profile-wrap">
              <span className="profile-avatar">
                {String(name).slice(0, 1).toUpperCase()}
              </span>

              <span className="profile-text">
                <strong>{name}</strong>
                <small>{email}</small>
              </span>

              <button
                type="button"
                className="account-logout"
                disabled={loggingOut}
                onClick={doLogout}
              >
                <LogOut size={15} />
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </div>
        </header>

        <main className="dashboard-content account-content">
          <Outlet />
        </main>

        <footer className="dashboard-footer">
          <span>© {new Date().getFullYear()} RationSaathi</span>

          <span>
            <ShieldCheck size={14} />
            Independent information tool · Not a government
            service
          </span>

          <Link to="/privacy">Privacy</Link>
        </footer>
      </div>
    </div>
  )
}