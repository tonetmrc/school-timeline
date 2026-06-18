import React, { useState } from 'react'
import { computeSchedule, fmt, getDurations, COMPLETABLE_PHASES, DEFAULT_DURATIONS } from '../lib/scheduler'

const REGIONS = ['US', 'UK', 'ES', 'BR', 'PT', 'RU', 'Other']

const DURATION_FIELDS = [
  { key: 'de',      dbField: 'de_days',      label: 'Data Entry',       unit: 'team' },
  { key: 'qa',      dbField: 'qa_days',      label: 'QA Jakala',        unit: 'team' },
  { key: 'review',  dbField: 'review_days',  label: 'School review',   unit: 'school' },
  { key: 'sr',      dbField: 'sr_days',      label: 'Staging review',  unit: 'both' },
  { key: 'fv',      dbField: 'fv_days',      label: 'Final validation',unit: 'both' },
  { key: 'signoff', dbField: 'signoff_days', label: 'Sign-off',        unit: 'school' },
  { key: 'check',   dbField: 'check_days',   label: 'Tech check',      unit: 'team' },
]

export default function SchoolModal({ school, onSave, onClose }) {
  const editing = !!school?.id
  const [form, setForm] = useState({
    name: '',
    de_start_date: '',
    needs_translation: false,
    translation_days: 4,
    confirmed: true,
    confirm_note: '',
    region: 'US',
    manual_live_date: null,
    completed_phases: {},
    ...school,
  })

  const [showDurations, setShowDurations] = useState(
    DURATION_FIELDS.some(f => school?.[f.dbField] != null)
  )

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setDuration(dbField, v) {
    setForm(f => ({ ...f, [dbField]: v === '' ? null : (parseInt(v) || null) }))
  }

  function togglePhaseCompleted(key) {
    setForm(f => ({
      ...f,
      completed_phases: { ...f.completed_phases, [key]: !f.completed_phases?.[key] },
    }))
  }

  const durations = getDurations(form, 0)
  const preview = form.de_start_date
    ? computeSchedule(form.de_start_date, form.needs_translation, form.translation_days || 4, form.manual_live_date || null, durations)
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.de_start_date) return
    onSave({ ...form, manual_live_date: form.manual_live_date || null })
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>{editing ? 'Edit school' : 'Add school'}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>School name *</label>
            <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Greenfield Academy" required />
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>DE start date *</label>
              <input style={styles.input} type="date" value={form.de_start_date} onChange={e => set('de_start_date', e.target.value)} required />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Region</label>
              <select style={styles.input} value={form.region} onChange={e => set('region', e.target.value)}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Override go live date
              <span style={{ color: '#545c6e', fontWeight: 400, marginLeft: 6 }}>(optional — leave blank for auto)</span>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="date"
                value={form.manual_live_date || ''}
                onChange={e => set('manual_live_date', e.target.value || null)}
              />
              {form.manual_live_date && (
                <button type="button" onClick={() => set('manual_live_date', null)} style={styles.clearBtn}>
                  Clear
                </button>
              )}
            </div>
            {preview && (
              <div style={styles.previewBox}>
                {form.manual_live_date ? (
                  <>
                    <span style={{ color: '#a78bfa' }}>📅 Manual override:</span>
                    <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 6 }}>Go live {fmt(preview.liveDate)}</span>
                    <span style={{ color: '#64748b', marginLeft: 6 }}>· Checks: {fmt(preview.checkStart)} → {fmt(preview.checkEnd)}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#64748b' }}>Auto:</span>
                    <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 6 }}>Go live {fmt(preview.liveDate)}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={styles.toggle}>
            <label style={styles.toggleLabel}>
              <input type="checkbox" checked={form.needs_translation} onChange={e => set('needs_translation', e.target.checked)} style={{ marginRight: 8 }} />
              Needs translation after sign-off
            </label>
          </div>

          {form.needs_translation && (
            <div style={styles.field}>
              <label style={styles.label}>Translation duration (working days)</label>
              <input style={{ ...styles.input, width: 80 }} type="number" min={1} max={15} value={form.translation_days} onChange={e => set('translation_days', parseInt(e.target.value) || 4)} />
            </div>
          )}

          <div style={styles.toggle}>
            <label style={styles.toggleLabel}>
              <input type="checkbox" checked={form.confirmed} onChange={e => set('confirmed', e.target.checked)} style={{ marginRight: 8 }} />
              DE start confirmed
            </label>
          </div>

          {!form.confirmed && (
            <div style={styles.field}>
              <label style={styles.label}>Confirmation note</label>
              <input style={styles.input} value={form.confirm_note} onChange={e => set('confirm_note', e.target.value)} placeholder="e.g. Confirmation expected by 20 May" />
            </div>
          )}

          <div style={styles.section}>
            <button
              type="button"
              onClick={() => setShowDurations(v => !v)}
              style={styles.sectionToggle}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#3a4255', transform: showDurations ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                Custom phase durations
              </span>
              <span style={styles.sectionHint}>per progetti particolari</span>
            </button>

            {showDurations && (
              <div style={styles.durationGrid}>
                {DURATION_FIELDS.map(f => (
                  <div key={f.key} style={styles.durationRow}>
                    <div style={styles.durationLabelWrap}>
                      <span style={styles.durationLabel}>{f.label}</span>
                      <span style={styles.durationUnit}>{f.unit}</span>
                    </div>
                    <input
                      style={styles.durationInput}
                      type="number" min={1} max={15}
                      placeholder={String(DEFAULT_DURATIONS[f.key])}
                      value={form[f.dbField] ?? ''}
                      onChange={e => setDuration(f.dbField, e.target.value)}
                    />
                  </div>
                ))}
                <div style={styles.durationFootnote}>
                  Campo vuoto = valore standard (5gg DE per le prime 3 scuole, 4gg dalla 4ª)
                </div>
              </div>
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionStaticHeader}>
              <span>Completed phases</span>
              <span style={styles.sectionHint}>marca cosa è già stato fatto</span>
            </div>
            <div style={styles.phaseChips}>
              {COMPLETABLE_PHASES.map(p => {
                const isDone = !!form.completed_phases?.[p.key]
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => togglePhaseCompleted(p.key)}
                    style={{
                      ...styles.phaseChip,
                      background: isDone ? 'rgba(62,207,142,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isDone ? 'rgba(62,207,142,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: isDone ? '#3ecf8e' : '#8890a0',
                    }}
                  >
                    {isDone ? '✓ ' : ''}{p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.saveBtn}>{editing ? 'Update' : 'Add school'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#1a1e25', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, width: 480, maxWidth: '95vw',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'sticky', top: 0, background: '#1a1e25', zIndex: 1,
  },
  title: { fontSize: 16, fontWeight: 600, color: '#e8eaf0' },
  closeBtn: { background: 'none', color: '#8890a0', fontSize: 16, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' },
  form: { padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 12 },
  label: { fontSize: 12, fontWeight: 500, color: '#8890a0', letterSpacing: '0.03em' },
  input: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '9px 12px', color: '#e8eaf0', fontSize: 14, width: '100%',
  },
  clearBtn: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 6, padding: '8px 12px', color: '#ef4444', fontSize: 12, cursor: 'pointer', flexShrink: 0,
  },
  previewBox: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6, padding: '8px 12px', fontSize: 12, marginTop: 2,
  },
  toggle: { display: 'flex', alignItems: 'center' },
  toggleLabel: { display: 'flex', alignItems: 'center', fontSize: 14, color: '#c0c8d8', cursor: 'pointer' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '9px 18px', color: '#8890a0', fontSize: 14, cursor: 'pointer',
  },
  saveBtn: {
    background: '#4f8ef7', border: 'none',
    borderRadius: 8, padding: '9px 20px', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },

  section: {
    borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14,
  },
  sectionToggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', background: 'none', border: 'none', padding: 0,
    color: '#c0c8d8', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  sectionStaticHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    color: '#c0c8d8', fontSize: 13, fontWeight: 500, marginBottom: 10,
  },
  sectionHint: { fontSize: 11, color: '#3a4255', fontWeight: 400 },

  durationGrid: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  durationRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  durationLabelWrap: { display: 'flex', alignItems: 'center', gap: 6, flex: 1 },
  durationLabel: { fontSize: 13, color: '#e8eaf0' },
  durationUnit: {
    fontSize: 9, color: '#545c6e', textTransform: 'uppercase', letterSpacing: '0.04em',
    background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px',
  },
  durationInput: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '6px 10px', color: '#e8eaf0', fontSize: 13, width: 64, textAlign: 'center',
  },
  durationFootnote: { fontSize: 10.5, color: '#3a4255', marginTop: 4, lineHeight: 1.4 },

  phaseChips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  phaseChip: {
    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
}
