'use client'
import { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#080810', card: '#0f0f1c', border: '#1a1a2e',
  cal: '#f97316', run: '#22d3ee', smoke: '#818cf8',
  mental: '#a78bfa', green: '#4ade80', yellow: '#facc15',
  pink: '#f472b6', text: '#e2e8f0', muted: '#475569', dim: '#1e2030',
  food: '#34d399', basal: '#94a3b8',
}

const BRIGHT_BLUE = '#38bdf8'
const DEEP_GREEN = '#22c55e'
const YELLOW = '#facc15'
const AMBER = '#fb923c'
const RED = '#ef4444'
const EMPTY = '#1e2030'

function netColor(net: number | null): string {
  if (net === null) return EMPTY
  const deficit = -net
  if (deficit >= 1000) return BRIGHT_BLUE
  if (deficit >= 500) return DEEP_GREEN
  if (deficit >= 200) return YELLOW
  if (deficit >= 0) return AMBER
  return RED
}

const PLAN = [
  {w:1,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km'},
  {w:2,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km'},
  {w:3,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km'},
  {w:4,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km'},
  {w:5,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km'},
  {w:6,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km'},
  {w:7,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km'},
  {w:8,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km'},
  {w:9,sp:'5x800m @ 4:20',ez:'5-7km',te:'4km @ 4:30',lo:'8-12km'},
  {w:10,sp:'5x800m @ 4:20',ez:'5-7km',te:'4km @ 4:30',lo:'8-12km'},
  {w:11,sp:'4x1km @ 4:20',ez:'5-7km',te:'5km @ 4:30',lo:'8-12km'},
  {w:12,sp:'4x1km @ 4:20',ez:'5-7km',te:'5km @ 4:30',lo:'8-12km'},
]

const SESS_TYPES = ['speed','easy','tempo','long']

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0,0,0,0)
  return x
}

function fmtSecs(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

function sportEmoji(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('cycl') || n.includes('bike') || n.includes('bik')) return '🚴'
  if (n.includes('swim')) return '🏊'
  if (n.includes('hik')) return '🥾'
  if (n.includes('strength') || n.includes('weight') || n.includes('gym')) return '💪'
  if (n.includes('tennis')) return '🎾'
  if (n.includes('soccer') || n.includes('football')) return '⚽'
  if (n.includes('basketball')) return '🏀'
  if (n.includes('yoga')) return '🧘'
  if (n.includes('dance')) return '💃'
  if (n.includes('hiit') || n.includes('circuit')) return '⚡'
  if (n.includes('walk')) return '🚶'
  if (n.includes('ski') || n.includes('snow')) return '⛷️'
  if (n.includes('climb') || n.includes('boulder')) return '🧗'
  if (n.includes('row')) return '🚣'
  if (n.includes('box')) return '🥊'
  if (n.includes('pilates')) return '🤸'
  return '🏅'
}

export default function Home() {
  const [tab, setTab] = useState(0)
  const [calories, setCalories] = useState<any>({})
  const [dietaryCalories, setDietaryCalories] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [latestRuns, setLatestRuns] = useState<any[]>([])
  const [sports, setSports] = useState<any[]>([])
  const [latestSports, setLatestSports] = useState<any[]>([])
  const [cigs, setCigs] = useState(0)
  const [checks, setChecks] = useState<Record<string,boolean>>({})
  const [collapsed, setCollapsed] = useState<Record<number,boolean>>({})
  const [undoStack, setUndoStack] = useState<{wk:number,type:string}[]>([])
  const [cigHistory, setCigHistory] = useState<{date:string,count:number}[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('')

  // Settings (basal, goals) — fetched from API
  const [settings, setSettings] = useState({ basalCalories: 1800, calGoal: 600, eatGoal: 2200, cigGoal: 10, planStartDate: '2026-04-28', pb5kSecs: 1472, goal5kSecs: 1320, start5kSecs: 1560 })
  const [editingBasal, setEditingBasal] = useState(false)
  const [basalInput, setBasalInput] = useState('1800')
  const [editingPb, setEditingPb] = useState(false)
  const [pbInput, setPbInput] = useState('24:32')

  const basalCalories = settings.basalCalories
  const calGoal = settings.calGoal
  const eatGoal = settings.eatGoal
  const cigGoal = settings.cigGoal

  const fetchAll = useCallback(async () => {
    setSyncing(true)
    try {
      const [health, cigRes, planRes, settingsRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/cigs').then(r => r.json()),
        fetch('/api/plan').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
      if (health.calories?.calories_kcal) setCalories(health.calories)
      if (health.dietaryCalories?.calories_kcal) setDietaryCalories(health.dietaryCalories)
      if (health.history) setHistory(health.history)
      if (health.runs?.length) setRuns(health.runs)
      if (health.latestRuns?.length) setLatestRuns(health.latestRuns)
      if (health.sports?.length) setSports(health.sports)
      if (health.latestSports?.length) setLatestSports(health.latestSports)
      setCigs(cigRes.count || 0)
      if (cigRes.history?.length) setCigHistory(cigRes.history)
      setChecks(planRes.checks || {})
      if (settingsRes) {
        setSettings(settingsRes)
        setBasalInput(String(settingsRes.basalCalories))
        setPbInput(fmtSecs(settingsRes.pb5kSecs))
      }
      setLastSync(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))
    } catch(e) {}
    setSyncing(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function saveBasal() {
    const v = parseInt(basalInput, 10)
    if (isNaN(v) || v < 800 || v > 4000) {
      setBasalInput(String(basalCalories))
      setEditingBasal(false)
      return
    }
    const res = await fetch('/api/settings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ basalCalories: v }),
    })
    const data = await res.json()
    setSettings(data)
    setEditingBasal(false)
  }

  async function savePb() {
    const parts = pbInput.match(/^(\d+):(\d{2})$/)
    if (!parts) {
      setPbInput(fmtSecs(settings.pb5kSecs))
      setEditingPb(false)
      return
    }
    const secs = parseInt(parts[1]) * 60 + parseInt(parts[2])
    if (secs < 600 || secs > 3600) {
      setPbInput(fmtSecs(settings.pb5kSecs))
      setEditingPb(false)
      return
    }
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pb5kSecs: secs }),
    })
    const data = await res.json()
    setSettings(data)
    setEditingPb(false)
  }

  async function addCig() {
    const res = await fetch('/api/cigs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'increment'})})
    const d = await res.json()
    setCigs(d.count)
  }

  async function undoCig() {
    const res = await fetch('/api/cigs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'decrement'})})
    const d = await res.json()
    setCigs(d.count)
  }

  async function toggleCheck(key: string, checked: boolean) {
    const [, wkStr, type] = key.match(/^w(\d+)_(.+)$/) || []
    const wk = Number(wkStr)
    setChecks(prev => {
      const next = {...prev, [key]: checked}
      if (checked) {
        const allDone = SESS_TYPES.every(t => next[`w${wk}_${t}`])
        if (allDone) setCollapsed(c => ({...c, [wk]: true}))
      }
      return next
    })
    if (checked) {
      setUndoStack(prev => [...prev, {wk, type}])
    } else {
      setUndoStack(prev => prev.filter(u => !(u.wk===wk && u.type===type)))
    }
    await fetch('/api/plan', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key, checked})})
  }

  async function undoLastCheck() {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    const key = `w${last.wk}_${last.type}`
    setUndoStack(prev => prev.slice(0, -1))
    setChecks(prev => ({...prev, [key]: false}))
    setCollapsed(prev => ({...prev, [last.wk]: false}))
    await fetch('/api/plan', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key, checked: false})})
  }

  const kcal = calories.calories_kcal || 0
  const eaten = dietaryCalories?.calories_kcal || 0
  // NET = eaten − burned − basal
  const net = eaten - kcal - basalCalories
  const calPct = Math.min(Math.round((kcal/calGoal)*100), 100)
  const eatPct = Math.min(Math.round((eaten/eatGoal)*100), 100)
  const cigPct = Math.min(Math.round((cigs/cigGoal)*100), 100)
  const daysSinceStart = Math.floor((Date.now() - new Date(settings.planStartDate).getTime()) / 86400000)
  const currentWeek = Math.min(12, Math.max(1, Math.floor(daysSinceStart / 7) + 1))

  const pb5k = fmtSecs(settings.pb5kSecs)
  const goal5k = fmtSecs(settings.goal5kSecs)
  const start5k = fmtSecs(settings.start5kSecs)
  const pbPacePerKm = fmtSecs(Math.round(settings.pb5kSecs / 5))
  const gapSecs = settings.pb5kSecs - settings.goal5kSecs
  const gap5k = gapSecs > 0 ? `−${fmtSecs(gapSecs)}` : `+${fmtSecs(-gapSecs)}`
  const pct5k = Math.max(0, Math.min(100, Math.round((settings.start5kSecs - settings.pb5kSecs) / (settings.start5kSecs - settings.goal5kSecs) * 100)))

  const TABS = ['🔥','🏃','🏅','🚭','🤖']
  const TABNAMES = ['Calories','Running','Sports','Smoke','Coach']

  const ringSize = 220
  const cx = ringSize / 2
  const cy = ringSize / 2
  const ringStroke = 14
  const ringGap = 4
  const rOuter = 95
  const rMiddle = rOuter - ringStroke - ringGap
  const rInner = rMiddle - ringStroke - ringGap
  const circOuter = 2 * Math.PI * rOuter
  const circMiddle = 2 * Math.PI * rMiddle
  const circInner = 2 * Math.PI * rInner

  const balanceTarget = 500
  // Show balance ring as long as eaten exists (basal is always known now)
  const balancePct = eaten > 0
    ? Math.min(Math.abs(net) / balanceTarget * 100, 100)
    : 0
  const balanceColor = net < 0 ? C.green : net > 0 ? '#ef4444' : C.muted

  const histMap = new Map(history.map(h => [h.date, h]))
  const thisMonday = mondayOf(new Date())
  const weeks: { weekNum: number; days: ({ date: string; net: number | null } | null)[] }[] = []
  for (let w = 4; w >= 0; w--) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(weekStart.getDate() - w * 7)
    const weekNum = isoWeek(weekStart)
    const days = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + d)
      const dateStr = ymd(day)
      const entry = histMap.get(dateStr)
      const hasData = entry && entry.eaten > 0 && entry.burned > 0
      // History net also factors in basal
      days.push({
        date: dateStr,
        net: hasData ? (entry.eaten - entry.burned - basalCalories) : null,
      })
    }
    weeks.push({ weekNum, days })
  }

  const DAYS_LABEL = ['MON','TUE','WED','THU','FRI','SAT','SUN']

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:'monospace',paddingBottom:80}}>
      
      <div style={{background:'#0d0d1a',borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:15}}>Z</div>
          <div>
            <div style={{fontWeight:900,letterSpacing:5,fontSize:16}}>ZENIT</div>
            <div style={{fontSize:10,color:syncing?C.green:C.muted}}>{syncing?'Syncing...':lastSync?`Live · ${lastSync}`:'Loading...'}</div>
          </div>
        </div>
        <button onClick={fetchAll} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.mental,borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>↻ Sync</button>
      </div>

      <div style={{padding:'16px',maxWidth:480,margin:'0 auto'}}>

        {/* CALORIES */}
        {tab===0 && (
          <div>
            {/* Triple rings */}
            <div style={{background:C.card,border:`1px solid ${C.cal}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.cal,textTransform:'uppercase',letterSpacing:2,marginBottom:16,textAlign:'center'}}>⚡ Energy Today</div>
              
              <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
                <div style={{position:'relative',width:ringSize,height:ringSize}}>
                  <svg width={ringSize} height={ringSize} style={{transform:'rotate(-90deg)'}}>
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={C.food+'20'} strokeWidth={ringStroke}/>
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={C.food} strokeWidth={ringStroke}
                      strokeDasharray={`${circOuter*(eatPct/100)} ${circOuter}`} strokeLinecap="round"
                      style={{transition:'stroke-dasharray 1s ease',filter:`drop-shadow(0 0 6px ${C.food}80)`}}/>
                    <circle cx={cx} cy={cy} r={rMiddle} fill="none" stroke={C.cal+'20'} strokeWidth={ringStroke}/>
                    <circle cx={cx} cy={cy} r={rMiddle} fill="none" stroke={C.cal} strokeWidth={ringStroke}
                      strokeDasharray={`${circMiddle*(calPct/100)} ${circMiddle}`} strokeLinecap="round"
                      style={{transition:'stroke-dasharray 1s ease',filter:`drop-shadow(0 0 6px ${C.cal}80)`}}/>
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={balanceColor+'20'} strokeWidth={ringStroke}/>
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={balanceColor} strokeWidth={ringStroke}
                      strokeDasharray={`${circInner*(balancePct/100)} ${circInner}`} strokeLinecap="round"
                      style={{transition:'stroke-dasharray 1s ease',filter:`drop-shadow(0 0 6px ${balanceColor}80)`}}/>
                  </svg>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>NET</div>
                    <div style={{fontSize:28,fontWeight:900,color:balanceColor,lineHeight:1}}>
                      {eaten > 0 ? `${net > 0 ? '+' : ''}${net}` : '—'}
                    </div>
                    <div style={{fontSize:9,color:C.muted,marginTop:2}}>kcal</div>
                  </div>
                </div>
              </div>

              {/* Stat boxes — now 4 columns including basal */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                <div style={{textAlign:'center',padding:'8px 4px',background:C.dim,borderRadius:10,border:`1px solid ${C.food}20`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:3}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:C.food}}/>
                    <div style={{fontSize:8,color:C.muted,letterSpacing:1}}>EATEN</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:900,color:C.food}}>{eaten.toLocaleString()}</div>
                  <div style={{fontSize:8,color:C.muted,marginTop:1}}>/ {eatGoal}</div>
                </div>
                <div style={{textAlign:'center',padding:'8px 4px',background:C.dim,borderRadius:10,border:`1px solid ${C.cal}20`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:3}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:C.cal}}/>
                    <div style={{fontSize:8,color:C.muted,letterSpacing:1}}>BURNED</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:900,color:C.cal}}>{kcal.toLocaleString()}</div>
                  <div style={{fontSize:8,color:C.muted,marginTop:1}}>/ {calGoal}</div>
                </div>
                <div 
                  onClick={() => !editingBasal && setEditingBasal(true)}
                  style={{textAlign:'center',padding:'8px 4px',background:C.dim,borderRadius:10,border:`1px solid ${C.basal}20`,cursor:'pointer'}}
                >
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:3}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:C.basal}}/>
                    <div style={{fontSize:8,color:C.muted,letterSpacing:1}}>BASAL ✎</div>
                  </div>
                  {editingBasal ? (
                    <input
                      type="number"
                      value={basalInput}
                      onChange={e => setBasalInput(e.target.value)}
                      onBlur={saveBasal}
                      onKeyDown={e => { if (e.key === 'Enter') saveBasal() }}
                      autoFocus
                      style={{
                        width:'100%',fontSize:15,fontWeight:900,color:C.basal,
                        background:'transparent',border:`1px solid ${C.basal}50`,
                        borderRadius:4,textAlign:'center',padding:'2px 0',
                        fontFamily:'monospace',
                      }}
                    />
                  ) : (
                    <div style={{fontSize:15,fontWeight:900,color:C.basal}}>{basalCalories.toLocaleString()}</div>
                  )}
                  <div style={{fontSize:8,color:C.muted,marginTop:1}}>BMR</div>
                </div>
                <div style={{textAlign:'center',padding:'8px 4px',background:C.dim,borderRadius:10,border:`1px solid ${balanceColor}20`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:3}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:balanceColor}}/>
                    <div style={{fontSize:8,color:C.muted,letterSpacing:1}}>NET</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:900,color:balanceColor}}>
                    {eaten > 0 ? (net < 0 ? 'DEF' : net > 0 ? 'SUR' : '0') : '—'}
                  </div>
                  <div style={{fontSize:8,color:C.muted,marginTop:1}}>
                    {eaten > 0 ? `${Math.abs(net)} kcal` : 'no data'}
                  </div>
                </div>
              </div>

              {/* Formula hint */}
              <div style={{marginTop:10,padding:'6px 10px',borderRadius:6,background:C.dim,fontSize:9,color:C.muted,textAlign:'center',letterSpacing:0.5}}>
                NET = EATEN − BURNED − BASAL
              </div>

              <div style={{
                marginTop:10,padding:'8px 12px',borderRadius:8,
                background:eaten === 0 ? C.dim : (net < 0 ? C.green+'15' : '#ef444415'),
                fontSize:11,textAlign:'center',
                color:eaten === 0 ? C.muted : (net < 0 ? C.green : '#ef4444')
              }}>
                {eaten === 0 ? '🍽️ Log food in Kalorické Tabulky to see balance' 
                  : net < 0 ? `✅ ${Math.abs(net)} kcal deficit — on track`
                  : `⚠️ ${net} kcal surplus today`}
              </div>
            </div>

            {/* HISTORY GRID */}
            <div style={{background:C.card,border:`1px solid ${C.cal}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.cal,textTransform:'uppercase',letterSpacing:2,marginBottom:14}}>📊 30-Day History</div>
              
              <div style={{display:'grid',gridTemplateColumns:'32px repeat(7, 1fr)',gap:4,marginBottom:6}}>
                <div style={{fontSize:8,color:C.muted,letterSpacing:1,textAlign:'center'}}>WK</div>
                {DAYS_LABEL.map(d => (
                  <div key={d} style={{fontSize:8,color:C.muted,letterSpacing:1,textAlign:'center'}}>{d}</div>
                ))}
              </div>

              {weeks.map((week, wi) => {
                const todayStr = ymd(new Date())
                return (
                  <div key={wi} style={{display:'grid',gridTemplateColumns:'32px repeat(7, 1fr)',gap:4,marginBottom:4}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,textAlign:'center',alignSelf:'center'}}>
                      {week.weekNum}
                    </div>
                    {week.days.map((day, di) => {
                      if (!day) return <div key={di}/>
                      const color = netColor(day.net)
                      const isToday = day.date === todayStr
                      const isFuture = new Date(day.date) > new Date(todayStr)
                      const hasData = day.net !== null
                      return (
                        <div key={di} style={{
                          aspectRatio:'1',
                          background: isFuture ? 'transparent' : (hasData ? color : EMPTY),
                          border: isToday ? `2px solid ${C.text}` : isFuture ? `1px dashed ${C.border}` : 'none',
                          borderRadius:6,
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          fontSize:9,
                          fontWeight:700,
                          color: hasData ? '#000' : C.muted,
                          opacity: isFuture ? 0.3 : 1,
                        }}>
                          {hasData ? (day.net! < 0 ? Math.abs(day.net!) : `+${day.net}`) : ''}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.dim}`}}>
                <div style={{fontSize:8,color:C.muted,letterSpacing:1,marginBottom:6}}>DEFICIT SCALE</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[
                    {c:BRIGHT_BLUE,l:'1000+'},
                    {c:DEEP_GREEN,l:'500-1000'},
                    {c:YELLOW,l:'200-500'},
                    {c:AMBER,l:'0-200'},
                    {c:RED,l:'surplus'},
                    {c:EMPTY,l:'no data'},
                  ].map(item => (
                    <div key={item.l} style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{width:12,height:12,background:item.c,borderRadius:3}}/>
                      <div style={{fontSize:9,color:C.muted}}>{item.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                {label:'Date',val:calories.date||'—',color:C.run},
                {label:'Burned sync',val:calories.timestamp?new Date(calories.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—',color:C.cal},
                {label:'Eaten sync',val:dietaryCalories?.timestamp?new Date(dietaryCalories.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—',color:C.food},
                {label:'Source',val:'HAE + KT',color:C.green},
              ].map(m=>(
                <div key={m.label} style={{background:C.dim,borderRadius:10,padding:14}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{m.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:m.color}}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RUNNING */}
        {tab===1 && (
          <div>
            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>🎯 5K Goal Tracker</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'flex-end'}}>
                <div
                  onClick={() => !editingPb && setEditingPb(true)}
                  style={{cursor:'pointer',background:C.dim,border:`1px solid ${C.run}30`,borderRadius:10,padding:'10px 14px',minWidth:90}}
                >
                  <div style={{fontSize:9,color:C.muted,marginBottom:4}}>PB ✎</div>
                  {editingPb ? (
                    <input
                      type="text"
                      value={pbInput}
                      onChange={e => setPbInput(e.target.value)}
                      onBlur={savePb}
                      onKeyDown={e => { if (e.key === 'Enter') savePb() }}
                      autoFocus
                      style={{
                        width:80,fontSize:24,fontWeight:900,color:C.run,
                        background:'transparent',border:`1px solid ${C.run}50`,
                        borderRadius:4,textAlign:'center',padding:'2px 0',
                        fontFamily:'monospace',
                      }}
                    />
                  ) : (
                    <div style={{fontSize:28,fontWeight:900,color:C.run}}>{pb5k}</div>
                  )}
                  <div style={{fontSize:10,color:C.muted,marginTop:4}}>{pbPacePerKm}<span style={{fontSize:8}}>/km</span></div>
                </div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:C.muted}}>Gap</div><div style={{fontSize:28,fontWeight:900,color:C.yellow}}>{gap5k}</div></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted}}>Goal</div><div style={{fontSize:28,fontWeight:900,color:C.green}}>{goal5k}</div></div>
              </div>
              <div style={{height:8,background:C.border,borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct5k}%`,background:`linear-gradient(90deg,${C.run},${C.green})`,borderRadius:4}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted,marginTop:4}}>
                <span>{start5k}</span><span>You ({pct5k}%)</span><span>{goal5k} 🏁</span>
              </div>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>📡 Recent Runs — Apple Watch</div>
              {latestRuns.length===0?(
                <div style={{color:C.muted,fontSize:12}}>No runs yet — sync Health Auto Export</div>
              ):latestRuns.map((r,i)=>{
                function qty(v: any): number|null { return v==null ? null : typeof v==='object' ? v.qty : v }
                const rawDist = r.distance_km ?? r.distance
                const distKm: number|null = rawDist!=null ? +(qty(rawDist)!.toFixed(2)) : null
                const durRaw = r.duration_min ?? r.duration ?? null
                const durMin: number|null = durRaw!=null ? (durRaw>600 ? Math.round(durRaw/60) : Math.round(durRaw)) : null
                const durSec: number|null = durRaw!=null ? (durRaw>600 ? durRaw : durRaw*60) : null
                let paceKm: string|null = r.pace_per_km ?? null
                if (!paceKm && distKm && durSec) {
                  const sPerKm = durSec / distKm
                  paceKm = `${Math.floor(sPerKm/60)}:${String(Math.round(sPerKm%60)).padStart(2,'0')}`
                }
                const avgHr: number|null = qty(r.avg_hr)!=null ? Math.round(qty(r.avg_hr)!) : null
                const rawCal = r.calories_kcal
                let calKcal: number|null = null
                if (rawCal!=null) {
                  const q = qty(rawCal)!
                  const u = typeof rawCal==='object' ? rawCal.units : 'kcal'
                  calKcal = Math.round(u==='kJ' ? q/4.184 : q)
                }
                const intens = avgHr&&avgHr>160?{l:'Race',c:'#f97316'}:avgHr&&avgHr>145?{l:'Tempo',c:'#facc15'}:avgHr&&avgHr>130?{l:'Moderate',c:'#22d3ee'}:{l:'Easy',c:'#4ade80'}
                const dateLabel = (r.date??'').split(' ')[0]
                return(
                  <div key={i} style={{background:C.dim,borderRadius:10,padding:14,marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.run}}>{r.name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{dateLabel}</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,textAlign:'center'}}>
                      {[
                        {l:'Dist',v:distKm!=null?`${distKm}km`:'—',c:C.run},
                        {l:'Pace',v:paceKm??'—',c:C.yellow},
                        {l:'Time',v:durMin!=null?`${durMin}m`:'—',c:C.text},
                        {l:'HR',v:avgHr!=null?`${avgHr}`:'—',c:'#ef4444'},
                      ].map(m=>(
                        <div key={m.l}>
                          <div style={{fontSize:9,color:C.muted}}>{m.l}</div>
                          <div style={{fontSize:16,fontWeight:900,color:m.c}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{background:intens.c+'20',border:`1px solid ${intens.c}30`,borderRadius:4,padding:'2px 8px',fontSize:10,color:intens.c}}>{intens.l}</span>
                      {calKcal!=null&&calKcal>0&&<span style={{fontSize:10,color:C.cal,marginLeft:'auto'}}>🔥 {calKcal} kcal</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
              {(()=>{
                const monthGoal = 100
                const totalKm = Math.round(runs.reduce((s,r)=>{
                  const d = typeof r.distance_km==='object'&&r.distance_km!=null ? r.distance_km.qty : (r.distance_km??0)
                  return s+d
                },0)*100)/100
                const monthPct = Math.min((totalKm/monthGoal)*100,100)
                const rv = 52, circ = 2*Math.PI*rv
                const monthLabel = new Date().toLocaleString('default',{month:'long',year:'numeric'})
                return(<>
                  <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>📅 {monthLabel} — km Log</div>
                  <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:16}}>
                    <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
                      <svg width="120" height="120" style={{transform:'rotate(-90deg)'}}>
                        <circle cx="60" cy="60" r={rv} fill="none" stroke={C.border} strokeWidth="10"/>
                        <circle cx="60" cy="60" r={rv} fill="none" stroke={C.run} strokeWidth="10"
                          strokeDasharray={`${circ*(monthPct/100)} ${circ}`} strokeLinecap="round"
                          style={{transition:'stroke-dasharray 1s ease'}}/>
                      </svg>
                      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                        <div style={{fontSize:18,fontWeight:900,color:C.run}}>{totalKm}</div>
                        <div style={{fontSize:9,color:C.muted}}>km</div>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:28,fontWeight:900,color:C.run}}>{Math.round(monthPct)}%</div>
                      <div style={{fontSize:11,color:C.muted}}>of {monthGoal}km goal</div>
                      <div style={{fontSize:11,color:C.green,marginTop:4}}>{(monthGoal-totalKm).toFixed(1)}km to go</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:4}}>{runs.length} run{runs.length!==1?'s':''} logged</div>
                    </div>
                  </div>
                  {runs.length>0&&(
                    <div>
                      {runs.map((r,i)=>{
                        const d = typeof r.distance_km==='object'&&r.distance_km!=null ? +(r.distance_km.qty.toFixed(2)) : r.distance_km
                        return(
                          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                            padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
                            <div style={{fontSize:11,color:C.muted}}>{(r.date??'').split(' ')[0]}</div>
                            <div style={{fontSize:13,fontWeight:700,color:C.run}}>{d!=null?`${d}km`:'—'}</div>
                            <div style={{fontSize:11,color:C.yellow}}>{r.pace_per_km??'—'}</div>
                            <div style={{fontSize:11,color:C.text}}>{r.duration_min!=null?`${r.duration_min}m`:'—'}</div>
                            {r.avg_hr&&<div style={{fontSize:11,color:'#ef4444'}}>{r.avg_hr}bpm</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>)
              })()}
            </div>

            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2}}>📋 12-Week Plan</div>
                {undoStack.length>0&&(
                  <button onClick={undoLastCheck} style={{
                    background:C.dim,border:`1px solid ${C.border}`,color:C.yellow,
                    borderRadius:8,padding:'4px 12px',fontSize:11,fontWeight:700,cursor:'pointer',
                    WebkitTapHighlightColor:'transparent',touchAction:'manipulation',
                  }}>↩ Undo</button>
                )}
              </div>
              {PLAN.map(p=>{
                const allDone = SESS_TYPES.every(t => checks[`w${p.w}_${t}`])
                const isCollapsed = collapsed[p.w] ?? allDone
                return(
                  <div key={p.w} style={{borderRadius:10,marginBottom:6,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <button onClick={()=>setCollapsed(prev=>({...prev,[p.w]:!(prev[p.w]??allDone)}))}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'10px 12px',
                        background:allDone?C.green+'10':C.dim,border:'none',color:C.text,
                        cursor:'pointer',textAlign:'left',WebkitTapHighlightColor:'transparent',touchAction:'manipulation'}}>
                      <span style={{fontSize:12,color:allDone?C.green:C.muted}}>{allDone?'●':'○'}</span>
                      <span style={{fontWeight:700,fontSize:12,color:allDone?C.green:C.text}}>W{p.w}</span>
                      {allDone&&<span style={{background:C.green+'20',color:C.green,fontSize:9,padding:'1px 6px',borderRadius:4,fontWeight:700}}>Done</span>}
                      <span style={{marginLeft:'auto',fontSize:10,color:C.muted}}>{isCollapsed?'▾':'▴'}</span>
                    </button>
                    {!isCollapsed&&(
                      <div style={{padding:'8px 12px 12px',background:C.card,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        {SESS_TYPES.map(type=>{
                          const key = `w${p.w}_${type}`
                          const label = type==='speed'?p.sp:type==='easy'?p.ez:type==='tempo'?p.te:p.lo
                          const checked = checks[key]||false
                          return(
                            <label key={type} style={{display:'flex',alignItems:'flex-start',gap:8,cursor:'pointer',
                              background:checked?C.run+'12':C.dim,border:`1px solid ${checked?C.run+'40':C.border}`,
                              borderRadius:8,padding:'8px 10px'}}>
                              <input type="checkbox" checked={checked} onChange={e=>toggleCheck(key,e.target.checked)}
                                style={{width:15,height:15,accentColor:C.run,cursor:'pointer',marginTop:2,flexShrink:0}}/>
                              <div>
                                <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>{type}</div>
                                <div style={{fontSize:11,color:checked?C.run:C.text,fontWeight:checked?700:400}}>{label}</div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* OTHER SPORTS */}
        {tab===2 && (
          <div>
            {/* Monthly active time goal — mirrors 5K Goal Tracker */}
            <div style={{background:C.card,border:`1px solid ${C.pink}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.pink,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>⏱ Monthly Active Time</div>
              {(()=>{
                const goalMin = 600
                const totalMin = sports.reduce((s,r)=>s+(r.duration_min??0),0)
                const remaining = Math.max(0, goalMin - totalMin)
                const pct = Math.min(Math.round((totalMin/goalMin)*100), 100)
                const fmt = (m:number) => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`
                return(<>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <div><div style={{fontSize:9,color:C.muted}}>This Month</div><div style={{fontSize:28,fontWeight:900,color:C.pink}}>{fmt(totalMin)}</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:9,color:C.muted}}>To Go</div><div style={{fontSize:28,fontWeight:900,color:C.yellow}}>−{fmt(remaining)}</div></div>
                    <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted}}>Goal</div><div style={{fontSize:28,fontWeight:900,color:C.green}}>{fmt(goalMin)}</div></div>
                  </div>
                  <div style={{height:8,background:C.border,borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${C.pink},${C.green})`,borderRadius:4}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted,marginTop:4}}>
                    <span>0h</span><span>You ({pct}%)</span><span>10h 🏅</span>
                  </div>
                </>)
              })()}
            </div>

            {/* Recent Activities — mirrors Recent Runs */}
            <div style={{background:C.card,border:`1px solid ${C.pink}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.pink,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>📡 Recent Activities — Apple Watch</div>
              {latestSports.length===0?(
                <div style={{color:C.muted,fontSize:12}}>No recent activities — sync Health Auto Export</div>
              ):latestSports.map((r,i)=>{
                function qty(v:any):number|null{return v==null?null:typeof v==='object'?v.qty:v}
                const rawDist = r.distance_km ?? r.distance
                const distKm:number|null = rawDist!=null ? +(qty(rawDist)!.toFixed(2)) : null
                const durRaw = r.duration_min ?? r.duration ?? null
                const durMin:number|null = durRaw!=null ? (durRaw>600?Math.round(durRaw/60):Math.round(durRaw)) : null
                const avgHr:number|null = qty(r.avg_hr)!=null ? Math.round(qty(r.avg_hr)!) : null
                const rawCal = r.calories_kcal
                let calKcal:number|null = null
                if(rawCal!=null){const q=qty(rawCal)!;const u=typeof rawCal==='object'?rawCal.units:'kcal';calKcal=Math.round(u==='kJ'?q/4.184:q)}
                const intens = avgHr&&avgHr>160?{l:'Race',c:'#f97316'}:avgHr&&avgHr>145?{l:'Tempo',c:'#facc15'}:avgHr&&avgHr>130?{l:'Moderate',c:'#22d3ee'}:{l:'Easy',c:'#4ade80'}
                const dateLabel = (r.date??'').split(' ')[0]
                const emoji = sportEmoji(r.name??'')
                return(
                  <div key={i} style={{background:C.dim,borderRadius:10,padding:14,marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.pink}}>{emoji} {r.name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{dateLabel}</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,textAlign:'center'}}>
                      {[
                        {l:'Dist',v:distKm!=null?`${distKm}km`:'—',c:C.pink},
                        {l:'Time',v:durMin!=null?`${durMin}m`:'—',c:C.text},
                        {l:'HR',v:avgHr!=null?`${avgHr}`:'—',c:'#ef4444'},
                        {l:'Cal',v:calKcal!=null?`${calKcal}`:'—',c:C.cal},
                      ].map(m=>(
                        <div key={m.l}>
                          <div style={{fontSize:9,color:C.muted}}>{m.l}</div>
                          <div style={{fontSize:16,fontWeight:900,color:m.c}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{background:intens.c+'20',border:`1px solid ${intens.c}30`,borderRadius:4,padding:'2px 8px',fontSize:10,color:intens.c}}>{intens.l}</span>
                      {calKcal!=null&&calKcal>0&&<span style={{fontSize:10,color:C.cal,marginLeft:'auto'}}>🔥 {calKcal} kcal</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Monthly Activity Log — mirrors Monthly km Log */}
            <div style={{background:C.card,border:`1px solid ${C.pink}30`,borderRadius:14,padding:20}}>
              {(()=>{
                const goalMin = 600
                const totalMin = sports.reduce((s,r)=>s+(r.duration_min??0),0)
                const monthPct = Math.min((totalMin/goalMin)*100, 100)
                const rv = 52, circ = 2*Math.PI*rv
                const monthLabel = new Date().toLocaleString('default',{month:'long',year:'numeric'})
                const hrs = Math.floor(totalMin/60), mins = totalMin%60
                const remMin = Math.max(0, goalMin-totalMin)
                const typeCounts: Record<string,number> = {}
                sports.forEach(r=>{const t=r.name||'Other';typeCounts[t]=(typeCounts[t]||0)+1})
                const olderSports = sports.filter(r=>!latestSports.some(ls=>ls.date===r.date&&ls.name===r.name))
                return(<>
                  <div style={{fontSize:10,color:C.pink,textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>📅 {monthLabel} — Activity Log</div>
                  <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:16}}>
                    <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
                      <svg width="120" height="120" style={{transform:'rotate(-90deg)'}}>
                        <circle cx="60" cy="60" r={rv} fill="none" stroke={C.border} strokeWidth="10"/>
                        <circle cx="60" cy="60" r={rv} fill="none" stroke={C.pink} strokeWidth="10"
                          strokeDasharray={`${circ*(monthPct/100)} ${circ}`} strokeLinecap="round"
                          style={{transition:'stroke-dasharray 1s ease'}}/>
                      </svg>
                      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                        <div style={{fontSize:18,fontWeight:900,color:C.pink}}>{hrs>0?`${hrs}h`:totalMin>0?`${mins}m`:'0'}</div>
                        <div style={{fontSize:9,color:C.muted}}>{hrs>0?`${mins}m`:'active'}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:28,fontWeight:900,color:C.pink}}>{Math.round(monthPct)}%</div>
                      <div style={{fontSize:11,color:C.muted}}>of 10h goal</div>
                      <div style={{fontSize:11,color:C.green,marginTop:4}}>{Math.floor(remMin/60)}h {String(remMin%60).padStart(2,'0')}m to go</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:4}}>{sports.length} workout{sports.length!==1?'s':''} logged</div>
                    </div>
                  </div>
                  {olderSports.length>0&&(
                    <div>
                      {olderSports.map((r,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                          padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
                          <div style={{fontSize:11,color:C.muted}}>{(r.date??'').split(' ')[0]}</div>
                          <div style={{fontSize:13,fontWeight:700,color:C.pink}}>{sportEmoji(r.name??'')} {r.name}</div>
                          <div style={{fontSize:11,color:C.yellow}}>{r.duration_min!=null?`${r.duration_min}m`:'—'}</div>
                          {r.calories_kcal!=null&&<div style={{fontSize:11,color:C.cal}}>🔥 {r.calories_kcal}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(typeCounts).length>0&&(
                    <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.dim}`}}>
                      <div style={{fontSize:8,color:C.muted,letterSpacing:1,marginBottom:6}}>BY TYPE</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>(
                          <div key={name} style={{display:'flex',alignItems:'center',gap:4,background:C.dim,borderRadius:6,padding:'3px 8px'}}>
                            <span style={{fontSize:12}}>{sportEmoji(name)}</span>
                            <span style={{fontSize:10,color:C.muted}}>{name}</span>
                            <span style={{fontSize:10,fontWeight:700,color:C.pink}}>{count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {sports.length===0&&(
                    <div style={{color:C.muted,fontSize:12}}>No activities this month — sync Health Auto Export</div>
                  )}
                </>)
              })()}
            </div>
          </div>
        )}

        {/* SMOKE */}
        {tab===3 && (
          <div>
            <div style={{background:C.card,border:`1px solid ${C.smoke}30`,borderRadius:14,padding:20,marginBottom:12,textAlign:'center'}}>
              <div style={{fontSize:10,color:C.smoke,textTransform:'uppercase',letterSpacing:2,marginBottom:20}}>🚭 Cigarettes Today</div>
              <div style={{fontSize:96,fontWeight:900,color:cigs>=cigGoal?'#ef4444':C.smoke,lineHeight:1,marginBottom:8}}>{cigs}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:20}}>of {cigGoal} daily limit</div>
              <div style={{height:6,background:C.border,borderRadius:3,marginBottom:20,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${cigPct}%`,background:cigs>=cigGoal?'#ef4444':C.smoke,borderRadius:3,transition:'width 0.5s ease'}}/>
              </div>
              <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                <button onClick={addCig} style={{
                  width:80,height:80,borderRadius:'50%',
                  background:C.smoke+'20',border:`2px solid ${C.smoke}50`,
                  color:C.smoke,fontSize:32,cursor:'pointer',
                  WebkitTapHighlightColor:'transparent',
                  touchAction:'manipulation',
                }}>🚬</button>
                <button onClick={undoCig} style={{
                  background:'transparent',border:`1px solid ${C.border}`,
                  color:C.muted,borderRadius:10,padding:'0 20px',
                  fontSize:12,cursor:'pointer',
                  WebkitTapHighlightColor:'transparent',
                }}>Undo</button>
              </div>
              <div style={{marginTop:16,fontSize:13,color:cigs===0?C.green:cigs>=cigGoal?'#ef4444':C.muted}}>
                {cigs===0?'🌟 Zero today!':cigs>=cigGoal?'🚨 Limit reached!':`${cigGoal-cigs} remaining`}
              </div>

              {cigHistory.length>0&&(()=>{
                const todayStr = ymd(new Date())
                const maxVal = Math.max(cigGoal, ...cigHistory.map(d=>d.count), 1)
                const barH = 56
                function cigColor(n:number, isToday:boolean) {
                  if (isToday) return C.smoke
                  if (n===0) return C.green
                  if (n<=3) return YELLOW
                  if (n<=7) return AMBER
                  return RED
                }
                return(
                  <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:10}}>14-DAY HISTORY</div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,height:barH}}>
                      {cigHistory.map(day=>{
                        const isToday = day.date===todayStr
                        const h = day.count===0 ? 3 : Math.round((day.count/maxVal)*barH)
                        const color = cigColor(day.count,isToday)
                        return(
                          <div key={day.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}>
                            <div style={{
                              width:'100%',height:h,
                              background:color,
                              borderRadius:'3px 3px 0 0',
                              boxShadow:isToday?`0 0 6px ${C.smoke}80`:undefined,
                              outline:isToday?`1px solid ${C.smoke}`:'none',
                              opacity:0.9,
                            }}/>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{display:'flex',gap:3,marginTop:4}}>
                      {cigHistory.map(day=>{
                        const isToday = day.date===todayStr
                        const label = isToday ? 'T' : String(new Date(day.date+'T12:00:00').getDate())
                        return(
                          <div key={day.date} style={{flex:1,textAlign:'center',fontSize:8,
                            color:isToday?C.smoke:C.muted,fontWeight:isToday?700:400}}>
                            {label}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div style={{background:C.card,border:`1px solid ${C.green}20`,borderRadius:14,padding:20}}>
              <div style={{fontSize:10,color:C.green,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>💚 Craving Tips</div>
              {['Delay 10 min — urge will pass','Drink cold water instead','4-7-8 breathing','Go for a 2 min walk','Each skip = money saved'].map((t,i)=>(
                <div key={i} style={{padding:'8px 0',borderBottom:`1px solid ${C.dim}`,fontSize:12,color:'#64748b'}}>→ {t}</div>
              ))}
            </div>
          </div>
        )}

        {/* COACH */}
        {tab===4 && (
          <div style={{background:C.card,border:`1px solid ${C.mental}30`,borderRadius:14,padding:20}}>
            <div style={{fontSize:10,color:C.mental,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>🤖 AI Coach</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Coming soon — full AI coach with your live stats</div>
            <div style={{background:C.dim,borderRadius:10,padding:16}}>
              <div style={{fontSize:12,color:C.text,lineHeight:1.7}}>
                Your stats right now:<br/>
                🔥 <span style={{color:C.cal}}>{kcal} kcal</span> active today<br/>
                🍽️ <span style={{color:C.food}}>{eaten > 0 ? `${eaten} kcal` : 'Not logged'}</span> eaten<br/>
                💤 <span style={{color:C.basal}}>{basalCalories} kcal</span> basal<br/>
                ⚖️ <span style={{color:balanceColor}}>{eaten > 0 ? `${net > 0 ? '+' : ''}${net} kcal net` : '—'}</span><br/>
                🏃 <span style={{color:C.run}}>PB {pb5k}</span> · Goal {goal5k}<br/>
                🚭 <span style={{color:C.smoke}}>{cigs}/{cigGoal}</span> cigarettes<br/>
                📅 <span style={{color:C.green}}>Week {currentWeek}</span> of 12-week plan
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:'rgba(8,8,16,0.95)',backdropFilter:'blur(20px)',
        borderTop:`1px solid ${C.border}`,
        display:'flex',
        paddingBottom:'env(safe-area-inset-bottom)',
      }}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{
            flex:1,padding:'12px 0',background:'transparent',border:'none',
            color:tab===i?[C.cal,C.run,C.pink,C.smoke,C.mental][i]:C.muted,
            fontSize:22,cursor:'pointer',
            WebkitTapHighlightColor:'transparent',
            touchAction:'manipulation',
            borderTop:`2px solid ${tab===i?[C.cal,C.run,C.pink,C.smoke,C.mental][i]:'transparent'}`,
            transition:'all 0.15s',
          }}>
            <div>{t}</div>
            <div style={{fontSize:9,marginTop:2,letterSpacing:1}}>{TABNAMES[i].toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
