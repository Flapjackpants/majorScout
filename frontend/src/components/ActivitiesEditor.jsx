import { useMemo } from 'react'
import {
  ACTIVITY_CATEGORIES,
  AWARD_LEVELS,
  activitiesSummary,
  commitmentLabel,
  normalizeActivitiesValue,
} from '../lib/activities.js'

const GRADES = [9, 10, 11, 12]

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2'
const selectClass = `${inputClass} appearance-none`
const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-slate-500'

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function IconButton({ onClick, title, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-xs text-slate-400 transition hover:border-white/30 hover:text-white disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400"
    >
      {children}
    </button>
  )
}

function ActivityRow({ activity, index, total, onChange, onRemove, onMove }) {
  const commitment = commitmentLabel(activity.hoursPerWeek)
  const grades = Array.isArray(activity.grades) ? activity.grades : []

  function toggleGrade(g) {
    const next = grades.includes(g) ? grades.filter((x) => x !== g) : [...grades, g].sort()
    onChange({ ...activity, grades: next })
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20 text-[11px] font-bold text-violet-200">
            {index + 1}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Activity</span>
          {commitment && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${commitment.tone}`}>
              {commitment.label} commitment
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton title="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            ↑
          </IconButton>
          <IconButton title="Move down" onClick={() => onMove(1)} disabled={index === total - 1}>
            ↓
          </IconButton>
          <IconButton title="Remove" onClick={onRemove}>
            ✕
          </IconButton>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input
            type="text"
            value={activity.name || ''}
            onChange={(e) => onChange({ ...activity, name: e.target.value })}
            placeholder="e.g. Robotics Club, Varsity Soccer, Hospital volunteer"
            className={inputClass}
          />
        </Field>
        <Field label="Category">
          <select
            value={activity.category || 'club'}
            onChange={(e) => onChange({ ...activity, category: e.target.value })}
            className={selectClass}
          >
            {ACTIVITY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900">
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role / position">
          <input
            type="text"
            value={activity.role || ''}
            onChange={(e) => onChange({ ...activity, role: e.target.value })}
            placeholder="e.g. Captain, Founder, Member"
            className={inputClass}
          />
        </Field>
        <Field label="Grades participated">
          <div className="flex gap-2">
            {GRADES.map((g) => {
              const on = grades.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition ${
                    on
                      ? 'border-sky-400 bg-sky-400/15 text-sky-100'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-sky-400/40'
                  }`}
                >
                  {g}th
                </button>
              )
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours / week">
            <input
              type="number"
              min="0"
              max="80"
              value={activity.hoursPerWeek ?? ''}
              onChange={(e) => onChange({ ...activity, hoursPerWeek: e.target.value })}
              placeholder="5"
              className={inputClass}
            />
          </Field>
          <Field label="Weeks / year">
            <input
              type="number"
              min="0"
              max="52"
              value={activity.weeksPerYear ?? ''}
              onChange={(e) => onChange({ ...activity, weeksPerYear: e.target.value })}
              placeholder="30"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="What you did (one line)" className="sm:col-span-2">
          <input
            type="text"
            value={activity.description || ''}
            onChange={(e) => onChange({ ...activity, description: e.target.value })}
            placeholder="e.g. Led a 12-person team to build an autonomous robot that placed 3rd at regionals"
            maxLength={200}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  )
}

function AwardRow({ award, index, activities, onChange, onRemove }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/20 text-[11px] font-bold text-amber-200">
            {index + 1}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300/80">Award</span>
        </div>
        <IconButton title="Remove" onClick={onRemove}>
          ✕
        </IconButton>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input
            type="text"
            value={award.title || ''}
            onChange={(e) => onChange({ ...award, title: e.target.value })}
            placeholder="e.g. AIME qualifier, All-State Orchestra, Regional Science Fair 1st place"
            className={inputClass}
          />
        </Field>
        <Field label="Level" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {AWARD_LEVELS.map((lvl) => {
              const on = (award.level || 'school') === lvl.id
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onChange({ ...award, level: lvl.id })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? 'border-amber-400 bg-amber-400/15 text-amber-100'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-amber-400/40'
                  }`}
                >
                  {lvl.label}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Year">
          <input
            type="number"
            min="2000"
            max="2100"
            value={award.year ?? ''}
            onChange={(e) => onChange({ ...award, year: e.target.value })}
            placeholder={String(new Date().getFullYear())}
            className={inputClass}
          />
        </Field>
        <Field label="Related activity (optional)">
          <select
            value={award.activityId || ''}
            onChange={(e) => onChange({ ...award, activityId: e.target.value || null })}
            className={selectClass}
          >
            <option value="" className="bg-slate-900">
              None
            </option>
            {activities
              .filter((a) => (a.name || '').trim())
              .map((a) => (
                <option key={a.id} value={a.id} className="bg-slate-900">
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </div>
  )
}

/**
 * Structured extracurriculars + awards editor. Controlled:
 *   value = { activities: [...], awards: [...] }
 */
export default function ActivitiesEditor({ value, onChange, compact = false }) {
  const v = useMemo(() => normalizeActivitiesValue(value), [value])

  function setActivities(activities) {
    onChange({ ...v, activities })
  }
  function setAwards(awards) {
    onChange({ ...v, awards })
  }

  function addActivity() {
    setActivities([
      ...v.activities,
      {
        id: uid(),
        name: '',
        category: 'club',
        role: '',
        grades: [],
        hoursPerWeek: '',
        weeksPerYear: '',
        description: '',
      },
    ])
  }

  function addAward() {
    setAwards([...v.awards, { id: uid(), title: '', level: 'school', year: '', activityId: null }])
  }

  function moveActivity(index, delta) {
    const target = index + delta
    if (target < 0 || target >= v.activities.length) return
    const next = [...v.activities]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setActivities(next)
  }

  const summary = activitiesSummary(v)

  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Activities</h3>
            <p className="text-xs text-slate-500">
              {summary.activityCount === 0
                ? 'Add clubs, sports, jobs, research, and service. Most students list 4–10.'
                : `${summary.activityCount} listed · order them by importance to you.`}
            </p>
          </div>
          <button
            type="button"
            onClick={addActivity}
            className="shrink-0 rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-400/20"
          >
            + Add activity
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {v.activities.length === 0 && (
            <button
              type="button"
              onClick={addActivity}
              className="w-full rounded-2xl border border-dashed border-white/15 px-4 py-8 text-sm text-slate-500 transition hover:border-sky-400/40 hover:text-slate-300"
            >
              No activities yet — click to add your first one
            </button>
          )}
          {v.activities.map((a, i) => (
            <ActivityRow
              key={a.id || i}
              activity={a}
              index={i}
              total={v.activities.length}
              onChange={(next) => setActivities(v.activities.map((x, j) => (j === i ? next : x)))}
              onRemove={() => {
                const removedId = a.id
                setActivities(v.activities.filter((_, j) => j !== i))
                if (removedId) {
                  setAwards(v.awards.map((aw) => (aw.activityId === removedId ? { ...aw, activityId: null } : aw)))
                }
              }}
              onMove={(delta) => moveActivity(i, delta)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Awards & honors</h3>
            <p className="text-xs text-slate-500">
              {summary.awardCount === 0
                ? 'Competitions, recognitions, scholarships — with the level you earned them at.'
                : `${summary.awardCount} listed.`}
            </p>
          </div>
          <button
            type="button"
            onClick={addAward}
            className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20"
          >
            + Add award
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {v.awards.length === 0 && (
            <button
              type="button"
              onClick={addAward}
              className="w-full rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-slate-500 transition hover:border-amber-400/40 hover:text-slate-300"
            >
              No awards yet — that's fine, add any you have
            </button>
          )}
          {v.awards.map((aw, i) => (
            <AwardRow
              key={aw.id || i}
              award={aw}
              index={i}
              activities={v.activities}
              onChange={(next) => setAwards(v.awards.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setAwards(v.awards.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
