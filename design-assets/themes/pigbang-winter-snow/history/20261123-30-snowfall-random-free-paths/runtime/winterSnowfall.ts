/** Random horizontal corridors stay reserved until each flake fully exits. */
const SIZE = 60
const DRIFT = 4
const HALF = SIZE * Math.SQRT2 / 2 + DRIFT
const GAP = 6
const EDGE = 2
const SPACING = HALF * 2 + GAP
const SPEEDS = [26, 35, 48]

export interface WinterSnowflake {
  id: number; center: number; speed: number; bornAt: number; endAt: number; duration: number
  fromY: number; toY: number; driftStart: number; driftEnd: number
  rotationStart: number; rotationEnd: number
}

export class WinterSnowfallSchedule {
  readonly width: number
  readonly height: number
  private readonly random: () => number
  now = 0
  readonly active = new Map<number, WinterSnowflake>()
  nextSpawnAt = 0
  private sequence = 0
  private readonly initialPlan: number[]
  constructor(width: number, height: number, random: () => number = Math.random) {
    this.width = width
    this.height = height
    this.random = random
    this.now = 0
    this.nextSpawnAt = 0
    this.sequence = 0
    this.initialPlan = this.makeInitialPlan()
  }

  unit() {
    return Math.max(0, Math.min(1 - Number.EPSILON, this.random()))
  }

  makeInitialPlan() {
    const usable = this.width - 2 * (EDGE + HALF)
    const count = Math.min(3, Math.max(0, Math.floor(usable / SPACING) + 1))
    const slack = Math.max(0, usable - (count - 1) * SPACING)
    const offsets = Array.from({ length: count }, () => this.unit() * slack).sort((a, b) => a - b)
    const centers = offsets.map((extra, i) => EDGE + HALF + i * SPACING + extra)
    for (let i = centers.length - 1; i > 0; i--) {
      const j = Math.floor(this.unit() * (i + 1))
      ;[centers[i], centers[j]] = [centers[j], centers[i]]
    }
    return centers
  }

  isFree(center: number) {
    return center >= EDGE + HALF - 1e-7 && center <= this.width - EDGE - HALF + 1e-7 &&
      [...this.active.values()].every(flake => Math.abs(flake.center - center) >= SPACING - 1e-7)
  }

  freeIntervals() {
    let intervals = [[EDGE + HALF, this.width - EDGE - HALF]]
    if (intervals[0][1] < intervals[0][0]) return []
    for (const flake of this.active.values()) {
      const lo = flake.center - SPACING
      const hi = flake.center + SPACING
      intervals = intervals.flatMap(([a, b]) => {
        if (hi <= a || lo >= b) return [[a, b]]
        const parts: number[][] = []
        if (lo >= a) parts.push([a, Math.min(b, lo)])
        if (hi <= b) parts.push([Math.max(a, hi), b])
        return parts
      })
    }
    return intervals
  }

  chooseCenter() {
    while (this.initialPlan.length) {
      const candidate = this.initialPlan.shift()!
      if (this.isFree(candidate)) return candidate
    }
    const intervals = this.freeIntervals()
    const total = intervals.reduce((sum, [a, b]) => sum + b - a, 0)
    if (!intervals.length) return null
    if (total <= 1e-7) return intervals[0][0]
    let position = this.unit() * total
    for (const [a, b] of intervals) {
      if (position <= b - a) return a + position
      position -= b - a
    }
    return intervals[intervals.length - 1][1]
  }

  spawn(at: number) {
    if (this.active.size >= 3) return false
    const center = this.chooseCenter()
    if (center == null || !this.isFree(center)) {
      return false
    }
    const availableSpeeds = SPEEDS.filter(speed => ![...this.active.values()].some(f => f.speed === speed))
    const speed = availableSpeeds[Math.floor(this.unit() * availableSpeeds.length)]
    const duration = (this.height + 160) / speed * 1000
    const rotation = -15 + this.unit() * 30
    const flake = {
      id: ++this.sequence, center, speed, bornAt: at, endAt: at + duration, duration,
      fromY: -80, toY: this.height + 80,
      driftStart: -DRIFT + this.unit() * DRIFT * 2,
      driftEnd: -DRIFT + this.unit() * DRIFT * 2,
      rotationStart: rotation, rotationEnd: rotation + 75 + this.unit() * 60,
    }
    this.active.set(flake.id, flake)
    return true
  }

  get nextEventAt() {
    return Math.min(this.nextSpawnAt, ...[...this.active.values()].map(f => f.endAt))
  }

  advanceTo(target: number) {
    if (target < this.now) throw Error('Preview clock must advance monotonically')
    let guard = 0
    while (++guard < 100000) {
      const finish = Math.min(Infinity, ...[...this.active.values()].map(f => f.endAt))
      const next = Math.min(finish, this.nextSpawnAt)
      if (next > target || !Number.isFinite(next)) break
      let exited = false
      for (const flake of this.active.values()) {
        if (flake.endAt <= next + 1e-7) {
          this.active.delete(flake.id)
          exited = true
        }
      }
      if (exited && !Number.isFinite(this.nextSpawnAt)) this.nextSpawnAt = next + 350 + this.unit() * 600
      if (this.nextSpawnAt <= next + 1e-7) {
        const spawned = this.spawn(next)
        this.nextSpawnAt = spawned && this.active.size < 3 ? next + 1100 + this.unit() * 800 : Infinity
      }
    }
    if (guard >= 100000) throw Error('Preview event loop did not converge')
    this.now = target
    return [...this.active.values()]
  }

  pose(flake: WinterSnowflake, at = this.now) {
    const progress = Math.max(0, Math.min(1, (at - flake.bornAt) / flake.duration))
    return {
      x: flake.center - SIZE / 2 + flake.driftStart + (flake.driftEnd - flake.driftStart) * progress,
      y: flake.fromY + (flake.toY - flake.fromY) * progress,
      rotation: flake.rotationStart + (flake.rotationEnd - flake.rotationStart) * progress,
      opacity: progress < .08 ? progress / .08 : progress > .92 ? (1 - progress) / .08 : 1,
      progress,
    }
  }
}
