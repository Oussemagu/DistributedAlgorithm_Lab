import React, { useState } from 'react'
import { useSim } from '../state/SimProvider'
import type { SKSnapshot } from '../algorithms/suzukiKasamiCinema'
import type { MessageStep, AlgorithmStep, NodeStateStep, CinemaNodeState } from '../model/algorithmCinema'

// ─── Couleurs des messages ────────────────────────────────────────────────────
function colorFor(m: MessageStep) {
  const t = String(m.msgType || '').toUpperCase()
  if (t.includes('SK_TOKEN'))   return '#f59e0b'
  if (t.includes('SK_REQUEST')) return '#ef4444'
  if (t.includes('VC'))         return '#1971c2'
  if (t.includes('HM'))         return m.meta?.rejected ? '#e03131' : '#6741d9'
  if (t.includes('REQUEST'))    return '#dc2626'
  if (t.includes('REPLY'))      return '#16a34a'
  if (t.includes('ELECTION'))   return '#ea580c'
  if (t.includes('OK'))         return '#15803d'
  if (t.includes('COORD'))      return '#7c3aed'
  if (t.includes('TOKEN'))      return '#d97706'
  return '#64748b'
}

// ─── Courbe de Bezier quadratique ────────────────────────────────────────────
function getCurve(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  progress: number,
  curveOffset = 50
) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const R = 32

  const P0 = { x: p1.x + (dx / len) * R,        y: p1.y + (dy / len) * R }
  const P2 = { x: p1.x + (dx / len) * (len - R), y: p1.y + (dy / len) * (len - R) }

  const ldx = P2.x - P0.x
  const ldy = P2.y - P0.y
  const cl  = Math.max(1, Math.sqrt(ldx * ldx + ldy * ldy))
  const nx  = -ldy / cl
  const ny  =  ldx / cl
  const P1  = { x: (P0.x + P2.x) / 2 + nx * curveOffset, y: (P0.y + P2.y) / 2 + ny * curveOffset }

  if (progress >= 1) {
    const midX = 0.25 * P0.x + 0.5 * P1.x + 0.25 * P2.x
    const midY = 0.25 * P0.y + 0.5 * P1.y + 0.25 * P2.y
    return { path: `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`, midX, midY, head: P2 }
  }

  const A = { x: (1 - progress) * P0.x + progress * P1.x, y: (1 - progress) * P0.y + progress * P1.y }
  const B = { x: (1 - progress) * P1.x + progress * P2.x, y: (1 - progress) * P1.y + progress * P2.y }
  const C = { x: (1 - progress) * A.x  + progress * B.x,  y: (1 - progress) * A.y  + progress * B.y  }

  return { path: `M ${P0.x} ${P0.y} Q ${A.x} ${A.y} ${C.x} ${C.y}`, head: C, midX: undefined, midY: undefined }
}

function deriveNodes(baseNodes: CinemaNodeState[], steps: AlgorithmStep[], index: number) {
  const nodes = baseNodes.map((node) => ({
    ...node,
    badges: { ...(node.badges || {}) },
  }))

  steps.slice(0, index).forEach((step) => {
    if (step.type !== 'node') return
    const nodeIndex = nodes.findIndex((node) => node.id === step.nodeId)
    if (nodeIndex === -1) return
    nodes[nodeIndex] = {
      ...nodes[nodeIndex],
      ...step.state,
      badges: { ...(nodes[nodeIndex].badges || {}), ...(step.state.badges || {}) },
    }
  })

  return nodes
}

function latestNarration(steps: AlgorithmStep[], index: number) {
  for (let i = Math.min(index - 1, steps.length - 1); i >= 0; i -= 1) {
    const step = steps[i]
    if (step.type === 'narration') return step.text
  }
  return ''
}

function isMatchingMessage(a: MessageStep, b: MessageStep) {
  const aKey = a.meta?.messageKey
  const bKey = b.meta?.messageKey
  if (aKey || bKey) {
    const aRejected = Boolean(a.meta?.rejected)
    const bRejected = Boolean(b.meta?.rejected)
    return aKey === bKey && aRejected === bRejected
  }
  return a.from === b.from && a.to === b.to && String(a.msgType) === String(b.msgType)
}

// ─── Tableau RN[i] ────────────────────────────────────────────────────────────
function SVGRNTable({
  x, y, processId, rnRow, processes, highlight,
}: {
  x: number; y: number; processId: number
  rnRow: number[]; processes: number[]
  highlight?: { j: number }
}) {
  const cellW = 30
  const cellH = 26
  const N = processes.length
  const totalW = N * cellW + 20
  const labelH = 18

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={0} width={totalW} height={cellH + labelH + 22} rx={7}
        fill="#1e293b" stroke="#6d28d9" strokeWidth={2} />
      <text x={totalW / 2} y={13} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#a78bfa">
        RN{processId}[{N}]
      </text>
      {processes.map((p, j) => (
        <text key={j} x={10 + j * cellW + cellW / 2} y={26}
          textAnchor="middle" fontSize={9} fill="#94a3b8">P{p}</text>
      ))}
      {rnRow.map((val, j) => {
        const isHL = highlight?.j === j
        return (
          <g key={j}>
            <rect x={10 + j * cellW} y={29} width={cellW - 3} height={cellH}
              fill={isHL ? '#fbbf24' : val > 0 ? '#14532d' : '#0f172a'}
              stroke={isHL ? '#fbbf24' : val > 0 ? '#22c55e' : '#334155'}
              strokeWidth={isHL ? 2.5 : 1} rx={4}
            />
            <text x={10 + j * cellW + (cellW - 3) / 2} y={29 + cellH / 2 + 4.5}
              textAnchor="middle" fontSize={14} fontWeight="bold"
              fill={isHL ? '#000' : val > 0 ? '#4ade80' : '#475569'}>
              {val}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Panneau TOKEN : LN + Q clairement séparés ───────────────────────────────
function SVGTokenPanel({
  x, y, LN, Q, processes, highlight,
}: {
  x: number; y: number
  LN: number[]; Q: number[]; processes: number[]
  highlight?: number
}) {
  const N = processes.length
  const cellW = 30
  const cellH = 26
  const panelW = Math.max(150, N * cellW + 36)
  const panelH = 140

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Fond */}
      <rect x={0} y={0} width={panelW} height={panelH} rx={10}
        fill="#1a1200" stroke="#f59e0b" strokeWidth={2.5} />

      {/* Header TOKEN */}
      <rect x={0} y={0} width={panelW} height={24} rx={10} fill="#f59e0b" />
      <rect x={0} y={14} width={panelW} height={10} fill="#f59e0b" />
      <text x={panelW / 2} y={17} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#000">
        🏅 TOKEN
      </text>

      {/* ── Section LN ── */}
      <rect x={6} y={28} width={panelW - 12} height={14} rx={3} fill="#431407" />
      <text x={12} y={39} fontSize={9} fontWeight="bold" fill="#fb923c">
        LN[j] — dernier sn exécuté pour Sj
      </text>
      {processes.map((p, j) => (
        <text key={j} x={10 + j * cellW + (cellW - 3) / 2} y={57}
          textAnchor="middle" fontSize={9} fill="#94a3b8">P{p}</text>
      ))}
      {LN.map((val, j) => {
        const isHL = highlight === j
        return (
          <g key={j}>
            <rect x={10 + j * cellW} y={60} width={cellW - 3} height={cellH}
              fill={isHL ? '#fbbf24' : val > 0 ? '#431407' : '#1e293b'}
              stroke={isHL ? '#fbbf24' : val > 0 ? '#ea580c' : '#334155'}
              strokeWidth={isHL ? 2.5 : 1} rx={4} />
            <text x={10 + j * cellW + (cellW - 3) / 2} y={60 + cellH / 2 + 4.5}
              textAnchor="middle" fontSize={14} fontWeight="bold"
              fill={isHL ? '#000' : val > 0 ? '#fb923c' : '#475569'}>
              {val}
            </text>
          </g>
        )
      })}

      {/* Séparateur */}
      <line x1={8} y1={93} x2={panelW - 8} y2={93} stroke="#334155" strokeWidth={1} />

      {/* ── Section Q ── */}
      <rect x={6} y={96} width={panelW - 12} height={14} rx={3} fill="#1e1b4b" />
      <text x={12} y={107} fontSize={9} fontWeight="bold" fill="#a78bfa">
        Q — file d'attente du token
      </text>
      {Q.length === 0 ? (
        <g>
          <rect x={10} y={114} width={56} height={cellH} fill="#1e293b" stroke="#334155" rx={4} />
          <text x={38} y={114 + cellH / 2 + 4.5} textAnchor="middle" fontSize={11} fill="#475569">∅ vide</text>
        </g>
      ) : Q.map((p, i) => (
        <g key={i}>
          <rect x={10 + i * (cellW + 4)} y={114} width={cellW} height={cellH}
            fill="#2e1065" stroke="#a855f7" strokeWidth={2} rx={4} />
          <text x={10 + i * (cellW + 4) + cellW / 2} y={114 + cellH / 2 + 4.5}
            textAnchor="middle" fontSize={12} fontWeight="bold" fill="#c084fc">
            P{p}
          </text>
        </g>
      ))}
    </g>
  )
}

// ─── Explication pédagogique ──────────────────────────────────────────────────
function ExplanationPanel({
  x, y, width, text, phase,
}: { x: number; y: number; width: number; text: string; phase: string }) {
  const PHASE_COLOR: Record<string, string> = {
    INIT:            '#60a5fa',
    REQUEST_INIT:    '#34d399',
    REQUEST_SENT:    '#34d399',
    BROADCAST:       '#fb923c',
    RECEIVE_REQUEST: '#a78bfa',
    SEND_TOKEN:      '#fbbf24',
    RECEIVE_TOKEN:   '#fbbf24',
    ENTER_CS:        '#f87171',
    IN_CS:           '#ef4444',
    EXIT_CS:         '#4ade80',
    BUILD_QUEUE:     '#c084fc',
    PASS_TOKEN:      '#fbbf24',
    DONE:            '#34d399',
  }
  const color = PHASE_COLOR[phase] || '#94a3b8'

  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    if (rawLine.length <= 100) { lines.push(rawLine); continue }
    const words = rawLine.split(' ')
    let cur = ''
    for (const w of words) {
      if ((cur + ' ' + w).length > 100) { lines.push(cur); cur = w }
      else cur = cur ? cur + ' ' + w : w
    }
    if (cur) lines.push(cur)
  }
  const displayLines = lines.slice(0, 6)
  const boxH = 28 + displayLines.length * 14

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={0} width={width} height={boxH} rx={8}
        fill="#0f2040" stroke={color} strokeWidth={2} opacity={0.97} />
      <rect x={0} y={0} width={9} height={boxH} fill={color} rx={4} />
      <rect x={16} y={5} width={Math.max(90, phase.replace(/_/g,' ').length * 7.5)} height={16} rx={4}
        fill={color + '30'} stroke={color} strokeWidth={1} />
      <text x={22} y={17} fontSize={10} fontWeight="bold" fill={color}>
        📍 {phase.replace(/_/g, ' ')}
      </text>
      {displayLines.map((line, i) => (
        <text key={i} x={18} y={30 + i * 14} fontSize={10} fill="#e2e8f0">{line}</text>
      ))}
    </g>
  )
}

// ─── Badge 🔑 animé, bien écarté du nœud ─────────────────────────────────────
function TokenBadge({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx={0} cy={0} r={16} fill="none" stroke="#fbbf24" strokeWidth={2} opacity={0.6}>
        <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.05;0.6" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={0} cy={0} r={13} fill="#78350f" stroke="#f59e0b" strokeWidth={2.5} />
      <text x={0} y={5} textAnchor="middle" fontSize={13}>🔑</text>
    </g>
  )
}

// ─── Éditeur d'état manuel ────────────────────────────────────────────────────
function StateEditor({
  snap, onClose, onApply,
}: {
  snap: SKSnapshot
  onClose: () => void
  onApply: (newSnap: SKSnapshot) => void
}) {
  const [rnValues, setRnValues] = useState(snap.RN.map(row => [...row]))
  const [lnValues, setLnValues] = useState([...snap.LN])
  const [qValue,   setQValue]   = useState(snap.Q.join(','))
  const [tokenH,   setTokenH]   = useState(snap.tokenHolder)

  const handleApply = () => {
    const newQ = qValue.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    onApply({ ...snap, RN: rnValues.map(r => [...r]), LN: [...lnValues], Q: newQ, tokenHolder: tokenH })
    onClose()
  }

  const cellStyle: React.CSSProperties = {
    width: 44, height: 32, textAlign: 'center', fontSize: 14, fontWeight: 'bold',
    background: '#1e293b', color: '#4ade80', border: '1px solid #334155',
    borderRadius: 4, margin: 2,
  }
  const sectionStyle: React.CSSProperties = {
    marginBottom: 14, padding: '10px 14px', borderRadius: 8,
    background: '#0f172a', border: '1px solid #1e293b',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6,
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5,10,30,0.93)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#0d1b2a', border: '2px solid #3b82f6', borderRadius: 14,
        padding: 24, minWidth: 420, maxWidth: 580, color: '#e2e8f0',
        boxShadow: '0 8px 40px #000a', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#60a5fa' }}>✏️ Édition manuelle de l'état</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #374151', color: '#94a3b8',
            borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: 13,
          }}>✕</button>
        </div>

        {/* Token Holder */}
        <div style={sectionStyle}>
          <div style={labelStyle}>🔑 Token Holder — processus qui possède le token</div>
          <select value={tokenH} onChange={e => setTokenH(Number(e.target.value))}
            style={{ background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b',
              borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>
            {snap.processes.map(p => <option key={p} value={p}>P{p}</option>)}
          </select>
        </div>

        {/* RN */}
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, color: '#a78bfa' }}>
            RN[i][j] — plus grand sn reçu par Si de Sj
          </div>
          {snap.processes.map((pi, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: '#a78bfa', fontWeight: 700, minWidth: 50, fontSize: 12 }}>RN{pi}:</span>
              {snap.processes.map((pj, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#64748b', marginBottom: 1 }}>P{pj}</span>
                  <input type="number" min={0} max={99}
                    value={rnValues[i][j]}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0
                      setRnValues(prev => { const n = prev.map(r => [...r]); n[i][j] = v; return n })
                    }}
                    style={cellStyle}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* LN */}
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, color: '#fb923c' }}>
            LN[j] — dernier sn exécuté pour Sj (stocké dans le token)
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {snap.processes.map((pj, j) => (
              <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#64748b', marginBottom: 1 }}>P{pj}</span>
                <input type="number" min={0} max={99}
                  value={lnValues[j]}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 0
                    setLnValues(prev => { const n = [...prev]; n[j] = v; return n })
                  }}
                  style={{ ...cellStyle, color: '#fb923c' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Q */}
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, color: '#c084fc' }}>
            Q — file d'attente (IDs séparés par virgules, ex: 2,3)
          </div>
          <input type="text" value={qValue} onChange={e => setQValue(e.target.value)}
            placeholder="ex: 2,3  ou laisser vide"
            style={{
              width: '100%', background: '#1e293b', color: '#c084fc',
              border: '1px solid #7c3aed', borderRadius: 6, padding: '6px 10px', fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Vide = Q est ∅</div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
            borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13,
          }}>Annuler</button>
          <button onClick={handleApply} style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>✅ Appliquer</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NetworkCanvas
// ═══════════════════════════════════════════════════════════════════════════════
function NetworkCanvas() {
  const { state } = useSim()
  const isSuzuki = state.algorithm === 'suzuki'

  const [manualSnap, setManualSnap] = useState<SKSnapshot | null>(null)

  const svgW = 960
  const svgH = isSuzuki ? 720 : 500
  const netCX = svgW / 2
  const netCY = isSuzuki ? 265 : svgH / 2
  const radius = isSuzuki ? 165 : Math.min(svgW, svgH) / 2 - 60

  const nodes = deriveNodes(state.processes, state.steps, state.index)
  const steps = state.steps
  const idx   = state.index

  const positions = new Map<number, { x: number; y: number }>()
  nodes.forEach((n, i) => {
    const angle = (i * 2 * Math.PI) / Math.max(1, nodes.length) - Math.PI / 2
    positions.set(n.id, { x: netCX + radius * Math.cos(angle), y: netCY + radius * Math.sin(angle) })
  })

  // Snapshot courant
  let autoSnap: SKSnapshot | null = null
  let narText  = ''
  let narPhase = 'INIT'

  for (let i = idx - 1; i >= 0; i--) {
    const s = steps[i] as any
    if (s?.meta?.snapshot) { autoSnap = s.meta.snapshot; break }
  }
  if (!autoSnap && steps.length > 0) {
    const s = steps[0] as any
    if (s?.meta?.snapshot) autoSnap = s.meta.snapshot
  }

  const snap = manualSnap ?? autoSnap
  const tokenHolderId = snap?.tokenHolder ?? nodes[0]?.id

  const curStep = steps[idx - 1] as any
  if (curStep?.type === 'narration') {
    narText  = curStep.text || ''
    narPhase = curStep.meta?.snapshot?.phase || 'INIT'
  }

  // Paires send/deliver
  const messages: Array<{ stepIndex: number; m: MessageStep }> = []
  steps.forEach((s, i) => { if ((s as any).type === 'message') messages.push({ stepIndex: i, m: s as MessageStep }) })

  const pairs: Array<{ sendIndex: number; deliverIndex: number; send: MessageStep }> = []
  const used = new Set<number>()
  for (let i = 0; i < messages.length; i++) {
    if (used.has(i)) continue
    const { stepIndex: sIdx, m } = messages[i]
    let found = -1
    for (let j = i + 1; j < messages.length; j++) {
      if (used.has(j)) continue
      const mj = messages[j].m
      if (isMatchingMessage(m, mj)) {
        found = j
        break
      }
    }
    if (found !== -1) { pairs.push({ sendIndex: sIdx, deliverIndex: messages[found].stepIndex, send: m }); used.add(i); used.add(found) }
    else { pairs.push({ sendIndex: sIdx, deliverIndex: sIdx + 1, send: m }); used.add(i) }
  }

  const BG = '#ffff'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bouton Reset pour état manuel */}
      {manualSnap && (
        <button onClick={() => setManualSnap(null)} style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          background: '#1a0a0a', color: '#ef4444', border: '1.5px solid #ef4444',
          borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
        }}>🔄 Reset</button>
      )}

      <svg width={svgW} height={svgH} style={{ background: BG, display: 'block' }}>
        <defs>
          {[
            { id: 'arr-gold',   color: '#f59e0b' },
            { id: 'arr-red',    color: '#ef4444' },
            { id: 'arr-blue',   color: '#3b82f6' },
            { id: 'arr-green',  color: '#22c55e' },
            { id: 'arr-purple', color: '#a855f7' },
            { id: 'arr-gray',   color: '#64748b' },
          ].map(({ id, color }) => (
            <marker key={id} id={id} viewBox="0 -5 10 10" refX="8" refY="0"
              markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,-5L10,0L0,5" fill={color} />
            </marker>
          ))}
          <linearGradient id="tokenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="glowGold">
            <feGaussianBlur stdDeviation="7" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glowBlue">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glowRed">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Grille subtile */}
        {isSuzuki && (
          <g opacity={0.035}>
            {Array.from({ length: 20 }, (_, i) => (
              <line key={`gv${i}`} x1={i * 50} y1={0} x2={i * 50} y2={svgH} stroke="#60a5fa" strokeWidth={1} />
            ))}
            {Array.from({ length: 15 }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={i * 50} x2={svgW} y2={i * 50} stroke="#60a5fa" strokeWidth={1} />
            ))}
          </g>
        )}

        {/* Connexions fond */}
        <g opacity={0.2}>
          {nodes.map((n1, i) => nodes.map((n2, j) => {
            if (j <= i) return null
            const p1 = positions.get(n1.id), p2 = positions.get(n2.id)
            if (!p1 || !p2) return null
            return <line key={`bg-${i}-${j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 6" />
          }))}
        </g>

        {/* ═══ MESSAGES ═══ */}
        <g>
          {pairs.map((pair, pairIdx) => {
            const { sendIndex, deliverIndex, send } = pair
            if (sendIndex >= idx) return null
            const p1 = positions.get(send.from), p2 = positions.get(send.to)
            if (!p1 || !p2) return null

            const color   = colorFor(send)
            const msgType = String(send.msgType).toUpperCase()
            const isToken   = msgType.includes('SK_TOKEN')
            const isRequest = msgType.includes('SK_REQUEST')
            const meta      = (send as any).meta
            const seqNum    = meta?.seqNum

            let marker = 'arr-gray'
            if (isToken)        marker = 'arr-gold'
            else if (isRequest) marker = 'arr-red'

            const msgLabel = isSuzuki
              ? (isToken ? '📦 TOKEN' : seqNum !== undefined ? `REQUEST(${send.from}, ${seqNum})` : send.msgType)
              : send.msgType
            const lw = Math.max(70, msgLabel.length * 7)

            if (deliverIndex <= idx) {
              const curve = getCurve(p1, p2, 1, 60)
              return (
                <g key={`del-${pairIdx}`}>
                  <path d={curve.path}
                    stroke={isToken ? 'url(#tokenGrad)' : color}
                    strokeWidth={isToken ? 3 : 2}
                    fill="none" opacity={0.75}
                    markerEnd={`url(#${marker})`}
                    filter={isToken ? 'url(#glowGold)' : isRequest ? 'url(#glowRed)' : undefined}
                  />
                  {curve.midX !== undefined && (
                    <g>
                      {/* Fond bleu ardoise lisible */}
                      <rect x={(curve.midX ?? 0) - lw / 2 - 3} y={(curve.midY ?? 0) - 13}
                        width={lw + 6} height={19} rx={5}
                        fill="#1e3a5f" stroke={color} strokeWidth={1.5} />
                      <text x={curve.midX} y={(curve.midY ?? 0) + 3}
                        fontSize={10} textAnchor="middle"
                        fill={isToken ? '#fbbf24' : '#f1f5f9'} fontWeight="bold">
                        {msgLabel}
                      </text>
                    </g>
                  )}
                </g>
              )
            } else {
              const progress = Math.max(0, Math.min(0.95, (idx - sendIndex) / Math.max(1, deliverIndex - sendIndex)))
              const curve = getCurve(p1, p2, progress, 60)
              const hx = curve.head.x, hy = curve.head.y
              return (
                <g key={`fly-${pairIdx}`}>
                  <path d={curve.path}
                    stroke={isToken ? 'url(#tokenGrad)' : color}
                    strokeWidth={isToken ? 4 : 2.5}
                    fill="none" strokeDasharray="7 4"
                    markerEnd={`url(#${marker})`}
                    filter={isToken ? 'url(#glowGold)' : isRequest ? 'url(#glowRed)' : undefined}
                  />
                  <circle cx={hx} cy={hy} r={isToken ? 10 : 7}
                    fill={isToken ? 'url(#tokenGrad)' : color}
                    filter={isToken ? 'url(#glowGold)' : undefined}
                  />
                  {/* Label sur fond bleu ardoise bien lisible */}
                  <rect x={hx - lw / 2 - 3} y={hy - 30} width={lw + 6} height={19} rx={5}
                    fill="#1e3a5f" stroke={color} strokeWidth={1.5} />
                  <text x={hx} y={hy - 15}
                    fontSize={10} textAnchor="middle"
                    fill={isToken ? '#fbbf24' : '#f1f5f9'} fontWeight="bold">
                    {msgLabel}
                  </text>
                </g>
              )
            }
          })}
        </g>

        {/* ═══ TABLEAUX RN ═══ */}
        {isSuzuki && nodes.map((n, ni) => {
          const pos = positions.get(n.id)
          if (!pos) return null
          const rnRow = snap?.RN?.[ni] ?? new Array(nodes.length).fill(0)
          const procs = snap?.processes ?? nodes.map(nn => nn.id)
          const N = nodes.length
          const angle = (ni * 2 * Math.PI) / Math.max(1, N) - Math.PI / 2
          const dist  = radius + 92
          const rawX  = netCX + dist * Math.cos(angle)
          const rawY  = netCY + dist * Math.sin(angle)
          const tableW = N * 30 + 20
          const tx = rawX - tableW / 2
          const ty = rawY - 35
          const hlJ = (snap?.highlight?.rnCell?.i === ni) ? snap?.highlight?.rnCell?.j : undefined

          return (
            <SVGRNTable
              key={`rn-${n.id}`}
              x={tx} y={ty}
              processId={n.id}
              rnRow={rnRow}
              processes={procs}
              highlight={hlJ !== undefined ? { j: hlJ } : undefined}
            />
          )
        })}

        {/* ═══ NOEUDS ═══ */}
        <g>
          {nodes.map(n => {
            const pos = positions.get(n.id)
            if (!pos) return null
            const hasToken = (snap ? snap.tokenHolder === n.id : n.id === tokenHolderId)
                          || n.badges?.token === '🔑'
            const inCS = n.badges?.cs === 'CS'

            let nodeFill    = '#0f2040'
            let nodeStroke  = '#3b82f6'
            let nodeStrokeW = 2.5
            let textColor   = '#e2e8f0'

            if (hasToken && inCS)  { nodeFill = '#7c2d12'; nodeStroke = '#ef4444'; nodeStrokeW = 4; textColor = '#fff' }
            else if (hasToken)     { nodeFill = '#78350f'; nodeStroke = '#f59e0b'; nodeStrokeW = 4; textColor = '#fef3c7' }
            else if (n.color && !['skyblue','#fff','#12122a'].includes(n.color)) { nodeFill = n.color }

            const N    = snap?.processes?.length ?? nodes.length
            const panW = Math.max(150, N * 30 + 36)
            const panH = 140
            // Décalage important : +60px depuis le bord du nœud (r=30)
            const offX = pos.x > netCX ? -(panW + 65) : 65
            const panX = pos.x + offX
            const panY = pos.y - panH / 2

            return (
              <g key={n.id}>
                {/* Panneau TOKEN */}
                {isSuzuki && hasToken && snap && (
                  <SVGTokenPanel
                    x={panX} y={panY}
                    LN={snap.LN} Q={snap.Q}
                    processes={snap.processes}
                    highlight={snap.highlight?.lnCell}
                  />
                )}
                {/* Ligne pointillée panneau → nœud */}
                {isSuzuki && hasToken && snap && (
                  <line
                    x1={pos.x > netCX ? panX + panW : panX}
                    y1={panY + panH / 2}
                    x2={pos.x}
                    y2={pos.y}
                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" opacity={0.35}
                  />
                )}

                {/* Nœud */}
                <g transform={`translate(${pos.x}, ${pos.y})`}>
                  {inCS && <circle r={44} fill="none" stroke="#ef4444" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.6} />}
                  {hasToken && !inCS && (
                    <circle r={40} fill="none" stroke="#f59e0b" strokeWidth={1.5}
                      opacity={0.25} strokeDasharray="5 3" />
                  )}
                  <circle r={30} fill={nodeFill} stroke={nodeStroke} strokeWidth={nodeStrokeW}
                    filter={hasToken ? 'url(#glowGold)' : 'url(#glowBlue)'}
                  />
                  <text y={5} fontSize={14} fontWeight={700} textAnchor="middle" fill={textColor}>
                    {n.label ?? `P${n.id}`}
                  </text>
                  {inCS && (
                    <g>
                      <rect x={-18} y={16} width={36} height={15} rx={4} fill="#ef4444" />
                      <text y={27} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#fff">SC</text>
                    </g>
                  )}
                </g>

                {/* 🔑 Badge bien écarté: décalé de +50px horizontal et -45px vertical */}
                {hasToken && (
                  <TokenBadge x={pos.x + 50} y={pos.y - 45} />
                )}
              </g>
            )
          })}
        </g>

        {/* ═══ LÉGENDE ═══ */}
        {isSuzuki && (
          <g transform="translate(10, 10)">
            <rect x={0} y={0} width={300} height={118} rx={9}
              fill="#0f2040" stroke="#1e3a5f" strokeWidth={1.5} opacity={0.97} />
            <text x={12} y={19} fontSize={12} fontWeight="bold" fill="#93c5fd">
              🎓 Suzuki-Kasami — Structures
            </text>
            {[
              { y: 30, bg: '#1e1b4b', label: 'RN[i][j]', lw: 58, lc: '#a78bfa', desc: '= max sn reçu par Si de Sj' },
              { y: 52, bg: '#1c1003', label: 'LN[j]',    lw: 42, lc: '#fb923c', desc: '= dernier sn exécuté pour Sj (token)' },
              { y: 74, bg: '#1a0033', label: 'Q',         lw: 14, lc: '#c084fc', desc: '= file des sites en attente du token' },
              { y: 96, bg: '#0d1b2a', label: 'REQUEST(i,sn)', lw: 88, lc: '#ef4444', desc: '→ broadcast | TOKEN → unicast' },
            ].map(({ y, bg, label, lw, lc, desc }) => (
              <g key={y}>
                <rect x={10} y={y} width={280} height={19} rx={4} fill={bg} />
                <text x={16} y={y + 13} fontSize={10} fontWeight="bold" fill={lc}>{label}</text>
                <text x={16 + lw + 4} y={y + 13} fontSize={10} fill="#cbd5e1">{desc}</text>
              </g>
            ))}
          </g>
        )}

        {/* ═══ EXPLICATION BAS ═══ */}
        {isSuzuki && narText && (
          <ExplanationPanel
            x={10} y={svgH - 135}
            width={svgW - 20}
            text={narText}
            phase={narPhase}
          />
        )}

        {/* Indicateur état manuel */}
        {manualSnap && (
          <g transform={`translate(${svgW / 2 - 95}, 10)`}>
            <rect x={0} y={0} width={190} height={24} rx={6} fill="#7c2d12" stroke="#ef4444" strokeWidth={1.5} />
            <text x={95} y={16} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#fca5a5">
              ✏️ État modifié manuellement
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

// --- SequenceCanvas -----------------------------------------------------------
function SequenceCanvas() {
  const { state } = useSim()
  const width = 900
  const height = 500
  const leftMargin = 120
  const rightMargin = 20
  const topMargin = 30
  const bottomMargin = 20

  const nodes = deriveNodes(state.processes, state.steps, state.index)
  const steps = state.steps
  const idx = state.index
  const visibleSteps = steps.slice(0, idx)

  const laneHeight = Math.max(40, (height - topMargin - bottomMargin) / Math.max(1, nodes.length))
  const usableWidth = width - leftMargin - rightMargin
  const maxSteps = Math.max(1, steps.length)

  function stepX(stepIndex: number) {
    return leftMargin + (stepIndex / maxSteps) * usableWidth
  }

  function processY(i: number) {
    return topMargin + i * laneHeight + laneHeight / 2
  }

  const messages: Array<{ stepIndex: number; m: MessageStep }> = []
  steps.forEach((s, i) => {
    if ((s as any).type === 'message') messages.push({ stepIndex: i, m: s as MessageStep })
  })

  const pairs: Array<{ sendIndex: number; deliverIndex: number; send: MessageStep; deliver: MessageStep }> = []
  const used = new Set<number>()
  for (let i = 0; i < messages.length; i += 1) {
    if (used.has(i)) continue
    const { stepIndex: sIdx, m } = messages[i]
    let found = -1
    for (let j = i + 1; j < messages.length; j += 1) {
      if (used.has(j)) continue
      const mj = messages[j].m
      if (isMatchingMessage(m, mj)) {
        found = j
        break
      }
    }
    if (found !== -1) {
      pairs.push({ sendIndex: sIdx, deliverIndex: messages[found].stepIndex, send: m, deliver: messages[found].m })
      used.add(i)
      used.add(found)
    } else {
      pairs.push({ sendIndex: sIdx, deliverIndex: sIdx + 1, send: m, deliver: m })
      used.add(i)
    }
  }

  const visibleNodeSteps: Array<{ stepIndex: number; step: Extract<AlgorithmStep, { type: 'node' }> }> = []
  visibleSteps.forEach((step, stepIndex) => {
    if (step.type === 'node' && step.state.badges?.event && step.state.badges.event !== 'init') {
      visibleNodeSteps.push({ stepIndex, step })
    }
  })

  const narration = latestNarration(steps, idx)

  function messageStartIndex(sendIndex: number, send: MessageStep) {
    if (!send.meta?.messageKey) return sendIndex

    for (let i = sendIndex - 1; i >= 0; i -= 1) {
      const step = steps[i]
      if (
        step.type === 'node' &&
        step.nodeId === send.from &&
        step.state.badges?.kind === 'send' &&
        step.state.badges?.event === send.meta.event
      ) {
        return i
      }
    }

    return sendIndex
  }

  function messageEndIndex(deliverIndex: number, send: MessageStep) {
    if (!send.meta?.messageKey) return deliverIndex

    if (send.meta?.rejected) {
      for (let i = deliverIndex + 1; i < steps.length; i += 1) {
        const step = steps[i]
        if (step.type === 'narration') break
        if (step.type === 'node' && step.nodeId === send.to && step.state.badges?.kind === 'reject' && step.state.badges?.rejected) {
          return i
        }
      }
      return deliverIndex
    }

    for (let i = deliverIndex + 1; i < steps.length; i += 1) {
      const step = steps[i]
      if (step.type === 'narration') break
      if (step.type === 'node' && step.nodeId === send.to && step.state.badges?.kind === 'receive') {
        return i
      }
    }

    return deliverIndex
  }
  const nodeStates = React.useMemo(() => {
  const map = new Map<number, Partial<CinemaNodeState>>()
  state.processes.forEach((p) => map.set(p.id, { ...p }))
  steps.slice(0, idx).forEach((s) => {
    if ((s as any).type === 'node') {
      const ns = s as NodeStateStep
      const prev = map.get(ns.nodeId) || {}
      map.set(ns.nodeId, { ...prev, ...ns.state })
    }
  })
  return map
}, [state.processes, steps, idx])
const csSegments = React.useMemo(() => {
  const segments: Array<{ nodeId: number; enterIdx: number; leaveIdx: number }> = []
  const enterMap = new Map<number, number>()
  steps.forEach((s, i) => {
    if ((s as any).type === 'cs') {
      const cs = s as any
      if (cs.action === 'enter') {
        // ✅ utiliser le step PRÉCÉDENT comme point de départ du segment
        const prevIdx = i > 0 ? i - 1 : i
        enterMap.set(cs.nodeId, prevIdx)
      } else if (cs.action === 'leave') {
        const enterIdx = enterMap.get(cs.nodeId)
        if (enterIdx !== undefined) {
          // ✅ utiliser le step PRÉCÉDENT comme point de fin du segment
          const leaveIdx = i > 0 ? i - 1 : i
          segments.push({ nodeId: cs.nodeId, enterIdx, leaveIdx })
          enterMap.delete(cs.nodeId)
        }
      }
    }
  })
  return segments
}, [steps])
  return (
    <svg width={width} height={height} style={{ background: '#fff' }}>
      <defs>
        <marker id="arrow" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,-5L10,0L0,5" fill="#000" />
        </marker>
        <marker id="arrow-red" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,-5L10,0L0,5" fill="#e03131" />
        </marker>
      </defs>

      <g>
        <line x1={leftMargin} y1={topMargin - 10} x2={width - rightMargin} y2={topMargin - 10} stroke="#ddd" />
        {Array.from({ length: Math.min(20, maxSteps) }).map((_, i) => {
          const sx = leftMargin + (i / Math.min(20, maxSteps)) * usableWidth
          return <line key={i} x1={sx} y1={topMargin - 14} x2={sx} y2={topMargin - 6} stroke="#ccc" />
        })}
        <text x={leftMargin} y={topMargin - 18} fontSize={12} fontWeight={600}>Time / Steps</text>
      </g>

      <g>
        {nodes.map((n, i) => {
          const y = processY(i)
          const matrixRows = Array.isArray(n.badges?.matrixRows) ? n.badges.matrixRows as string[] : []
          return (
            <g key={n.id}>
              <text x={10} y={y + 5} fontSize={13} fontWeight={600}>
                {n.label ?? `P${n.id}`}
                {n.badges?.token === '??' && <tspan dx={4}>??</tspan>}
              </text>
              {n.badges?.vector && <text x={62} y={y + 5} fontSize={11} fill="#555">{String(n.badges.vector)}</text>}
              {matrixRows.length > 0 && (
                <g>
                  {matrixRows.map((row, rowIndex) => (
                    <text key={rowIndex} x={62} y={y - 12 + rowIndex * 11} fontSize={10} fontFamily="monospace" fill="#555">
                      {row}
                    </text>
                  ))}
                </g>
              )}
              <line x1={leftMargin} y1={y} x2={width - rightMargin} y2={y} stroke="#e6e6e6" strokeWidth={2} />
                        {/* Clock badge */}
{nodeStates.get(n.id)?.clock !== undefined &&  state.algorithm === 'ricart' &&(
  <g>
    <rect x={leftMargin + 4} y={y - 10} rx={3} width={36} height={20} fill="#f0f0ff" stroke="#8888cc" strokeWidth={1} />
    <text x={leftMargin + 22} y={y + 5} fontSize={11} textAnchor="middle" fill="#333">
      C={nodeStates.get(n.id)?.clock}
    </text>
  </g>
)}
              {/* CS indicator */}
              {nodeStates.get(n.id)?.color === 'orange' && (
                <rect x={width - rightMargin - 60} y={y - 12} rx={4} width={48} height={24} fill="orange" stroke="#b85" />
              )}
            </g>
          )
        })}
      </g>
        {/* ✅ Segments SC — rectangle rouge sur la lane du process en SC */}
<g>
  {csSegments.map((seg) => {
    if (seg.enterIdx >= idx) return null
    const nodeIndex = nodes.findIndex((n) => n.id === seg.nodeId)
    if (nodeIndex === -1) return null
    const y = processY(nodeIndex)
    const xStart = stepX(seg.enterIdx)
    const xEnd = seg.leaveIdx <= idx ? stepX(seg.leaveIdx) : stepX(idx)
    return (
      <g key={`cs-${seg.nodeId}-${seg.enterIdx}`}>
  <rect
    x={xStart}
    y={y - 6}
    width={Math.max(4, xEnd - xStart)}
    height={12}
    fill="red"
    opacity={0.35}
    rx={3}
  />
  <text
    x={xStart + Math.max(4, xEnd - xStart) / 2}
    y={y - 10}
    fontSize={10}
    textAnchor="middle"
    fill="red"
    fontWeight={600}
  >
    SC
  </text>
</g>
    )
  })}
</g>
 {/* ═══ EVENT DOTS (vector/matrix clock labels) ═══ */}      
  {/* <g>
      {visibleNodeSteps.map(({ stepIndex, step }) => {
        const nodeIndex = nodes.findIndex((node) => node.id === step.nodeId)
        if (nodeIndex === -1) return null
        const x = stepX(stepIndex)
        const y = processY(nodeIndex)
        const kind = String(step.state.badges?.kind || '')
        const color = kind === 'receive' ? '#2f9e44' : kind === 'send' ? '#1971c2' : '#868e96'
        const vector = String(step.state.badges?.vector || '')
        const event = String(step.state.badges?.event || '')
        return (
          <g key={step.id}>
            <circle cx={x} cy={y} r={5} fill={color} stroke="#fff" strokeWidth={2} />
            <text x={x} y={y - 10} fontSize={10} textAnchor="middle" fill="#222" fontWeight={700}>{event}</text>
            // only show vector for vector/matrix algorithms 
            {(state.algorithm === 'vector' || state.algorithm === 'matrix') && (
              <text x={x} y={y + 20} fontSize={10} textAnchor="middle" fill={color}>{vector}</text>
            )}
          </g>
        )
      })}
    </g>*/}
    <g>
  {visibleNodeSteps.map(({ stepIndex, step }) => {
    const nodeIndex = nodes.findIndex((node) => node.id === step.nodeId)
    if (nodeIndex === -1) return null
    const x = stepX(stepIndex)
    const y = processY(nodeIndex)
    const kind = String(step.state.badges?.kind || '')
    const color = kind === 'receive' ? '#2f9e44' : kind === 'send' ? '#1971c2' : '#868e96'
    const vector = String(step.state.badges?.vector || '')
    const event = String(step.state.badges?.event || '')
    const rejected = Boolean(step.state.badges?.rejected)
    const matrixRows = Array.isArray(step.state.badges?.matrixRows)
      ? step.state.badges.matrixRows as string[]
      : []
    return (
      <g key={step.id}>
        <circle cx={x} cy={y} r={5} fill={rejected ? '#e03131' : color} stroke="#fff" strokeWidth={2} />
        {rejected && (
          <g stroke="#e03131" strokeWidth={3} strokeLinecap="round">
            <line x1={x - 9} y1={y - 9} x2={x + 9} y2={y + 9} />
            <line x1={x + 9} y1={y - 9} x2={x - 9} y2={y + 9} />
          </g>
        )}
        <text x={x} y={y - 10} fontSize={10} textAnchor="middle" fill="#222" fontWeight={700}>{event}</text>
        {state.algorithm === 'vector' && vector && (
          <text x={x} y={y + 20} fontSize={10} textAnchor="middle" fill={color}>{vector}</text>
        )}
        {state.algorithm === 'matrix' && matrixRows.map((row, rowIndex) => (
          <text key={rowIndex} x={x} y={y + 20 + rowIndex * 11} fontSize={10} textAnchor="middle" fill={rejected ? '#e03131' : color}>{row}</text>
        ))}
      </g>
    )
  })}
</g>
<g>
  {pairs.map((pair) => {
    const { sendIndex, deliverIndex, send } = pair
    if (sendIndex >= idx) return null

    const fromIndex = nodes.findIndex((p) => p.id === send.from)
    const toIndex = nodes.findIndex((p) => p.id === send.to)
    if (fromIndex === -1 || toIndex === -1) return null

  const sharedSendIndex = (() => {
  if (!send.msgType.toUpperCase().includes('REQUEST')) return sendIndex
  const first = messages.find(
    ({ m }) => m.from === send.from && m.clock === send.clock
  )
  return first ? first.stepIndex : sendIndex
})()

const adjustedDeliverIndex = (() => {
  if (!send.msgType.toUpperCase().includes('REQUEST')) return deliverIndex
  return sharedSendIndex + (toIndex + 1) * 3
})()
const x1 = stepX(sharedSendIndex)
/*const t1 = stepY(sharedSendIndex)*/
    const y1 = processY(fromIndex)
    const x2 = stepX(deliverIndex)
    const y2 = processY(toIndex)
    const color = colorFor(send)

    const receiverClockAtDelivery = (() => {
  if (pair.deliver.clock !== undefined && pair.deliver !== pair.send) {
    return pair.deliver.clock
  }
  if (send.msgType.toUpperCase().includes('REQUEST')) {
    // ✅ clock du receiver AVANT réception = rejouer les nodeSteps jusqu'à sendIndex
    let clockBeforeReceive = 0
    steps.slice(0, sendIndex).forEach((s) => {
      if ((s as any).type === 'node') {
        const ns = s as NodeStateStep
        if (ns.nodeId === send.to && ns.state.clock !== undefined) {
          clockBeforeReceive = ns.state.clock
        }
      }
    })
    return Math.max(clockBeforeReceive, send.clock) + 1
  }
  return send.clock + 1
})()

    if (deliverIndex <= idx) {
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      return (
        <g key={`${send.id}-delivered`}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} markerEnd="url(#arrow)" />
          
          {/* label on arrow */}
          <rect x={mx - 28} y={my - 12} rx={6} width={56} height={20} fill="#fff" stroke={color} />
          <text x={mx} y={my + 5} fontSize={10} textAnchor="middle" fill="#000">
            {send.msgType}{send.clock !== undefined ? `@${send.clock}` : ''}
          </text>

            {/* ✅ send dot + clock on sender lane */}
          <circle cx={x1} cy={y1} r={5} fill={color} />
                {send.clock !== undefined && (
          <text x={x1} y={y1 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
            {send.clock}
          </text>
        )}

          {/* ✅ receive dot + max(Cj, Csend)+1 on receiver lane */}
          <circle cx={x2} cy={y2} r={5} fill={color} />
          {send.clock !== undefined && (
  <text x={x2} y={y2 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
    {receiverClockAtDelivery}
  </text>
)}
        </g>
      )
    } else {
      // in-flight
      const progress = Math.max(0, Math.min(1, (idx - sendIndex) / Math.max(1, deliverIndex - sendIndex)))
      const cx2 = x1 + (x2 - x1) * progress
      const cy2 = y1 + (y2 - y1) * progress
      const mx = (x1 + cx2) / 2
      const my = (y1 + cy2) / 2
      return (
        <g key={`${send.id}-inflight`}>
          <line x1={x1} y1={y1} x2={cx2} y2={cy2} stroke={color} strokeWidth={2} markerEnd="url(#arrow)" strokeDasharray="4 3" />
          <rect x={mx - 28} y={my - 12} rx={6} width={56} height={20} fill="#fff" stroke={color} />
          <text x={mx} y={my + 5} fontSize={11} textAnchor="middle" fill="#000">{send.msgType}</text>

          {/* ✅ send dot + clock always visible even in flight */}
          <circle cx={x1} cy={y1} r={5} fill={color} />
          {send.clock !== undefined && (
  <text x={x1} y={y1 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
    {send.clock}
  </text>
)}
        </g>
      )
    }
  })}
    </g>
    </svg>
  )
}

export default function GraphCanvas() {
  const { state } = useSim()
  return (state.algorithm === 'bully' || state.algorithm === 'token' || state.algorithm === 'suzuki')
    ? <NetworkCanvas />
    : <SequenceCanvas />
}
