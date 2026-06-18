import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_SCHOOLS = [
  { id: '1',  name: 'Rowntree',                  de_start_date: '2026-05-18', needs_translation: false, translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'UK', manual_live_date: null, completed_phases: {} },
  { id: '2',  name: 'Alexander Montessori',       de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '3',  name: 'Willows Prep',               de_start_date: '2026-05-26', needs_translation: false, translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '4',  name: 'Smart Vision',               de_start_date: '2026-05-29', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Confirmation expected by 20 May',    region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '5',  name: 'Almeria',                    de_start_date: '2026-06-05', needs_translation: true,  translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'ES', manual_live_date: null, completed_phases: {} },
  { id: '6',  name: 'Vila Real',                  de_start_date: '2026-06-10', needs_translation: true,  translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'ES', manual_live_date: null, completed_phases: {} },
  { id: '7',  name: 'Granada',                    de_start_date: '2026-06-15', needs_translation: true,  translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'ES', manual_live_date: null, completed_phases: {} },
  { id: '8',  name: 'Summit-Questa Montessori',   de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Confirmation expected next week',    region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '9',  name: 'New Horizons',               de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Sign-off expected 18 May',           region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '10', name: 'Lake Mary',                  de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: '',                                   region: 'US', manual_live_date: null, completed_phases: {} },
  { id: '11', name: 'Fontenebro',                 de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Sign-off expected 18 May',           region: 'ES', manual_live_date: null, completed_phases: {} },
  { id: '12', name: 'Progresso Cambuì',           de_start_date: '2026-06-22', needs_translation: false, translation_days: 4, confirmed: true,  confirm_note: '',                                   region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '13', name: 'Progresso Santos',           de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Principal feedback expected 22 May', region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '14', name: 'Progresso Vinhedo',          de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Translation completed 18 May',       region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '15', name: 'Progresso Itu',              de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Translation completed 22 May',       region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '16', name: 'Progresso Taquaral',         de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Check translation timeline',         region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '17', name: 'Progresso Indiatuba',        de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Check translation timeline',         region: 'BR', manual_live_date: null, completed_phases: {} },
  { id: '18', name: 'Monte Maior',                de_start_date: '2026-05-21', needs_translation: false, translation_days: 4, confirmed: false, confirm_note: 'Awaiting sign-off from Alejandro',   region: 'ES', manual_live_date: null, completed_phases: {} },
  { id: '19', name: 'Platon',                     de_start_date: '2026-05-21', needs_translation: true,  translation_days: 5, confirmed: false, confirm_note: 'Translation issues – moved to July', region: 'RU', manual_live_date: null, completed_phases: {} },
  { id: '20', name: 'Mosaic',                     de_start_date: '2026-05-21', needs_translation: true,  translation_days: 5, confirmed: false, confirm_note: 'Translation issues – moved to July', region: 'RU', manual_live_date: null, completed_phases: {} },
]

const LS_KEY = 'school_timeline_v1'
function loadFromLS() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function saveToLS(schools) { try { localStorage.setItem(LS_KEY, JSON.stringify(schools)) } catch {} }

// Strip computed fields before sending to DB
function toDBRecord(s) {
  const { sched, ...rest } = s
  return rest
}

export function useSchools() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbOk, setDbOk] = useState(false)
  const [dbError, setDbError] = useState(null)

  useEffect(() => {
    async function load() {
      if (!supabase) {
        console.warn('[useSchools] No Supabase config — using localStorage')
        const ls = loadFromLS()
        setSchools(ls || DEFAULT_SCHOOLS)
        setLoading(false)
        return
      }

      const { data, error } = await supabase.from('schools').select('*').order('created_at')
      
      if (error) {
        console.error('[useSchools] Supabase load error:', error)
        setDbError(error.message)
        const ls = loadFromLS()
        setSchools(ls || DEFAULT_SCHOOLS)
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        console.log('[useSchools] Loaded from Supabase:', data.length, 'schools')
        // Sort by sort_order if present, otherwise by created_at
        const sorted = [...data].sort((a, b) => {
          if (a.sort_order != null && b.sort_order != null) return a.sort_order - b.sort_order
          return 0
        })
        setSchools(sorted)
        setDbOk(true)
        setLoading(false)
        return
      }

      // Empty table — seed it
      console.log('[useSchools] Empty table, seeding defaults...')
      const { data: inserted, error: insertError } = await supabase
        .from('schools')
        .insert(DEFAULT_SCHOOLS.map(toDBRecord))
        .select()

      if (insertError) {
        console.error('[useSchools] Seed error:', insertError)
        setDbError(insertError.message)
        setSchools(DEFAULT_SCHOOLS)
      } else {
        console.log('[useSchools] Seeded', inserted.length, 'schools')
        setSchools(inserted)
        setDbOk(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  const addSchool = useCallback(async (school) => {
    const record = toDBRecord(school)
    // Always generate an id client-side (table uses text pk, no DB default)
    const newRecord = { ...record, id: record.id || Date.now().toString() }
    if (supabase && dbOk) {
      const { data, error } = await supabase.from('schools').insert([newRecord]).select()
      if (error) { console.error('[addSchool] error:', error); alert('Save failed: ' + error.message); return }
      if (data) { setSchools(prev => [...prev, ...data]); return }
    }
    setSchools(prev => { const next = [...prev, newRecord]; saveToLS(next); return next })
  }, [dbOk])

  const updateSchool = useCallback(async (id, updates) => {
    const { sched, ...cleanUpdates } = updates
    // Optimistic UI update
    setSchools(prev => prev.map(s => s.id === id ? { ...s, ...cleanUpdates } : s))

    if (supabase && dbOk) {
      const { error } = await supabase.from('schools').update(cleanUpdates).eq('id', id)
      if (error) {
        console.error('[updateSchool] error:', error)
        alert('Save failed: ' + error.message)
        const { data } = await supabase.from('schools').select('*').order('created_at')
        if (data) setSchools(data)
      } else {
        console.log('[updateSchool] saved id:', id, cleanUpdates)
      }
    } else {
      setSchools(prev => { const next = prev.map(s => s.id === id ? { ...s, ...cleanUpdates } : s); saveToLS(next); return next })
    }
  }, [dbOk])

  const deleteSchool = useCallback(async (id) => {
    if (supabase && dbOk) {
      const { error } = await supabase.from('schools').delete().eq('id', id)
      if (error) { console.error('[deleteSchool] error:', error); alert('Delete failed: ' + error.message); return }
    }
    setSchools(prev => { const next = prev.filter(s => s.id !== id); if (!dbOk) saveToLS(next); return next })
  }, [dbOk])

  const reorderSchools = useCallback(async (orderedIds) => {
    // Update state immediately
    setSchools(prev => {
      const map = Object.fromEntries(prev.map(s => [s.id, s]))
      return orderedIds.map((id, i) => ({ ...map[id], sort_order: i })).filter(Boolean)
    })
    // Persist sort_order to DB
    if (supabase && dbOk) {
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase.from('schools').update({ sort_order: i }).eq('id', orderedIds[i])
      }
    }
  }, [dbOk])

  return { schools, loading, addSchool, updateSchool, deleteSchool, reorderSchools, dbOk, dbError }
}
