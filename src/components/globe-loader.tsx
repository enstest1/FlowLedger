'use client'
import { useEffect, useRef } from 'react'
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoInterpolate,
} from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'

const HUBS: [number, number][] = [
  [-74.0, 40.7], [-87.6, 41.9], [-118.2, 34.1], [-99.1, 19.4],
  [-46.6, -23.5], [-58.4, -34.6], [-0.13, 51.5], [2.35, 48.86],
  [13.4, 52.5], [-3.7, 40.4], [12.5, 41.9], [37.6, 55.75],
  [28.98, 41.0], [31.23, 30.04], [3.4, 6.5], [18.4, -33.9],
  [55.3, 25.3], [72.83, 19.07], [77.2, 28.6], [103.8, 1.35],
  [100.5, 13.75], [114.16, 22.3], [121.47, 31.23], [116.4, 39.9],
  [139.69, 35.68], [126.97, 37.57], [151.21, -33.87], [-123.12, 49.28],
  [-43.2, -22.9], [88.36, 22.57], [174.76, -36.85],
]

interface Transfer {
  src: [number, number]
  dst: [number, number]
  t0: number
  dur: number
}

const CSS_SIZE = 160
const BITMAP = CSS_SIZE * 2
const R = BITMAP / 2 - 4
const CX = BITMAP / 2
const CY = BITMAP / 2
const INK = '#1a1a18'
const TRANSFER_DUR = 1800
const FADE_DUR = 600
const SPAWN_EVERY = 240
const PERIOD_MS = 6000

export function GlobeLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const projection = geoOrthographic()
      .translate([CX, CY])
      .scale(R)
      .clipAngle(90)

    const pathGen = geoPath(projection, ctx)
    const graticule = geoGraticule10()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sphere = { type: 'Sphere' } as any

    let land: GeoJSON.FeatureCollection | null = null
    let borders: GeoJSON.MultiLineString | null = null
    let animId: number
    const transfers: Transfer[] = []
    let lastSpawn = 0
    const t0 = Date.now()

    function spawnTransfer(now: number) {
      const a = HUBS[(Math.random() * HUBS.length) | 0]
      let b = HUBS[(Math.random() * HUBS.length) | 0]
      let g = 0
      while (b === a || Math.hypot(a[0] - b[0], a[1] - b[1]) < 25) {
        b = HUBS[(Math.random() * HUBS.length) | 0]
        if (++g > 8) break
      }
      transfers.push({ src: a, dst: b, t0: now, dur: TRANSFER_DUR + Math.random() * 600 })
    }

    function drawArc(src: [number, number], dst: [number, number], p: number, alpha: number) {
      const interp = geoInterpolate(src, dst)
      const end = Math.max(0.001, Math.min(1, p))
      const line: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: Array.from({ length: 29 }, (_, i) => interp((i / 28) * end)),
      }
      ctx!.beginPath()
      pathGen(line)
      ctx!.lineWidth = 1.4
      ctx!.strokeStyle = `rgba(26,26,24,${0.85 * alpha})`
      ctx!.lineCap = 'round'
      ctx!.stroke()

      const pt = projection(interp(end))
      if (pt && isFinite(pt[0]) && isFinite(pt[1])) {
        ctx!.beginPath()
        ctx!.arc(pt[0], pt[1], 2.6, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(26,26,24,${alpha})`
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(pt[0], pt[1], 5.2, 0, Math.PI * 2)
        ctx!.strokeStyle = `rgba(26,26,24,${0.35 * alpha})`
        ctx!.lineWidth = 1
        ctx!.stroke()
      }
    }

    function drawPulse(coord: [number, number], age: number, maxAge: number) {
      const pt = projection(coord)
      if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return
      const k = age / maxAge
      ctx!.beginPath()
      ctx!.arc(pt[0], pt[1], 2 + k * 10, 0, Math.PI * 2)
      ctx!.strokeStyle = `rgba(26,26,24,${(1 - k) * 0.55})`
      ctx!.lineWidth = 1.2
      ctx!.stroke()
    }

    function draw() {
      const lambda = ((Date.now() - t0) / PERIOD_MS) * 360
      projection.rotate([lambda, -12, 0])
      ctx!.clearRect(0, 0, BITMAP, BITMAP)

      ctx!.beginPath(); pathGen(sphere)
      ctx!.fillStyle = 'rgba(26,26,24,0.035)'; ctx!.fill()

      ctx!.beginPath(); pathGen(graticule)
      ctx!.lineWidth = 1; ctx!.strokeStyle = 'rgba(26,26,24,0.22)'; ctx!.stroke()

      if (land) {
        ctx!.beginPath(); pathGen(land)
        ctx!.fillStyle = 'rgba(26,26,24,0.10)'; ctx!.fill()
      }
      if (borders) {
        ctx!.beginPath(); pathGen(borders)
        ctx!.lineWidth = 1.4; ctx!.strokeStyle = INK; ctx!.stroke()
      }
      if (land) {
        ctx!.beginPath(); pathGen(land)
        ctx!.lineWidth = 1.6; ctx!.strokeStyle = INK; ctx!.stroke()
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
          drawArc(t.src, t.dst, ease, 1)
          if (age < 500) drawPulse(t.src, age, 500)
        } else {
          drawArc(t.src, t.dst, 1, (1 - (age - t.dur) / FADE_DUR))
          drawPulse(t.dst, age - t.dur, FADE_DUR)
        }
      }

      ctx!.beginPath(); pathGen(sphere)
      ctx!.lineWidth = 2; ctx!.strokeStyle = INK; ctx!.stroke()

      animId = requestAnimationFrame(draw)
    }

    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then((topo: Topology) => {
        const objects = topo.objects as Record<string, GeometryCollection>
        land = feature(topo, objects.land) as unknown as GeoJSON.FeatureCollection
        borders = mesh(topo, objects.countries, (a, b) => a !== b) as unknown as GeoJSON.MultiLineString
      })
      .catch(() => {})
      .finally(() => { animId = requestAnimationFrame(draw) })

    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={BITMAP}
      height={BITMAP}
      style={{ width: CSS_SIZE, height: CSS_SIZE }}
      className="block"
      aria-label="Live payment globe"
    />
  )
}
