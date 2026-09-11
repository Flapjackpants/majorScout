/** Shared constants/helpers for the structured extracurriculars answer (ai_activities). */

export const ACTIVITIES_QUESTION_ID = 'ai_activities'

export const ACTIVITY_CATEGORIES = [
  { id: 'club', label: 'Club / organization' },
  { id: 'sport', label: 'Athletics' },
  { id: 'arts', label: 'Arts / music / theater' },
  { id: 'research', label: 'Research' },
  { id: 'volunteering', label: 'Volunteering / service' },
  { id: 'work', label: 'Job / internship' },
  { id: 'competition', label: 'Competition team' },
  { id: 'other', label: 'Other' },
]

export const AWARD_LEVELS = [
  { id: 'school', label: 'School' },
  { id: 'regional', label: 'Regional' },
  { id: 'state', label: 'State' },
  { id: 'national', label: 'National' },
  { id: 'international', label: 'International' },
]

export function emptyActivitiesValue() {
  return { activities: [], awards: [] }
}

export function normalizeActivitiesValue(value) {
  if (!value || typeof value !== 'object') return emptyActivitiesValue()
  return {
    activities: Array.isArray(value.activities) ? value.activities : [],
    awards: Array.isArray(value.awards) ? value.awards : [],
  }
}

export function activitiesSummary(value) {
  const v = normalizeActivitiesValue(value)
  const named = v.activities.filter((a) => (a.name || '').trim())
  const awards = v.awards.filter((a) => (a.title || '').trim())
  return { activityCount: named.length, awardCount: awards.length }
}

/** Drop rows without a name/title so the model only sees real entries. */
export function cleanActivitiesValue(value) {
  const v = normalizeActivitiesValue(value)
  return {
    activities: v.activities.filter((a) => (a.name || '').trim()),
    awards: v.awards.filter((a) => (a.title || '').trim()),
  }
}

export function commitmentLabel(hoursPerWeek) {
  const h = Number(hoursPerWeek)
  if (!h || Number.isNaN(h)) return null
  if (h < 3) return { label: 'Light', tone: 'text-slate-300 bg-white/10' }
  if (h <= 8) return { label: 'Moderate', tone: 'text-sky-200 bg-sky-500/15' }
  if (h <= 15) return { label: 'Heavy', tone: 'text-violet-200 bg-violet-500/15' }
  return { label: 'Intensive', tone: 'text-amber-200 bg-amber-500/15' }
}
