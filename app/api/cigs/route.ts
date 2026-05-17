import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET() {
  const today = new Date().toISOString().split('T')[0]
  const count = await redis.get(`cigs_${today}`) || 0
  return NextResponse.json({ count, date: today })
}

export async function POST(req: Request) {
  const today = new Date().toISOString().split('T')[0]
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