'use client'
import { useEffect, useRef } from 'react'

const HUBS: [number, number][] = [
  [-74.0, 40.7], [-87.6, 41.9], [-118.2, 34.1], [-99.1, 19.4],
  [-46.6, -23.5], [-58.4, -34.6], [-0.13, 51.5], [2.35, 48.86],
  [13.4, 52.5], [-3.7, 40.4], [12.5, 41.9], [37.6, 55.75],
  [28.98, 41.0], [31.23, 30.04], [3.4, 6.5], [18.4, -33.9],
  [55.3, 25.3], [72.83, 19.07], [77.2, 28.6], [103.8, 1.35],
  [100.5, 13.75], [114.16, 22.3], [121.47, 31.23], [116.4, 39.9],
  [139.69, 35.68], [126.97, 37.57], [151.21, -33.87], [-123.12, 49.28],
]

interface Transfer {
  src: [number, number]
  dst: [number, number]
  t0: number
  dur: number
}

export function GlobeLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    const CSS = 160
    const W = CSS * 2
    const H = CSS * 2
    canvas.width = W
    canvas.height = H

    const cx = W / 2
    const cy = H / 2
    const R = W / 2 - 4

    let animId: number

    const INK = '#1a1a18'
    const TRANSFER_DUR = 1800
    const FADE_DUR = 600
    const SPAWN_EVERY = 280
    const PERIOD_MS = 8000

    const transfers: Transfer[] = []
    let lastSpawn = 0

    function project(lon: number, lat: number, rot: number): [number, number] | null {
      const λ = ((lon - rot) * Math.PI) / 180
      const φ = (lat * Math.PI) / 180
      const x = Math.cos(φ) * Math.sin(λ)
      const y = Math.sin(φ)
      const z = Math.cos(φ) * Math.cos(λ)
      if (z < 0) return null
      return [cx + R * x, cy - R * y]
    }

    function geoInterp(a: [number, number], b: [number, number], t: number): [number, number] {
      const toRad = Math.PI / 180
      const φ1 = a[1] * toRad, λ1 = a[0] * toRad
      const φ2 = b[1] * toRad, λ2 = b[0] * toRad
      const ax = Math.cos(φ1) * Math.cos(λ1), ay = Math.cos(φ1) * Math.sin(λ1), az = Math.sin(φ1)
      const bx = Math.cos(φ2) * Math.cos(λ2), by = Math.cos(φ2) * Math.sin(λ2), bz = Math.sin(φ2)
      const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
      const omega = Math.acos(dot)
      if (omega < 1e-6) return a
      const s = Math.sin(omega)
      const sa = Math.sin((1 - t) * omega) / s
      const sb = Math.sin(t * omega) / s
      return [
        Math.atan2(sa * ay + sb * by, sa * ax + sb * bx) / toRad,
        Math.asin(Math.max(-1, Math.min(1, sa * az + sb * bz))) / toRad,
      ]
    }

    function drawArc(src: [number, number], dst: [number, number], p: number, alpha: number, rot: number) {
      const steps = 32
      const end = Math.max(0.001, Math.min(1, p))
      ctx.beginPath()
      let drawing = false
      for (let i = 0; i <= steps; i++) {
        const pt = project(...geoInterp(src, dst, (i / steps) * end), rot)
        if (!pt) { drawing = false; continue }
        if (!drawing) { ctx.moveTo(pt[0], pt[1]); drawing = true }
        else ctx.lineTo(pt[0], pt[1])
      }
      ctx.lineWidth = 1.6
      ctx.strokeStyle = `rgba(26,26,24,${0.8 * alpha})`
      ctx.lineCap = 'round'
      ctx.stroke()

      const hp = project(...geoInterp(src, dst, end), rot)
      if (hp) {
        ctx.beginPath()
        ctx.arc(hp[0], hp[1], 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(26,26,24,${alpha})`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(hp[0], hp[1], 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(26,26,24,${0.28 * alpha})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    function drawPulse(coord: [number, number], age: number, maxAge: number, rot: number) {
      const pt = project(...coord, rot)
      if (!pt) return
      const k = age / maxAge
      ctx.beginPath()
      ctx.arc(pt[0], pt[1], 2 + k * 10, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(26,26,24,${(1 - k) * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    function spawnTransfer(now: number) {
      const a = HUBS[(Math.random() * HUBS.length) | 0]
      let b = HUBS[(Math.random() * HUBS.length) | 0]
      let g = 0
      while (b === a || Math.hypot(a[0] - b[0], a[1] - b[1]) < 30) {
        b = HUBS[(Math.random() * HUBS.length) | 0]
        if (++g > 8) break
      }
      transfers.push({ src: a, dst: b, t0: now, dur: TRANSFER_DUR + Math.random() * 600 })
    }

    function drawGlobe(rot: number) {
      ctx.clearRect(0, 0, W, H)

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(26,26,24,0.03)'
      ctx.fill()

      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath()
        let first = true
        for (let lat = -90; lat <= 90; lat += 2) {
          const pt = project(lon, lat, rot)
          if (!pt) { first = true; continue }
          if (first) { ctx.moveTo(pt[0], pt[1]); first = false }
          else ctx.lineTo(pt[0], pt[1])
        }
        ctx.strokeStyle = 'rgba(26,26,24,0.13)'
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let first = true
        for (let lon = -180; lon <= 180; lon += 2) {
          const pt = project(lon, lat, rot)
          if (!pt) { first = true; continue }
          if (first) { ctx.moveTo(pt[0], pt[1]); first = false }
          else ctx.lineTo(pt[0], pt[1])
        }
        ctx.strokeStyle = 'rgba(26,26,24,0.13)'
        ctx.lineWidth = 0.6
        ctx.stroke()
      }

      const now = performance.now()
      if (now - lastSpawn > SPAWN_EVERY) { lastSpawn = now; spawnTransfer(now) }
      for (let i = transfers.length - 1; i >= 0; i--) {
        const t = transfers[i]
        const age = now - t.t0
        if (age > t.dur + FADE_DUR) { transfers.splice(i, 1); continue }
        if (age < t.dur) {
          const p = age / t.dur
          const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
          drawArc(t.src, t.dst, ease, 1, rot)
          if (age < 400) drawPulse(t.src, age, 400, rot)
        } else {
          drawArc(t.src, t.dst, 1, 1 - (age - t.dur) / FADE_DUR, rot)
          drawPulse(t.dst, age - t.dur, FADE_DUR, rot)
        }
      }

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.stroke()
    }

    const t0 = Date.now()
    function tick() {
      const rot = ((Date.now() - t0) / PERIOD_MS) * 360
      drawGlobe(rot)
      animId = requestAnimationFrame(tick)
    }

    tick()

    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 160, height: 160 }}
      className="block"
      aria-label="Live payment globe"
    />
  )
}
