import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const RUN_TYPES = ['Outdoor Run', 'Indoor Run', 'Running']

function ymd(d: Date) {
  return d.toISOString().split('T')[0]
}

function scalar(v: any): number | null {
  if (v == null) return null
  return typeof v === 'object' ? (v.qty ?? null) : v
}

function normalizeRun(w: any, fallbackDate: string) {
  const dateStr = (w.date ?? w.start ?? fallbackDate).replace(' ', 'T').split('T')[0]
  const distKm = scalar(w.distance_km ?? w.distance)
  const durRaw = scalar(w.duration_min ?? w.duration)
  // >600 means value is in seconds (no run lasts 10+ hours in minutes)
  const durMin = durRaw != null ? (durRaw > 600 ? Math.round(durRaw / 60) : Math.round(durRaw)) : null
  let pace = w.pace_per_km ?? w.pace ?? null
  if (!pace && distKm && durRaw) {
    const sPerKm = durRaw / distKm
    pace = `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, '0')}`
  }
  const rawHr = w.avg_hr ?? w.avgHeartRate ?? w.heartRateAverage ?? null
  const avgHr = scalar(rawHr)
  const rawCal = w.calories_kcal ?? w.activeEnergyBurned ?? w.totalEnergyBurned ?? null
  let calKcal: number | null = null
  if (rawCal != null) {
    const q = scalar(rawCal) ?? 0
    const units = typeof rawCal === 'object' ? rawCal.units : 'kcal'
    calKcal = Math.round(units === 'kJ' ? q / 4.184 : q)
  }
  return {
    name: w.name,
    date: dateStr,
    duration_min: durMin,
    distance_km: distKm != null ? Math.round(distKm * 100) / 100 : null,
    pace_per_km: pace,
    avg_hr: avgHr != null ? Math.round(avgHr) : null,
    calories_kcal: calKcal,
  }
}

export async function GET() {
  const today = ymd(new Date())
  const monthKey = `runs_${today.slice(0, 7)}`
  const calories = await redis.get(`calories_${today}`) || {}
  const [rawMonthRuns, rawLatestRuns] = await Promise.all([
    redis.get<any[]>(monthKey),
    redis.get<any[]>('latest_runs'),
  ])
  const monthRuns = (rawMonthRuns ?? []).map(r => normalizeRun(r, today))
  const latestRuns = (rawLatestRuns ?? []).map(r => normalizeRun(r, today))
  // persist re-normalized month runs if they changed
  if (monthRuns.length > 0) await redis.set(monthKey, monthRuns)
  const runs = monthRuns

  const cigs = await redis.get(`cigs_${today}`) || 0
  const plan = await redis.get('plan_checks') || {}
  const dietaryCalories = await redis.get(`dietary_${today}`) || null

  const days: string[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); days.push(ymd(d))
  }
  const [calVals, dietVals] = await Promise.all([
    redis.mget<any[]>(...days.map(d => `calories_${d}`)),
    redis.mget<any[]>(...days.map(d => `dietary_${d}`)),
  ])
  const history = days.map((date, i) => ({
    date,
    burned: calVals[i]?.calories_kcal || 0,
    eaten: dietVals[i]?.calories_kcal || 0,
    net: (dietVals[i]?.calories_kcal || 0) - (calVals[i]?.calories_kcal || 0),
  }))

  return NextResponse.json({ calories, runs, latestRuns, cigs, plan, dietaryCalories, history })
}

export async function POST(req: Request) {
  const body = await req.json()
  const today = ymd(new Date())

  // ── WORKOUTS ──────────────────────────────────────────────
  if (body.data?.workouts) {
    const incoming = body.data.workouts
      .filter((w: any) => RUN_TYPES.includes(w.name))
      .map((w: any) => normalizeRun(w, today))

    const monthKey = `runs_${today.slice(0, 7)}`
    const existing: any[] = (await redis.get<any[]>(monthKey)) ?? []
    const merged = [...existing]
    for (const run of incoming) {
      if (!merged.find(r => r.date === run.date && r.name === run.name)) {
        merged.unshift(run)
      }
    }
    merged.sort((a, b) => b.date.localeCompare(a.date))
    await redis.set(monthKey, merged.slice(0, 100))
    return NextResponse.json({ ok: true, type: 'runs', count: merged.length })
  }

  // ── METRICS ───────────────────────────────────────────────
  if (body.data?.metrics) {
    const metrics = body.data.metrics

    const active = metrics.find((m: any) =>
      m.name === 'active_energy' || m.name === 'activeEnergyBurned'
    )
    if (active) {
      const isKj = active.units === 'kJ'
      const seen = new Map<string, number>()
      for (const d of active.data) {
        const key = d.date ?? d.startDate ?? d.dateComponents ?? JSON.stringify(d)
        const val = isKj ? d.qty / 4.184 : d.qty
        if (!seen.has(key) || seen.get(key)! < val) seen.set(key, val)
      }
      const total = Array.from(seen.values()).reduce((s, v) => s + v, 0)
      await redis.set(`calories_${today}`, {
        calories_kcal: Math.round(total),
        entries: active.data.length,
        date: today,
        timestamp: new Date().toISOString(),
      })
    }

    const dietary = metrics.find((m: any) =>
      m.name === 'dietary_energy' || m.name === 'dietaryEnergyConsumed' || m.name === 'Dietary Energy'
    )
    if (dietary) {
      const isKj = dietary.units === 'kJ'
      const seen = new Map<string, number>()
      for (const d of dietary.data) {
        const key = d.date ?? d.startDate ?? d.dateComponents ?? JSON.stringify(d)
        const val = isKj ? d.qty / 4.184 : d.qty
        if (!seen.has(key) || seen.get(key)! < val) seen.set(key, val)
      }
      const total = Array.from(seen.values()).reduce((s, v) => s + v, 0)
      await redis.set(`dietary_${today}`, {
        calories_kcal: Math.round(total),
        date: today,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, type: 'metrics' })
  }

  return NextResponse.json({ error: 'unrecognized payload' }, { status: 400 })
}
