import React from 'react'
import { useSim } from '../state/SimProvider'
import type { MessageStep, AlgorithmStep, NodeStateStep, CinemaNodeState } from '../model/algorithmCinema'

export default function GraphCanvas() {
  const { state } = useSim()
  const width = 900
  const height = 500
  const leftMargin = 120
  const rightMargin = 20
  const topMargin = 30
  const bottomMargin = 20

  const nodes = state.processes
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

  // collect message steps with their original index to place along time
  const messages: Array<{ stepIndex: number; m: MessageStep }> = []
  steps.forEach((s, i) => {
    if ((s as any).type === 'message') messages.push({ stepIndex: i, m: s as MessageStep })
  })

  // pair send/deliver steps: look for later message with same from/to/type
  const pairs: Array<{ sendIndex: number; deliverIndex: number; send: MessageStep; deliver: MessageStep }> = []
  const used = new Set<number>()
  for (let i = 0; i < messages.length; i++) {
    if (used.has(i)) continue
    const { stepIndex: sIdx, m } = messages[i]
    let found = -1
    for (let j = i + 1; j < messages.length; j++) {
      if (used.has(j)) continue
      const mj = messages[j].m
      if (mj.from === m.from && mj.to === m.to && String(mj.msgType) === String(m.msgType)) {
        found = j
        break
      }
    }
    if (found !== -1) {
      pairs.push({ sendIndex: sIdx, deliverIndex: messages[found].stepIndex, send: m, deliver: messages[found].m })
      used.add(i)
      used.add(found)
    } else {
      // no matching deliver found; treat as instantaneous at same step
      pairs.push({ sendIndex: sIdx, deliverIndex: sIdx + 1, send: m, deliver: m })
      used.add(i)
    }
  }

  // group all pairs by sender so outgoing arrows originate from the same tail point
  type Group = { from: number; baseSendIndex: number; items: typeof pairs[0][] }
  const groupsMap = new Map<number, typeof pairs[0][]>()
  for (const p of pairs) {
    const arr = groupsMap.get(p.send.from) || []
    arr.push(p)
    groupsMap.set(p.send.from, arr)
  }
  const groups: Group[] = []
  for (const [from, items] of groupsMap.entries()) {
    const baseSendIndex = items.reduce((min, it) => Math.min(min, it.sendIndex), Infinity)
    groups.push({ from, baseSendIndex: baseSendIndex === Infinity ? 0 : baseSendIndex, items })
  }

  // helper to color by type
  function colorFor(m: MessageStep) {
    const t = String(m.msgType || '').toUpperCase()
    if (t.includes('REQUEST')) return 'crimson'
    if (t.includes('REPLY')) return 'seagreen'
    return '#333'
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
      </defs>

      {/* time axis */}
      <g>
        <line x1={leftMargin} y1={topMargin - 10} x2={width - rightMargin} y2={topMargin - 10} stroke="#ddd" />
        {Array.from({ length: Math.min(20, maxSteps) }).map((_, i) => {
          const sx = leftMargin + (i / Math.min(20, maxSteps)) * usableWidth
          return <line key={i} x1={sx} y1={topMargin - 14} x2={sx} y2={topMargin - 6} stroke="#ccc" />
        })}
        <text x={leftMargin} y={topMargin - 18} fontSize={12} fontWeight={600}>Time / Steps</text>
      </g>

      {/* lanes and process labels */}
      <g>
        {nodes.map((n, i) => {
          const y = processY(i)
          return (
            <g key={n.id}>
              <text x={10} y={y + 5} fontSize={13} fontWeight={600}>{n.label ?? `P${n.id}`}</text>
              <line x1={leftMargin} y1={y} x2={width - rightMargin} y2={y} stroke="#e6e6e6" strokeWidth={2} />
                        {/* Clock badge */}
{nodeStates.get(n.id)?.clock !== undefined && (
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
      {/* messages for visible steps (paired send -> deliver), grouped by sender so tails share same origin */}
  
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
          <text x={x1} y={y1 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
            {send.clock}
          </text>

          {/* ✅ receive dot + max(Cj, Csend)+1 on receiver lane */}
          <circle cx={x2} cy={y2} r={5} fill={color} />
          <text x={x2} y={y2 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
            {receiverClockAtDelivery}
          </text>
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
          <text x={x1} y={y1 - 10} fontSize={11} textAnchor="middle" fill={color} fontWeight={600}>
            {send.clock}
          </text>
        </g>
      )
    }
  })}
    </g>
    </svg>
  )
}
