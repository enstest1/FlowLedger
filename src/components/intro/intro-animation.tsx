'use client'
import { useEffect, useRef, useState, useMemo, createContext, useContext, type ReactNode, type CSSProperties } from 'react'

// ── Easing ────────────────────────────────────────────────────────────────────
type EaseFn = (t: number) => number
const E: Record<string, EaseFn> = {
  linear:         t => t,
  easeOutCubic:   t => (--t) * t * t + 1,
  easeInCubic:    t => t * t * t,
  easeInOutCubic: t => t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
  easeOutBack:    t => { const c1=1.70158,c3=c1+1; return 1+c3*(t-1)**3+c1*(t-1)**2 },
  easeInQuad:     t => t * t,
  easeOutQuad:    t => t * (2 - t),
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function interp(input: number[], output: number[], ease: EaseFn | EaseFn[] = E.linear) {
  return (t: number): number => {
    if (t <= input[0]) return output[0]
    if (t >= input[input.length-1]) return output[output.length-1]
    for (let i=0; i<input.length-1; i++) {
      if (t >= input[i] && t <= input[i+1]) {
        const span = input[i+1]-input[i]
        const local = span===0 ? 0 : (t-input[i])/span
        const ef = Array.isArray(ease) ? (ease[i] ?? E.linear) : ease
        return output[i]+(output[i+1]-output[i])*ef(local)
      }
    }
    return output[output.length-1]
  }
}

// ── Timeline context ──────────────────────────────────────────────────────────
interface TLCtx { time: number; duration: number }
const TLContext = createContext<TLCtx>({ time: 0, duration: 22 })
const useTime = () => useContext(TLContext).time
const useTimeline = () => useContext(TLContext)

// ── Sprite ────────────────────────────────────────────────────────────────────
interface SpriteCtx { localTime: number; progress: number; duration: number; visible: boolean }
const SpriteCtx = createContext<SpriteCtx>({ localTime:0, progress:0, duration:0, visible:false })
export const useSprite = () => useContext(SpriteCtx)

export function Sprite({ start=0, end=Infinity, children, keepMounted=false }: {
  start?: number; end?: number; children: ReactNode|((c:SpriteCtx)=>ReactNode); keepMounted?: boolean
}) {
  const { time } = useTimeline()
  const visible = time >= start && time <= end
  if (!visible && !keepMounted) return null
  const dur = end-start
  const localTime = Math.max(0, time-start)
  const progress = dur>0 && isFinite(dur) ? clamp(localTime/dur,0,1) : 0
  const val: SpriteCtx = { localTime, progress, duration:dur, visible }
  return (
    <SpriteCtx.Provider value={val}>
      {typeof children==='function' ? children(val) : children}
    </SpriteCtx.Provider>
  )
}

// ── Colour + font tokens ──────────────────────────────────────────────────────
const C = {
  bg:          '#fafaf9',
  ink:         '#0f0f12',
  inkSoft:     '#3f3f46',
  inkMuted:    '#71717a',
  line:        '#e7e5e4',
  lineSoft:    '#f0eeec',
  paper:       '#ffffff',
  purple:      '#7c3aed',
  purpleDeep:  '#5b21b6',
  purpleSoft:  '#ede9fe',
  redact:      '#1c1917',
}
const SANS = "'Inter','CommitMono',system-ui,sans-serif"
const MONO = "'CommitMono','JetBrains Mono',ui-monospace,monospace"

// ── Shared building blocks ────────────────────────────────────────────────────

function GridBackground() {
  const t = useTime()
  const drift = (t*6)%40
  return (
    <div style={{
      position:'absolute',inset:0,
      backgroundImage:`linear-gradient(${C.lineSoft} 1px,transparent 1px),linear-gradient(90deg,${C.lineSoft} 1px,transparent 1px)`,
      backgroundSize:'40px 40px',
      backgroundPosition:`${drift}px ${drift*0.3}px`,
      opacity:0.7,
      maskImage:'radial-gradient(ellipse at center,black 30%,transparent 80%)',
      WebkitMaskImage:'radial-gradient(ellipse at center,black 30%,transparent 80%)',
    }}/>
  )
}

function RedactableLine({ text, revealed=text.length, size=14, color=C.ink, weight=500, family=MONO }: {
  text:string; revealed?:number; size?:number; color?:string; weight?:number; family?:string
}) {
  return (
    <div style={{ fontFamily:family, fontSize:size, color, fontWeight:weight, letterSpacing:'0.01em', display:'flex', whiteSpace:'pre' }}>
      {text.split('').map((ch,i) => {
        const hidden = i >= revealed
        return (
          <span key={i} style={{ display:'inline-block', position:'relative', minWidth:ch===' '?4:'auto' }}>
            <span style={{ opacity:hidden?0:1, transition:'opacity 120ms' }}>{ch}</span>
            {hidden && <span style={{ position:'absolute', left:0, right:0, top:2, bottom:2, background:C.redact, borderRadius:1, minWidth:ch===' '?0:7 }}/>}
          </span>
        )
      })}
    </div>
  )
}

function InvoiceCard({ progress, redactionT=0 }: { progress:number; redactionT?:number }) {
  const lift   = interp([0,1],[24,0],E.easeOutCubic)(progress)
  const opacity= interp([0,0.4],[0,1],E.easeOutCubic)(progress)
  const lines = [
    { label:'TO',         value:'Northwind Logistics LLC',   w:0.7 },
    { label:'FROM',       value:'Acme Manufacturing Co.',    w:0.7 },
    { label:'INVOICE',    value:'#2480 · 2026-04-28',        w:0.6 },
    { label:'LINE ITEMS', value:'Q2 components · 14 SKUs',   w:0.65 },
    { label:'AMOUNT',     value:'USDCX 48,200.00',           w:0.55, emphasis:true },
  ]
  return (
    <div style={{
      position:'absolute', left:'50%', top:'50%',
      transform:`translate(-50%,calc(-50% + ${lift}px))`,
      opacity, width:520,
      background:C.paper, border:`1px solid ${C.line}`, borderRadius:14,
      padding:'32px 36px',
      boxShadow:'0 20px 50px -20px rgba(15,15,18,.18),0 4px 14px -4px rgba(15,15,18,.06)',
      fontFamily:SANS,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28, paddingBottom:18, borderBottom:`1px solid ${C.lineSoft}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:22, height:22, borderRadius:6, background:C.purple, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:8, height:8, background:C.paper, borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:C.ink, letterSpacing:'-0.005em' }}>FlowLedger</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:11, color:C.inkMuted, letterSpacing:'0.04em', textTransform:'uppercase' }}>INVOICE</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        {lines.map((line,i) => {
          const localRedact = clamp((redactionT - i*0.04)/0.7, 0, 1)
          const revealed = Math.round(line.value.length*(1-localRedact))
          return (
            <div key={i} style={{ display:'flex', alignItems:'baseline', gap:16 }}>
              <div style={{ fontFamily:MONO, fontSize:10, color:C.inkMuted, letterSpacing:'0.08em', textTransform:'uppercase', width:84, flexShrink:0 }}>{line.label}</div>
              <RedactableLine text={line.value} revealed={revealed} size={line.emphasis?18:14} weight={line.emphasis?600:500} color={C.ink} family={line.emphasis?MONO:SANS}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Scene 1 — Invoice document ────────────────────────────────────────────────
function Scene1_Invoice() {
  const { localTime } = useSprite()
  return <InvoiceCard progress={Math.min(1, localTime/1.2)} redactionT={0}/>
}

// ── Scene 2 — Counterparties + approval ──────────────────────────────────────
function PartyNode({ x, y, label, sublabel, accent=false, progress }: {
  x:number; y:number; label:string; sublabel:string; accent?:boolean; progress:number
}) {
  const opacity = interp([0,0.4],[0,1],E.easeOutCubic)(progress)
  const scale   = interp([0,0.5],[0.92,1],E.easeOutCubic)(progress)
  const initials = label.split(' ').map(w=>w[0]).slice(0,2).join('')
  return (
    <div style={{ position:'absolute', left:x, top:y, transform:`translate(-50%,-50%) scale(${scale})`, opacity, display:'flex', flexDirection:'column', alignItems:'center', gap:10, fontFamily:SANS }}>
      <div style={{ width:64, height:64, borderRadius:16, background:accent?C.purpleSoft:C.paper, border:`1px solid ${accent?C.purple:C.line}`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px -12px rgba(15,15,18,.15)' }}>
        <div style={{ fontFamily:MONO, fontSize:18, fontWeight:600, color:accent?C.purpleDeep:C.ink, letterSpacing:'-0.01em' }}>{initials}</div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.ink, letterSpacing:'-0.01em' }}>{label}</div>
        <div style={{ fontFamily:MONO, fontSize:10, color:C.inkMuted, letterSpacing:'0.06em', marginTop:3 }}>{sublabel}</div>
      </div>
    </div>
  )
}

function ConnectionLine({ from, to, progress, dashOffset=0 }: {
  from:{x:number;y:number}; to:{x:number;y:number}; progress:number; dashOffset?:number
}) {
  const length = interp([0,1],[0,1],E.easeInOutCubic)(progress)
  const dx=to.x-from.x, dy=to.y-from.y
  const len=Math.sqrt(dx*dx+dy*dy)
  const angle=Math.atan2(dy,dx)*180/Math.PI
  return (
    <svg style={{ position:'absolute', left:from.x, top:from.y, width:len, height:2, transform:`rotate(${angle}deg)`, transformOrigin:'0 50%', overflow:'visible', pointerEvents:'none' }}>
      <line x1={0} y1={1} x2={len*length} y2={1} stroke={C.purple} strokeWidth={1.5} strokeDasharray="4 4" strokeDashoffset={-dashOffset} opacity={0.85}/>
    </svg>
  )
}

function Scene2_Counterparties() {
  const { progress, localTime } = useSprite()
  const cx=960, cy=540
  const left={x:cx-360,y:cy}, right={x:cx+360,y:cy}
  const cardScale   = interp([0,0.4],[1,0.65],E.easeInOutCubic)(progress)
  const cardOpacity = interp([0.5,0.9],[1,0.4],E.linear)(progress)
  const lineProgress = clamp((localTime-0.5)/1.4, 0, 1)
  const dashOffset   = localTime*30
  const stampProgress = clamp((localTime-1.8)/0.6, 0, 1)
  return (
    <>
      <PartyNode x={left.x}  y={left.y}  label="Acme Mfg."  sublabel="canton:0xa4f…" progress={progress*1.4}/>
      <PartyNode x={right.x} y={right.y} label="Northwind"  sublabel="canton:0xb91…" progress={progress*1.4} accent/>
      <ConnectionLine from={left} to={right} progress={lineProgress} dashOffset={dashOffset}/>
      <div style={{ position:'absolute', left:cx, top:cy, transform:`translate(-50%,-50%) scale(${cardScale})`, opacity:cardOpacity, transformOrigin:'center' }}>
        <InvoiceCard progress={1} redactionT={0}/>
      </div>
      {stampProgress > 0 && (
        <div style={{ position:'absolute', left:cx, top:cy+4, transform:`translate(-50%,-50%) scale(${interp([0,1],[0.4,1],E.easeOutBack)(stampProgress)})`, opacity:stampProgress }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:C.paper, border:`1px solid ${C.purple}`, borderRadius:999, padding:'6px 14px 6px 10px', boxShadow:'0 6px 20px -8px rgba(124,58,237,.4)', fontFamily:SANS }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke={C.purple} strokeWidth="1.2"/>
              <path d="M4.5 7.2l1.7 1.7L10 5" stroke={C.purple} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize:12, fontWeight:600, color:C.purpleDeep, letterSpacing:'-0.005em' }}>Approved · 2 of 2</div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Scene 3 — Privacy curtain ─────────────────────────────────────────────────
function Scene3_Curtain() {
  const { progress, localTime } = useSprite()
  const cardScale  = interp([0,0.3],[0.65,1],E.easeOutCubic)(progress)
  const redactionT = clamp((localTime-0.8)/2.2, 0, 1)
  const labelT     = clamp((localTime-0.6)/0.6, 0, 1)
  return (
    <>
      <div style={{ position:'absolute', left:'50%', top:130, transform:`translate(-50%,${(1-labelT)*-16}px)`, opacity:labelT, display:'flex', alignItems:'center', gap:10, fontFamily:SANS }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:C.inkMuted }}/>
        <div style={{ fontFamily:MONO, fontSize:11, color:C.inkMuted, letterSpacing:'0.12em', textTransform:'uppercase' }}>View from outside the counterparty set</div>
      </div>
      <div style={{ position:'absolute', left:'50%', top:'50%', transform:`translate(-50%,-50%) scale(${cardScale})`, transformOrigin:'center' }}>
        <InvoiceCard progress={1} redactionT={redactionT}/>
      </div>
    </>
  )
}

// ── Scene 4 — Cryptographic proof ────────────────────────────────────────────
function ProofStat({ label, value, accent }: { label:string; value:string; accent?:boolean }) {
  return (
    <div>
      <div style={{ fontFamily:MONO, fontSize:9, color:C.inkMuted, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:MONO, fontSize:13, fontWeight:500, color:accent?C.purple:C.ink, letterSpacing:'-0.005em' }}>{value}</div>
    </div>
  )
}

function ProofCard({ localTime }: { localTime:number }) {
  const hash = '0x7f3a8c2e91d4b6f0a17c4a2e3b8d9f12c2e1'
  const opacity = interp([0,0.4],[0,1],E.easeOutCubic)(Math.min(1,localTime/0.4))
  const lift    = interp([0,0.5],[16,0],E.easeOutCubic)(Math.min(1,localTime/0.5))
  const typingT = clamp((localTime-0.6)/1.6, 0, 1)
  const typed   = Math.round(hash.length*E.easeOutCubic(typingT))
  const showCursor = typingT>0 && typingT<1 && Math.floor(localTime*2.5)%2===0
  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:`translate(-50%,calc(-50% + ${lift}px))`, opacity, width:560, background:C.paper, border:`1px solid ${C.line}`, borderRadius:14, padding:'28px 32px', boxShadow:'0 30px 60px -24px rgba(124,58,237,.25),0 4px 14px -4px rgba(15,15,18,.06)', fontFamily:SANS }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 1.5l6.5 2.8v4c0 4-2.8 7.4-6.5 8.2-3.7-.8-6.5-4.2-6.5-8.2v-4L9 1.5z" stroke={C.purple} strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M6 9l2.2 2.2L12.5 7" stroke={C.purple} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>Canton Update · Settled</div>
        <div style={{ flex:1 }}/>
        <div style={{ fontFamily:MONO, fontSize:10, color:C.inkMuted, letterSpacing:'0.08em' }}>PROOF OF TRANSFER</div>
      </div>
      <div style={{ background:'#0f0f12', borderRadius:8, padding:'14px 16px', fontFamily:MONO, fontSize:13, color:'#e7e5e4', letterSpacing:'0.02em', lineHeight:1.5, wordBreak:'break-all' }}>
        <span style={{ color:'#a78bfa' }}>update_id</span>
        <span style={{ color:'#71717a' }}>{' = '}</span>
        <span style={{ color:'#fafaf9' }}>{hash.slice(0,typed)}</span>
        {showCursor && <span style={{ color:'#a78bfa' }}>▍</span>}
      </div>
      <div style={{ display:'flex', gap:28, marginTop:18 }}>
        <ProofStat label="Block"  value="14,902,184"  />
        <ProofStat label="Time"   value="04:28:12 UTC"/>
        <ProofStat label="Status" value="Final" accent/>
      </div>
    </div>
  )
}

function Scene4_Proof() {
  const { localTime } = useSprite()
  return <ProofCard localTime={localTime}/>
}

// ── Scene 5 — Ledger pull-back ────────────────────────────────────────────────
function LedgerRow({ y, hash, amountVisible, delay=0, t }: {
  y:number; hash:string; amountVisible:boolean; delay?:number; t:number
}) {
  const local = clamp((t-delay)/0.5, 0, 1)
  const opacity = interp([0,1],[0,1],E.easeOutCubic)(local)
  const tx      = interp([0,1],[16,0],E.easeOutCubic)(local)
  return (
    <div style={{ position:'absolute', left:0, right:0, top:y, transform:`translateX(${tx}px)`, opacity, display:'flex', alignItems:'center', gap:16, padding:'14px 32px', borderBottom:`1px solid ${C.lineSoft}`, fontFamily:MONO }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
        <circle cx="6" cy="6" r="5" stroke={C.purple} strokeWidth="1"/>
        <path d="M3.8 6.2l1.5 1.5L8.5 4.5" stroke={C.purple} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontSize:12, color:C.ink, flex:1 }}>{hash}</div>
      <div style={{ fontSize:11, color:C.inkMuted, width:110 }}>{amountVisible?'USDCX 48,200':'▪▪▪▪▪▪▪▪▪▪▪▪'}</div>
      <div style={{ fontSize:11, color:C.purple, fontWeight:500, width:70 }}>Settled</div>
    </div>
  )
}

function Scene5_Ledger() {
  const { localTime } = useSprite()
  const rows = [
    { hash:'0x7f3a…c2e1' },{ hash:'0x9b22…44a8' },{ hash:'0x1c4e…78d3' },
    { hash:'0xa401…ff09' },{ hash:'0x3e87…2b1c' },{ hash:'0x55d0…91e6' },
  ]
  const headlineT = clamp((localTime-1.6)/1.0, 0, 1)
  return (
    <>
      <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:760, background:C.paper, border:`1px solid ${C.line}`, borderRadius:14, boxShadow:'0 30px 60px -24px rgba(15,15,18,.18)', overflow:'hidden', fontFamily:SANS }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 32px', borderBottom:`1px solid ${C.line}` }}>
          <div style={{ width:18, height:18, borderRadius:4, background:C.purple, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:6, height:6, background:C.paper, borderRadius:1 }}/>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>FlowLedger · Recent settlements</div>
          <div style={{ flex:1 }}/>
          <div style={{ fontFamily:MONO, fontSize:10, color:C.inkMuted, letterSpacing:'0.1em', textTransform:'uppercase' }}>Canton Network</div>
        </div>
        <div style={{ position:'relative', height:56*rows.length }}>
          {rows.map((r,i) => <LedgerRow key={i} y={i*56} hash={r.hash} amountVisible={i===0} delay={i*0.08} t={localTime}/>)}
        </div>
      </div>
      <div style={{ position:'absolute', left:'50%', bottom:90, transform:`translate(-50%,${(1-headlineT)*12}px)`, opacity:headlineT, textAlign:'center', fontFamily:SANS }}>
        <div style={{ fontSize:32, fontWeight:600, color:C.ink, letterSpacing:'-0.025em' }}>
          Private. <span style={{ color:C.purple }}>Proven.</span>
        </div>
      </div>
    </>
  )
}

// ── Loop cross-fade overlay ───────────────────────────────────────────────────
function LoopFade({ duration }: { duration:number }) {
  const t = useTime()
  const fadeOut = clamp((t-(duration-1.2))/1.2, 0, 1)
  const fadeIn  = 1-clamp(t/0.6, 0, 1)
  const opacity = Math.max(fadeOut, fadeIn)
  return <div style={{ position:'absolute', inset:0, background:C.bg, opacity, pointerEvents:'none' }}/>
}

// ── Main exported component ───────────────────────────────────────────────────
const DURATION = 22

export function IntroAnimation({ onComplete, onSkip }: { onComplete:()=>void; onSkip:()=>void }) {
  const [time, setTime] = useState(0)
  const [scale, setScale] = useState(1)
  const stageRef  = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const rafRef    = useRef<number>(0)
  const lastTsRef = useRef<number|null>(null)
  const doneRef   = useRef(false)

  // Responsive scale to fit viewport
  useEffect(() => {
    const W=1920, H=1080
    const measure = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setScale(Math.min(vw/W, vh/H))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Animation loop — plays once then calls onComplete
  useEffect(() => {
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setTime(prev => {
        const next = prev + dt
        if (next >= DURATION && !doneRef.current) {
          doneRef.current = true
          // defer so state update completes first
          setTimeout(onComplete, 100)
          return DURATION
        }
        return Math.min(next, DURATION)
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(rafRef.current); lastTsRef.current = null }
  }, [onComplete])

  const ctx = useMemo(() => ({ time, duration: DURATION }), [time])

  return (
    <div ref={stageRef} style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      {/* Scaled 1920×1080 stage */}
      <div ref={canvasRef} style={{ width:1920, height:1080, background:C.bg, position:'relative', transform:`scale(${scale})`, transformOrigin:'center', flexShrink:0, overflow:'hidden' }}>
        <TLContext.Provider value={ctx}>
          <GridBackground/>

          <Sprite start={0.0} end={3.4}><Scene1_Invoice/></Sprite>
          <Sprite start={3.0} end={7.4}><Scene2_Counterparties/></Sprite>
          <Sprite start={7.0} end={12.4}><Scene3_Curtain/></Sprite>
          <Sprite start={12.0} end={16.8}><Scene4_Proof/></Sprite>
          <Sprite start={16.4} end={22.0}><Scene5_Ledger/></Sprite>

          <LoopFade duration={DURATION}/>
        </TLContext.Provider>
      </div>

      {/* Skip button — always accessible, positioned relative to viewport */}
      <button
        onClick={onSkip}
        style={{
          position:'fixed', top:24, right:28,
          background:'rgba(15,15,18,0.55)',
          backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          border:'1px solid rgba(255,255,255,0.12)',
          color:'rgba(255,255,255,0.75)',
          borderRadius:6,
          padding:'8px 16px',
          fontSize:12,
          fontFamily:MONO,
          letterSpacing:'0.06em',
          cursor:'pointer',
          zIndex:100,
          transition:'background 150ms,color 150ms',
        }}
        onMouseEnter={e => { (e.target as HTMLButtonElement).style.background='rgba(15,15,18,0.85)'; (e.target as HTMLButtonElement).style.color='#fff' }}
        onMouseLeave={e => { (e.target as HTMLButtonElement).style.background='rgba(15,15,18,0.55)'; (e.target as HTMLButtonElement).style.color='rgba(255,255,255,0.75)' }}
      >
        Skip →
      </button>

      {/* Progress bar at bottom */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.08)', zIndex:100 }}>
        <div style={{ height:'100%', width:`${(time/DURATION)*100}%`, background:C.purple, transition:'width 100ms linear' }}/>
      </div>
    </div>
  )
}
