import type {
  AlgorithmCinemaPayload,
  MessageStep,
  NarrationStep,
  NodeStateStep,
  CriticalSectionStep,
} from '../model/algorithmCinema'

let uid = 0
function id(prefix = 'm') { return `${prefix}-${++uid}` }

export type RicartScenario = {
  requester: number
  processes: number[]
  alsoRequesting: number[]  // peers qui demandent la SC en même temps
}

export function generateRicartAgrawalaCinema(scenario: RicartScenario): AlgorithmCinemaPayload {
  uid = 0
  const { requester, processes, alsoRequesting } = scenario
  const steps: Array<any> = []

  const clocks: Record<number, number> = {}
  processes.forEach((p) => { clocks[p] = 0 })

  function tick(at: number): number {
    clocks[at] += 1
    return clocks[at]
  }

  function receive(at: number, received: number): number {
    clocks[at] = Math.max(clocks[at], received) + 1
    return clocks[at]
  }

  function nodeStep(nodeId: number, extra?: object) {
    steps.push({
      type: 'node',
      id: id('ns'),
      nodeId,
      state: { clock: clocks[nodeId], ...extra },
    } as NodeStateStep)
  }

  function csStep(nodeId: number, action: 'enter' | 'leave') {
    steps.push({
      type: 'cs',
      id: id('cs'),
      nodeId,
      action,
    } as CriticalSectionStep)
  }

  const peers = processes.filter((p) => p !== requester)

  // ─── Phase 1 : tous les demandeurs broadcastent REQUEST ───────────────────

 
steps.push({
  type: 'narration',
  id: id('n'),
  text: `Process ${requester} requests CS`,
} as NarrationStep)

const requestTS: Record<number, number> = {}

// requester broadcast EN PREMIER
const tsRequester = tick(requester)
requestTS[requester] = tsRequester
nodeStep(requester)
peers.forEach((p) => {
  steps.push({
    type: 'message',
    id: id('msg'),
    from: requester,
    to: p,
    msgType: 'RA_REQUEST',
    clock: tsRequester,
  } as MessageStep)
})

// ✅ alsoRequesting : reçoit d'abord le REQUEST du requester, PUIS broadcast le sien
alsoRequesting.forEach((ar) => {
  steps.push({
    type: 'narration',
    id: id('n'),
    text: `Process ${ar} also requests CS`,
  } as NarrationStep)

  // ✅ reçoit REQUEST du requester en premier → max(0, tsRequester) + 1
  receive(ar, tsRequester)
  nodeStep(ar)

  // ✅ puis ticke et broadcast son propre REQUEST
  const tsAr = tick(ar)
  requestTS[ar] = tsAr
  nodeStep(ar)
  processes.filter((p) => p !== ar).forEach((p) => {
    steps.push({
      type: 'message',
      id: id('msg'),
      from: ar,
      to: p,
      msgType: 'RA_REQUEST',
      clock: tsAr,
    } as MessageStep)
  })
})
  // ─── Phase 2 : traitement des REQUEST par chaque process ─────────────────

  // Pour chaque process, déterminer qui a la priorité
  // Priorité : timestamp le plus bas, en cas d'égalité l'ID le plus bas
  function hasPriority(from: number, fromTS: number, over: number, overTS: number): boolean {
    if (fromTS !== overTS) return fromTS < overTS
    return from < over
  }

  const replyClocks: Record<string, number> = {}  // clé: `${from}-${to}`
  const deferred: Record<number, number[]> = {}   // deferred[peer] = liste des demandeurs qu'il a différé
  processes.forEach((p) => { deferred[p] = [] })

  // chaque process reçoit les REQUEST qui lui sont destinés
  processes.forEach((receiver) => {
    // demandeurs qui ont envoyé un REQUEST à ce receiver
    const requesters = [requester, ...alsoRequesting].filter((r) => r !== receiver)

    requesters.forEach((sender) => {
      receive(receiver, requestTS[sender])
      nodeStep(receiver)

      // receiver est-il lui-même demandeur ?
      const receiverIsRequesting = alsoRequesting.includes(receiver) || receiver === requester

      let grant = true
      if (receiverIsRequesting) {
        // accorder seulement si sender a priorité sur receiver
        grant = hasPriority(sender, requestTS[sender], receiver, requestTS[receiver])
      }

      if (grant) {
        const replyClock = tick(receiver)
        replyClocks[`${receiver}-${sender}`] = replyClock
        nodeStep(receiver)
        steps.push({
          type: 'message',
          id: id('msg'),
          from: receiver,
          to: sender,
          msgType: 'RA_REPLY',
          clock: replyClock,
        } as MessageStep)
      } else {
        // différé
        deferred[receiver].push(sender)
        steps.push({
          type: 'narration',
          id: id('n'),
          text: `Process ${receiver} defers REPLY to ${sender}`,
        } as NarrationStep)
      }
    })
  })

  // ─── Phase 3 : requester reçoit tous ses REPLY → entre en SC ─────────────

  const replySenders = peers.filter((p) => !deferred[p].includes(requester))
  replySenders.forEach((p) => {
    receive(requester, replyClocks[`${p}-${requester}`] ?? 0)
    steps.push({
      type: 'message',
      id: id('deliver'),
      from: p,
      to: requester,
      msgType: 'RA_REPLY',
      clock: clocks[requester],
    } as MessageStep)
    nodeStep(requester)
  })

  steps.push({
    type: 'narration',
    id: id('n'),
    text: `Process ${requester} received all replies — enters CS`,
  } as NarrationStep)

  // ✅ segment rouge — entrée en SC
  csStep(requester, 'enter')
  nodeStep(requester, { color: 'orange' })

  // ─── Phase 4 : RELEASE ────────────────────────────────────────────────────

  steps.push({
    type: 'narration',
    id: id('n'),
    text: `Process ${requester} leaves CS — sends RELEASE`,
  } as NarrationStep)

  // ✅ segment rouge — sortie de SC
  csStep(requester, 'leave')
  nodeStep(requester, { color: 'skyblue' })

  // envoie RELEASE uniquement aux peers différés
  deferred[requester].forEach((deferredPeer) => {
    const relClock = tick(requester)
    nodeStep(requester)
    steps.push({
      type: 'message',
      id: id('msg'),
      from: requester,
      to: deferredPeer,
      msgType: 'RA_RELEASE',
      clock: relClock,
    } as MessageStep)
  })

  // peers différés reçoivent RELEASE et entrent en SC à leur tour
  deferred[requester].forEach((deferredPeer) => {
    receive(deferredPeer, clocks[requester])
    nodeStep(deferredPeer)
    steps.push({
      type: 'narration',
      id: id('n'),
      text: `Process ${deferredPeer} receives RELEASE — enters CS`,
    } as NarrationStep)
    csStep(deferredPeer, 'enter')
    nodeStep(deferredPeer, { color: 'orange' })

    // puis quitte aussi
    csStep(deferredPeer, 'leave')
    nodeStep(deferredPeer, { color: 'skyblue' })
  })

  return {
    metadata: { name: 'Ricart-Agrawala', algo: 'Ricart-Agrawala' },
    steps,
  }
}

export default generateRicartAgrawalaCinema