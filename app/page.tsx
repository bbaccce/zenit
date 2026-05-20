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
const AMBER = '#fb923c'
const RED = '#ef4444'
const EMPTY = '#1e2030'

function netColor(net: number | null): string {
  if (net === null) return EMPTY
  const deficit = -net
  if (deficit >= 1000) return BRIGHT_BLUE
  if (deficit >= 500) return DEEP_GREEN
  if (deficit >= 200) return C.yellow
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

const SESS = [
  {key:'speed',label:'SPEED'},
  {key:'easy', label:'EASY'},
  {key:'tempo',label:'TEMPO'},
  {key:'long', label:'LONG'},
] as const

const CURRENT_WEEK = 5
const TABS = ['🔥','🏃','🚭','🧠']
const TABNAMES = ['Calories','Running','Smoking','Mind']

function ymd(d: Date) { return d.toISOString().split('T')[0] }

export default function Page() {
  const [tab, setTab] = useState(1)
  const [data, setData]   = useState<any>(null)
  const [plan, setPlan]   = useState<Record<string,boolean>>({})
  const [cigs, setCigs]   = useState(0)
  const [settings, setSettings] = useState({ basalCalories:1800, calGoal:600, eatGoal:2200, cigGoal:10 })
  // collapsed state: week number -> bool (true = manually collapsed)
  const [collapsed, setCollapsed] = useState<Record<number,boolean>>({})
  // undo stack: array of {wk, key} for last unchecked action
  const [undoStack, setUndoStack] = useState<Array<{wk:number,key:string}>>([])

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      fetch('/api/health').then(r=>r.json()),
      fetch('/api/settings').then(r=>r.json()),
    ])
    setData(d)
    setPlan(d.plan || {})
    setCigs(Number(d.cigs) || 0)
    setSettings(s)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-collapse weeks where all 4 sessions are checked
  useEffect(() => {
    PLAN.forEach(week => {
      const allDone = SESS.every(s => plan[`w${week.w}_${s.key}`])
      if (allDone) {
        setCollapsed(prev => {
          // only auto-collapse if not manually expanded
          if (prev[week.w] === false) return prev // user manually opened it
          return { ...prev, [week.w]: true }
        })
      }
    })
  }, [plan])

  async function toggleSession(wk: number, key: string) {
    const planKey = `w${wk}_${key}`
    const newVal = !plan[planKey]
    const next = { ...plan, [planKey]: newVal }
    setPlan(next)

    if (newVal) {
      // checked — push to undo stack
      setUndoStack(prev => [...prev, { wk, key }])
    } else {
      // manually unchecked — remove from undo stack if present
      setUndoStack(prev => prev.filter(u => !(u.wk === wk && u.key === key)))
    }

    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: planKey, checked: newVal }),
    })
  }

  async function undoLast() {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    const planKey = `w${last.wk}_${last.key}`
    const next = { ...plan, [planKey]: false }
    setPlan(next)
    // Also un-collapse that week
    setCollapsed(prev => ({ ...prev, [last.wk]: false }))
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: planKey, checked: false }),
    })
  }

  function toggleCollapse(wk: number) {
    setCollapsed(prev => ({ ...prev, [wk]: !prev[wk] }))
  }

  async function addCig() {
    const r = await fetch('/api/cigs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'increment'}) })
    const d = await r.json(); setCigs(d.count)
  }
  async function undoCig() {
    const r = await fetch('/api/cigs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'decrement'}) })
    const d = await r.json(); setCigs(d.count)
  }

  const runs: any[] = data?.runs || []
  const calories = data?.calories || {}
  const dietaryCalories = data?.dietaryCalories || null
  const history: any[] = data?.history || []

  const kcal = calories.calories_kcal || 0
  const eaten = dietaryCalories?.calories_kcal || 0
  const basal = settings.basalCalories
  const calGoal = settings.calGoal
  const eatGoal = settings.eatGoal
  const cigGoal = settings.cigGoal
  const totalBurned = kcal + basal
  const net = eaten - totalBurned

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans',system-ui,sans-serif", paddingBottom: 'calc(70px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: C.muted, marginBottom: 2 }}>ZENIT</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>Dashboard</div>
      </div>

      <div style={{ padding: '12px 16px', maxWidth: 480, margin: '0 auto' }}>

        {/* ── CALORIES TAB ── */}
        {tab === 0 && (
          <div>
            {/* Ring display */}
            <div style={{ background: C.card, border: `1px solid ${C.cal}30`, borderRadius: 14, padding: 20, marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: C.cal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>🔥 Today's Energy</div>
              <svg viewBox="0 0 200 200" width={180} height={180} style={{ display: 'block', margin: '0 auto' }}>
                {/* Burned ring */}
                {(() => {
                  const r = 80, cx = 100, cy = 100, circ = 2 * Math.PI * r
                  const pct = Math.min(kcal / calGoal, 1)
                  return <>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={14} />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.cal} strokeWidth={14}
                      strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                      transform="rotate(-90 100 100)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                  </>
                })()}
                {/* Eaten ring */}
                {(() => {
                  const r = 60, cx = 100, cy = 100, circ = 2 * Math.PI * r
                  const pct = Math.min(eaten / eatGoal, 1)
                  return <>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={12} />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.food} strokeWidth={12}
                      strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                      transform="rotate(-90 100 100)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                  </>
                })()}
                <text x="100" y="92" textAnchor="middle" fill={C.text} fontSize="22" fontWeight="900">{kcal.toLocaleString()}</text>
                <text x="100" y="108" textAnchor="middle" fill={C.muted} fontSize="10">active kcal</text>
                <text x="100" y="124" textAnchor="middle" fill={C.food} fontSize="13" fontWeight="700">{eaten > 0 ? `${eaten} eaten` : 'no food data'}</text>
              </svg>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 20 }}>
                <div><div style={{ fontSize: 9, color: C.muted }}>ACTIVE</div><div style={{ fontSize: 18, fontWeight: 800, color: C.cal }}>{kcal}</div></div>
                <div><div style={{ fontSize: 9, color: C.muted }}>BASAL</div><div style={{ fontSize: 18, fontWeight: 800, color: C.basal }}>{basal}</div></div>
                <div><div style={{ fontSize: 9, color: C.muted }}>TOTAL BURN</div><div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{totalBurned}</div></div>
              </div>
            </div>

            {/* Net balance */}
            {(kcal > 0 || eaten > 0) && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Net Balance</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: net < 0 ? C.green : RED }}>{net > 0 ? '+' : ''}{net} kcal</div>
                <div style={{ marginTop: 8, fontSize: 11, color: net < 0 ? C.green : RED }}>
                  {eaten === 0 ? '🍽️ Log food in Kalorické Tabulky to see balance'
                    : kcal === 0 ? '⌛ Waiting for active calories sync'
                    : net < 0 ? `✅ ${Math.abs(net)} kcal deficit — on track`
                    : `⚠️ ${net} kcal surplus today`}
                </div>
              </div>
            )}

            {/* History grid */}
            {history.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>30-Day History</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                  {['M','T','W','T','F','S','S'].map((d,i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: 9, color: C.muted, paddingBottom: 4 }}>{d}</div>
                  ))}
                  {[...history].reverse().map((h, i) => (
                    <div key={i} title={`${h.date}: ${h.burned} burned, ${h.eaten} eaten`}
                      style={{ height: 28, borderRadius: 4, background: h.burned > 0 || h.eaten > 0 ? netColor(h.net) : C.dim, opacity: h.burned > 0 || h.eaten > 0 ? 1 : 0.3 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 9, color: C.muted }}>
                  {[[BRIGHT_BLUE,'1000+ deficit'],[DEEP_GREEN,'500-1000'],[C.yellow,'200-500'],[AMBER,'0-200'],[RED,'surplus']].map(([c,l]) => (
                    <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />{l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Date', val: calories.date || '—', color: C.run },
                { label: 'Burned sync', val: calories.timestamp ? new Date(calories.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', color: C.cal },
                { label: 'Eaten sync', val: dietaryCalories?.timestamp ? new Date(dietaryCalories.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', color: C.food },
                { label: 'Source', val: 'HAE + KT', color: C.green },
              ].map(m => (
                <div key={m.label} style={{ background: C.dim, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RUNNING TAB ── */}
        {tab === 1 && (
          <div>
            {/* PB tracker */}
            <div style={{ background: C.card, border: `1px solid ${C.run}30`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.run, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>🎯 5K Goal Tracker</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div><div style={{ fontSize: 9, color: C.muted }}>PB</div><div style={{ fontSize: 28, fontWeight: 900, color: C.run }}>24:32</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: C.muted }}>Gap</div><div style={{ fontSize: 28, fontWeight: 900, color: C.yellow }}>−2:32</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: C.muted }}>Goal</div><div style={{ fontSize: 28, fontWeight: 900, color: C.green }}>22:00</div></div>
              </div>
              <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '37%', background: `linear-gradient(90deg,${C.run},${C.green})`, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginTop: 4 }}>
                <span>26:00</span><span>You (37%)</span><span>22:00 🏁</span>
              </div>
            </div>

            {/* Recent runs from Apple Watch */}
            <div style={{ background: C.card, border: `1px solid ${C.run}30`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.run, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>📡 Recent Runs — Apple Watch</div>
              {runs.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 12 }}>No runs yet — sync Health Auto Export</div>
              ) : runs.map((r, i) => {
                const intens = r.avg_hr > 160 ? { l: 'Race', c: '#f97316' } : r.avg_hr > 145 ? { l: 'Tempo', c: '#facc15' } : r.avg_hr > 130 ? { l: 'Moderate', c: '#22d3ee' } : { l: 'Easy', c: '#4ade80' }
                return (
                  <div key={i} style={{ background: C.dim, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.run }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{r.date}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, textAlign: 'center' }}>
                      {[
                        { l: 'Dist', v: r.distance_km != null ? `${r.distance_km}km` : '—', c: C.run },
                        { l: 'Pace', v: r.pace_per_km ?? '—', c: C.yellow },
                        { l: 'Time', v: r.duration_min != null ? `${r.duration_min}m` : '—', c: C.text },
                        { l: 'HR', v: r.avg_hr ?? '—', c: '#ef4444' },
                      ].map(m => (
                        <div key={m.l}>
                          <div style={{ fontSize: 9, color: C.muted }}>{m.l}</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: m.c }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ background: intens.c + '20', border: `1px solid ${intens.c}30`, borderRadius: 4, padding: '2px 8px', fontSize: 10, color: intens.c }}>{intens.l}</span>
                      {r.calories_kcal > 0 && <span style={{ fontSize: 10, color: C.cal, marginLeft: 'auto' }}>🔥 {r.calories_kcal} kcal</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Training Plan */}
            <div style={{ background: C.card, border: `1px solid ${C.run}30`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 10, color: C.run, textTransform: 'uppercase', letterSpacing: 2 }}>📋 12-Week Plan</div>
                {undoStack.length > 0 && (
                  <button onClick={undoLast} style={{
                    background: C.dim, border: `1px solid ${C.border}`, color: C.yellow,
                    borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  }}>↩ Undo</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>Week 5 of 12 · Goal 22:00</div>

              {PLAN.map(week => {
                const isCurrentWeek = week.w === CURRENT_WEEK
                const allDone = SESS.every(s => plan[`w${week.w}_${s.key}`])
                const isCollapsed = collapsed[week.w] ?? allDone
                const isPast = week.w < CURRENT_WEEK
                const isFuture = week.w > CURRENT_WEEK

                return (
                  <div key={week.w} style={{
                    borderRadius: 12,
                    marginBottom: 8,
                    border: isCurrentWeek ? `1px solid ${C.run}60` : `1px solid ${C.border}`,
                    overflow: 'hidden',
                    opacity: isFuture ? 0.5 : 1,
                  }}>
                    {/* Week header row — always visible */}
                    <button onClick={() => toggleCollapse(week.w)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', background: isCurrentWeek ? C.run + '12' : C.dim,
                      border: 'none', color: C.text, cursor: 'pointer', textAlign: 'left',
                      WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                    }}>
                      <span style={{ fontSize: 10, color: allDone ? C.green : isCurrentWeek ? C.run : C.muted }}>
                        {allDone ? '●' : isCurrentWeek ? '▶' : '○'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 12, color: isCurrentWeek ? C.run : allDone ? C.green : C.muted }}>
                        W{week.w}
                      </span>
                      {isCurrentWeek && (
                        <span style={{ background: C.run + '30', color: C.run, fontSize: 9, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Current</span>
                      )}
                      {allDone && (
                        <span style={{ background: C.green + '20', color: C.green, fontSize: 9, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>✓ Done</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted }}>{isCollapsed ? '▾' : '▴'}</span>
                    </button>

                    {/* Sessions — only show when not collapsed */}
                    {!isCollapsed && (
                      <div style={{ padding: '10px 14px 14px', background: C.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {SESS.map(s => {
                          const planKey = `w${week.w}_${s.key}`
                          const checked = !!plan[planKey]
                          const desc = s.key === 'speed' ? week.sp : s.key === 'easy' ? week.ez : s.key === 'tempo' ? week.te : week.lo
                          return (
                            <button key={s.key} onClick={() => !isFuture && toggleSession(week.w, s.key)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: checked ? C.run + '15' : C.dim,
                                border: `1px solid ${checked ? C.run + '40' : C.border}`,
                                borderRadius: 8, padding: '8px 10px',
                                cursor: isFuture ? 'default' : 'pointer',
                                textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                                touchAction: 'manipulation',
                              }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                                border: `2px solid ${checked ? C.run : C.muted}`,
                                background: checked ? C.run : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {checked && <span style={{ color: C.bg, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>{s.label}</div>
                                <div style={{ fontSize: 11, color: checked ? C.run : C.text, fontWeight: checked ? 700 : 400 }}>{desc}</div>
                              </div>
                            </button>
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

        {/* ── SMOKING TAB ── */}
        {tab === 2 && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.smoke}30`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.smoke, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>🚭 Cigarettes Today</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ fontSize: 80, fontWeight: 900, color: cigs >= cigGoal ? RED : C.smoke, lineHeight: 1 }}>{cigs}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                    {cigs === 0 ? 'Zero today — great!' : cigs >= cigGoal ? 'At your limit!' : `${cigGoal - cigs} left`}
                  </div>
                  <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(cigs / cigGoal * 100, 100)}%`, background: cigs >= cigGoal ? RED : C.smoke, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>of {cigGoal} daily limit</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={addCig} style={{ flex: 1, padding: '12px 0', background: C.smoke, border: 'none', color: C.bg, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
                  🚬 Log
                </button>
                <button onClick={undoCig} style={{ padding: '12px 20px', background: C.dim, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 10, fontSize: 14, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
                  ↩ Undo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MIND TAB ── */}
        {tab === 3 && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.mental}30`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.mental, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>🧠 Daily Summary</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                🔥 <span style={{ color: C.cal }}>{kcal} kcal</span> burned<br />
                🍽️ <span style={{ color: C.food }}>{eaten > 0 ? `${eaten} kcal` : 'Not logged'}</span> eaten<br />
                🏃 <span style={{ color: C.run }}>PB 24:32</span> · Goal 22:00<br />
                🚭 <span style={{ color: C.smoke }}>{cigs}/{cigGoal}</span> cigarettes<br />
                📅 <span style={{ color: C.green }}>Week 5</span> of 12-week plan
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
            color: tab === i ? [C.cal, C.run, C.smoke, C.mental][i] : C.muted,
            fontSize: 22, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            borderTop: `2px solid ${tab === i ? [C.cal, C.run, C.smoke, C.mental][i] : 'transparent'}`,
            transition: 'all 0.15s',
          }}>
            <div>{t}</div>
            <div style={{ fontSize: 9, marginTop: 2, letterSpacing: 1 }}>{TABNAMES[i].toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  )
}