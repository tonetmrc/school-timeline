import React, { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { computeSchedule, getDurations } from '../lib/scheduler'

export default function SummaryCards({ schools }) {
  const stats = useMemo(() => {
    const scheduled = schools.map((s, i) => ({
      ...s,
      sched: computeSchedule(s.de_start_date, s.needs_translation, s.translation_days || 4, s.manual_live_date || null, getDurations(s, i))
    }))

    const confirmed = schools.filter(s => s.confirmed).length
    const withTranslation = schools.filter(s => s.needs_translation).length

    // Live dates grouped
    const liveGroups = {}
    scheduled.forEach(s => {
      const k = format(s.sched.liveDate, 'yyyy-MM-dd')
      if (!liveGroups[k]) liveGroups[k] = []
      liveGroups[k].push(s.name)
    })
    const conflicts = Object.entries(liveGroups).filter(([, v]) => v.length > 3)

    // Earliest and latest live
    const liveDates = scheduled.map(s => s.sched.liveDate).sort((a, b) => a - b)
    const earliest = liveDates[0]
    const latest = liveDates[liveDates.length - 1]

    return { total: schools.length, confirmed, withTranslation, conflicts, earliest, latest, liveGroups }
  }, [schools])

  return (
    <div style={styles.grid}>
      <Card value={stats.total} label="Total schools" color="#4f8ef7" />
      <Card value={stats.confirmed} label="Confirmed" color="#3ecf8e" sub={`${stats.total - stats.confirmed} pending`} />
      <Card value={stats.withTranslation} label="Need translation" color="#a78bfa" />
      <Card
        value={stats.conflicts.length === 0 ? '✓' : stats.conflicts.length}
        label="Live day conflicts"
        color={stats.conflicts.length === 0 ? '#22c55e' : '#ef4444'}
        sub={stats.conflicts.length === 0 ? 'No overloads' : `${stats.conflicts.map(([k, v]) => `${format(new Date(k), 'd MMM')}: ${v.length}`).join(', ')}`}
      />
      {stats.earliest && <Card value={format(stats.earliest, 'd MMM')} label="First go live" color="#22c55e" />}
      {stats.latest && <Card value={format(stats.latest, 'd MMM')} label="Last go live" color="#f59e0b" />}
    </div>
  )
}

function Card({ value, label, color, sub }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: 24, fontWeight: 600, color, fontFamily: 'DM Mono, monospace', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8890a0', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#545c6e', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '14px 16px',
  },
}
