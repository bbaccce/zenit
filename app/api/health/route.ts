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
  const startRaw = (w.date ?? w.start ?? fallbackDate).replace(' ', 'T')
  const dateStr = startRaw.split('T')[0]
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
    start: startRaw,
    duration_min: durMin,
    distance_km: distKm != null ? Math.round(distKm * 100) / 100 : null,
    pace_per_km: pace,
    avg_hr: avgHr != null ? Math.round(avgHr) : null,
    calories_kcal: calKcal,
  }
}

async function mergeWorkouts(items: any[], prefix: string): Promise<number> {
  const byMonth = new Map<string, any[]>()
  for (const item of items) {
    const mk = `${prefix}_${item.date.slice(0, 7)}`
    if (!byMonth.has(mk)) byMonth.set(mk, [])
    byMonth.get(mk)!.push(item)
  }
  let total = 0
  await Promise.all(Array.from(byMonth.entries()).map(async ([mk, monthItems]) => {
    const existing: any[] = (await redis.get<any[]>(mk)) ?? []
    const merged = [...existing]
    for (const item of monthItems) {
      const idx = merged.findIndex(r => r.start === item.start && r.name === item.name)
      if (idx >= 0) merged[idx] = item
      else merged.unshift(item)
    }
    merged.sort((a, b) => b.date.localeCompare(a.date))
    await redis.set(mk, merged.slice(0, 100))
    total += merged.length
  }))
  return total
}

export async function GET() {
  const today = ymd(new Date())
  const makeMonthKeys = (prefix: string) => [0, 1, 2].map(n => {
    const d = new Date(); d.setMonth(d.getMonth() - n)
    return `${prefix}_${ymd(d).slice(0, 7)}`
  })
  const runMonthKeys = makeMonthKeys('runs')
  const sportMonthKeys = makeMonthKeys('sports')

  const calories = await redis.get(`calories_${today}`) || {}
  const settingsData = (await redis.get<Record<string, unknown>>('settings')) || {}
  const basal = Number(settingsData.basalCalories ?? 1800)
  const [rawAllMonths, rawSportMonths] = await Promise.all([
    Promise.all(runMonthKeys.map(k => redis.get<any[]>(k))),
    Promise.all(sportMonthKeys.map(k => redis.get<any[]>(k))),
  ])

  const monthRuns = (rawAllMonths[0] ?? []).map(r => normalizeRun(r, today))
  const cutoff = ymd(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
  const seen = new Set<string>()
  const latestRuns = rawAllMonths
    .flatMap(r => r ?? [])
    .map(r => normalizeRun(r, today))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(r => { const k = `${r.start}_${r.name}`; if (seen.has(k)) return false; seen.add(k); return true })
    .filter(r => r.date >= cutoff)
  const runs = monthRuns

  const monthlySports = (rawSportMonths[0] ?? []).map(r => normalizeRun(r, today))
  const sportCutoff = ymd(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const sportSeen = new Set<string>()
  const latestSports = rawSportMonths
    .flatMap(r => r ?? [])
    .map(r => normalizeRun(r, today))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(r => { const k = `${r.start}_${r.name}`; if (sportSeen.has(k)) return false; sportSeen.add(k); return true })
    .filter(r => r.date >= sportCutoff)

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
    net: (dietVals[i]?.calories_kcal || 0) - ((calVals[i]?.calories_kcal || 0) + basal),
  }))

  return NextResponse.json({ calories, runs, latestRuns, sports: monthlySports, latestSports, cigs, plan, dietaryCalories, history })
}

export async function POST(req: Request) {
  const body = await req.json()
  const today = ymd(new Date())

  // ── WORKOUTS ──────────────────────────────────────────────
  if (body.data?.workouts) {
    const incomingRuns = body.data.workouts
      .filter((w: any) => RUN_TYPES.includes(w.name))
      .map((w: any) => normalizeRun(w, today))
    const incomingSports = body.data.workouts
      .filter((w: any) => !RUN_TYPES.includes(w.name))
      .map((w: any) => normalizeRun(w, today))

    const [runCount, sportsCount] = await Promise.all([
      mergeWorkouts(incomingRuns, 'runs'),
      mergeWorkouts(incomingSports, 'sports'),
    ])
    return NextResponse.json({ ok: true, type: 'workouts', runs: runCount, sports: sportsCount })
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
