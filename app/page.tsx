'use client'
import { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#080810', card: '#0f0f1c', border: '#1a1a2e',
  cal: '#f97316', run: '#22d3ee', smoke: '#818cf8',
  mental: '#a78bfa', green: '#4ade80', yellow: '#facc15',
  pink: '#f472b6', text: '#e2e8f0', muted: '#475569', dim: '#1e2030'
}

const PLAN = [
  {w:1,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km',done:true},
  {w:2,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km',done:true},
  {w:3,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km',done:true},
  {w:4,sp:'5x400m @ 4:10',ez:'5-7km',te:'3km @ 4:50',lo:'8-10km',done:true},
  {w:5,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km',done:false},
  {w:6,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km',done:false},
  {w:7,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km',done:false},
  {w:8,sp:'6x600m @ 4:20',ez:'6-8km',te:'4km @ 4:40',lo:'9-11km',done:false},
  {w:9,sp:'5x800m @ 4:20',ez:'5-7km',te:'4km @ 4:30',lo:'8-12km',done:false},
  {w:10,sp:'5x800m @ 4:20',ez:'5-7km',te:'4km @ 4:30',lo:'8-12km',done:false},
  {w:11,sp:'4x1km @ 4:20',ez:'5-7km',te:'5km @ 4:30',lo:'8-12km',done:false},
  {w:12,sp:'4x1km @ 4:20',ez:'5-7km',te:'5km @ 4:30',lo:'8-12km',done:false},
]

const SESS_TYPES = ['speed','easy','tempo','long']

export default function Home() {
  const [tab, setTab] = useState(0)
  const [calories, setCalories] = useState<any>({})
  const [runs, setRuns] = useState<any[]>([])
  const [cigs, setCigs] = useState(0)
  const [cigGoal] = useState(10)
  const [checks, setChecks] = useState<Record<string,boolean>>({})
  const [calGoal] = useState(600)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('')

  const fetchAll = useCallback(async () => {
    setSyncing(true)
    try {
      const [health, cigRes, planRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/cigs').then(r => r.json()),
        fetch('/api/plan').then(r => r.json()),
      ])
      if (health.calories?.calories_kcal) setCalories(health.calories)
      if (health.runs?.length) setRuns(health.runs)
      setCigs(cigRes.count || 0)
      setChecks(planRes.checks || {})
      setLastSync(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))
    } catch(e) {}
    setSyncing(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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
    setChecks(prev => ({...prev, [key]: checked}))
    await fetch('/api/plan', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key, checked})})
  }

  const kcal = calories.calories_kcal || 304
  const calPct = Math.min(Math.round((kcal/calGoal)*100), 100)
  const cigPct = Math.min(Math.round((cigs/cigGoal)*100), 100)
  const TABS = ['🔥','🏃','🚭','🤖']
  const TABNAMES = ['Calories','Running','Smoke','Coach']

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:'monospace',paddingBottom:80}}>
      
      {/* Header */}
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
            <div style={{background:C.card,border:`1px solid ${C.cal}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.cal,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>🔥 Active Calories Today</div>
              <div style={{display:'flex',alignItems:'center',gap:20}}>
                <svg width="80" height="80" style={{transform:'rotate(-90deg)',flexShrink:0}}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={C.border} strokeWidth="8"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={calPct>=100?C.green:C.cal} strokeWidth="8"
                    strokeDasharray={`${2*Math.PI*32*(calPct/100)} ${2*Math.PI*32}`} strokeLinecap="round"
                    style={{transition:'stroke-dasharray 1s ease'}}/>
                </svg>
                <div style={{flex:1}}>
                  <div style={{fontSize:48,fontWeight:900,color:C.cal,lineHeight:1}}>{kcal.toLocaleString()}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>of {calGoal} kcal goal · {calPct}%</div>
                  <div style={{height:5,background:C.border,borderRadius:3,marginTop:10,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${calPct}%`,background:calPct>=100?C.green:C.cal,borderRadius:3,transition:'width 1s ease'}}/>
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:5}}>{calPct>=100?'✅ Goal reached!':`${calGoal-kcal} kcal to go`}</div>
                </div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                {label:'Date',val:calories.date||'—',color:C.run},
                {label:'Data points',val:(calories.entries||421).toLocaleString(),color:C.mental},
                {label:'Last sync',val:calories.timestamp?new Date(calories.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—',color:C.yellow},
                {label:'Source',val:'Apple Watch',color:C.green},
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
            {/* PB tracker */}
            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>🎯 5K Goal Tracker</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <div><div style={{fontSize:9,color:C.muted}}>PB</div><div style={{fontSize:28,fontWeight:900,color:C.run}}>24:32</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:C.muted}}>Gap</div><div style={{fontSize:28,fontWeight:900,color:C.yellow}}>−2:32</div></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted}}>Goal</div><div style={{fontSize:28,fontWeight:900,color:C.green}}>22:00</div></div>
              </div>
              <div style={{height:8,background:C.border,borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:'37%',background:`linear-gradient(90deg,${C.run},${C.green})`,borderRadius:4}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted,marginTop:4}}>
                <span>26:00</span><span>You (37%)</span><span>22:00 🏁</span>
              </div>
            </div>

            {/* Recent runs */}
            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
              <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>📡 Recent Runs — Apple Watch</div>
              {runs.length===0?(
                <div style={{color:C.muted,fontSize:12}}>No runs yet — sync Health Auto Export</div>
              ):runs.map((r,i)=>{
                const intens = r.avg_hr>160?{l:'Race',c:'#f97316'}:r.avg_hr>145?{l:'Tempo',c:'#facc15'}:r.avg_hr>130?{l:'Moderate',c:'#22d3ee'}:{l:'Easy',c:'#4ade80'}
                return(
                  <div key={i} style={{background:C.dim,borderRadius:10,padding:14,marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.run}}>{r.name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{r.date}</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,textAlign:'center'}}>
                      {[{l:'Dist',v:r.distance_km+'km',c:C.run},{l:'Pace',v:r.pace_per_km,c:C.yellow},{l:'Time',v:r.duration_min+'m',c:C.text},{l:'HR',v:r.avg_hr,c:'#ef4444'}].map(m=>(
                        <div key={m.l}>
                          <div style={{fontSize:9,color:C.muted}}>{m.l}</div>
                          <div style={{fontSize:16,fontWeight:900,color:m.c}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{background:intens.c+'20',border:`1px solid ${intens.c}30`,borderRadius:4,padding:'2px 8px',fontSize:10,color:intens.c}}>{intens.l}</span>
                      {r.calories_kcal>0&&<span style={{fontSize:10,color:C.cal,marginLeft:'auto'}}>🔥 {r.calories_kcal} kcal</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 12 week plan with checkboxes */}
            <div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20}}>
              <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>📋 12-Week Plan</div>
              {PLAN.map(p=>{
                const isCurrent = p.w===5
                return(
                  <div key={p.w} style={{padding:'10px 0',borderBottom:`1px solid ${C.dim}`,opacity:p.done&&!isCurrent?0.4:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:p.done?0:6}}>
                      <div style={{fontSize:11,fontWeight:700,color:isCurrent?C.run:p.done?C.green:C.muted,minWidth:30}}>
                        {p.done?'✅':isCurrent?'▶':'○'} W{p.w}
                      </div>
                      {isCurrent&&<span style={{background:C.run+'20',color:C.run,fontSize:9,padding:'1px 6px',borderRadius:4,border:`1px solid ${C.run}30`}}>Current</span>}
                      {p.done&&<span style={{background:C.green+'20',color:C.green,fontSize:9,padding:'1px 6px',borderRadius:4}}>Done</span>}
                    </div>
                    {!p.done&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,paddingLeft:38}}>
                        {SESS_TYPES.map(type=>{
                          const key = `w${p.w}_${type}`
                          const label = type==='speed'?p.sp:type==='easy'?p.ez:type==='tempo'?p.te:p.lo
                          const checked = checks[key]||false
                          return(
                            <label key={type} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',padding:'4px 0'}}>
                              <input type="checkbox" checked={checked} onChange={e=>toggleCheck(key,e.target.checked)}
                                style={{width:16,height:16,accentColor:C.run,cursor:'pointer'}}/>
                              <div>
                                <div style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{type}</div>
                                <div style={{fontSize:10,color:C.text}}>{label}</div>
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
	{/* Monthly km progress */}
<div style={{background:C.card,border:`1px solid ${C.run}30`,borderRadius:14,padding:20,marginBottom:12}}>
  <div style={{fontSize:10,color:C.run,textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>📅 May — Monthly km Goal</div>
  
  {/* Big monthly ring */}
  {(() => {
    const WEEKS = [
      {label:'W1',km:13,goal:25},
      {label:'W2',km:11,goal:25},
      {label:'W3',km:22.15,goal:25},
      {label:'W4',km:0,goal:25},
    ]
    const totalKm = 46.15
    const monthGoal = 100
    const monthPct = Math.min((totalKm/monthGoal)*100, 100)
    const r = 52
    const circ = 2*Math.PI*r

    return (
      <div>
        {/* Big ring */}
        <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:20}}>
          <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
            <svg width="120" height="120" style={{transform:'rotate(-90deg)'}}>
              <circle cx="60" cy="60" r={r} fill="none" stroke={C.border} strokeWidth="10"/>
              <circle cx="60" cy="60" r={r} fill="none" stroke={C.run} strokeWidth="10"
                strokeDasharray={`${circ*(monthPct/100)} ${circ}`} strokeLinecap="round"
                style={{transition:'stroke-dasharray 1s ease'}}/>
            </svg>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:900,color:C.run}}>{totalKm}</div>
              <div style={{fontSize:9,color:C.muted}}>km</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:28,fontWeight:900,color:C.run}}>{Math.round(monthPct)}%</div>
            <div style={{fontSize:11,color:C.muted}}>of {monthGoal}km goal</div>
            <div style={{fontSize:11,color:C.green,marginTop:4}}>+{(monthGoal-totalKm).toFixed(1)}km to go</div>
            <div style={{fontSize:10,color:C.muted,marginTop:4}}>May 2026</div>
          </div>
        </div>

        {/* 4 weekly small rings */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {WEEKS.map((w,i) => {
            const pct = Math.min((w.km/w.goal)*100, 100)
            const wr = 26
            const wcirc = 2*Math.PI*wr
            const col = w.km>=w.goal ? C.green : i===2 ? C.run : w.km>0 ? C.yellow : C.muted
            return (
              <div key={i} style={{textAlign:'center'}}>
                <div style={{position:'relative',width:64,height:64,margin:'0 auto'}}>
                  <svg width="64" height="64" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="32" cy="32" r={wr} fill="none" stroke={C.border} strokeWidth="7"/>
                    <circle cx="32" cy="32" r={wr} fill="none" stroke={col} strokeWidth="7"
                      strokeDasharray={`${wcirc*(pct/100)} ${wcirc}`} strokeLinecap="round"/>
                  </svg>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                    <div style={{fontSize:11,fontWeight:900,color:col}}>{w.km>0?w.km:''}</div>
                  </div>
                </div>
                <div style={{fontSize:9,color:C.muted,marginTop:4}}>{w.label}</div>
                <div style={{fontSize:9,color:col}}>{w.km}/{w.goal}km</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  })()}
</div>

        {/* SMOKE */}
        {tab===2 && (
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
        {tab===3 && (
          <div style={{background:C.card,border:`1px solid ${C.mental}30`,borderRadius:14,padding:20}}>
            <div style={{fontSize:10,color:C.mental,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>🤖 AI Coach</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Coming soon — full AI coach with your live stats</div>
            <div style={{background:C.dim,borderRadius:10,padding:16}}>
              <div style={{fontSize:12,color:C.text,lineHeight:1.7}}>
                Your stats right now:<br/>
                🔥 <span style={{color:C.cal}}>{kcal} kcal</span> active today<br/>
                🏃 <span style={{color:C.run}}>PB 24:32</span> · Goal 22:00<br/>
                🚭 <span style={{color:C.smoke}}>{cigs}/{cigGoal}</span> cigarettes<br/>
                📅 <span style={{color:C.green}}>Week 5</span> of 12-week plan
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom nav */}
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
            color:tab===i?[C.cal,C.run,C.smoke,C.mental][i]:C.muted,
            fontSize:22,cursor:'pointer',
            WebkitTapHighlightColor:'transparent',
            touchAction:'manipulation',
            borderTop:`2px solid ${tab===i?[C.cal,C.run,C.smoke,C.mental][i]:'transparent'}`,
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