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

export async function GET() {
  const today = ymd(new Date())
  const calories = await redis.get(`calories_${today}`) || {}
  const runs = await redis.get('latest_runs') || []
  const cigs = await redis.get(`cigs_${today}`) || 0
  const plan = await redis.get('plan_checks') || {}
  const dietaryCalories = await redis.get(`dietary_${today}`) || null

  // Build 30 days of history
  const days: string[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(ymd(d))
  }

  const calKeys = days.map(d => `calories_${d}`)
  const dietKeys = days.map(d => `dietary_${d}`)

  const [calVals, dietVals] = await Promise.all([
    redis.mget<any[]>(...calKeys),
    redis.mget<any[]>(...dietKeys),
  ])

  const history = days.map((date, i) => {
    const burned = calVals[i]?.calories_kcal || 0
    const eaten = dietVals[i]?.calories_kcal || 0
    return { date, burned, eaten, net: eaten - burned }
  })

  return NextResponse.json({ calories, runs, cigs, plan, dietaryCalories, history })
}

export async function POST(req: Request) {
  const body = await req.json()
  const today = ymd(new Date())

  // ── WORKOUTS ──────────────────────────────────────────────
  if (body.data?.workouts) {
    const runs = body.data.workouts
      .filter((w: any) => RUN_TYPES.includes(w.name))
      .map((w: any) => ({
        name: w.name,
        date: w.start?.split('T')[0] ?? today,
        duration: w.duration,
        distance: w.distance,
        pace: w.pace,
      }))
      .slice(0, 10)

    await redis.set('latest_runs', runs)
    return NextResponse.json({ ok: true, type: 'runs', count: runs.length })
  }

  // ── METRICS ───────────────────────────────────────────────
  if (body.data?.metrics) {
    const metrics = body.data.metrics

    // Active calories burned
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

    // Dietary calories eaten
    const dietary = metrics.find((m: any) =>
      m.name === 'dietary_energy' ||
      m.name === 'dietaryEnergyConsumed' ||
      m.name === 'Dietary Energy'
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
