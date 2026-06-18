import React, { useState } from 'react'
import GanttChart from './components/GanttChart'
import SchoolModal from './components/SchoolModal'
import AutoScheduleModal from './components/AutoScheduleModal'
import SummaryCards from './components/SummaryCards'
import SchoolList from './components/SchoolList'
import { useSchools } from './hooks/useSchools'

const PHASE_FILTERS = [
  { key: 'de',     label: 'Data Entry',        color: '#4f8ef7' },
  { key: 'qa',     label: 'QA Jakala',         color: '#38bdf8' },
  { key: 'review', label: 'School review',     color: '#3ecf8e' },
  { key: 'sr',     label: 'Staging review',    color: '#f59e0b' },
  { key: 'fv',     label: 'Final validation',  color: '#fb923c' },
  { key: 'so',     label: 'Sign-off',          color: '#f472b6' },
  { key: 'tr',     label: 'Translation',       color: '#a78bfa' },
  { key: 'check',  label: 'Tech check',        color: '#64748b' },
  { key: 'live',   label: 'Go live',           color: '#22c55e' },
]

export default function App() {
  const { schools, loading, addSchool, updateSchool, deleteSchool, reorderSchools, dbOk, dbError } = useSchools()
  const [modal, setModal] = useState(null)
  const [showAutoSchedule, setShowAutoSchedule] = useState(false)
  const [view, setView] = useState('gantt')
  const [filter, setFilter] = useState('all')
  const [activePhases, setActivePhases] = useState([]) // empty = all visible

  const filtered = schools.filter(s => {
    if (filter === 'confirmed') return s.confirmed
    if (filter === 'pending') return !s.confirmed
    return true
  })

  function togglePhase(key) {
    setActivePhases(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function handleSave(formData) {
    if (formData.id && schools.find(s => s.id === formData.id)) {
      const { id, ...updates } = formData
      updateSchool(id, updates)
    } else {
      const { id, ...school } = formData
      addSchool(school)
    }
    setModal(null)
  }

  async function handleToggleCompleted(schoolId, phaseKey) {
    const school = schools.find(s => s.id === schoolId)
    if (!school) return
    const current = school.completed_phases || {}
    const updated = { ...current, [phaseKey]: !current[phaseKey] }
    await updateSchool(schoolId, { completed_phases: updated })
  }

  function handleReorder(fromIndex, toIndex) {
    const ids = filtered.map(s => s.id)
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, moved)
    const filteredSet = new Set(ids)
    const others = schools.filter(s => !filteredSet.has(s.id)).map(s => s.id)
    reorderSchools([...ids, ...others])
  }

  async function handleAutoScheduleApply(updates) {
    for (const u of updates) {
      await updateSchool(u.id, { de_start_date: u.de_start_date })
    }
    const updatedIds = updates.map(u => u.id)
    const rest = schools.filter(s => !updatedIds.includes(s.id)).map(s => s.id)
    reorderSchools([...updatedIds, ...rest])
  }

  return (
    <div style={styles.app}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>◈</span>
            <span style={styles.logoText}>School Launch Planner</span>
          </div>
          {dbOk && <span style={{ ...styles.dbBadge, color: '#3ecf8e', borderColor: 'rgba(62,207,142,0.3)' }}>● Supabase</span>}
          {!dbOk && !dbError && !loading && <span style={styles.dbBadge}>💾 local</span>}
          {dbError && <span style={{ ...styles.dbBadge, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>⚠ DB error</span>}
        </div>
        <div style={styles.headerRight}>
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(view === 'gantt' ? styles.tabActive : {}) }} onClick={() => setView('gantt')}>Gantt</button>
            <button style={{ ...styles.tab, ...(view === 'list' ? styles.tabActive : {}) }} onClick={() => setView('list')}>Table</button>
          </div>
          <div style={styles.filterRow}>
            {['all', 'confirmed', 'pending'].map(f => (
              <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button style={styles.autoBtn} onClick={() => setShowAutoSchedule(true)}>⚡ Auto-schedule</button>
          <button style={styles.addBtn} onClick={() => setModal({})}>+ Add school</button>
        </div>
      </header>

      {/* ── Phase filter bar ── */}
      <div style={styles.phaseBar}>
        <span style={styles.phaseBarLabel}>Show phases:</span>
        <div style={styles.phaseChips}>
          {PHASE_FILTERS.map(p => {
            const active = activePhases.includes(p.key)
            return (
              <button
                key={p.key}
                onClick={() => togglePhase(p.key)}
                style={{
                  ...styles.phaseChip,
                  background: active ? `${p.color}22` : 'transparent',
                  border: `1px solid ${active ? p.color : 'rgba(255,255,255,0.08)'}`,
                  color: active ? p.color : '#545c6e',
                }}
              >
                <span style={{ ...styles.chipDot, background: active ? p.color : '#2a3040' }} />
                {p.label}
              </button>
            )
          })}
          {activePhases.length > 0 && (
            <button onClick={() => setActivePhases([])} style={styles.clearChip}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <main style={styles.main}>
        {loading ? (
          <div style={styles.loading}><div style={styles.spinner} /><span>Loading schools…</span></div>
        ) : (
          <>
            <SummaryCards schools={filtered} />
            {view === 'gantt' ? (
              <GanttChart
                schools={filtered}
                activePhases={activePhases}
                onEditSchool={(sc) => setModal({ school: sc })}
                onDeleteSchool={deleteSchool}
                onUpdateDeStart={(id, newDate) => updateSchool(id, { de_start_date: newDate })}
                onReorderSchools={handleReorder}
                onToggleCompleted={handleToggleCompleted}
              />
            ) : (
              <SchoolList
                schools={filtered}
                onEditSchool={(sc) => setModal({ school: sc })}
                onDeleteSchool={deleteSchool}
              />
            )}
          </>
        )}
      </main>

      {modal !== null && (
        <SchoolModal school={modal.school || null} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {showAutoSchedule && (
        <AutoScheduleModal schools={schools} onApply={handleAutoScheduleApply} onClose={() => setShowAutoSchedule(false)} />
      )}
    </div>
  )
}

const styles = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0f12' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(13,15,18,0.97)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: { fontSize: 18, color: '#4f8ef7' },
  logoText: { fontSize: 14, fontWeight: 600, color: '#e8eaf0', letterSpacing: '-0.01em' },
  dbBadge: { fontSize: 10, color: '#8890a0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 8px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tabs: { display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 2, gap: 2 },
  tab: { background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', fontWeight: 500 },
  tabActive: { background: 'rgba(255,255,255,0.1)', color: '#e8eaf0' },
  filterRow: { display: 'flex', gap: 3 },
  filterBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '4px 10px', color: '#64748b', fontSize: 11, cursor: 'pointer', fontWeight: 500 },
  filterActive: { background: 'rgba(79,142,247,0.15)', borderColor: 'rgba(79,142,247,0.4)', color: '#4f8ef7' },
  autoBtn: { background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 7, padding: '6px 12px', color: '#4f8ef7', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  addBtn: { background: '#4f8ef7', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  phaseBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,15,18,0.95)', position: 'sticky', top: 45, zIndex: 49, flexWrap: 'wrap' },
  phaseBarLabel: { fontSize: 11, color: '#3a4255', fontWeight: 500, flexShrink: 0 },
  phaseChips: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' },
  phaseChip: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  chipDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  clearChip: { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 10px', color: '#545c6e', fontSize: 11, cursor: 'pointer' },

  main: { flex: 1, padding: '20px 24px', maxWidth: '100%', overflowX: 'hidden' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#8890a0', padding: 80, fontSize: 14 },
  spinner: { width: 20, height: 20, border: '2px solid rgba(79,142,247,0.2)', borderTop: '2px solid #4f8ef7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}
