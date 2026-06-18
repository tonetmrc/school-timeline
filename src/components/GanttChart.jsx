import React, { useMemo, useRef, useState, useCallback } from 'react'
import { addDays, format, isWeekend, eachDayOfInterval, differenceInCalendarDays } from 'date-fns'
import { computeSchedule, isTeamHoliday, isSummerPause, nextTeamWorkday, fmt, fmtFull, getDurations, COMPLETABLE_PHASES, isPhaseCompleted } from '../lib/scheduler'

const PHASES = [
  { key: 'de',     label: 'DE',               color: '#4f8ef7', textColor: '#0a1628' },
  { key: 'qa',     label: 'QA Jakala',         color: '#38bdf8', textColor: '#0a2030' },
  { key: 'review', label: 'School review',     color: '#3ecf8e', textColor: '#052e1b' },
  { key: 'sr',     label: 'Staging review',    color: '#f59e0b', textColor: '#2d1a00' },
  { key: 'fv',     label: 'Final validation',  color: '#fb923c', textColor: '#2d1200' },
  { key: 'so',     label: 'Sign-off',          color: '#f472b6', textColor: '#2d0a1e' },
  { key: 'tr',     label: 'Translation',       color: '#a78bfa', textColor: '#1a0a40' },
  { key: 'check',  label: 'Tech check',        color: '#64748b', textColor: '#e2e8f0' },
  { key: 'live',   label: 'Go live',           color: '#22c55e', textColor: '#052e12' },
]

const CELL_W  = 24
const ROW_H   = 32
const LABEL_W = 180

function getPhaseSegments(sched, needsTranslation) {
  const segs = []
  if (!sched) return segs
  segs.push({ key: 'de',     start: sched.deStart,    end: sched.deEnd,    color: '#4f8ef7' })
  segs.push({ key: 'qa',     start: sched.qaStart,    end: sched.qaEnd,    color: '#38bdf8' })
  segs.push({ key: 'review', start: sched.reviewStart,end: sched.reviewEnd,color: '#3ecf8e' })
  segs.push({ key: 'sr',     start: sched.srStart,    end: sched.srEnd,    color: '#f59e0b' })
  segs.push({ key: 'fv',     start: sched.fvStart,    end: sched.fvEnd,    color: '#fb923c' })
  segs.push({ key: 'so',     start: sched.soStart,    end: sched.soEnd,    color: '#f472b6' })
  if (needsTranslation && sched.trStart)
    segs.push({ key: 'tr',   start: sched.trStart,    end: sched.trEnd,    color: '#a78bfa' })
  segs.push({ key: 'check',  start: sched.checkStart, end: sched.checkEnd, color: '#64748b' })
  segs.push({ key: 'live',   start: sched.liveDate,   end: sched.liveDate, color: '#22c55e' })
  return segs
}

export default function GanttChart({ schools, activePhases = [], onEditSchool, onDeleteSchool, onUpdateDeStart, onReorderSchools, onToggleCompleted }) {
  const [tooltip, setTooltip]         = useState(null)
  const [hoveredRow, setHoveredRow]   = useState(null)
  const [dragState, setDragState]     = useState(null)
  // dragState for horizontal DE drag: { schoolId, origDeStart, deltadays, snappedDate, valid }

  // Row-reorder drag state
  const [rowDrag, setRowDrag] = useState(null)
  // rowDrag: { fromIndex, currentIndex, startY, currentY }

  const scrollRef = useRef(null)

  // ── derived data ─────────────────────────────────────────────────────────────
  const { calStart, allDays, scheduledSchools, liveConflicts } = useMemo(() => {
    if (!schools.length) return { calStart: new Date(), allDays: [], scheduledSchools: [], liveConflicts: new Set() }

    const schedules = schools.map((s, idx) => ({
      ...s,
      sched: computeSchedule(s.de_start_date, s.needs_translation, s.translation_days || 4, s.manual_live_date || null, getDurations(s, idx)),
    }))

    const minDate = schedules.reduce((m, s) => s.sched.deStart < m ? s.sched.deStart : m, schedules[0].sched.deStart)
    const maxDate = schedules.reduce((m, s) => s.sched.liveDate > m ? s.sched.liveDate : m, schedules[0].sched.liveDate)

    const calStart = addDays(minDate, -3)
    const calEnd   = addDays(maxDate, 5)
    const allDays  = eachDayOfInterval({ start: calStart, end: calEnd })

    const liveCounts = {}
    schedules.forEach(s => {
      const k = format(s.sched.liveDate, 'yyyy-MM-dd')
      liveCounts[k] = (liveCounts[k] || 0) + 1
    })
    const liveConflicts = new Set(Object.entries(liveCounts).filter(([, v]) => v > 3).map(([k]) => k))

    return { calStart, calEnd, allDays, scheduledSchools: schedules, liveConflicts }
  }, [schools])

  const monthGroups = useMemo(() => {
    const groups = []; let cur = null
    allDays.forEach((d) => {
      const m = format(d, 'MMM yyyy')
      if (!cur || cur.label !== m) { cur = { label: m, count: 1 }; groups.push(cur) }
      else cur.count++
    })
    return groups
  }, [allDays])

  const liveDayCounts = useMemo(() => {
    const c = {}
    scheduledSchools.forEach(s => { const k = format(s.sched.liveDate, 'yyyy-MM-dd'); c[k] = (c[k] || 0) + 1 })
    return c
  }, [scheduledSchools])

  function dayCol(date) { return differenceInCalendarDays(date, calStart) }

  // ── horizontal DE drag ───────────────────────────────────────────────────────
  const handleDEMouseDown = useCallback((e, school) => {
    e.preventDefault()
    e.stopPropagation()
    setTooltip(null)

    const startX   = e.clientX
    const origDate = new Date(school.de_start_date)
    let lastDelta  = 0

    function onMove(ev) {
      const rawDelta = Math.round((ev.clientX - startX) / CELL_W)
      if (rawDelta === lastDelta) return
      lastDelta = rawDelta
      const candidate = addDays(origDate, rawDelta)
      const snapped   = nextTeamWorkday(candidate)
      const actualDelta = differenceInCalendarDays(snapped, origDate)
      setDragState({ schoolId: school.id, origDeStart: origDate, deltadays: actualDelta, snappedDate: snapped, valid: true })
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragState(prev => {
        if (prev && prev.valid && prev.deltadays !== 0) {
          onUpdateDeStart(school.id, format(prev.snappedDate, 'yyyy-MM-dd'))
        }
        return null
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onUpdateDeStart])

  // ── vertical row-reorder drag ────────────────────────────────────────────────
  const handleRowHandleMouseDown = useCallback((e, fromIndex) => {
    e.preventDefault()
    e.stopPropagation()
    setTooltip(null)

    const startY = e.clientY
    let currentIndex = fromIndex

    setRowDrag({ fromIndex, currentIndex, startY, currentY: startY })

    function onMove(ev) {
      const dy = ev.clientY - startY
      // Each row is ROW_H + 4px (border) ≈ ROW_H + 4
      const rowSize = ROW_H + 4
      const rawOffset = Math.round(dy / rowSize)
      const newIndex  = Math.max(0, Math.min(schools.length - 1, fromIndex + rawOffset))
      if (newIndex !== currentIndex) {
        currentIndex = newIndex
        setRowDrag(prev => ({ ...prev, currentIndex, currentY: ev.clientY }))
      } else {
        setRowDrag(prev => ({ ...prev, currentY: ev.clientY }))
      }
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setRowDrag(prev => {
        if (prev && prev.currentIndex !== prev.fromIndex && onReorderSchools) {
          onReorderSchools(prev.fromIndex, prev.currentIndex)
        }
        return null
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [schools.length, onReorderSchools])

  // ── render ───────────────────────────────────────────────────────────────────
  const totalW    = LABEL_W + allDays.length * CELL_W
  const isDraggingDE  = !!dragState
  const isDraggingRow = !!rowDrag
  const isDragging    = isDraggingDE || isDraggingRow

  // Build display order: when row-dragging, show the reordered preview
  const displaySchools = useMemo(() => {
    if (!rowDrag) return scheduledSchools
    const arr = [...scheduledSchools]
    const [moved] = arr.splice(rowDrag.fromIndex, 1)
    arr.splice(rowDrag.currentIndex, 0, moved)
    return arr
  }, [scheduledSchools, rowDrag])

  return (
    <div style={{ position: 'relative', userSelect: isDragging ? 'none' : 'auto' }}>
      {/* Legend */}
      <div style={styles.legend}>
        {PHASES.map(p => (
          <span key={p.key} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: p.color }} />{p.label}
          </span>
        ))}
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)' }} />
          Weekend / Holiday
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: 'rgba(251,146,60,0.35)', border: '1px solid rgba(251,146,60,0.5)' }} />
          Summer pause (7–24 Aug)
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: '#4f8ef7', cursor: 'ew-resize', border: '1px dashed rgba(255,255,255,0.5)' }} />
          Drag DE bar to reschedule
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: 'rgba(255,255,255,0.15)', cursor: 'ns-resize' }} />
          Drag ⠿ handle to reorder rows
        </span>
      </div>

      <div ref={scrollRef} className="gantt-scroll"
        style={{ overflowX: 'auto', width: '100%', position: 'relative', cursor: isDraggingDE ? 'ew-resize' : isDraggingRow ? 'ns-resize' : 'default' }}>
        <div style={{ minWidth: totalW, position: 'relative' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10, background: '#0d0f12' }}>
            <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', position: 'sticky', left: 0, zIndex: 11, background: '#0d0f12' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Months */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {monthGroups.map((m, i) => (
                  <div key={i} style={{ width: m.count * CELL_W, fontSize: 11, fontWeight: 600, color: '#8890a0', padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {m.label.toUpperCase()}
                  </div>
                ))}
              </div>
              {/* Days */}
              <div style={{ display: 'flex' }}>
                {allDays.map((d, i) => {
                  const we   = isWeekend(d)
                  const sum  = isSummerPause(d)
                  const th   = isTeamHoliday(d) && !sum // Jun holidays only
                  const lk = format(d, 'yyyy-MM-dd')
                  const lc = liveDayCounts[lk] || 0
                  const conflict = liveConflicts.has(lk)
                  const textColor = sum ? 'rgba(251,146,60,0.9)'
                    : th ? 'rgba(255,90,90,0.8)'
                    : we ? 'rgba(239,68,68,0.75)'
                    : lc > 0 ? (conflict ? '#ef4444' : '#3ecf8e') : '#545c6e'
                  const bg = sum ? 'rgba(251,146,60,0.12)'
                    : th ? 'rgba(255,60,60,0.18)'
                    : we ? 'rgba(239,68,68,0.08)' : 'transparent'
                  return (
                    <div key={i} style={{ width: CELL_W, flexShrink: 0, fontSize: 9, textAlign: 'center', padding: '4px 0 3px', color: textColor, fontWeight: lc > 0 ? 600 : 400, background: bg, borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                      {d.getDate()}
                      {lc > 0 && <div style={{ fontSize: 7, color: conflict ? '#ef4444' : '#3ecf8e' }}>↑{lc}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Rows ── */}
          {displaySchools.map((sc, ri) => {
            // Find original index for drag handle
            const origIndex = scheduledSchools.findIndex(s => s.id === sc.id)
            const isBeingDraggedDE  = dragState?.schoolId === sc.id
            const isBeingDraggedRow = rowDrag?.fromIndex === origIndex
            const isDropTarget      = rowDrag && ri === rowDrag.currentIndex && !isBeingDraggedRow

            const displaySched = isBeingDraggedDE && dragState.valid
              ? computeSchedule(format(dragState.snappedDate, 'yyyy-MM-dd'), sc.needs_translation, sc.translation_days || 4, sc.manual_live_date || null, getDurations(sc, origIndex))
              : sc.sched
            const segments = getPhaseSegments(displaySched, sc.needs_translation)
            const liveKey  = format(displaySched.liveDate, 'yyyy-MM-dd')
            const liveConflict = liveConflicts.has(liveKey)
            const isHovered = hoveredRow === sc.id && !isDragging

            return (
              <div key={sc.id}
                style={{
                  display: 'flex', alignItems: 'center', minHeight: ROW_H + 4,
                  background: isBeingDraggedRow
                    ? 'rgba(168,139,250,0.08)'
                    : isDropTarget
                      ? 'rgba(168,139,250,0.04)'
                      : isBeingDraggedDE
                        ? 'rgba(79,142,247,0.06)'
                        : isHovered
                          ? 'rgba(255,255,255,0.025)'
                          : ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  borderBottom: isDropTarget
                    ? '2px solid rgba(168,139,250,0.6)'
                    : '1px solid rgba(255,255,255,0.04)',
                  outline: isBeingDraggedDE ? '1px solid rgba(79,142,247,0.3)' : isBeingDraggedRow ? '1px solid rgba(168,139,250,0.4)' : 'none',
                  opacity: isBeingDraggedRow ? 0.55 : 1,
                  transition: isDraggingRow ? 'none' : 'background 0.1s',
                }}
                onMouseEnter={() => !isDragging && setHoveredRow(sc.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Label — sticky */}
                <div style={{
                  width: LABEL_W, flexShrink: 0, padding: '4px 12px 4px 4px',
                  borderRight: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  position: 'sticky', left: 0, zIndex: 3,
                  background: isBeingDraggedRow
                    ? '#141820'
                    : isBeingDraggedDE
                      ? '#111520'
                      : ri % 2 === 0 ? '#0d0f12' : '#0f1115',
                }}>

                  {/* Row reorder handle */}
                  <div
                    title="Drag to reorder"
                    onMouseDown={(e) => handleRowHandleMouseDown(e, origIndex)}
                    style={{
                      flexShrink: 0,
                      width: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'ns-resize',
                      color: isHovered || isBeingDraggedRow ? 'rgba(168,139,250,0.8)' : 'rgba(255,255,255,0.12)',
                      fontSize: 13,
                      lineHeight: 1,
                      userSelect: 'none',
                      transition: 'color 0.15s',
                      paddingLeft: 4,
                    }}
                  >
                    ⠿
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: sc.confirmed ? '#c8d0e0' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {!sc.confirmed && <span style={{ color: '#f59e0b', marginRight: 4 }}>⏳</span>}
                      {sc.needs_translation && <span style={{ color: '#a78bfa', marginRight: 4 }}>🌐</span>}
                      {sc.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a5366', marginTop: 1 }}>
                      {sc.region}
                      {isBeingDraggedDE && dragState.deltadays !== 0 && (
                        <span style={{ color: '#4f8ef7', marginLeft: 6, fontWeight: 600 }}>
                          {dragState.deltadays > 0 ? '+' : ''}{dragState.deltadays}d → {format(dragState.snappedDate, 'd MMM')}
                        </span>
                      )}
                      {isBeingDraggedRow && (
                        <span style={{ color: '#a78bfa', marginLeft: 6, fontWeight: 600 }}>
                          → row {rowDrag.currentIndex + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {isHovered && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => onEditSchool(sc)} style={styles.rowBtn} title="Edit">✎</button>
                      <button onClick={() => { if (confirm(`Delete ${sc.name}?`)) onDeleteSchool(sc.id) }} style={{ ...styles.rowBtn, color: '#ef4444' }} title="Delete">✕</button>
                    </div>
                  )}
                </div>

                {/* Bars area */}
                <div style={{ flex: 1, position: 'relative', height: ROW_H }}>
                  {/* Column backgrounds */}
                  {allDays.map((d, i) => {
                    const we  = isWeekend(d)
                    const sum = isSummerPause(d)
                    const th  = isTeamHoliday(d) && !sum
                    if (!we && !th && !sum) return null
                    const bg = sum ? 'rgba(251,146,60,0.10)'
                      : th ? 'rgba(255,60,60,0.18)' : we ? 'rgba(239,68,68,0.06)' : null
                    if (!bg) return null
                    return <div key={i} style={{ position: 'absolute', left: i * CELL_W, top: 0, width: CELL_W, height: ROW_H, background: bg }} />
                  })}

                  {/* Phase bars */}
                  {segments.map((seg, si) => {
                    const x = dayCol(seg.start) * CELL_W
                    const w = (differenceInCalendarDays(seg.end, seg.start) + 1) * CELL_W - 1
                    const isLive = seg.key === 'live'
                    const isDE   = seg.key === 'de'
                    const isTR   = seg.key === 'tr'
                    const phaseInfo = PHASES.find(p => p.key === seg.key)
                    const showLabel = w >= 28

                    // Completion states
                    const isCompleted     = !isLive && isPhaseCompleted(sc, seg.key)
                    const liveDone        = isLive && isPhaseCompleted(sc, 'live_done')
                    const onenoteImported = isDE   && isPhaseCompleted(sc, 'onenote_imported')
                    const excelDone       = isTR   && isPhaseCompleted(sc, 'translation_excel_done')

                    // Phase filter
                    const phaseFiltered = activePhases.length > 0
                    const isHighlighted = activePhases.includes(seg.key)
                    const phaseOpacity  = phaseFiltered ? (isHighlighted ? 1 : 0) : 1

                    const dragOpacity      = (isBeingDraggedDE && !isDE) || isBeingDraggedRow ? 0.5 : 1
                    const completedOpacity = (isCompleted || liveDone) ? 0.4 : 1
                    const opacity = Math.min(phaseOpacity, dragOpacity, completedOpacity)

                    // Bar color: live_done → gray
                    const barColor = liveDone ? '#3a4255'
                      : isLive && liveConflict ? '#ef4444'
                      : seg.color

                    // Click handler: toggle completion
                    function handleBarClick(e) {
                      if (isDE || !onToggleCompleted) return
                      e.stopPropagation()
                      setTooltip(null)
                      if (isLive) {
                        onToggleCompleted(sc.id, 'live_done')
                      } else {
                        onToggleCompleted(sc.id, seg.key)
                      }
                    }

                    return (
                      <div key={si}
                        title={
                          isDE ? 'Drag to reschedule' :
                          isLive ? (liveDone ? 'Go live done ✓ — click to undo' : 'Click to mark go live as done') :
                          isCompleted ? `${phaseInfo?.label} completed ✓ — click to undo` :
                          `Click to mark ${phaseInfo?.label} as done`
                        }
                        style={{
                          position: 'absolute',
                          left: x,
                          top: (ROW_H - (isLive ? 26 : 22)) / 2,
                          width: Math.max(w, isLive ? 26 : 4),
                          height: isLive ? 26 : 22,
                          background: barColor,
                          borderRadius: isLive ? 13 : 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 600, color: phaseInfo?.textColor || '#000',
                          cursor: isDE ? 'ew-resize' : 'pointer',
                          overflow: 'visible',
                          opacity,
                          boxShadow: liveDone ? 'none'
                            : isLive && phaseOpacity > 0.5
                              ? `0 0 0 2px rgba(0,0,0,0.5), 0 0 12px ${seg.color}55`
                              : isDE && isBeingDraggedDE
                                ? `0 0 0 2px rgba(79,142,247,0.6), 0 0 10px rgba(79,142,247,0.4)`
                                : phaseFiltered && isHighlighted
                                  ? `0 0 0 1.5px ${seg.color}99, 0 0 8px ${seg.color}44`
                                  : 'none',
                          border: isLive && liveConflict && !liveDone ? '2px solid #fca5a5'
                            : isDE ? '1px solid rgba(255,255,255,0.15)'
                            : (isCompleted || liveDone) ? '1px solid rgba(62,207,142,0.6)' : 'none',
                          transition: isDragging ? 'none' : 'left 0.15s, width 0.15s, opacity 0.2s',
                        }}
                        onMouseDown={isDE ? (e) => handleDEMouseDown(e, sc) : undefined}
                        onClick={!isDE ? handleBarClick : undefined}
                        onMouseEnter={!isDE ? e => setTooltip({ phase: seg.key, school: sc, sched: displaySched, x: e.clientX, y: e.clientY }) : undefined}
                        onMouseLeave={!isDE ? () => setTooltip(null) : undefined}
                      >
                        {/* Bar label */}
                        {showLabel && (
                          isLive
                            ? (liveDone ? '✓' : sc.manual_live_date ? '📅' : '🚀')
                            : isDE ? '⠿ DE' : phaseInfo?.label
                        )}

                        {/* ✓ completion badge (non-live phases) */}
                        {(isCompleted) && (
                          <div style={{
                            position: 'absolute', top: -7, right: -7,
                            width: 16, height: 16, borderRadius: '50%',
                            background: '#3ecf8e', border: '2px solid #0d0f12',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: '#052e1b', fontWeight: 700, lineHeight: 1,
                          }}>✓</div>
                        )}

                        {/* OneNote badge on DE bar */}
                        {isDE && (
                          <div
                            title={onenoteImported ? 'OneNote importato ✓ — click per annullare' : 'Click per segnare OneNote come importato'}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onToggleCompleted) onToggleCompleted(sc.id, 'onenote_imported')
                            }}
                            style={{
                              position: 'absolute', top: -8, left: -2,
                              width: 18, height: 18, borderRadius: 4,
                              background: onenoteImported ? '#7c3aed' : 'rgba(0,0,0,0.5)',
                              border: `1.5px solid ${onenoteImported ? '#a78bfa' : 'rgba(168,139,250,0.3)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, color: onenoteImported ? '#fff' : 'rgba(168,139,250,0.5)',
                              fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                              transition: 'all 0.15s',
                            }}
                          >ON</div>
                        )}

                        {/* Excel translation badge on TR bar */}
                        {isTR && (
                          <div
                            title={excelDone ? 'Excel traduzione fatto ✓ — click per annullare' : 'Click per segnare Excel traduzione come fatto'}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onToggleCompleted) onToggleCompleted(sc.id, 'translation_excel_done')
                            }}
                            style={{
                              position: 'absolute', top: -8, left: -2,
                              width: 18, height: 18, borderRadius: 4,
                              background: excelDone ? '#166534' : 'rgba(0,0,0,0.5)',
                              border: `1.5px solid ${excelDone ? '#22c55e' : 'rgba(34,197,94,0.3)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, color: excelDone ? '#fff' : 'rgba(34,197,94,0.5)',
                              fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                              transition: 'all 0.15s',
                            }}
                          >XL</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && !isDragging && (
        <TooltipBox tooltip={tooltip} schools={scheduledSchools} liveConflicts={liveConflicts} />
      )}
    </div>
  )
}

function TooltipBox({ tooltip, schools, liveConflicts }) {
  const { phase, school, sched } = tooltip
  const phaseInfo = PHASES.find(p => p.key === phase)
  let startDate, endDate, label
  switch (phase) {
    case 'de':     startDate = sched.deStart;    endDate = sched.deEnd;    label = 'Data Entry'; break
    case 'qa':     startDate = sched.qaStart;    endDate = sched.qaEnd;    label = 'QA Jakala'; break
    case 'review': startDate = sched.reviewStart;endDate = sched.reviewEnd;label = 'School self-review'; break
    case 'sr':     startDate = sched.srStart;    endDate = sched.srEnd;    label = 'Staging review'; break
    case 'fv':     startDate = sched.fvStart;    endDate = sched.fvEnd;    label = 'Final validation'; break
    case 'so':     startDate = sched.soStart;    endDate = sched.soEnd;    label = 'Sign-off window'; break
    case 'tr':     startDate = sched.trStart;    endDate = sched.trEnd;    label = 'Translation'; break
    case 'check':  startDate = sched.checkStart; endDate = sched.checkEnd; label = 'Technical checks'; break
    case 'live':   startDate = sched.liveDate;   endDate = sched.liveDate; label = 'Go live 🚀'; break
    default: return null
  }
  const liveKey      = format(sched.liveDate, 'yyyy-MM-dd')
  const liveConflict = liveConflicts.has(liveKey)
  const sameDay      = schools.filter(s => format(s.sched.liveDate, 'yyyy-MM-dd') === liveKey).map(s => s.name)

  return (
    <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, background: '#1a1e25', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', zIndex: 999, pointerEvents: 'none', minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: phaseInfo?.color || '#fff', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#8890a0', marginBottom: 2 }}>{school.name}</div>
      <div style={{ fontSize: 12, color: '#c0c8d8' }}>
        {fmtFull(startDate)}{startDate.getTime() !== endDate.getTime() ? ` → ${fmtFull(endDate)}` : ''}
      </div>
      {phase === 'live' && liveConflict && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(239,68,68,0.15)', borderRadius: 6, fontSize: 11, color: '#fca5a5' }}>
          ⚠️ {sameDay.length} schools live same day!<br /><span style={{ color: '#8890a0' }}>{sameDay.join(', ')}</span>
        </div>
      )}
      {phase === 'live' && !liveConflict && sameDay.length > 1 && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b' }}>+{sameDay.length - 1} other{sameDay.length > 2 ? 's' : ''} same day</div>
      )}
    </div>
  )
}

const styles = {
  legend: { display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8890a0' },
  legendDot: { width: 10, height: 10, borderRadius: 2, flexShrink: 0 },
  rowBtn: { background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 4, color: '#8890a0', fontSize: 12, padding: '2px 6px', cursor: 'pointer', lineHeight: 1.4 },
}
