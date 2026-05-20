import { Redis } from '@upstash/redis'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

function pace(durSec, km) {
  const sPerKm = durSec / km
  return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, '0')}`
}

const raw = [
  { name:'Evening Run',    date:'2026-05-20', durSec:22*60+41, km:4.20  },
  { name:'Afternoon Run',  date:'2026-05-17', durSec:66*60+38, km:11.01 },
  { name:'Tempo 5/12',    date:'2026-05-13', durSec:31*60+17, km:6.13  },
  { name:'Easy run 5/12', date:'2026-05-12', durSec:30*60+33, km:5.01  },
  { name:'Intervaly 5/12',date:'2026-05-10', durSec:22*60+13, km:4.08  },
  { name:'Long 4/12',     date:'2026-05-07', durSec:46*60+50, km:8.00  },
  { name:'Temp 4/12',     date:'2026-05-03', durSec:30*60+57, km:6.09  },
  { name:'Easy 4/12',     date:'2026-05-02', durSec:38*60+57, km:6.01  },
]

const runs = raw.map(r => ({
  name: r.name,
  date: r.date,
  duration_min: Math.round(r.durSec / 60),
  distance_km: Math.round(r.km * 100) / 100,
  pace_per_km: pace(r.durSec, r.km),
  avg_hr: null,
  calories_kcal: null,
}))

const monthKey = 'runs_2026-05'
const existing = (await redis.get(monthKey)) ?? []
const merged = [...existing]
for (const run of runs) {
  if (!merged.find(r => r.date === run.date && r.name === run.name)) {
    merged.unshift(run)
  }
}
merged.sort((a, b) => b.date.localeCompare(a.date))
await redis.set(monthKey, merged)

const total = merged.reduce((s, r) => s + (r.distance_km ?? 0), 0)
console.log(`Saved ${merged.length} runs — ${total.toFixed(2)} km total`)
merged.forEach(r => console.log(` ${r.date}  ${r.name}  ${r.distance_km}km  ${r.pace_per_km}  ${r.duration_min}m`))
