import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const DEFAULTS = {
  basalCalories: 1800,
  calGoal: 600,
  eatGoal: 2200,
  cigGoal: 10,
}

export async function GET() {
  const stored = (await redis.get<Record<string, number>>('settings')) || {}
  return NextResponse.json({ ...DEFAULTS, ...stored })
}

export async function POST(req: Request) {
  const body = await req.json()
  const stored = (await redis.get<Record<string, number>>('settings')) || {}
  const updated = { ...stored, ...body }
  await redis.set('settings', updated)
  return NextResponse.json({ ...DEFAULTS, ...updated })
}
