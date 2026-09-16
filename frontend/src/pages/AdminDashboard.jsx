import { useCallback, useEffect, useState } from 'react'
import {
  deleteAdminDemo,
  fetchAdminEvents,
  fetchAdminFunnel,
  fetchAdminMetrics,
  fetchAdminSessions,
  seedAdminDemo,
  startGoogleLogin,
} from '../api.js'

// ── SVG Math & Curve Helpers ────────────────────────────────────────────────

function createSmoothPath(points, closeToBottom = false, bottomY = 160) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  if (closeToBottom) {
    const lastX = points[points.length - 1].x
    const firstX = points[0].x
    d += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }
  return d
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

// ── Soft-UI Chart Components ────────────────────────────────────────────────

/** Top KPI curved trend chart */
function CurvedTrendMini({ data = [], width = 240, height = 70, stroke = '#38bdf8', fillId = 'blueGrad' }) {
  const values = data.length > 0 ? data : [12, 18, 14, 25, 20, 32, 28]
  const min = Math.min(...values)
  const max = Math.max(...values, min + 1)
  const paddingX = 8
  const paddingY = 8

  const points = values.map((val, i) => {
    const x = paddingX + (i / Math.max(values.length - 1, 1)) * (width - paddingX * 2)
    const y = height - paddingY - ((val - min) / (max - min)) * (height - paddingY * 2)
    return { x, y }
  })

  const linePath = createSmoothPath(points)
  const areaPath = createSmoothPath(points, true, height)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, idx) => (
        <circle key={idx} cx={p.x} cy={p.y} r="2.5" fill={stroke} className="opacity-70 hover:opacity-100 transition" />
      ))}
    </svg>
  )
}

/** Focal Multi-Layer Area Wave Chart (matching center of mockup) */
function MultiLayerAreaChart({ data = [], height = 180 }) {
  const chartWidth = 600
  const series = data.length > 0 ? data : [
    { label: '01', active_sessions: 30, quiz_activity: 20, quiz_completed: 12 },
    { label: '02', active_sessions: 45, quiz_activity: 32, quiz_completed: 18 },
    { label: '03', active_sessions: 35, quiz_activity: 25, quiz_completed: 15 },
    { label: '04', active_sessions: 60, quiz_activity: 44, quiz_completed: 28 },
    { label: '05', active_sessions: 52, quiz_activity: 38, quiz_completed: 24 },
    { label: '06', active_sessions: 75, quiz_activity: 56, quiz_completed: 35 },
    { label: '07', active_sessions: 68, quiz_activity: 49, quiz_completed: 30 },
    { label: '08', active_sessions: 90, quiz_activity: 70, quiz_completed: 45 },
    { label: '09', active_sessions: 82, quiz_activity: 62, quiz_completed: 40 },
    { label: '10', active_sessions: 70, quiz_activity: 50, quiz_completed: 32 },
    { label: '11', active_sessions: 85, quiz_activity: 65, quiz_completed: 42 },
    { label: '12', active_sessions: 95, quiz_activity: 74, quiz_completed: 50 },
  ]

  const maxVal = Math.max(
    ...series.map((d) => Math.max(d.active_sessions || 0, d.quiz_activity || 0, d.quiz_completed || 0)),
    10
  )

  const padX = 20
  const padBottom = 26
  const padTop = 15
  const usableHeight = height - padBottom - padTop

  const getPoints = (key) =>
    series.map((item, i) => {
      const val = item[key] || 0
      const x = padX + (i / Math.max(series.length - 1, 1)) * (chartWidth - padX * 2)
      const y = height - padBottom - (val / maxVal) * usableHeight
      return { x, y }
    })

  const ptsSessions = getPoints('active_sessions')
  const ptsQuiz = getPoints('quiz_activity')
  const ptsCompletes = getPoints('quiz_completed')

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="areaSessionsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="areaQuizGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="areaCompletesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Subtle grid lines */}
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padBottom - usableHeight * ratio
          return (
            <line
              key={ratio}
              x1={padX}
              y1={y}
              x2={chartWidth - padX}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="4 4"
              strokeWidth="0.8"
            />
          )
        })}

        {/* Layer 1: Sessions (Purple) */}
        <path d={createSmoothPath(ptsSessions, true, height - padBottom)} fill="url(#areaSessionsGrad)" />
        <path
          d={createSmoothPath(ptsSessions)}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Layer 2: Quiz Activity (Sky Blue) */}
        <path d={createSmoothPath(ptsQuiz, true, height - padBottom)} fill="url(#areaQuizGrad)" />
        <path
          d={createSmoothPath(ptsQuiz)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Layer 3: Quiz Completes (Teal) */}
        <path d={createSmoothPath(ptsCompletes, true, height - padBottom)} fill="url(#areaCompletesGrad)" />
        <path
          d={createSmoothPath(ptsCompletes)}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* X-axis ticks */}
        {series.map((item, idx) => {
          const x = padX + (idx / Math.max(series.length - 1, 1)) * (chartWidth - padX * 2)
          return (
            <text
              key={idx}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400 dark:fill-slate-500 text-[10px] font-semibold tracking-wider uppercase"
            >
              {item.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

/** Hexagonal Spider / Radar Chart (matching middle right of mockup) */
function RadarSpiderChart({ data = [], size = 200 }) {
  const center = size / 2
  const maxRadius = size * 0.4
  const dimensions = data.length === 6 ? data : [
    { dimension: 'Progress', value: 75, target: 60 },
    { dimension: 'Duration', value: 85, target: 70 },
    { dimension: 'Signups', value: 55, target: 50 },
    { dimension: 'Return', value: 65, target: 55 },
    { dimension: 'PRO+', value: 45, target: 40 },
    { dimension: 'Explore', value: 80, target: 65 },
  ]

  const levels = [0.25, 0.5, 0.75, 1.0]

  // Compute actual polygon
  const actualPolygon = dimensions
    .map((dim, i) => {
      const angle = (i * 360) / dimensions.length
      const r = (Math.max(10, Math.min(dim.value || 0, 100)) / 100) * maxRadius
      const pt = polarToCartesian(center, center, r, angle)
      return `${pt.x},${pt.y}`
    })
    .join(' ')

  // Compute target polygon
  const targetPolygon = dimensions
    .map((dim, i) => {
      const angle = (i * 360) / dimensions.length
      const r = ((dim.target || 60) / 100) * maxRadius
      const pt = polarToCartesian(center, center, r, angle)
      return `${pt.x},${pt.y}`
    })
    .join(' ')

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Concentric hexagonal grid rings */}
        {levels.map((lvl, lIdx) => {
          const r = maxRadius * lvl
          const hexPts = dimensions
            .map((_, i) => {
              const angle = (i * 360) / dimensions.length
              const pt = polarToCartesian(center, center, r, angle)
              return `${pt.x},${pt.y}`
            })
            .join(' ')
          return (
            <polygon
              key={lIdx}
              points={hexPts}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="0.8"
            />
          )
        })}

        {/* Axes lines */}
        {dimensions.map((_, i) => {
          const angle = (i * 360) / dimensions.length
          const pt = polarToCartesian(center, center, maxRadius, angle)
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={pt.x}
              y2={pt.y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="0.8"
            />
          )
        })}

        {/* Target shape (cool purple/blue) */}
        <polygon
          points={targetPolygon}
          fill="#818cf8"
          fillOpacity="0.2"
          stroke="#818cf8"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* Actual polygon (teal/cyan vibrant) */}
        <polygon
          points={actualPolygon}
          fill="#2dd4bf"
          fillOpacity="0.5"
          stroke="#0d9488"
          strokeWidth="2"
        />

        {/* Dimension labels */}
        {dimensions.map((dim, i) => {
          const angle = (i * 360) / dimensions.length
          const pt = polarToCartesian(center, center, maxRadius + 14, angle)
          return (
            <text
              key={i}
              x={pt.x}
              y={pt.y + 3}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 text-[9px] font-bold tracking-tight uppercase"
            >
              {dim.dimension}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

/** Donut / Ring chart with multi-segments */
function DonutSegmentChart({ data = {}, size = 110 }) {
  const guests = data.guest_sessions || 0
  const registered = data.registered_free || 0
  const pro = data.pro_users || 0
  const total = Math.max(guests + registered + pro, 1)

  const pGuests = (guests / total) * 100
  const pReg = (registered / total) * 100
  const pPro = (pro / total) * 100

  const radius = 40
  const circumference = 2 * Math.PI * radius

  const strokePro = (pPro / 100) * circumference
  const strokeReg = (pReg / 100) * circumference
  const strokeGuests = (pGuests / 100) * circumference

  const offsetPro = 0
  const offsetReg = -strokePro
  const offsetGuests = -(strokePro + strokeReg)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="12" />
        {/* Guests Segment (Blue) */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="12"
          strokeDasharray={`${strokeGuests} ${circumference}`}
          strokeDashoffset={offsetGuests}
        />
        {/* Registered Segment (Teal) */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="12"
          strokeDasharray={`${strokeReg} ${circumference}`}
          strokeDashoffset={offsetReg}
        />
        {/* PRO+ Segment (Amber) */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="12"
          strokeDasharray={`${strokePro} ${circumference}`}
          strokeDashoffset={offsetPro}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-black text-slate-800 dark:text-white">{total}</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Users</span>
      </div>
    </div>
  )
}

/** Mini Sparkline for Bottom Right Metric Widgets */
function MiniSparkline({ data = [], color = '#38bdf8', height = 30, width = 80 }) {
  const values = data.length > 0 ? data : [10, 15, 12, 18, 14, 22, 20]
  const min = Math.min(...values)
  const max = Math.max(...values, min + 1)

  const pts = values.map((val, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width
    const y = height - ((val - min) / (max - min)) * (height - 4) - 2
    return { x, y }
  })

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path
        d={createSmoothPath(pts)}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Main Admin Dashboard Component ──────────────────────────────────────────

export default function AdminDashboard({ user, onHome, _onRefreshUser, _onStartQuiz }) {
  const [tab, setTab] = useState('overview') // 'overview' | 'funnel' | 'sessions' | 'events'
  const [range, setRange] = useState('7d') // 'today' | '7d' | '30d' | 'all'
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [sessionsData, setSessionsData] = useState({ sessions: [], total: 0, page: 1, pages: 1 })
  const [eventsData, setEventsData] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(false)

  const loadAllData = useCallback(async () => {
    if (!user?.is_admin) return
    setLoading(true)
    try {
      const [m, f, s, e] = await Promise.all([
        fetchAdminMetrics(range).catch(() => null),
        fetchAdminFunnel(range).catch(() => null),
        fetchAdminSessions({ page: 1, limit: 25, search: searchQuery }).catch(() => ({ sessions: [], total: 0 })),
        fetchAdminEvents({ limit: 50 }).catch(() => ({ events: [] })),
      ])
      if (m) setMetrics(m)
      if (f) setFunnel(f)
      if (s) setSessionsData(s)
      if (e?.events) setEventsData(e.events)
    } finally {
      setLoading(false)
    }
  }, [user?.is_admin, range, searchQuery])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  async function handleSeedDemo() {
    setSeeding(true)
    try {
      await seedAdminDemo()
      await loadAllData()
    } finally {
      setSeeding(false)
    }
  }

  async function handleDeleteDemo() {
    if (!window.confirm('Remove seeded demo sessions and events?')) return
    setSeeding(true)
    try {
      await deleteAdminDemo()
      await loadAllData()
    } finally {
      setSeeding(false)
    }
  }

  // Unauthorized view
  if (!user || !user.is_admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-3xl text-rose-400 border border-rose-500/20">
          🔒
        </div>
        <h1 className="mt-4 text-2xl font-black">Admin Access Required</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400 leading-relaxed">
          The analytics dashboard is restricted to administrator accounts. Please sign in with an authorized admin email address.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => startGoogleLogin({ selectAccount: true })}
            className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:scale-105 transition"
          >
            Sign in with Admin Google Account
          </button>
          <button
            onClick={onHome}
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
          >
            Back to Site
          </button>
        </div>
      </div>
    )
  }

  const kpi = metrics?.kpi || {
    total_visitors: 0,
    visitors_change: 0,
    total_sessions: 0,
    sessions_change: 0,
    accounts_created: 0,
    accounts_change: 0,
    avg_duration_formatted: '0m 0s',
    quiz_starts: 0,
    quiz_completes: 0,
    quiz_completion_rate: 0,
    active_now: 0,
  }

  const device = metrics?.device_breakdown || {
    desktop: { count: 0, percent: 0 },
    mobile: { count: 0, percent: 0 },
    tablet: { count: 0, percent: 0 },
  }

  const themeClasses = isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#f4f7fb] text-slate-800'
  const cardClasses = isDarkMode
    ? 'rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-black/20 p-5'
    : 'rounded-2xl border border-slate-200/90 bg-white shadow-sm p-5'

  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClasses}`}>
      <div className="mx-auto flex max-w-[1520px] flex-col lg:flex-row min-h-screen">
        {/* ── Sidebar (Left Navigation) ─────────────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            {/* Brand Logo & Name */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-sm shadow-md shadow-sky-500/30">
                  MS
                </div>
                <div>
                  <div className="text-sm font-black tracking-tight text-slate-900 dark:text-white">MajorScout</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-500">Telemetry Admin</div>
                </div>
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="mt-6 space-y-1">
              {[
                { id: 'overview', label: 'OVERVIEW', icon: '📊' },
                { id: 'funnel', label: 'QUIZ FUNNEL', icon: '🎯' },
                { id: 'sessions', label: 'USER SESSIONS', icon: '⏱️' },
                { id: 'events', label: 'LIVE EVENTS', icon: '⚡' },
              ].map((item) => {
                const isActive = tab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-black tracking-wider transition ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-300 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Live Indicator */}
            <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {kpi.active_now} Active On Site
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-400/80">
                Tracking heartbeat &amp; active steps
              </p>
            </div>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              {user.picture ? (
                <img src={user.picture} alt="" className="h-7 w-7 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-sky-500/20 text-sky-500 font-bold flex items-center justify-center text-xs">
                  {user.email[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-bold truncate text-slate-800 dark:text-white">{user.name || 'Admin'}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="flex-1 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2 py-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition"
              >
                {seeding ? 'Seeding…' : 'Seed Demo Data'}
              </button>
              <button
                onClick={handleDeleteDemo}
                disabled={seeding}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition"
                title="Clear demo data"
              >
                Clear
              </button>
            </div>

            <button
              onClick={onHome}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span>←</span> Return to Site
            </button>
          </div>
        </aside>

        {/* ── Main Content Area ────────────────────────────────────────── */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {/* Top Header & Range Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {tab === 'overview' && 'Activity & Performance Overview'}
                {tab === 'funnel' && 'Quiz Progression & Drop-off Funnel'}
                {tab === 'sessions' && 'Active & Historic User Sessions'}
                {tab === 'events' && 'Real-time Telemetry Event Stream'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time site telemetry across quiz completion, signups, and session duration.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl">
              {[
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    range === r.id
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <button
                onClick={loadAllData}
                disabled={loading}
                className="p-1.5 text-xs text-slate-500 hover:text-sky-500 transition"
                title="Refresh Metrics"
              >
                🔄
              </button>
            </div>
          </div>

          {/* ── Tab: OVERVIEW ────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Row 1: Top KPI Cards (matching top row of mockup) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Metric Card 1: Visitors with Curved Line */}
                <div className={cardClasses}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Visitors</span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        kpi.visitors_change >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {kpi.visitors_change >= 0 ? `+${kpi.visitors_change}%` : `${kpi.visitors_change}%`}
                    </span>
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {kpi.total_visitors}
                  </div>
                  <div className="mt-4 h-16 w-full">
                    <CurvedTrendMini
                      data={metrics?.timeline?.map((t) => t.visitors) || []}
                      stroke="#38bdf8"
                      fillId="kpiVisitorsGrad"
                    />
                  </div>
                </div>

                {/* Metric Card 2: Quiz Progress & Retention */}
                <div className={cardClasses}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Quiz Completion</span>
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {kpi.quiz_completion_rate}% Rate
                    </span>
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {kpi.quiz_completes} <span className="text-sm font-semibold text-slate-400">/ {kpi.quiz_starts} started</span>
                  </div>
                  {/* Horizontal milestone progress bars */}
                  <div className="mt-4 space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Started (Q1)</span>
                        <span>100%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Mid-Quiz (Q8)</span>
                        <span>{Math.round(Math.max(kpi.quiz_completion_rate * 1.3, 20))}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{ width: `${Math.min(100, Math.round(Math.max(kpi.quiz_completion_rate * 1.3, 20)))}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Completed (Q15)</span>
                        <span>{kpi.quiz_completion_rate}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-teal-400 rounded-full"
                          style={{ width: `${kpi.quiz_completion_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric Card 3: Account Signups */}
                <div className={cardClasses}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Accounts Created</span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        kpi.accounts_change >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {kpi.accounts_change >= 0 ? `+${kpi.accounts_change}%` : `${kpi.accounts_change}%`}
                    </span>
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {kpi.accounts_created}
                  </div>
                  <div className="mt-4 h-16 w-full">
                    <CurvedTrendMini
                      data={metrics?.timeline?.map((t) => t.accounts) || []}
                      stroke="#818cf8"
                      fillId="kpiAccountsGrad"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Center Primary Analytics Card + Right Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Large Center Area Chart Card (span 2) */}
                <div className={`${cardClasses} lg:col-span-2 flex flex-col justify-between`}>
                  <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="text-base font-black text-slate-900 dark:text-white">Active Traffic &amp; Progression</div>
                        <div className="text-xs text-slate-400">Sessions vs Quiz Activity vs Completed Attempts</div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                          <span className="text-slate-600 dark:text-slate-300">Sessions</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                          <span className="text-slate-600 dark:text-slate-300">Quiz Active</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                          <span className="text-slate-600 dark:text-slate-300">Completed</span>
                        </span>
                      </div>
                    </div>

                    {/* Headline numbers inside area card */}
                    <div className="grid grid-cols-3 gap-4 my-4 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                        <div className="text-xl font-black text-indigo-500">{kpi.total_sessions}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Total Sessions</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                        <div className="text-xl font-black text-sky-500">{kpi.quiz_starts}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Quiz Starts</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                        <div className="text-xl font-black text-teal-500">{kpi.quiz_completes}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Completes</div>
                      </div>
                    </div>

                    {/* Multi-layered Area Wave Chart */}
                    <div className="pt-2">
                      <MultiLayerAreaChart data={metrics?.area_chart || []} height={190} />
                    </div>
                  </div>

                  {/* Device Breakdown sub-section (matching bottom of mockup card) */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💻</span>
                        <div>
                          <div className="text-xs font-black text-slate-800 dark:text-white">{device.desktop.count}</div>
                          <div className="text-[10px] text-slate-400">Desktop ({device.desktop.percent}%)</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">📱</span>
                        <div>
                          <div className="text-xs font-black text-slate-800 dark:text-white">{device.mobile.count}</div>
                          <div className="text-[10px] text-slate-400">Mobile ({device.mobile.percent}%)</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">📟</span>
                        <div>
                          <div className="text-xs font-black text-slate-800 dark:text-white">{device.tablet.count}</div>
                          <div className="text-[10px] text-slate-400">Tablet ({device.tablet.percent}%)</div>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-sky-500 bg-sky-500/10 px-2.5 py-1 rounded-full">
                      100% Tracked
                    </span>
                  </div>
                </div>

                {/* Right Column: Hexagonal Radar Chart Widget */}
                <div className={`${cardClasses} flex flex-col justify-between`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Engagement Radar</span>
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                      6 Pillars
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-center">
                    <RadarSpiderChart data={metrics?.radar_data || []} size={210} />
                  </div>
                  <div className="flex justify-around pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="h-2 w-2 rounded-full bg-teal-400" />
                      Current
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="h-2 w-2 rounded-full bg-indigo-400" />
                      Target (60+)
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Time on Site Summary, User Donut, and Sparklines */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Time on Site Card */}
                <div className={cardClasses}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Avg Session Duration</span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        kpi.duration_change >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {kpi.duration_change >= 0 ? `+${kpi.duration_change}%` : `${kpi.duration_change}%`}
                    </span>
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {kpi.avg_duration_formatted}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Active engagement time measured via heartbeat</p>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs font-black text-slate-700 dark:text-slate-300">&lt; 1m</div>
                      <div className="text-[9px] text-slate-400">Bounce</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs font-black text-sky-500">1 - 5m</div>
                      <div className="text-[9px] text-slate-400">Core Quiz</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs font-black text-indigo-500">&gt; 5m</div>
                      <div className="text-[9px] text-slate-400">Deep Read</div>
                    </div>
                  </div>
                </div>

                {/* User Breakdown Donut Card */}
                <div className={cardClasses}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">User Segments</span>
                    <span className="text-xs font-bold text-slate-500">Composition</span>
                  </div>
                  <div className="flex items-center justify-around py-2">
                    <DonutSegmentChart data={metrics?.user_distribution || {}} size={110} />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          Guest ({metrics?.user_distribution?.guest_sessions || 0})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          Free ({metrics?.user_distribution?.registered_free || 0})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          PRO+ ({metrics?.user_distribution?.pro_users || 0})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                    Registered users have cloud persistence for quiz attempts
                  </div>
                </div>

                {/* Sparklines Widget Card (Bottom Right in mockup) */}
                <div className={`${cardClasses} flex flex-col justify-between`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Trend Highlights
                  </div>
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-800 dark:text-white">{kpi.total_visitors} Visitors</div>
                        <div className="text-[10px] text-emerald-500 font-bold">+{kpi.visitors_change}% trend</div>
                      </div>
                      <MiniSparkline
                        data={metrics?.sparklines?.visitors?.trend || []}
                        color="#38bdf8"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-800 dark:text-white">{kpi.avg_duration_formatted}</div>
                        <div className="text-[10px] text-sky-500 font-bold">Time on Site</div>
                      </div>
                      <MiniSparkline
                        data={metrics?.sparklines?.duration?.trend || []}
                        color="#818cf8"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-800 dark:text-white">{kpi.quiz_completion_rate}% Completion</div>
                        <div className="text-[10px] text-teal-500 font-bold">Funnel conversion</div>
                      </div>
                      <MiniSparkline
                        data={metrics?.sparklines?.completion?.trend || []}
                        color="#2dd4bf"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: QUIZ FUNNEL ────────────────────────────────────────── */}
          {tab === 'funnel' && (
            <div className="space-y-6">
              <div className={cardClasses}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Step-by-Step Question Progression</h2>
                    <p className="text-xs text-slate-400">See exactly which questions cause drop-off or engagement.</p>
                  </div>
                  <div className="flex gap-4 text-xs font-bold">
                    <span className="text-emerald-500">Completed: {funnel?.summary?.total_completed || 0}</span>
                    <span className="text-indigo-500">Started: {funnel?.summary?.total_started || 0}</span>
                    <span className="text-sky-500">Rate: {funnel?.summary?.completion_rate || 0}%</span>
                  </div>
                </div>

                {/* Milestone progression bars */}
                <div className="mt-6 space-y-4">
                  {(funnel?.milestones || []).map((m, idx) => (
                    <div key={m.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-500 text-[10px] font-black">
                            {idx + 1}
                          </span>
                          <span className="text-slate-800 dark:text-white">{m.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-normal">{m.count} users</span>
                          <span className="font-black text-sky-600 dark:text-sky-400">{m.overall_conversion}%</span>
                          {idx > 0 && m.drop_off_count > 0 && (
                            <span className="text-[11px] text-rose-500 font-medium">(-{m.drop_off_count} dropped)</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${m.overall_conversion}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Avg Time to Complete Quiz
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-800 dark:text-white">
                      {Math.round((funnel?.summary?.avg_completed_duration_seconds || 0) / 60)} min{' '}
                      {Math.round((funnel?.summary?.avg_completed_duration_seconds || 0) % 60)} sec
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">For students who finish all 15 questions</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Avg Time for Incomplete Sessions
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-800 dark:text-white">
                      {Math.round((funnel?.summary?.avg_incomplete_duration_seconds || 0) / 60)} min{' '}
                      {Math.round((funnel?.summary?.avg_incomplete_duration_seconds || 0) % 60)} sec
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Time spent before leaving</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: USER SESSIONS ────────────────────────────────────────── */}
          {tab === 'sessions' && (
            <div className="space-y-6">
              <div className={cardClasses}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent User Sessions</h2>
                    <p className="text-xs text-slate-400">Detailed logs of visitors, devices, duration, and progress.</p>
                  </div>
                  <div className="w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search session ID, email, OS…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Sessions Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3">Session ID</th>
                        <th className="py-3 px-3">User</th>
                        <th className="py-3 px-3">Device / OS</th>
                        <th className="py-3 px-3">Duration</th>
                        <th className="py-3 px-3">Quiz Step</th>
                        <th className="py-3 px-3">Completed</th>
                        <th className="py-3 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(sessionsData?.sessions || []).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                            {s.session_id.substring(0, 16)}…
                          </td>
                          <td className="py-3 px-3">
                            {s.user_email ? (
                              <div>
                                <span className="font-bold text-slate-800 dark:text-white">{s.user_name || s.user_email}</span>
                                {s.is_pro && (
                                  <span className="ml-1.5 text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                    PRO+
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Guest Visitor</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                              {s.device_type}
                            </span>{' '}
                            <span className="text-slate-400">· {s.browser} on {s.os}</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-white">
                            {Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Step {s.max_quiz_step}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {s.quiz_completed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                ✓ Yes
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {s.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sessionsData.sessions.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No sessions recorded matching this filter. Click &ldquo;Seed Demo Data&rdquo; in the sidebar to populate realistic sample data.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: LIVE EVENTS ────────────────────────────────────────── */}
          {tab === 'events' && (
            <div className="space-y-6">
              <div className={cardClasses}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Telemetry Events</h2>
                    <p className="text-xs text-slate-400">Stream of discrete interactions recorded on the site.</p>
                  </div>
                  <span className="text-xs font-bold text-sky-500 bg-sky-500/10 px-3 py-1 rounded-full">
                    {eventsData.length} Recent Events
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  {eventsData.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase ${
                            ev.event_type === 'quiz_complete'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : ev.event_type === 'quiz_step'
                              ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                              : ev.event_type === 'account_created'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {ev.event_type}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {ev.page || '/'}
                        </span>
                        {ev.user_email && (
                          <span className="text-slate-400 text-[11px] truncate max-w-[140px]">
                            ({ev.user_email})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                        <span className="font-mono text-[10px] text-slate-500 truncate max-w-xs">
                          {JSON.stringify(ev.properties || {})}
                        </span>
                        <span className="shrink-0">{ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  ))}

                  {eventsData.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No events recorded yet. Start exploring or taking the quiz, or click &ldquo;Seed Demo Data&rdquo;.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
