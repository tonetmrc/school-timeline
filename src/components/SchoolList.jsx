import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { computeSchedule, fmt, getDurations } from '../lib/scheduler'

const REGION_COLORS = {
  US: '#4f8ef7', UK: '#3ecf8e', ES: '#f59e0b', BR: '#22c55e',
  PT: '#a78bfa', RU: '#fb923c', Other: '#64748b',
}

export default function SchoolList({ schools, onEditSchool, onDeleteSchool }) {
  const rows = useMemo(() => schools.map((s, i) => ({
    ...s,
    sched: computeSchedule(s.de_start_date, s.needs_translation, s.translation_days || 4, s.manual_live_date || null, getDurations(s, i))
  })).sort((a, b) => a.sched.liveDate - b.sched.liveDate), [schools])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['School', 'Region', 'DE start', 'QA Jakala', 'School review', 'Staging', 'Final val.', 'Sign-off', 'Translation', 'Check', 'Go live', 'Status', ''].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((sc, i) => {
            const s = sc.sched
            return (
              <tr key={sc.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 500, color: sc.confirmed ? '#c8d0e0' : '#64748b', fontSize: 13 }}>
                    {sc.needs_translation && <span style={{ color: '#a78bfa', marginRight: 4 }}>🌐</span>}
                    {sc.name}
                  </div>
                  {sc.confirm_note && <div style={{ fontSize: 10, color: '#545c6e', marginTop: 2 }}>{sc.confirm_note}</div>}
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: `${REGION_COLORS[sc.region] || '#64748b'}22`, color: REGION_COLORS[sc.region] || '#64748b', border: `1px solid ${REGION_COLORS[sc.region] || '#64748b'}44` }}>
                    {sc.region}
                  </span>
                </td>
                <DateCell date={s.deStart} end={s.deEnd} />
                <DateCell date={s.qaStart} end={s.qaEnd} color="#38bdf8" />
                <DateCell date={s.reviewStart} end={s.reviewEnd} muted />
                <DateCell date={s.srStart} />
                <DateCell date={s.fvStart} />
                <DateCell date={s.soStart} end={s.soEnd} muted />
                <td style={styles.td}>
                  {sc.needs_translation && s.trStart
                    ? <span style={{ color: '#a78bfa', fontSize: 12 }}>{fmt(s.trStart)} → {fmt(s.trEnd)}</span>
                    : <span style={{ color: '#2a3040', fontSize: 12 }}>—</span>}
                </td>
                <DateCell date={s.checkStart} />
                <td style={styles.td}>
                  <span style={{ color: '#22c55e', fontWeight: 600, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {format(s.liveDate, 'EEE d MMM')}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: sc.confirmed ? 'rgba(62,207,142,0.1)' : 'rgba(245,158,11,0.1)',
                    color: sc.confirmed ? '#3ecf8e' : '#f59e0b',
                    border: `1px solid ${sc.confirmed ? 'rgba(62,207,142,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                    {sc.confirmed ? 'Confirmed' : 'Pending'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onEditSchool(sc)} style={styles.btn}>Edit</button>
                    <button onClick={() => { if (confirm(`Delete ${sc.name}?`)) onDeleteSchool(sc.id) }} style={{ ...styles.btn, color: '#ef4444' }}>Del</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DateCell({ date, end, muted, color }) {
  if (!date) return <td style={styles.td}><span style={{ color: '#2a3040' }}>—</span></td>
  const textColor = color || (muted ? '#64748b' : '#8890a0')
  return (
    <td style={styles.td}>
      <span style={{ color: textColor, fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
        {fmt(date)}{end && end.getTime() !== date.getTime() ? ` – ${fmt(end)}` : ''}
      </span>
    </td>
  )
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#545c6e', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.03em' },
  btn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 8px', color: '#8890a0', fontSize: 11, cursor: 'pointer' },
}
