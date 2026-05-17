import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET() {
  const checks = await redis.get('plan_checks') || {}
  return NextResponse.json({ checks })
}

export async function POST(req: Request) {
  const body = await req.json()
  const checks = await redis.get('plan_checks') as Record<string, boolean> || {}
  checks[body.key] = body.checked
  await redis.set('plan_checks', checks)
  return NextResponse.json({ checks })
}