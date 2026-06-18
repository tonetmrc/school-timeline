import { addDays, format, isWeekend, parseISO, getDay, isWithinInterval } from 'date-fns'

// ── Holiday definitions ──────────────────────────────────────────────────────

// Days off for the WHOLE team (no work at all)
const TEAM_HOLIDAY_DATES = ['2026-06-01', '2026-06-02']

// Summer pause: 7–24 Aug 2026
// During this period the TEAM cannot do: DE, QA, staging review, final validation,
// translation, tech check, or go-live.
// Schools CAN still do: self-review and sign-off (they work independently).
const SUMMER_START = new Date('2026-08-07')
const SUMMER_END   = new Date('2026-08-24')

export function isSummerPause(date) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return isWithinInterval(d, { start: SUMMER_START, end: SUMMER_END })
}

export function isTeamHoliday(date) {
  return TEAM_HOLIDAY_DATES.includes(format(date, 'yyyy-MM-dd')) || isSummerPause(date)
}

export function isSchoolHoliday(date) {
  return false // Schools work all weekdays (incl. Jun 1–2 and summer pause)
}

// Team workday: no weekend, no team holiday (incl. summer pause)
export function isTeamWorkday(date) {
  return !isWeekend(date) && !isTeamHoliday(date)
}

// School workday: no weekend
export function isSchoolWorkday(date) {
  return !isWeekend(date)
}

// ── Date arithmetic ──────────────────────────────────────────────────────────

export function addTeamWorkdays(startDate, n) {
  let date = new Date(startDate)
  let count = 0
  while (count < n) {
    if (isTeamWorkday(date)) count++
    if (count < n) date = addDays(date, 1)
  }
  return date
}

export function addSchoolWorkdays(startDate, n) {
  let date = new Date(startDate)
  let count = 0
  while (count < n) {
    if (isSchoolWorkday(date)) count++
    if (count < n) date = addDays(date, 1)
  }
  return date
}

export function nextTeamWorkday(date) {
  let d = new Date(date)
  while (!isTeamWorkday(d)) d = addDays(d, 1)
  return d
}

export function nextSchoolWorkday(date) {
  let d = new Date(date)
  while (!isSchoolWorkday(d)) d = addDays(d, 1)
  return d
}

// Next day that is a workday for BOTH team and school
export function nextSharedWorkday(date) {
  let d = new Date(date)
  while (!isTeamWorkday(d) || !isSchoolWorkday(d)) d = addDays(d, 1)
  return d
}

export function phaseEnd(startDate, durationDays, isTeam = true) {
  return isTeam ? addTeamWorkdays(startDate, durationDays) : addSchoolWorkdays(startDate, durationDays)
}

export function fmt(date) {
  if (!date) return ''
  return format(date, 'd MMM')
}

export function fmtFull(date) {
  if (!date) return ''
  return format(date, 'EEE d MMM')
}

export function isFriday(date) {
  return getDay(date) === 5
}

// ── Main scheduler ───────────────────────────────────────────────────────────

// durations: { de, qa, review, sr, fv, signoff, check } — working-day lengths per phase.
// Any phase not present falls back to the default below.
export const DEFAULT_DURATIONS = { de: 5, qa: 1, review: 2, sr: 1, fv: 1, signoff: 2, check: 1 }

export function computeSchedule(deStartDate, needsTranslation = false, translationDays = 4, manualLiveDate = null, durations = {}) {
  const d = { ...DEFAULT_DURATIONS, ...durations }
  const start = typeof deStartDate === 'string' ? parseISO(deStartDate) : new Date(deStartDate)

  // Phase 1: DE — d.de team workdays (blocked during summer pause)
  const deStart = nextTeamWorkday(start)
  const deEnd   = addTeamWorkdays(deStart, d.de)

  // Phase 1b: QA Jakala — d.qa team workdays (blocked during summer pause)
  const qaStart = nextTeamWorkday(addDays(deEnd, 1))
  const qaEnd   = d.qa > 1 ? addTeamWorkdays(qaStart, d.qa) : qaStart

  // Phase 2: School self-review — d.review school workdays
  // Schools CAN work during summer pause, team doesn't need to be present
  const reviewStart = nextSchoolWorkday(addDays(qaEnd, 1))
  const reviewEnd   = addSchoolWorkdays(reviewStart, d.review)

  // Phase 3: Staging review — d.sr days, needs BOTH team and school
  // Blocked during summer pause
  let srStart = addDays(reviewEnd, 1)
  while (!isSchoolWorkday(srStart) || !isTeamWorkday(srStart)) srStart = addDays(srStart, 1)
  let srEnd = srStart
  if (d.sr > 1) {
    let count = 1
    while (count < d.sr) {
      srEnd = addDays(srEnd, 1)
      while (!isSchoolWorkday(srEnd) || !isTeamWorkday(srEnd)) srEnd = addDays(srEnd, 1)
      count++
    }
  }

  // Gap day (school workday)
  let gapStart = addDays(srEnd, 1)
  while (!isSchoolWorkday(gapStart)) gapStart = addDays(gapStart, 1)
  const gapEnd = gapStart

  // Phase 4: Final validation — d.fv days, needs BOTH team and school
  // Blocked during summer pause
  let fvStart = addDays(gapEnd, 1)
  while (!isSchoolWorkday(fvStart) || !isTeamWorkday(fvStart)) fvStart = addDays(fvStart, 1)
  let fvEnd = fvStart
  if (d.fv > 1) {
    let count = 1
    while (count < d.fv) {
      fvEnd = addDays(fvEnd, 1)
      while (!isSchoolWorkday(fvEnd) || !isTeamWorkday(fvEnd)) fvEnd = addDays(fvEnd, 1)
      count++
    }
  }

  // Phase 5: Sign-off — d.signoff school workdays
  // Schools CAN send sign-off during summer pause
  const soStart = nextSchoolWorkday(addDays(fvEnd, 1))
  const soEnd   = addSchoolWorkdays(soStart, d.signoff)

  // Phase 6 (optional): Translation — N team workdays (blocked during summer pause)
  let trStart = null, trEnd = null
  let checkBase = addDays(soEnd, 1)

  if (needsTranslation) {
    trStart   = nextTeamWorkday(addDays(soEnd, 1))
    trEnd     = addTeamWorkdays(trStart, translationDays)
    checkBase = addDays(trEnd, 1)
  }

  // Phase 7: Tech check — d.check team workdays only (blocked during summer pause)
  const checkStart = nextTeamWorkday(checkBase)

  // Phase 8: Go live — team workday, not Friday, not summer pause
  let liveDate
  if (manualLiveDate) {
    liveDate = typeof manualLiveDate === 'string' ? parseISO(manualLiveDate) : new Date(manualLiveDate)
    while (!isTeamWorkday(liveDate) || isFriday(liveDate)) liveDate = addDays(liveDate, 1)
  } else {
    const minCheckEnd = addTeamWorkdays(checkStart, d.check - 1)
    liveDate = nextTeamWorkday(addDays(minCheckEnd, 1))
    while (isFriday(liveDate) || !isTeamWorkday(liveDate)) liveDate = addDays(liveDate, 1)
  }

  // Check end = last team workday before go live
  let checkEnd = addDays(liveDate, -1)
  while (!isTeamWorkday(checkEnd)) checkEnd = addDays(checkEnd, -1)
  if (checkEnd < checkStart) checkEnd = checkStart

  return {
    deStart, deEnd,
    qaStart, qaEnd,
    reviewStart, reviewEnd,
    srStart, srEnd,
    gapStart, gapEnd,
    fvStart, fvEnd,
    soStart, soEnd,
    trStart, trEnd,
    checkStart, checkEnd,
    liveDate,
    isManualLive: !!manualLiveDate,
  }
}

export function rangesOverlap(s1, e1, s2, e2) { return s1 <= e2 && s2 <= e1 }

// Builds the durations object for computeSchedule from a school record,
// applying the "first 3 schools get 5-day DE, rest get 4" rule unless overridden.
export function getDurations(school, index) {
  return {
    de:      school.de_days      ?? (index < 3 ? 5 : 4),
    qa:      school.qa_days      ?? 1,
    review:  school.review_days  ?? 2,
    sr:      school.sr_days      ?? 1,
    fv:      school.fv_days      ?? 1,
    signoff: school.signoff_days ?? 2,
    check:   school.check_days   ?? 1,
  }
}

// Phases that can be marked as completed, in pipeline order.
export const COMPLETABLE_PHASES = [
  { key: 'de',      label: 'Data Entry' },
  { key: 'qa',      label: 'QA Jakala' },
  { key: 'review',  label: 'School review' },
  { key: 'sr',      label: 'Staging review' },
  { key: 'fv',      label: 'Final validation' },
  { key: 'so',      label: 'Sign-off' },
  { key: 'check',   label: 'Tech check' },
]

export function isPhaseCompleted(school, phaseKey) {
  return !!(school.completed_phases && school.completed_phases[phaseKey])
}

export function getDaysRange(start, end) {
  const days = []
  let d = new Date(start)
  const e = new Date(end)
  while (d <= e) { days.push(new Date(d)); d = addDays(d, 1) }
  return days
}
