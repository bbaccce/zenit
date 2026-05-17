import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET() {
  const today = new Date().toISOString().split('T')[0]
  const calories = await redis.get(`calories_${today}`) || {}
  const runs = await redis.get('latest_runs') || []
  const cigs = await redis.get(`cigs_${today}`) || 0
  const plan = await redis.get('plan_checks') || {}

  return NextResponse.json({ calories, runs, cigs, plan })
}

export async function POST(req: Request) {
  const body = await req.json()
  const today = new Date().toISOString().split('T')[0]

  if (body.type === 'calories') {
    const metrics = body.data?.metrics || []
    const active = metrics.find((m: any) => m.name === 'active_energy')
    if (active) {
      const isKj = active.units === 'kJ'
      const total = active.data.reduce((s: number, d: any) => 
        s + (isKj ? d.qty * 0.239 : d.qty), 0)
      await redis.set(`calories_${today}`, {
        calories_kcal: Math.round(total),
        entries: active.data.length,
        date: today,
        timestamp: new Date().toISOString()
      })
    }
  }

  if (body.type === 'runs') {
    const workouts = body.data?.workouts || []
    const RUN_TYPES = ['Outdoor Run', 'Indoor Run', 'Running']
    const runs = workouts.filter((w: any) => 
      w.distance?.units === 'km' && RUN_TYPES.includes(w.name)
    ).map((w: any) => {
      const secs = w.duration / w.distance.qty
      return {
        date: w.start?.split(' ')[0],
        distance_km: Math.round(w.distance.qty * 100) / 100,
        duration_min: Math.round(w.duration / 60),
        pace_per_km: `${Math.floor(secs/60)}:${String(Math.round(secs%60)).padStart(2,'0')}`,
        avg_hr: Math.round(w.heartRate?.avg?.qty || 0),
        max_hr: Math.round(w.heartRate?.max?.qty || 0),
        calories_kcal: Math.round((w.activeEnergyBurned?.qty || 0) * 0.239),
        name: w.name,
      }
    })
    await redis.set('latest_runs', runs)
  }

  return NextResponse.json({ ok: true })
}