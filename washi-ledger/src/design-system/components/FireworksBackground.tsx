import { useEffect, useMemo, useRef } from 'react'
import { useSettings } from '../../hooks/useSettings'

/** R-29："夏 · 花火"主题的动态背景——完整移植旧仓库index.html的starSkySvg()+
 * startFireworksCanvas()：星空SVG(固定种子生成的星点+月亮+虚化色斑)叠一层canvas
 * 实时烟花粒子物理引擎(shell发射→拖尾上升→顶点分层炸开成牡丹/菊花/柳枝/十字爆/
 * 闪烁星5种烟花，颜色从同一色系里取近似色，重力/阻力/拖尾长度/寿命都按类型区分)。
 * 挂在App.tsx根部(SettingsProvider内、Routes外)、跟路由完全无关地持续存在，只根据
 * themeSkin是不是'summer'来决定要不要渲染——不是挂在某个页面的AppLayout实例里，
 * 这样切页面(仪表盘→明细→统计)时动画不会被重新初始化或闪一下。
 *
 * 旧App是"多个.page各自一份.fw-bg-layer，跟着当前显示的page走、切page要拆了重挂"，
 * 这里"格局"不同(React Router单页应用，只有一个常驰的背景层)，不需要那套挂载/
 * 拆除逻辑，直接常驻+按主题开关显示/隐藏更简单也更不容易闪烁。 */
export function FireworksBackground() {
  const { settings } = useSettings()
  const active = settings.themeSkin === 'summer'
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const parent = canvas.parentElement
    if (!parent) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 1)
    function resize() {
      const r = parent!.getBoundingClientRect()
      w = Math.max(1, r.width)
      h = Math.max(1, r.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    let ro: ResizeObserver | null = null
    if (window.ResizeObserver) {
      ro = new ResizeObserver(resize)
      ro.observe(parent)
    }

    // 花火配色——照旧App startFireworksCanvas(canvas, {seal, accent, jade, sealSoft})
    // 调用处的固定色值搬，不是从当前CSS变量读取(旧App本身也是这么做的：这几个色值
    // 是这套动效专用的、跟主题token解耦的独立常量)
    const SEAL = '#E85D4A'
    const ACCENT = '#F2C94C'
    const JADE = '#4FD1A5'
    const SEAL_SOFT = '#F2967F'
    const palette = [SEAL, ACCENT, JADE, SEAL_SOFT]
    const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

    function hexToRgb(hex: string): [number, number, number] {
      const m = hex.replace('#', '')
      const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
      const num = parseInt(n, 16)
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    }
    function rgbToHsl(rgb: [number, number, number]): [number, number, number] {
      const r = rgb[0] / 255,
        g = rgb[1] / 255,
        b = rgb[2] / 255
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b)
      let hue = 0,
        s = 0
      const l = (max + min) / 2
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) hue = (g - b) / d + (g < b ? 6 : 0)
        else if (max === g) hue = (b - r) / d + 2
        else hue = (r - g) / d + 4
        hue *= 60
      }
      return [hue, s, l]
    }
    function hslToRgb(h: number, s: number, l: number): [number, number, number] {
      h = (((h % 360) + 360) % 360) / 360
      if (s <= 0) return [l * 255, l * 255, l * 255]
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255]
    }
    const mixRgb = (a: number[], b: number[], t: number): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]
    const rgbStr = (rgb: number[], a: number) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`

    // 一簇烟花的颜色应该像"同一束考虑过的配色"，不是随手抓——真实烟花的星是同一色系
    // (或一个色相+近白)混出来的，不会出现互相冲突的色相并排。所以固定一个基准色相，
    // 只小幅度浮动色相、更大幅度浮动明度/饱和度，偶尔有一个槽位换成近白(真实烟花里
    // 常见的混色方式)
    function pickShellColors(): number[][] {
      const [bh, bs, bl] = rgbToHsl(hexToRgb(pick(palette)))
      const count = 2 + (Math.random() < 0.4 ? 1 : 0)
      const colors: number[][] = [hslToRgb(bh, bs, bl)]
      for (let i = 1; i < count; i++) {
        if (Math.random() < 0.3) {
          colors.push([250, 248, 240])
          continue
        }
        const dh = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16)
        const dl = (Math.random() - 0.3) * 0.22
        const ds = (Math.random() - 0.5) * 0.1
        colors.push(hslToRgb(bh + dh, Math.min(0.95, Math.max(0.25, bs + ds)), Math.min(0.82, Math.max(0.25, bl + dl))))
      }
      return colors
    }

    interface Shell {
      x: number
      x0: number
      y: number
      targetY: number
      t: number
      dur: number
      colors: number[][]
      type: string
      trail: { x: number; y: number }[]
    }
    interface Spark {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      gravityMul: number
      dragMul: number
      trailLen: number
      glitter: boolean
      splitAt: number | null
      splitDone: boolean
      trail: { x: number; y: number }[]
      size: number
      seed: number
      delay: number
      age: number
      emberRgb: number[]
      whiteRgb: number[]
      coolRgb: number[]
    }

    let shells: Shell[] = []
    let sparks: Spark[] = []
    let openBursts: number[] = []
    let nextLaunch = 0.5
    let tClock = 0
    let shellCount = 0

    function spawnShell() {
      const scale = w / 300
      const x = w * (0.14 + Math.random() * 0.72)
      const groundY = h + 20 * scale
      // 偏向屏幕最上方——均匀0..1随机数用指数压缩后大多数烟花会在高处炸开，第一发
      // 强制定在贴近顶边的位置，保证一进来马上就能看到炸开效果，不用靠运气等
      const burstY = shellCount === 0 ? h * 0.05 : h * (0.03 + Math.pow(Math.random(), 1.6) * 0.34)
      shellCount++
      const colors = pickShellColors()
      const type = pick(['peony', 'chrysanthemum', 'willow', 'crossette', 'strobe'])
      // 更从容的上升节奏——真实烟花升到顶点要个两三秒，不是不到一秒
      const dur = (1.3 + Math.random() * 0.5) / Math.max(0.6, scale * 0.5 + 0.5)
      shells.push({ x, x0: x, y: groundY, targetY: burstY, t: 0, dur, colors, type, trail: [] })
    }

    function makeSpark(x: number, y: number, vx: number, vy: number, opts: Partial<Spark>) {
      sparks.push(
        Object.assign(
          {
            x,
            y,
            vx,
            vy,
            life: 1.6,
            maxLife: 1.6,
            gravityMul: 1,
            dragMul: 0.982,
            trailLen: 6,
            glitter: false,
            splitAt: null,
            splitDone: false,
            trail: [],
            size: 1.5 + Math.random() * 0.9,
            seed: Math.random() * 20,
            delay: 0,
            age: 0,
          },
          opts
        ) as Spark
      )
    }

    // 每发烟花现在都是两层：外层立刻炸开，内层慢半拍从同一个中心再炸一层、在外层
    // 里面绽放——这个错拍才是"一层叠一层"的关键，不是所有火花同时炸成一个平的球
    function burst(shell: Pick<Shell, 'x' | 'y' | 'colors' | 'type'>) {
      const { x, y, colors } = shell
      const emberRgbs = colors
      const coolRgbs = emberRgbs.map((c) => mixRgb(c, [30, 8, 6], 0.72))
      const whiteRgb = [255, 255, 255]
      const scale = w / 300
      let n: number, speed: number, gravityMul: number, dragMul: number, trailLen: number, life: number
      let glitter = false
      let splitAt: number | null = null
      switch (shell.type) {
        case 'peony':
          n = 68
          speed = 200 * scale
          gravityMul = 0.85
          dragMul = 0.992
          trailLen = 7
          life = 2.1
          break
        case 'willow':
          n = 52
          speed = 145 * scale
          gravityMul = 1.1
          dragMul = 0.986
          trailLen = 22
          life = 3.5
          break
        case 'crossette':
          n = 24
          speed = 225 * scale
          gravityMul = 0.88
          dragMul = 0.993
          life = 1.7
          splitAt = 0.5
          trailLen = 12
          break
        case 'strobe':
          n = 46
          speed = 180 * scale
          gravityMul = 1.0
          dragMul = 0.989
          trailLen = 10
          life = 2.5
          glitter = true
          break
        default:
          n = 72
          speed = 190 * scale
          gravityMul = 0.95
          dragMul = 0.989
          trailLen = 17
          life = 2.7 // chrysanthemum
      }
      const spawnLayer = (count: number, speedMul: number, sizeMul: number, delayRange: [number, number]) => {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.16
          const sp = speed * speedMul * (0.72 + Math.random() * 0.4)
          const delay = delayRange[0] + Math.random() * (delayRange[1] - delayRange[0])
          // 每个火花自己独立掷一次这发烟花的2-3种颜色——这才是让球看起来真的是混色
          // 而不是同一个色的深浅渐变的关键
          const ci = (Math.random() * colors.length) | 0
          makeSpark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
            life,
            maxLife: life,
            gravityMul,
            dragMul,
            trailLen,
            glitter,
            splitAt,
            emberRgb: emberRgbs[ci],
            whiteRgb,
            coolRgb: coolRgbs[ci],
            size: (1.5 + Math.random() * 0.9) * sizeMul,
            delay,
          })
        }
      }
      spawnLayer(n, 1, 1, [0, 0]) // 外层——立刻炸开
      spawnLayer(Math.round(n * 0.6), 0.52, 0.8, [0.16, 0.3]) // 内层——慢半拍在外层里面绽放
      // 记这发烟花"还在绽放中"直到它最长那一层寿命耗尽，发射调度靠这个限制同屏
      // 最多几发在炸，不是只限制粒子总数
      openBursts.push(tClock + life)
    }

    function splitChildren(p: Spark) {
      const n = 5
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = (45 + Math.random() * 35) * (w / 300)
        makeSpark(p.x, p.y, p.vx * 0.25 + Math.cos(a) * sp, p.vy * 0.25 + Math.sin(a) * sp, {
          life: 0.55,
          maxLife: 0.55,
          gravityMul: 1,
          dragMul: 0.978,
          trailLen: 4,
          emberRgb: p.emberRgb,
          whiteRgb: p.whiteRgb,
          coolRgb: p.coolRgb,
          size: 1,
        })
      }
    }

    function update(dt: number) {
      tClock += dt
      openBursts = openBursts.filter((exp) => exp > tClock)
      nextLaunch -= dt
      // 硬上限：同时最多3发正在升起或绽放中。密度靠一次发射多发(volley)+每发粒子数
      // 本身多来营造，不是靠让很多个绽放同时叠在屏幕上——那样看起来乱，且这个上限
      // 比单纯限制粒子总数更能兜住最坏情况的性能
      const inFlight = shells.length + openBursts.length
      if (nextLaunch <= 0 && inFlight < 3 && shells.length + sparks.length < 460) {
        const roomLeft = 3 - inFlight
        const wanted = Math.random() < 0.4 ? 2 + ((Math.random() * 3) | 0) : 1
        const salvo = Math.min(wanted, roomLeft)
        for (let i = 0; i < salvo; i++) spawnShell()
        nextLaunch = 0.32 + Math.random() * 0.5
      }
      const g = 78 * (w / 300)
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i]
        s.t += dt
        const p = Math.min(1, s.t / s.dur)
        const e = 1 - Math.pow(1 - p, 2)
        s.x = s.x0 + Math.sin(s.t * 3.2) * 2 * (w / 300)
        s.y = h + 20 * (w / 300) + (s.targetY - (h + 20 * (w / 300))) * e
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 6) s.trail.shift()
        if (p >= 1) {
          burst(s)
          shells.splice(i, 1)
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        if (p.age < p.delay) {
          p.age += dt
          continue
        }
        p.vy += g * p.gravityMul * dt
        const dragF = Math.pow(p.dragMul, dt * 60)
        p.vx *= dragF
        p.vy *= dragF
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
        if (p.trailLen > 0) {
          p.trail.push({ x: p.x, y: p.y })
          if (p.trail.length > p.trailLen) p.trail.shift()
        }
        if (p.splitAt != null && !p.splitDone && p.life < p.maxLife * p.splitAt) {
          p.splitDone = true
          splitChildren(p)
        }
        if (p.life <= 0) sparks.splice(i, 1)
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      // 圆头圆角连接——让多段拖尾看起来是一条连续、平滑淡出的痕迹，不是一排断开的
      // 短线段(canvas默认butt cap每段末端会露出缝隙，之前拖尾不明显就是这个原因)
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      for (const s of shells) {
        if (s.trail.length > 1) {
          ctx!.beginPath()
          ctx!.moveTo(s.trail[0].x, s.trail[0].y)
          for (let i = 1; i < s.trail.length; i++) ctx!.lineTo(s.trail[i].x, s.trail[i].y)
          ctx!.strokeStyle = 'rgba(255,235,190,0.55)'
          ctx!.lineWidth = 1.3
          ctx!.stroke()
        }
        ctx!.beginPath()
        ctx!.fillStyle = '#fff6df'
        ctx!.arc(s.x, s.y, 1.6, 0, Math.PI * 2)
        ctx!.fill()
      }
      for (const p of sparks) {
        if (p.age < p.delay) continue
        const lifeFrac = Math.max(0, p.life / p.maxLife)
        const headT = 1 - lifeFrac
        let rgb: number[]
        if (headT < 0.15) rgb = mixRgb(p.whiteRgb, p.emberRgb, headT / 0.15)
        else rgb = mixRgb(p.emberRgb, p.coolRgb, Math.min(1, (headT - 0.15) / 0.85))
        let alpha = Math.pow(lifeFrac, 0.6)
        if (p.glitter) alpha *= 0.35 + 0.65 * Math.max(0, Math.sin(tClock * 20 + p.seed * 7))
        if (p.trail.length > 1) {
          // 一条连续路径，从最旧的点(透明)渐变到当前位置(全亮)——这才是锥形彗尾的
          // 观感，不是等透明度的一条虫子，也不是(butt cap下)一排断开的短线
          const tailStart = p.trail[0]
          const grad = ctx!.createLinearGradient(tailStart.x, tailStart.y, p.x, p.y)
          grad.addColorStop(0, rgbStr(rgb, 0))
          grad.addColorStop(1, rgbStr(rgb, Math.min(1, alpha * 1.15)))
          ctx!.beginPath()
          ctx!.moveTo(tailStart.x, tailStart.y)
          for (let i = 1; i < p.trail.length; i++) ctx!.lineTo(p.trail[i].x, p.trail[i].y)
          ctx!.lineTo(p.x, p.y)
          ctx!.strokeStyle = grad
          ctx!.lineWidth = Math.max(0.9, p.size * 0.85)
          ctx!.stroke()
        }
        ctx!.beginPath()
        ctx!.fillStyle = rgbStr(rgb, alpha)
        ctx!.shadowColor = rgbStr(rgb, Math.min(1, alpha * 1.2))
        ctx!.shadowBlur = 6
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.shadowBlur = 0
      }
      ctx!.globalCompositeOperation = 'source-over'
    }

    let raf = 0
    let alive = true
    let last = performance.now()

    if (reduced) {
      ;(['peony', 'chrysanthemum', 'willow', 'crossette'] as const).forEach((type, i) => {
        burst({ x: w * (0.22 + i * 0.2), y: h * (0.05 + (i % 2) * 0.16), colors: pickShellColors(), type })
      })
      sparks.forEach((p) => {
        p.life = p.maxLife * 0.5
      })
      draw()
      return () => {
        ro?.disconnect()
      }
    }

    function frame(now: number) {
      if (!alive) return
      if (!document.body.contains(canvas)) {
        stop()
        return
      }
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      update(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }
    function stop() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
    }
    // 滑动时暂停这个循环——粒子物理+canvas绘制(尤其每个粒子的渐变拖尾/shadowBlur
    // 发光)跟滚动抢同一条主线程是卡顿的根源，直接停掉rAF比"降画质硬扛"更彻底。
    // dt的钳制(Math.min(...,0.05))已经兜住恢复时的时间跳变，不会因为暂停了一段
    // 时间就在恢复的第一帧把物理往前算一大截
    let scrollFadeTimer: ReturnType<typeof setTimeout> | null = null
    function onScroll() {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      if (scrollFadeTimer) clearTimeout(scrollFadeTimer)
      scrollFadeTimer = setTimeout(() => {
        if (alive && !raf) {
          last = performance.now()
          raf = requestAnimationFrame(frame)
        }
      }, 170)
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })

    raf = requestAnimationFrame(frame)
    return () => {
      stop()
      window.removeEventListener('scroll', onScroll, { capture: true })
      if (scrollFadeTimer) clearTimeout(scrollFadeTimer)
    }
  }, [active])

  // 星空——固定种子(用下标算三角函数式的伪随机)生成90颗星+月亮+4个虚化色斑，
  // 数值/公式照旧App starSkySvg()原样搬，只用useMemo避免每次渲染重新算一遍
  const stars = useMemo(() => {
    const list: { x: number; y: number; r: number; op: number; col: string; tw: boolean; delay: number }[] = []
    for (let i = 0; i < 90; i++) {
      const x = 15 + ((i * 47) % 270)
      const y = 8 + ((i * 83) % 555)
      const r = 0.5 + ((i * 13) % 4) * 0.35
      const op = 0.25 + ((i * 7) % 6) * 0.11
      const col = i % 9 === 0 ? '#F2C94C' : i % 5 === 0 ? '#F2967F' : '#1A2C4D'
      const tw = i % 6 === 0
      const delay = (i * 0.37) % 3.2
      list.push({ x, y, r, op, col, tw, delay })
    }
    return list
  }, [])

  if (!active) return null

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 700" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
        <defs>
          <filter id="fwbokeh" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <rect width="300" height="700" fill="#101B33" />
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={s.col}
            fillOpacity={s.op}
            className={s.tw ? 'fw-star-tw' : undefined}
            style={s.tw ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
        <circle cx={258} cy={34} r={15} fill="#F2C94C" fillOpacity={0.3} />
        {[
          [30, 45, 5, '#E85D4A'],
          [270, 90, 4, '#4FD1A5'],
          [15, 190, 3.5, '#F2C94C'],
          [280, 230, 4.5, '#F2967F'],
        ].map(([x, y, r, fill], i) => (
          <circle
            key={i}
            cx={x as number}
            cy={y as number}
            r={r as number}
            fill={fill as string}
            fillOpacity={0.55}
            filter="url(#fwbokeh)"
            style={{ mixBlendMode: 'screen' }}
          />
        ))}
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
    </div>
  )
}
