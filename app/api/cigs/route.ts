import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

function ymd(d: Date) {
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const today = ymd(new Date())
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); days.push(ymd(d))
  }
  const vals = await redis.mget<any[]>(...days.map(d => `cigs_${d}`))
  const count = Number(vals[13] ?? 0)
  const history = days.map((date, i) => ({ date, count: Number(vals[i] ?? 0) }))
  return NextResponse.json({ count, date: today, history })
}

export async function POST(req: Request) {
  const today = ymd(new Date())
  const body = await req.json()

  if (body.action === 'increment') {
    const count = await redis.incr(`cigs_${today}`)
    return NextResponse.json({ count })
  }

  if (body.action === 'decrement') {
    const current = Number(await redis.get(`cigs_${today}`) || 0)
    const count = Math.max(0, current - 1)
    await redis.set(`cigs_${today}`, count)
    return NextResponse.json({ count })
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 })
}
