
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, hasSupabase } from './lib/supabase'

// CONFIG
const PRO_AUTH = { username: 'professionista', password: 'apprendi2025' }
import logoAM from './assets/logo-am.jpg'

const BRAND = { primary: 'var(--brand-primary)', secondary: 'var(--brand-secondary)', accent: 'var(--brand-accent)', bg: 'var(--brand-bg)', text: '#1A202C' }
const PRO_COLORS = ['#0EA5E9','#22C55E','#F59E0B','#EF4444','#8B5CF6','#14B8A6','#EC4899','#6366F1','#84CC16','#06B6D4']
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

// Helpers
function buildISOFromYMD_HHMM(ymd, hhmm) {
  if (!ymd || !hhmm) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  const t = /^([0-2]\d)-([0-5]\d)$/.exec(hhmm)
  if (!m || !t) return null
  const [, Y, M, D] = m; const [, HH, MM] = t
  const date = new Date(Number(Y), Number(M)-1, Number(D), Number(HH), Number(MM))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
const fmtIt = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth()+1).padStart(2, '0'); const yy = String(d.getFullYear()).slice(-2)
  const HH = String(d.getHours()).padStart(2, '0'); const MM = String(d.getMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yy} ${HH}:${MM}`
}

// storage
const LS = { pros: 'appr_pros', users: 'appr_users' }
const loadLS = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f } catch { return f } }
const saveLS = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export default function App() {
  const [pros, setPros] = useState(() => loadLS(LS.pros, []))
  const [users, setUsers] = useState(() => loadLS(LS.users, []))
  const [role, setRole] = useState(null)
  const [authOk, setAuthOk] = useState(false)
  const [currentProId, setCurrentProId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
const [hydrated, setHydrated] = useState(false)
const initialPros = useRef(pros)
const initialUsers = useRef(users)

  useEffect(() => saveLS(LS.pros, pros), [pros])
  useEffect(() => saveLS(LS.users, users), [users])

// ===== Supabase sync (Option 2 MVP, safe) =====
const TENANT_ID = 'default'
const savingRef = useRef(false)

async function remoteLoad() {
  if (!hasSupabase) return null
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', TENANT_ID)
    .single()
  if (error) { console.warn('Supabase load error', error); return null }
  return data?.data || null
}

async function remoteSave(snapshot) {
  if (!hasSupabase) return
  try {
    savingRef.current = true
    const { error } = await supabase
      .from('app_state')
      .upsert(
        { id: TENANT_ID, data: snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    if (error) console.warn('Supabase save error', error)
  } finally {
    // usa un piccolo delay per evitare eco degli eventi realtime
    setTimeout(() => { savingRef.current = false }, 200)
  }
}

// Boot: carica dal remoto; se non esiste la riga e local ha dati, semina; poi attiva Realtime
useEffect(() => {
  (async () => {
    const remote = await remoteLoad()
    if (remote) {
      // aggiorna SOLO i dati condivisi
      setPros(remote.pros || [])
      setUsers(remote.users || [])
    } else {
      // la riga non esiste: se local ha dati, semina
      if ((initialPros.current?.length || initialUsers.current?.length) && hasSupabase) {
        await remoteSave({ pros: initialPros.current, users: initialUsers.current })
      }
    }

    // attiva realtime
    if (hasSupabase && supabase?.channel) {
      try {
        channel = supabase
          .channel('app_state_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${TENANT_ID}` },
            (payload) => {
              const next = payload.new?.data
              if (!next || savingRef.current) return
              // applica SOLO i dati condivisi (niente currentProId!)
              setPros(next.pros || [])
              setUsers(next.users || [])
            }
          )
          .subscribe()
      } catch (e) { console.warn('Realtime not available', e) }
    }

    setHydrated(true) // da qui in poi è consentito salvare
  })()
  return () => {try { if (channel) supabase.removeChannel(channel) } catch {}
}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Salva su Supabase al variare dei dati condivisi (solo dopo idratazione)
useEffect(() => {
  if (!hasSupabase || !hydrated) return
  remoteSave({ pros, users }) // <- NON includere currentProId
}, [pros, users, hydrated])
// ===== end Supabase sync =====

  const currentPro = useMemo(() => pros.find(p => p.id === currentProId) || null, [pros, currentProId])
  const currentUser = useMemo(() => users.find(u => u.id === currentUserId) || null, [users, currentUserId])
  const colorForIndex = (i) => PRO_COLORS[i % PRO_COLORS.length]

  // CRUD
  function createProfessional(name, email) {
    const exists = pros.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (exists) return exists
    const p = { id: uid(), name: name.trim(), email: (email||'').trim(), color: colorForIndex(pros.length) }
    setPros(s => [...s, p]); return p
  }
  function generateUniqueCode() { let code; do { code = String(Math.floor(100000 + Math.random()*900000)) } while (users.some(u => u.code === code)); return code }
  function createUser({ fullName, phone, email }) {
    const u = { id: uid(), code: generateUniqueCode(), fullName: fullName.trim(), phone: (phone||'').trim(), email: (email||'').trim(), notificationEmail: true, notificationSms: false, percorsi: [] }
    setUsers(prev => [...prev, u]); return u
  }
  function updateUser(u) { setUsers(prev => prev.map(x => x.id === u.id ? u : x)) }
  function deleteUser(userId) { setUsers(prev => prev.filter(u => u.id !== userId)); if (currentUserId === userId) setCurrentUserId(null) }
  function addPercorso(userId, { name, professionalId, totalSessions }) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const p = { id: uid(), name: name.trim(), professionalId, totalSessions: Number(totalSessions)||0, remainingSessions: Number(totalSessions)||0, sessions: [], history: [] }
      return { ...u, percorsi: [...u.percorsi, p] }
    }))
  }
  function planSession(userId, percorsoId, iso) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const percorsi = u.percorsi.map(p => p.id !== percorsoId ? p :
        ({ ...p, sessions: [...p.sessions, { id: uid(), datetimeISO: iso }].sort((a,b)=> new Date(a.datetimeISO)-new Date(b.datetimeISO)) }))
      return { ...u, percorsi }
    }))
  }
  function confirmSession(userId, percorsoId, sessionId) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const percorsi = u.percorsi.map(p => {
        if (p.id !== percorsoId) return p
        const session = p.sessions.find(s => s.id === sessionId); if (!session) return p
        const rest = p.sessions.filter(s => s.id !== sessionId)
        return { ...p, sessions: rest, history: [{...session}, ...p.history], remainingSessions: clamp((p.remainingSessions||0)-1,0,9999) }
      })
      return { ...u, percorsi }
    }))
  }
  function editSessionDate(userId, percorsoId, sessionId, newIso, isHistory=false) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const percorsi = u.percorsi.map(p => {
        if (p.id !== percorsoId) return p
        if (!isHistory) {
          const sessions = p.sessions.map(s => s.id === sessionId ? { ...s, datetimeISO: newIso } : s).sort((a,b)=> new Date(a.datetimeISO)-new Date(b.datetimeISO))
          return { ...p, sessions }
        } else {
          const history = p.history.map(s => s.id === sessionId ? { ...s, datetimeISO: newIso } : s).sort((a,b)=> new Date(a.datetimeISO)-new Date(b.datetimeISO))
          return { ...p, history }
        }
      })
      return { ...u, percorsi }
    }))
  }
  function deletePlannedSession(userId, percorsoId, sessionId) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const percorsi = u.percorsi.map(p => p.id!==percorsoId ? p : ({ ...p, sessions: p.sessions.filter(s => s.id !== sessionId) }))
      return { ...u, percorsi }
    }))
  }
  function regenerateCode(userId) { const code = generateUniqueCode(); setUsers(prev => prev.map(u => u.id === userId ? { ...u, code } : u )) }

  
  // --- injected: professional update/delete and deleteHistorySession ---
  function updateProfessional(id, updates) {
    setPros(prev => {
      const nameTo = (updates.name ?? '').trim()
      if (nameTo) {
        const exists = prev.find(p => p.id !== id && p.name.trim().toLowerCase() === nameTo.toLowerCase())
        if (exists) { alert('Esiste già un professionista con questo nome.'); return prev }
      }
      return prev.map(p => p.id === id ? { ...p, ...updates, name: (updates.name ?? p.name).trim(), email: (updates.email ?? p.email).trim() } : p)
    })
  }

  function deleteProfessional(id) {
    const used = users.some(u => (u.percorsi||[]).some(per => per.professionalId === id))
    if (used) { alert('Questo professionista è associato ad almeno un percorso. Sposta o elimina quei percorsi prima di cancellarlo.'); return }
    setPros(prev => prev.filter(p => p.id !== id))
    if (currentProId === id) setCurrentProId(null)
  }

  function deleteHistorySession(userId, percorsoId, sessionId) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const percorsi = u.percorsi.map(p => {
        if (p.id!==percorsoId) return p
        const maxTot = Number(p.totalSessions) || 0
        const nextRem = Math.min(maxTot, (p.remainingSessions||0)+1)
        return { ...p, history: p.history.filter(s => s.id !== sessionId), remainingSessions: Math.min(Math.max(nextRem, 0), maxTot) }
      })
      return { ...u, percorsi }
    }))
  }
  // --- end injected ---
return (
    <div className="min-h-screen" style={{ background: BRAND.bg, color: BRAND.text }}>
      <Header onBack={role ? ()=>setRole(null) : null} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {!role && <Landing onSelectRole={setRole} />}
        {role === 'professionista' && !authOk && <ProAuth onOk={()=>setAuthOk(true)} />}
        {role === 'professionista' && authOk && !currentPro && (
          <ProIdentity pros={pros} onCreate={(name,email)=>{ const p = createProfessional(name,email); setCurrentProId(p.id)}} onSelect={(id)=> setCurrentProId(id)} onBack={()=>{ setAuthOk(false) }}  onUpdate={updateProfessional} onDelete={deleteProfessional}/>
        )}
        {role === 'professionista' && authOk && currentPro && (
          <ProDashboard pros={pros} me={currentPro} users={users} onUpdateProfessional={updateProfessional} onDeleteProfessional={deleteProfessional}
            onLogout={()=>{ setCurrentProId(null); setAuthOk(false) }}
            onCreateUser={createUser} onDeleteUser={deleteUser} onUpdateUser={updateUser}
            onAddPercorso={addPercorso} onPlan={planSession} onConfirm={confirmSession}
            onEditSession={editSessionDate} onDeletePlanned={deletePlannedSession} onDeleteHistory={deleteHistorySession} onRegenerateCode={regenerateCode}
            onBack={()=> setCurrentProId(null)}
          />
        )}
        {role === 'utente' && !currentUser && (<UserCodeLogin onSelectByCode={(code)=>{
            const u = users.find(x => x.code === code.trim()); if (u) setCurrentUserId(u.id); else alert('Codice non valido. Contatta il professionista.')
          }} onBack={()=> setRole(null)} />)}
        {role === 'utente' && currentUser && (<UserDashboard pros={pros} user={currentUser} onBack={()=> setCurrentUserId(null)} />)}
      </div>
    </div>
  )
}

function Header({ onBack }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoAM} alt="ApprendiMente" className="w-8 h-8 rounded-xl object-cover" />
          <div>
            <div className="font-bold">ApprendiMente</div>
            <div className="text-xs text-gray-500">Centro per l'apprendimento</div>
          </div>
        </div>
        <div>{onBack && <Button variant="ghost" onClick={onBack}>Indietro</Button>}</div>
      </div>
    </header>
  )
}


function Card({ children, accent }) { return <div className="rounded-2xl p-4 shadow-sm border bg-white" style={{ borderColor: accent || '#E2E8F0' }}>{children}</div> }
function Button({ children, onClick, variant='primary', disabled, title }) {
  const base="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition border"
  const styles={primary:{backgroundColor:'var(--brand-primary)',color:'white',borderColor:'var(--brand-primary)'},
                ghost:{backgroundColor:'transparent',color:'#111827',borderColor:'#E2E8F0'},
                danger:{backgroundColor:'#DC2626',color:'white',borderColor:'#B91C1C'},
                warn:{backgroundColor:'var(--brand-accent)',color:'#111827',borderColor:'#F59E0B'}}
  return <button onClick={onClick} disabled={disabled} title={title} style={styles[variant]} className={base+(disabled?" opacity-50 cursor-not-allowed":" hover:opacity-90")}>{children}</button>
}
function Field({ label, children }) { return (<label className="flex flex-col gap-1 text-sm"><span className="font-medium text-gray-700">{label}</span>{children}</label>) }

// DateTime picker modal: input type="date" + 30-min slots grid
function DateTimeModal({ open, onClose, onConfirm }) {
  const [ymd, setYmd] = useState('')
  const [slot, setSlot] = useState('') // 'HH-MM'

  if (!open) return null
  const slots = []; for (let h=0; h<24; h++){ for (let m of [0,30]){ const HH=String(h).padStart(2,'0'); const MM=String(m).padStart(2,'0'); slots.push(`${HH}-${MM}`) } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Seleziona data e orario</h3>
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Data">
            <input type="date" className="rounded-xl border p-2" value={ymd} onChange={(e)=> setYmd(e.target.value)} />
          </Field>
          <Field label="Orario (scaglioni 30 min)">
            <div className="h-48 overflow-auto border rounded-xl p-2">
              <div className="grid grid-cols-3 gap-2">
                {slots.map(s => {
                  const label = s.replace('-',':')
                  const active = slot === s
                  return (
                    <button key={s} onClick={()=> setSlot(s)} className={"text-sm rounded-lg border px-2 py-1 "+(active?"bg-brand-primary text-white":"bg-white")}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">{ymd && slot ? `Selezionato: ${ymd} ${slot.replace('-',':')}` : 'Scegli una data e un orario'}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
            <Button onClick={()=>{
              const iso = buildISOFromYMD_HHMM(ymd, slot)
              if (!iso) return alert('Seleziona data e orario')
              onConfirm(iso); onClose()
            }}>Conferma</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Screens
function Landing({ onSelectRole }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card accent={'var(--brand-primary)'}>
        <h2 className="text-xl font-bold mb-2">Area Professionisti</h2>
        <p className="text-sm text-gray-600 mb-4">Gestisci utenti, percorsi, pianificazioni e storico. Richiede user e password condivisi.</p>
        <Button onClick={()=> onSelectRole('professionista')}>Sono un professionista</Button>
      </Card>
      <Card accent={'var(--brand-secondary)'}>
        <h2 className="text-xl font-bold mb-2">Area Utenti (solo lettura)</h2>
        <p className="text-sm text-gray-600 mb-4">Accedi con il tuo codice a 6 cifre per vedere percorsi, date pianificate e residuo lezioni.</p>
        <Button variant="ghost" onClick={()=> onSelectRole('utente')}>Sono un utente</Button>
      </Card>
    </div>
  )
}

function ProAuth({ onOk }) {
  const [u, setU] = useState(''); const [p, setP] = useState('')
  return (
    <Card accent={'var(--brand-primary)'}>
      <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Accesso professionisti</h3></div>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="User"><input className="rounded-xl border p-2" value={u} onChange={(e)=>setU(e.target.value)} /></Field>
        <Field label="Password"><input type="password" className="rounded-xl border p-2" value={p} onChange={(e)=>setP(e.target.value)} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={()=>{ if (u===PRO_AUTH.username && p===PRO_AUTH.password) onOk(); else alert('Credenziali non valide') }}>Entra</Button>
        <Button variant="ghost" onClick={()=>{ setU(''); setP('') }}>Reset</Button>
      </div>
    </Card>
  )
}

function ProIdentity({ pros, onCreate, onSelect, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('entra'); const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card accent={'var(--brand-primary)'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button variant={tab==='entra'?'primary':'ghost'} onClick={()=>setTab('entra')}>Seleziona</Button>
            <Button variant={tab==='nuovo'?'primary':'ghost'} onClick={()=>setTab('nuovo')}>Crea</Button>
          </div>
          <Button variant="ghost" onClick={onBack}>Indietro</Button>
        </div>
        {tab === 'entra' ? (
          <div className="space-y-3">
            <Field label="Seleziona il tuo profilo professionista">
              <select className="rounded-xl border p-2" onChange={(e)=> onSelect(e.target.value)} defaultValue="">
                <option value="" disabled>- scegli -</option>
                {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Nome e Cognome"><input className="rounded-xl border p-2" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Mario Rossi" /></Field>
            <Field label="Email (facoltativa)"><input type="email" className="rounded-xl border p-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="nome@dominio.it" /></Field>
            <Button onClick={()=> name.trim() && onCreate(name, email)}>Crea e continua</Button>
          </div>
        )}
      </Card>
      <Card>
        <h3 className="text-lg font-semibold mb-2">Professionisti registrati</h3>
        <ul className="space-y-2">
          {pros.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border p-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: p.color }}></span>
                {editingId === p.id ? (
                  <div className="flex flex-col gap-1 min-w-0">
                    <input className="rounded-lg border p-1 text-sm" value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nome" />
                    <input className="rounded-lg border p-1 text-sm" value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="Email" />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 truncate">{p.email || ' - '}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {editingId === p.id ? (
                  <>
                    <Button onClick={() => (editName.trim() ? (onUpdate(p.id, { name: editName, email: editEmail }), setEditingId(null)) : alert('Inserisci un nome'))}>Salva</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Annulla</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditEmail(p.email || '') }}>Modifica</Button>
                    <Button variant="ghost" onClick={() => { if (confirm('Cancellare questo professionista?')) onDelete(p.id) }}>Elimina</Button>
                  </>
                )}
              </div>
            </li>
          ))}
          {pros.length===0 && <li className="text-sm text-gray-500">Nessun professionista registrato.</li>}
        </ul>
      </Card>
    </div>
  )
}

function ProDashboard({ pros, me, users, onLogout, onCreateUser, onDeleteUser, onUpdateUser, onAddPercorso, onPlan, onConfirm, onEditSession, onDeletePlanned, onRegenerateCode, onBack , onDeleteHistory}) {
  const [userForm, setUserForm] = useState({ fullName:'', phone:'', email:'', notificationEmail:true, notificationSms:false })
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || null)
  const selectedUser = users.find(u => u.id === selectedUserId) || null
  const [percForm, setPercForm] = useState({ name:'', professionalId: me.id, totalSessions: 10 })
  const [dtOpen, setDtOpen] = useState(false)

  useEffect(()=>{ if (users.length && !selectedUserId) setSelectedUserId(users[0].id) }, [users])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Area Professionisti</h2>
          <span className="inline-flex items-center gap-2 text-sm text-gray-600"><span className="inline-block w-3 h-3 rounded-full" style={{ background: me.color }} />{me.name}</span>
        </div>
        <div className="flex gap-2"><Button variant="ghost" onClick={onBack}>Indietro</Button><Button variant="ghost" onClick={onLogout}>Esci</Button></div>
      </div>

      <Card accent={me.color}>
        <h3 className="text-lg font-semibold mb-3">Crea/gestisci utenti</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Nome e Cognome"><input className="rounded-xl border p-2" value={userForm.fullName} onChange={(e)=>setUserForm({...userForm, fullName:e.target.value})} /></Field>
          <Field label="Cellulare"><input className="rounded-xl border p-2" value={userForm.phone} onChange={(e)=>setUserForm({...userForm, phone:e.target.value})} /></Field>
          <Field label="Mail"><input type="email" className="rounded-xl border p-2" value={userForm.email} onChange={(e)=>setUserForm({...userForm, email:e.target.value})} /></Field>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={userForm.notificationEmail} onChange={(e)=> setUserForm({...userForm, notificationEmail: e.target.checked})} /> Promemoria email 24h prima</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={userForm.notificationSms} onChange={(e)=> setUserForm({...userForm, notificationSms: e.target.checked})} /> Promemoria SMS 24h prima</label>
        </div>
        <div className="mt-3"><Button onClick={()=>{
          if (!userForm.fullName.trim()) return alert('Inserisci il nome completo')
          const u = onCreateUser(userForm); setSelectedUserId(u.id); setUserForm({ fullName:'', phone:'', email:'', notificationEmail:true, notificationSms:false })
        }}>Crea utente</Button></div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card accent={me.color}>
          <h3 className="text-lg font-semibold mb-3">Tutti gli utenti</h3>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className={"rounded-xl border p-3 " + (selectedUserId===u.id ? 'bg-slate-50':'')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.fullName}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email || ' - '} • {u.phone || ' - '}</div>
                    <div className="text-xs text-gray-500">Codice: <span className="font-mono">{u.code}</span></div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" onClick={()=> setSelectedUserId(u.id)}>Apri</Button>
                    <Button variant="danger" onClick={()=>{ if (confirm(`Confermi l'eliminazione dell'utente?`)) onDeleteUser(u.id) }}>Elimina</Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {u.percorsi.map(p=>{ const pro = pros.find(pr => pr.id === p.professionalId); return <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: pro?.color, color: pro?.color }}>{p.name}</span> })}
                </div>
              </div>
            ))}
            {users.length===0 && <div className="text-sm text-gray-500">Nessun utente. Creane uno sopra.</div>}
          </div>
        </Card>

        <Card accent={me.color}>
          {!selectedUser ? (<div className="text-sm text-gray-500">Seleziona un utente.</div>) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedUser.fullName}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Codice</span>
                  <input className="rounded-xl border p-2 font-mono w-28 text-center" value={selectedUser.code} readOnly />
                  <Button variant="ghost" onClick={()=> onRegenerateCode(selectedUser.id)}>Rigenera</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <Field label="Mail"><input type="email" className="rounded-xl border p-2" value={selectedUser.email} onChange={(e)=> onUpdateUser({ ...selectedUser, email: e.target.value })} /></Field>
                <Field label="Cellulare"><input className="rounded-xl border p-2" value={selectedUser.phone} onChange={(e)=> onUpdateUser({ ...selectedUser, phone: e.target.value })} /></Field>
                <div className="flex items-end gap-3">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedUser.notificationEmail||false} onChange={(e)=> onUpdateUser({ ...selectedUser, notificationEmail: e.target.checked })} /> Email 24h</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedUser.notificationSms||false} onChange={(e)=> onUpdateUser({ ...selectedUser, notificationSms: e.target.checked })} /> SMS 24h</label>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">Percorsi dell'utente</h4>
                <div className="grid md:grid-cols-4 gap-3 mb-3">
                  <Field label="Nome percorso"><input className="rounded-xl border p-2" value={percForm.name} onChange={(e)=>setPercForm({...percForm, name:e.target.value})} placeholder="Es. Logopedia" /></Field>
                  <Field label="Professionista">
                    <select className="rounded-xl border p-2" value={percForm.professionalId} onChange={(e)=>setPercForm({...percForm, professionalId: e.target.value})}>
                      {pros.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Numero di incontri (totale)"><input type="number" className="rounded-xl border p-2" value={percForm.totalSessions} onChange={(e)=>setPercForm({...percForm, totalSessions: e.target.value})} /></Field>
                  <div className="flex items-end"><Button onClick={()=>{
                    if(!percForm.name.trim()) return alert('Inserisci il nome del percorso')
                    onAddPercorso(selectedUser.id, percForm); setPercForm({ name:'', professionalId: percForm.professionalId, totalSessions: 10 })
                  }}>Aggiungi percorso</Button></div>
                </div>

                <div className="space-y-4">
                  {selectedUser.percorsi.map(percorso => {
                    const pro = pros.find(pr => pr.id === percorso.professionalId)
                    return (
                      <div key={percorso.id} className="rounded-xl border p-3" style={{ borderColor: pro?.color }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: pro?.color }} /><div className="font-medium">{percorso.name}</div></div>
                          <div className="text-xs text-gray-500">Residuo {percorso.remainingSessions}/{percorso.totalSessions}</div>
                        </div>

                        <div className="mt-3">
                          <Button onClick={()=> setDtOpen(true)}>Scegli data/ora</Button>
                          <DateTimeModal open={dtOpen} onClose={()=> setDtOpen(false)} onConfirm={(iso)=>{
                            if (confirm(`Confermi l'aggiunta di questo incontro?`)) onPlan(selectedUser.id, percorso.id, iso)
                          }} />
                        </div>

                        <div className="mt-4 space-y-4">
                          <div>
                            <div className="font-semibold mb-2">Prossimi incontri</div>
                            <ul className="space-y-2">
                              {percorso.sessions.map(sess => (
                                <EditableSessionRow key={sess.id} initialIso={sess.datetimeISO}
                                  onEdit={(newIso)=> onEditSession(selectedUser.id, percorso.id, sess.id, newIso, false)}
                                  onDelete={()=> onDeletePlanned(selectedUser.id, percorso.id, sess.id)}
                                  onConfirm={()=> onConfirm(selectedUser.id, percorso.id, sess.id)}
                                />
                              ))}
                              {percorso.sessions.length===0 && <li className="text-sm text-gray-500"> - </li>}
                            </ul>
                          </div>
                          <div>
                            <div className="font-semibold mb-2">Storico incontri</div>
                            <ul className="space-y-2">
                              {percorso.history.map(sess => (
                                <EditableSessionRow key={sess.id} initialIso={sess.datetimeISO}
                                  onEdit={(newIso)=> onEditSession(selectedUser.id, percorso.id, sess.id, newIso, true)}
                                  onDelete={()=> onDeleteHistory(selectedUser.id, percorso.id, sess.id)}
                                  hideConfirm deleteMsg="Confermi di eliminare questo incontro passato?"
                                />
                              ))}
                              {percorso.history.length===0 && <li className="text-sm text-gray-500"> - </li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {selectedUser.percorsi.length===0 && <div className="text-sm text-gray-500">Nessun percorso: aggiungine uno sopra.</div>}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function EditableSessionRow({ initialIso, onEdit, onDelete, onConfirm, hideConfirm, hideDelete, deleteMsg }) {
  const [editing, setEditing] = useState(false)
  const [dateIt, setDateIt] = useState('')
  const [timeIt, setTimeIt] = useState('')
  const label = fmtIt(initialIso)

  return (
    <li className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border p-3 gap-2">
      <div className="text-sm">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {!editing ? (
          <>
            {!hideConfirm && <Button variant="primary" onClick={onConfirm}>Conferma svolto</Button>}
            {!hideDelete && <Button variant="danger" onClick={() => { if (confirm(deleteMsg || `Confermi di eliminare questo incontro pianificato?`)) onDelete(); }}>Elimina</Button>}
            <Button variant="ghost" onClick={()=> setEditing(true)}>Modifica</Button>
          </>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <input className="rounded-xl border p-2 w-28" placeholder="GG-MM-AA" value={dateIt} onChange={(e)=>setDateIt(e.target.value)} />
            <input className="rounded-xl border p-2 w-20" placeholder="HH-MM" value={timeIt} onChange={(e)=>setTimeIt(e.target.value)} />
            <Button variant="warn" onClick={()=>{
              // Accept manual inputs for edit, keep previous parser style
              const d = /^([0-3]?\d)-([0-1]?\d)-(\d{2})$/.exec((dateIt||'').trim());
              const t = /^([0-2]?\d)-([0-5]\d)$/.exec((timeIt||'').trim());
              if (!d || !t) return alert('Data/ora non valide')
              const [, gg, mm, aa] = d; const [, HH, MM] = t
              const iso = new Date(2000+Number(aa), Number(mm)-1, Number(gg), Number(HH), Number(MM)).toISOString()
              if (confirm(`Confermi la modifica della data/ora?`)) { onEdit(iso); setEditing(false); setDateIt(''); setTimeIt('') }
            }}>Salva</Button>
            <Button variant="ghost" onClick={()=>{ setEditing(false); setDateIt(''); setTimeIt('') }}>Annulla</Button>
          </div>
        )}
      </div>
    </li>
  )
}

function UserCodeLogin({ onSelectByCode, onBack }) {
  const [code, setCode] = useState('')
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card accent={'var(--brand-secondary)'}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Accesso Utente</h3><Button variant="ghost" onClick={onBack}>Indietro</Button></div>
        <div className="space-y-3">
          <Field label="Codice di accesso (6 cifre)"><input className="rounded-xl border p-2 font-mono text-center" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="######" /></Field>
          <Button onClick={()=> onSelectByCode(code)} disabled={code.length < 6}>Accedi</Button>
        </div>
      </Card>
      <Card><p className="text-sm text-gray-600">Il codice ti e stato fornito dal professionista. Se lo hai smarrito, chiedi di rigenerarlo.</p></Card>
    </div>
  )
}

function UserDashboard({ pros, user, onBack }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Ciao, {user.fullName}</h2><Button variant="ghost" onClick={onBack}>Indietro</Button></div>
      <Card><div className="grid md:grid-cols-3 gap-3"><div><div className="font-semibold">Contatti</div><div className="text-sm text-gray-600">{user.email || ' - '} • {user.phone || ' - '}</div></div><div><div className="font-semibold">Codice accesso</div><div className="text-sm text-gray-600 font-mono">{user.code}</div></div></div></Card>
      <div className="space-y-4">
        {user.percorsi.map(percorso => { const pro = pros.find(p => p.id === percorso.professionalId); return (
          <Card key={percorso.id} accent={pro?.color}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: pro?.color }} />
                <h3 className="text-lg font-semibold">{percorso.name}</h3>
              </div>
              <div className="text-xs text-gray-500">Residuo {percorso.remainingSessions}/{percorso.totalSessions}</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">Professionista: <span className="font-medium">{pro?.name || '-'}</span></div>
            <div className="mt-3 space-y-4">
              <div><div className="font-semibold mb-1">Prossimi incontri</div><ul className="space-y-1">{percorso.sessions.map(s => <li key={s.id} className="text-sm">{fmtIt(s.datetimeISO)}</li>)}{percorso.sessions.length===0 && <li className="text-sm text-gray-500"> - </li>}</ul></div>
              <div><div className="font-semibold mb-1">Storico</div><ul className="space-y-1">{percorso.history.map(h => <li key={h.id} className="text-sm text-gray-600">✔ {fmtIt(h.datetimeISO)}</li>)}{percorso.history.length===0 && <li className="text-sm text-gray-500"> - </li>}</ul></div>
            </div>
          </Card>
        )})}
        {user.percorsi.length===0 && <Card><div className="text-sm text-gray-500">Nessun percorso attivo.</div></Card>}
      </div>
    </div>
  )
}
