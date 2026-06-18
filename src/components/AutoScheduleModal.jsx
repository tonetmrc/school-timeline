import React, { useState, useRef, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { nextTeamWorkday } from '../lib/scheduler'

// Overlap: new school starts on day 4 of previous (last 2 days overlap)
// DE = 5 workdays, new school starts at workday index 3 (0-based) of previous
function computeCascadeDates(orderedSchools, firstStartDate) {
  if (!orderedSchools.length) return []
  
  const results = []
  let currentStart = nextTeamWorkday(
    typeof firstStartDate === 'string' ? new Date(firstStartDate) : firstStartDate
  )

  for (let i = 0; i < orderedSchools.length; i++) {
    results.push({
      id: orderedSchools[i].id,
      name: orderedSchools[i].name,
      de_start_date: format(currentStart, 'yyyy-MM-dd'),
    })

    if (i < orderedSchools.length - 1) {
      // Next school starts 3 team workdays after current start (overlap on days 4 and 5)
      let next = currentStart
      let wd = 0
      while (wd < 3) {
        next = addDays(next, 1)
        // count only team workdays
        const dow = next.getDay()
        const ds = format(next, 'yyyy-MM-dd')
        const isHoliday = ['2026-06-01', '2026-06-02'].includes(ds)
        if (dow !== 0 && dow !== 6 && !isHoliday) wd++
      }
      currentStart = next
    }
  }
  return results
}

export default function AutoScheduleModal({ schools, onApply, onClose }) {
  const [order, setOrder] = useState(schools.map(s => s.id))
  const [firstDate, setFirstDate] = useState('2026-05-18')
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragNode = useRef(null)

  const orderedSchools = order.map(id => schools.find(s => s.id === id)).filter(Boolean)
  const preview = computeCascadeDates(orderedSchools, firstDate)

  // Drag handlers
  function onDragStart(e, idx) {
    setDragIdx(idx)
    dragNode.current = e.currentTarget
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4' }, 0)
  }

  function onDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = '1'
    setDragIdx(null)
    setOverIdx(null)
    dragNode.current = null
  }

  function onDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== overIdx) setOverIdx(idx)
  }

  function onDrop(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newOrder = [...order]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(idx, 0, moved)
    setOrder(newOrder)
    setDragIdx(null)
    setOverIdx(null)
  }

  function handleApply() {
    onApply(preview)
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Auto-schedule DE dates</div>
            <div style={styles.subtitle}>Drag schools into execution order, set the first start date</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* First date picker */}
          <div style={styles.dateRow}>
            <label style={styles.label}>First school DE start</label>
            <input
              type="date"
              value={firstDate}
              onChange={e => setFirstDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>

          {/* Reorderable list */}
          <div style={styles.listHeader}>
            <span style={styles.colLabel}>Order</span>
            <span style={styles.colLabel}>School</span>
            <span style={styles.colLabel}>DE start</span>
          </div>

          <div style={styles.list}>
            {orderedSchools.map((sc, i) => {
              const p = preview[i]
              const isOver = overIdx === i && dragIdx !== i
              return (
                <div
                  key={sc.id}
                  draggable
                  onDragStart={e => onDragStart(e, i)}
                  onDragEnd={onDragEnd}
                  onDragOver={e => onDragOver(e, i)}
                  onDrop={e => onDrop(e, i)}
                  style={{
                    ...styles.row,
                    background: isOver ? 'rgba(79,142,247,0.12)' : dragIdx === i ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderTop: isOver ? '2px solid #4f8ef7' : '1px solid rgba(255,255,255,0.04)',
                    opacity: dragIdx === i ? 0.5 : 1,
                  }}
                >
                  <div style={styles.handle}>
                    <span style={styles.handleIcon}>⠿</span>
                    <span style={styles.indexNum}>{i + 1}</span>
                  </div>
                  <div style={styles.schoolName}>
                    {!sc.confirmed && <span style={{ color: '#f59e0b', marginRight: 4, fontSize: 11 }}>⏳</span>}
                    {sc.needs_translation && <span style={{ color: '#a78bfa', marginRight: 4, fontSize: 11 }}>🌐</span>}
                    <span style={{ color: sc.confirmed ? '#c8d0e0' : '#64748b' }}>{sc.name}</span>
                    <span style={styles.region}>{sc.region}</span>
                  </div>
                  <div style={styles.dateCell}>
                    {p ? (
                      <span style={{ color: '#4f8ef7', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>
                        {format(new Date(p.de_start_date), 'd MMM yyyy')}
                      </span>
                    ) : '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div style={styles.summary}>
            <span style={{ color: '#64748b', fontSize: 12 }}>
              {orderedSchools.length} schools · first DE {firstDate ? format(new Date(firstDate), 'd MMM') : '—'} · last DE {preview.length ? format(new Date(preview[preview.length - 1].de_start_date), 'd MMM') : '—'}
            </span>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.applyBtn} onClick={handleApply}>
            Apply to {orderedSchools.length} schools
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#1a1e25', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, width: 560, maxWidth: '95vw', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 32px 96px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  title: { fontSize: 16, fontWeight: 600, color: '#e8eaf0' },
  subtitle: { fontSize: 12, color: '#545c6e', marginTop: 4 },
  closeBtn: { background: 'none', color: '#8890a0', fontSize: 16, padding: '2px 6px', borderRadius: 6, cursor: 'pointer', border: 'none', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px 8px' },
  dateRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  label: { fontSize: 13, fontWeight: 500, color: '#8890a0' },
  dateInput: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 12px', color: '#e8eaf0', fontSize: 13,
  },
  listHeader: {
    display: 'grid', gridTemplateColumns: '60px 1fr 100px',
    padding: '0 8px 8px', gap: 8,
  },
  colLabel: { fontSize: 10, fontWeight: 600, color: '#3a4255', letterSpacing: '0.06em', textTransform: 'uppercase' },
  list: { borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' },
  row: {
    display: 'grid', gridTemplateColumns: '60px 1fr 100px',
    alignItems: 'center', padding: '10px 8px', gap: 8,
    cursor: 'grab', transition: 'background 0.1s, border-color 0.1s',
  },
  handle: { display: 'flex', alignItems: 'center', gap: 8 },
  handleIcon: { color: 'rgba(255,255,255,0.2)', fontSize: 14, cursor: 'grab' },
  indexNum: { fontSize: 11, fontWeight: 600, color: '#3a4255', fontFamily: 'DM Mono, monospace', width: 16 },
  schoolName: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, overflow: 'hidden' },
  region: { fontSize: 10, color: '#3a4255', marginLeft: 6, fontWeight: 500 },
  dateCell: { textAlign: 'right' },
  summary: {
    padding: '14px 8px 4px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    marginTop: 12,
  },
  footer: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '9px 18px', color: '#8890a0', fontSize: 14, cursor: 'pointer',
  },
  applyBtn: {
    background: '#4f8ef7', border: 'none',
    borderRadius: 8, padding: '9px 20px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
}
